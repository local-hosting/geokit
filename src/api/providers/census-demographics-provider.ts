/**
 * Census Demographics API Provider
 *
 * Implements BaseAPIProvider for U.S. Census Bureau ACS API
 * Provides demographic data for geographic areas
 *
 * Features:
 * - Free, no API key required
 * - Supports ZIP code tabulation areas
 * - Supports polygon-based queries (finds ZIPs in polygon, aggregates)
 * - Returns population, income, housing data
 * - Built-in caching for ZIP and polygon queries
 */

import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type DemographicsOptions,
  type DemographicsResult,
  type DemographicField,
} from './types';
import {
  findZipsInPolygon,
  getZipForPoint,
  estimateTravelRadius,
  getLocalDemographics,
} from '../../utils/demographics/zipcode';
import { aggregateDemographics } from '../../utils/demographics/aggregate';
import { ProviderCache, roundForCacheKey, type CacheStats } from './cache';
import type { Polygon, MultiPolygon } from 'geojson';

// ============================================================================
// Census API Configuration
// ============================================================================

const CENSUS_BASE_URL = 'https://api.census.gov/data/2023/acs/acs5';
const DEFAULT_FIELDS: DemographicField[] = ['basic', 'age', 'language'];

/** Census API variable groups by field type
 * All from acs5 detailed tables (B/C tables) - can be combined in single request
 * basic (7) + age (16) + language (3) = 26 variables
 *
 * Age uses key brackets (male only, doubled for estimate):
 * - Gen Z: 18-24
 * - Millennials: 25-44
 * - Gen X: 45-64
 * - Boomers: 65-74
 */
const CENSUS_VARIABLES: Record<DemographicField, string[]> = {
  basic: [
    'B01001_001E', // Total population
    'B19013_001E', // Median household income
    'B25064_001E', // Median gross rent
    'B01002_001E', // Median age
    'B25003_001E', // Total occupied housing units
    'B25003_002E', // Owner-occupied
    'B25003_003E', // Renter-occupied
  ],
  age: [
    // Male age groups (will double for total estimate)
    'B01001_007E', // 18-19 (Gen Z)
    'B01001_008E', // 20 (Gen Z)
    'B01001_009E', // 21 (Gen Z)
    'B01001_010E', // 22-24 (Gen Z)
    'B01001_011E', // 25-29 (Millennials)
    'B01001_012E', // 30-34 (Millennials)
    'B01001_013E', // 35-39 (Millennials)
    'B01001_014E', // 40-44 (Millennials)
    'B01001_015E', // 45-49 (Gen X)
    'B01001_016E', // 50-54 (Gen X)
    'B01001_017E', // 55-59 (Gen X)
    'B01001_018E', // 60-61 (Gen X)
    'B01001_019E', // 62-64 (Gen X/Boomers)
    'B01001_020E', // 65-66 (Boomers)
    'B01001_021E', // 67-69 (Boomers)
    'B01001_022E', // 70-74 (Boomers)
  ],
  language: [
    'C16001_001E', // Total population 5+
    'C16001_003E', // Spanish
    'C16001_021E', // Chinese
  ],
  ethnicity: [
    'B02001_001E', // Total population
    'B02001_002E', // White
    'B02001_003E', // Black
    'B02001_004E', // Native American
    'B02001_005E', // Asian
    'B02001_006E', // Pacific Islander
    'B02001_007E', // Other
    'B02001_008E', // Two or more
    'B03003_001E', // Hispanic origin total
    'B03003_003E', // Hispanic or Latino
  ],
};

// ============================================================================
// Census Response Parser
// ============================================================================

/**
 * Generate a cache key for a polygon based on its coordinates
 * Uses a simple hash of the first few coordinate points
 */
function getPolygonCacheKey(
  polygon: Polygon | MultiPolygon,
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): string {
  // Get first ring coordinates for hashing
  const coords =
    polygon.type === 'Polygon' ? polygon.coordinates[0] : polygon.coordinates[0]?.[0] || [];

  // Sample a few points for the hash (don't need all of them)
  const samplePoints = coords.slice(0, 5);
  const coordHash = samplePoints
    .map(([lng, lat]) => `${roundForCacheKey(lng, 4)},${roundForCacheKey(lat, 4)}`)
    .join('|');

  return `poly:${roundForCacheKey(centerLat, 4)},${roundForCacheKey(centerLng, 4)}:${radiusMeters}:${coordHash}`;
}

export class CensusDemographicsProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;

  // Cache for individual ZIP code demographics (1 hour TTL - demographics don't change frequently)
  private zipCache = new ProviderCache<DemographicsResult>({
    maxEntries: 500,
    ttlMs: 60 * 60 * 1000,
    name: 'CensusZipCache',
  });

  // Cache for polygon query results
  private polygonCache = new ProviderCache<DemographicsResult>({
    maxEntries: 100,
    ttlMs: 60 * 60 * 1000,
    name: 'CensusPolygonCache',
  });

  getName(): string {
    return 'census-demographics';
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;
    // Census API is free and doesn't require an API key
  }

  getCapabilities(): APICapability[] {
    return ['demographics'];
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.zipCache.clear();
    this.polygonCache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { zip: CacheStats; polygon: CacheStats } {
    return {
      zip: this.zipCache.getStats(),
      polygon: this.polygonCache.getStats(),
    };
  }

  /**
   * Fetch demographic data for a single ZIP code (with caching)
   * @param zipcode - ZIP code to fetch
   * @param fields - Which data fields to include (default: basic, age, language)
   */
  async fetchZipDemographics(
    zipcode: string,
    fields: DemographicField[] = DEFAULT_FIELDS
  ): Promise<DemographicsResult | null> {
    // Check pre-loaded demographics cache first (instant, no API call)
    const preloaded = getLocalDemographics(zipcode);
    if (preloaded) {
      // Add zipcode and metadata to match expected format
      const result: DemographicsResult = {
        ...preloaded,
        zipcode,
        dataSource: 'census-local',
        year: 2023,
        lastUpdated: new Date().toISOString(),
      };
      return result;
    }

    // Check runtime cache (cache key includes fields)
    const cacheKey = `${zipcode}:${fields.sort().join(',')}`;
    const cached = this.zipCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const forClause = `for=zip%20code%20tabulation%20area:${zipcode}`;

      // Combine all requested variables into as few requests as possible
      // Census API allows up to 50 variables per request
      const MAX_VARS_PER_REQUEST = 50;
      const allVariables: string[] = [];
      for (const field of fields) {
        allVariables.push(...CENSUS_VARIABLES[field]);
      }

      // Deduplicate variables (some may be shared across field groups)
      const uniqueVariables = [...new Set(allVariables)];

      // Split into chunks of MAX_VARS_PER_REQUEST
      const variableChunks: string[][] = [];
      for (let i = 0; i < uniqueVariables.length; i += MAX_VARS_PER_REQUEST) {
        variableChunks.push(uniqueVariables.slice(i, i + MAX_VARS_PER_REQUEST));
      }

      // Fetch all chunks in parallel (usually 1-2 requests instead of 3-4)
      const fetchPromises = variableChunks.map((vars) =>
        fetch(`${CENSUS_BASE_URL}?get=${vars.join(',')}&${forClause}`)
      );

      if (fetchPromises.length === 0) {
        return null;
      }

      const responses = await Promise.all(fetchPromises);

      // Parse all responses and merge into single lookup
      // Handle errors and empty responses gracefully
      const parsedData: unknown[] = [];
      for (const response of responses) {
        if (!response.ok) {
          // Skip failed responses (ZIP might not exist in Census data)
          continue;
        }
        try {
          const text = await response.text();
          if (text && text.trim().length > 0) {
            parsedData.push(JSON.parse(text));
          }
        } catch {
          // Skip responses that can't be parsed (empty, truncated, etc.)
        }
      }

      if (parsedData.length === 0) {
        // No valid data for this ZIP - cache null to avoid repeated lookups
        return null;
      }
      const allHeaders: string[] = [];
      const allValues: string[] = [];

      for (const data of parsedData) {
        if (Array.isArray(data) && data.length >= 2) {
          allHeaders.push(...(data[0] as string[]));
          allValues.push(...(data[1] as string[]));
        }
      }

      // Return null if no valid data was parsed
      if (allHeaders.length === 0) {
        return null;
      }

      const getValue = (varName: string): number | undefined => {
        const index = allHeaders.indexOf(varName);
        if (index === -1) return undefined;
        const value = parseFloat(allValues[index]);
        // Census uses -666666666 (and other large negative values) for "data not available"
        // Filter out NaN and any negative values for fields that should never be negative
        if (isNaN(value) || value < 0) return undefined;
        return value;
      };

      // Calculate owner vs renter percentages
      const totalHousingUnits = getValue('B25003_001E');
      const ownerOccupied = getValue('B25003_002E');
      const renterOccupied = getValue('B25003_003E');

      let ownerOccupiedPct: number | undefined;
      let renterOccupiedPct: number | undefined;

      if (totalHousingUnits && totalHousingUnits > 0) {
        if (ownerOccupied !== undefined) {
          ownerOccupiedPct = Math.round((ownerOccupied / totalHousingUnits) * 100);
        }
        if (renterOccupied !== undefined) {
          renterOccupiedPct = Math.round((renterOccupied / totalHousingUnits) * 100);
        }
      }

      // Calculate generation percentages using male age groups (doubled for estimate)
      // This halves our variable count while maintaining reasonable accuracy
      const totalPop = getValue('B01001_001E') || 0;

      // Gen Z: 18-24 (male counts × 2)
      const genZ =
        2 *
        ((getValue('B01001_007E') || 0) + // 18-19
          (getValue('B01001_008E') || 0) + // 20
          (getValue('B01001_009E') || 0) + // 21
          (getValue('B01001_010E') || 0)); // 22-24

      // Millennials: 25-44 (male counts × 2)
      const millennials =
        2 *
        ((getValue('B01001_011E') || 0) + // 25-29
          (getValue('B01001_012E') || 0) + // 30-34
          (getValue('B01001_013E') || 0) + // 35-39
          (getValue('B01001_014E') || 0)); // 40-44

      // Gen X: 45-64 (male counts × 2)
      const genX =
        2 *
        ((getValue('B01001_015E') || 0) + // 45-49
          (getValue('B01001_016E') || 0) + // 50-54
          (getValue('B01001_017E') || 0) + // 55-59
          (getValue('B01001_018E') || 0) + // 60-61
          (getValue('B01001_019E') || 0)); // 62-64

      // Boomers: 65-74 (male counts × 2)
      const boomers =
        2 *
        ((getValue('B01001_020E') || 0) + // 65-66
          (getValue('B01001_021E') || 0) + // 67-69
          (getValue('B01001_022E') || 0)); // 70-74

      // Find top two generations
      let topGeneration: string | undefined;
      let topGenerationPct: number | undefined;
      let secondGeneration: string | undefined;
      let secondGenerationPct: number | undefined;

      if (totalPop > 0) {
        const generations = [
          { name: 'Gen Z', count: genZ },
          { name: 'Millennials', count: millennials },
          { name: 'Gen X', count: genX },
          { name: 'Boomers', count: boomers },
        ].filter((g) => g.count > 0);

        // Sort by count descending
        generations.sort((a, b) => b.count - a.count);

        if (generations.length > 0) {
          topGeneration = generations[0].name;
          topGenerationPct = Math.round((generations[0].count / totalPop) * 100);
        }
        if (generations.length > 1) {
          secondGeneration = generations[1].name;
          secondGenerationPct = Math.round((generations[1].count / totalPop) * 100);
        }
      }

      // Find top two non-English languages
      let topLanguage: string | undefined;
      let topLanguagePct: number | undefined;
      let secondLanguage: string | undefined;
      let secondLanguagePct: number | undefined;

      const langPop = getValue('C16001_001E') || 0; // Population 5+ years
      if (langPop > 0) {
        const languages = [
          { name: 'Spanish', count: getValue('C16001_003E') || 0 },
          { name: 'Chinese', count: getValue('C16001_021E') || 0 },
        ];

        // Sort by count descending and filter out zero counts
        const sortedLangs = languages.filter((l) => l.count > 0).sort((a, b) => b.count - a.count);

        if (sortedLangs.length > 0) {
          const topLang = sortedLangs[0];
          topLanguage = topLang.name;
          topLanguagePct = Math.round((topLang.count / langPop) * 100);
        }
        if (sortedLangs.length > 1) {
          const secondLang = sortedLangs[1];
          secondLanguage = secondLang.name;
          secondLanguagePct = Math.round((secondLang.count / langPop) * 100);
        }
      }

      const result: DemographicsResult = {
        totalPopulation: getValue('B01001_001E'),
        medianHouseholdIncome: getValue('B19013_001E'),
        medianRent: getValue('B25064_001E'),
        medianAge: getValue('B01002_001E'),
        ownerOccupiedPct,
        renterOccupiedPct,
        topGeneration,
        topGenerationPct,
        secondGeneration,
        secondGenerationPct,
        topLanguage,
        topLanguagePct,
        secondLanguage,
        secondLanguagePct,
        zipcode,
        dataSource: 'census',
        year: 2023, // ACS 5-year estimates (2019-2023)
        lastUpdated: new Date().toISOString(),
      };

      // Cache the result
      this.zipCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.warn(`[Census Demographics] Error fetching ZIP ${zipcode}:`, error);
      return null;
    }
  }

  /**
   * Fetch demographic data from U.S. Census Bureau ACS API
   * Free, no API key required for basic usage
   *
   * Supports:
   * - Point-based queries (lat/lng - geocodes to ZIP)
   * - ZIP code queries (direct lookup)
   * - Polygon queries (finds ZIPs in polygon, aggregates results)
   */
  async fetchDemographics(options: DemographicsOptions): Promise<DemographicsResult | null> {
    const fields = options.fields || DEFAULT_FIELDS;

    // Polygon-based query: find ZIPs in polygon and aggregate
    if (options.polygon) {
      return this.fetchPolygonDemographics(options);
    }

    // Direct ZIP code query
    if (options.zipcode) {
      return this.fetchZipDemographics(options.zipcode, fields);
    }

    // Point-based query: geocode to ZIP first
    if (options.latitude !== undefined && options.longitude !== undefined) {
      const zipcode = await getZipForPoint(options.latitude, options.longitude);
      if (!zipcode) {
        console.warn('[Census Demographics] Could not geocode point to ZIP code');
        return null;
      }
      return this.fetchZipDemographics(zipcode, fields);
    }

    console.warn('[Census Demographics] ZIP code, lat/lng, or polygon required');
    return null;
  }

  /**
   * Fetch demographics for a polygon area (with caching)
   * Finds ZIP codes within the polygon and aggregates their demographics
   */
  private async fetchPolygonDemographics(
    options: DemographicsOptions
  ): Promise<DemographicsResult | null> {
    if (!options.polygon) return null;

    const fields = options.fields || DEFAULT_FIELDS;

    // Need a center point to search from
    const centerLat = options.latitude;
    const centerLng = options.longitude;

    if (centerLat === undefined || centerLng === undefined) {
      console.warn('[Census Demographics] Polygon query requires center lat/lng');
      return null;
    }

    // Estimate search radius based on travel time if provided
    const radiusMeters = options.radiusMiles
      ? options.radiusMiles * 1609.34
      : estimateTravelRadius(30, 'driving'); // Default 30 min drive

    // Generate cache key and check cache (include fields in key)
    const baseCacheKey = getPolygonCacheKey(options.polygon, centerLat, centerLng, radiusMeters);
    const cacheKey = `${baseCacheKey}:${fields.sort().join(',')}`;
    const cached = this.polygonCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Find ZIP codes within the polygon area
      const zipcodes = await findZipsInPolygon(centerLat, centerLng, options.polygon, {
        mode: options.travelMode,
        timeMinutes: options.travelTimeMinutes,
      });

      if (zipcodes.length === 0) {
        return null;
      }

      // Fetch demographics for all ZIP codes
      // Local data is instant, only API calls need batching
      const BATCH_SIZE = 20;
      const results: DemographicsResult[] = [];

      for (let i = 0; i < zipcodes.length; i += BATCH_SIZE) {
        const batch = zipcodes.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (zip) => {
            // Check runtime cache first
            const zipCached = this.zipCache.get(`${zip}:${fields.sort().join(',')}`);
            if (zipCached) {
              return zipCached;
            }
            // Check pre-loaded local data
            const local = getLocalDemographics(zip);
            if (local) {
              return {
                ...local,
                zipcode: zip,
                dataSource: 'census-local',
                year: 2023,
                lastUpdated: new Date().toISOString(),
              } as DemographicsResult;
            }
            // Fall back to API
            return this.fetchZipDemographics(zip, fields);
          })
        );

        for (const result of batchResults) {
          if (result) results.push(result);
        }
      }

      if (results.length === 0) {
        return null;
      }

      // Aggregate results (weighted by population)
      const aggregated = aggregateDemographics(results);

      if (aggregated) {
        aggregated.dataSource = 'census-aggregated';
        // Store the ZIP codes that were aggregated
        aggregated.aggregatedZipcodes = results.map((r) => r.zipcode).filter(Boolean) as string[];
      }

      // Cache the aggregated result
      if (aggregated) {
        this.polygonCache.set(cacheKey, aggregated);
      }

      return aggregated;
    } catch (error) {
      console.error('[Census Demographics] Error fetching polygon demographics:', error);
      return null;
    }
  }
}
