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
} from '../../utils/demographics/zipcode';
import { aggregateDemographics } from '../../utils/demographics/aggregate';
import { ProviderCache, roundForCacheKey, type CacheStats } from './cache';
import type { Polygon, MultiPolygon } from 'geojson';

// ============================================================================
// Census API Configuration
// ============================================================================

const CENSUS_BASE_URL = 'https://api.census.gov/data/2023/acs/acs5';
const DEFAULT_FIELDS: DemographicField[] = ['basic', 'age', 'language'];

/** Census API variable groups by field type */
const CENSUS_VARIABLES: Record<DemographicField, string[]> = {
  basic: [
    'NAME',
    'B01001_001E', // Total population
    'B19013_001E', // Median household income
    'B25077_001E', // Median home value
    'B25064_001E', // Median gross rent
    'B01002_001E', // Median age
    'B25010_001E', // Average household size
    'B25003_001E', // Total occupied housing units
    'B25003_002E', // Owner-occupied
    'B25003_003E', // Renter-occupied
  ],
  age: [
    // Male age groups
    'B01001_005E',
    'B01001_006E',
    'B01001_007E',
    'B01001_008E',
    'B01001_009E',
    'B01001_010E',
    'B01001_011E',
    'B01001_012E',
    'B01001_013E',
    'B01001_014E',
    'B01001_015E',
    'B01001_016E',
    'B01001_017E',
    'B01001_018E',
    'B01001_019E',
    'B01001_020E',
    'B01001_021E',
    'B01001_022E',
    'B01001_023E',
    // Female age groups
    'B01001_029E',
    'B01001_030E',
    'B01001_031E',
    'B01001_032E',
    'B01001_033E',
    'B01001_034E',
    'B01001_035E',
    'B01001_036E',
    'B01001_037E',
    'B01001_038E',
    'B01001_039E',
    'B01001_040E',
    'B01001_041E',
    'B01001_042E',
    'B01001_043E',
    'B01001_044E',
    'B01001_045E',
    'B01001_046E',
    'B01001_047E',
  ],
  language: [
    'C16001_001E', // Total population 5+
    'C16001_002E', // English only
    'C16001_003E', // Spanish
    'C16001_006E', // French
    'C16001_009E', // German
    'C16001_012E', // Slavic
    'C16001_015E', // Other Indo-European
    'C16001_018E', // Korean
    'C16001_021E', // Chinese
    'C16001_024E', // Vietnamese
    'C16001_027E', // Tagalog
    'C16001_030E', // Other Asian/Pacific
    'C16001_033E', // Arabic
    'C16001_036E', // Other
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
    // Check cache first (cache key includes fields)
    const cacheKey = `${zipcode}:${fields.sort().join(',')}`;
    const cached = this.zipCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const forClause = `for=zip%20code%20tabulation%20area:${zipcode}`;

      // Fetch only requested field groups in parallel
      const fetchPromises = fields.map((field) =>
        fetch(`${CENSUS_BASE_URL}?get=${CENSUS_VARIABLES[field].join(',')}&${forClause}`)
      );

      if (fetchPromises.length === 0) {
        return null;
      }

      const responses = await Promise.all(fetchPromises);

      // Check for errors
      for (const response of responses) {
        if (!response.ok) {
          throw new Error(`Census API error: ${response.statusText}`);
        }
      }

      // Parse all responses and merge into single lookup
      const parsedData = await Promise.all(responses.map((r) => r.json()));
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
        return isNaN(value) ? undefined : value;
      };

      const includeEthnicity = fields.includes('ethnicity');

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

      // Calculate generation percentages
      // Based on 2023 ACS data, using approximate age ranges:
      // Gen Z: 11-28 (born 1995-2012), Millennials: 29-44 (born 1981-1994)
      // Gen X: 45-60 (born 1963-1978), Boomers: 61-79 (born 1944-1962)
      const totalPop = getValue('B01001_001E') || 0;

      // Sum male + female for each age group
      const getAgeSum = (maleVar: string, femaleVar: string): number => {
        return (getValue(maleVar) || 0) + (getValue(femaleVar) || 0);
      };

      // Gen Z (ages 10-29 as approximation for 12-27)
      const genZ =
        getAgeSum('B01001_005E', 'B01001_029E') + // 10-14
        getAgeSum('B01001_006E', 'B01001_030E') + // 15-17
        getAgeSum('B01001_007E', 'B01001_031E') + // 18-19
        getAgeSum('B01001_008E', 'B01001_032E') + // 20
        getAgeSum('B01001_009E', 'B01001_033E') + // 21
        getAgeSum('B01001_010E', 'B01001_034E') + // 22-24
        getAgeSum('B01001_011E', 'B01001_035E'); // 25-29

      // Millennials (ages 30-44 as approximation for 28-43)
      const millennials =
        getAgeSum('B01001_012E', 'B01001_036E') + // 30-34
        getAgeSum('B01001_013E', 'B01001_037E') + // 35-39
        getAgeSum('B01001_014E', 'B01001_038E'); // 40-44

      // Gen X (ages 45-59 as approximation for 44-59)
      const genX =
        getAgeSum('B01001_015E', 'B01001_039E') + // 45-49
        getAgeSum('B01001_016E', 'B01001_040E') + // 50-54
        getAgeSum('B01001_017E', 'B01001_041E'); // 55-59

      // Boomers (ages 60-79 as approximation for 60-78)
      const boomers =
        getAgeSum('B01001_018E', 'B01001_042E') + // 60-61
        getAgeSum('B01001_019E', 'B01001_043E') + // 62-64
        getAgeSum('B01001_020E', 'B01001_044E') + // 65-66
        getAgeSum('B01001_021E', 'B01001_045E') + // 67-69
        getAgeSum('B01001_022E', 'B01001_046E') + // 70-74
        getAgeSum('B01001_023E', 'B01001_047E'); // 75-79

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
        ];

        // Sort by count descending
        generations.sort((a, b) => b.count - a.count);

        const top = generations[0];
        topGeneration = top.name;
        topGenerationPct = Math.round((top.count / totalPop) * 100);

        if (generations.length > 1) {
          const second = generations[1];
          secondGeneration = second.name;
          secondGenerationPct = Math.round((second.count / totalPop) * 100);
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
          { name: 'French', count: getValue('C16001_006E') || 0 },
          { name: 'German', count: getValue('C16001_009E') || 0 },
          { name: 'Slavic', count: getValue('C16001_012E') || 0 },
          { name: 'Korean', count: getValue('C16001_018E') || 0 },
          { name: 'Chinese', count: getValue('C16001_021E') || 0 },
          { name: 'Vietnamese', count: getValue('C16001_024E') || 0 },
          { name: 'Tagalog', count: getValue('C16001_027E') || 0 },
          { name: 'Arabic', count: getValue('C16001_033E') || 0 },
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

      // Calculate top two ethnicities (only if ethnicity data was requested)
      let topEthnicity: string | undefined;
      let topEthnicityPct: number | undefined;
      let secondEthnicity: string | undefined;
      let secondEthnicityPct: number | undefined;

      if (includeEthnicity) {
        const racePop = getValue('B02001_001E') || 0;
        const hispanicPop = getValue('B03003_003E') || 0;

        if (racePop > 0) {
          const whitePop = getValue('B02001_002E') || 0;
          const nonHispanicWhite = Math.max(0, whitePop - hispanicPop * 0.9);

          const ethnicities = [
            { name: 'White', count: nonHispanicWhite },
            { name: 'Hispanic', count: hispanicPop },
            { name: 'Black', count: getValue('B02001_003E') || 0 },
            { name: 'Asian', count: getValue('B02001_005E') || 0 },
            { name: 'Mixed', count: getValue('B02001_008E') || 0 },
            {
              name: 'Native',
              count: (getValue('B02001_004E') || 0) + (getValue('B02001_006E') || 0),
            },
          ];

          const sortedEthnicities = ethnicities
            .filter((e) => e.count > 0)
            .sort((a, b) => b.count - a.count);

          if (sortedEthnicities.length > 0) {
            const top = sortedEthnicities[0];
            topEthnicity = top.name;
            topEthnicityPct = Math.round((top.count / racePop) * 100);
          }
          if (sortedEthnicities.length > 1) {
            const second = sortedEthnicities[1];
            secondEthnicity = second.name;
            secondEthnicityPct = Math.round((second.count / racePop) * 100);
          }
        }
      }

      const result: DemographicsResult = {
        totalPopulation: getValue('B01001_001E'),
        medianHouseholdIncome: getValue('B19013_001E'),
        medianHomeValue: getValue('B25077_001E'),
        medianRent: getValue('B25064_001E'),
        medianAge: getValue('B01002_001E'),
        averageHouseholdSize: getValue('B25010_001E'),
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
        topEthnicity,
        topEthnicityPct,
        secondEthnicity,
        secondEthnicityPct,
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
      const zipcodes = await findZipsInPolygon(centerLat, centerLng, options.polygon, radiusMeters);

      if (zipcodes.length === 0) {
        return null;
      }

      // Fetch demographics for each ZIP code (with concurrency limit)
      // Individual ZIP results are cached by fetchZipDemographics
      const BATCH_SIZE = 5;
      const results: DemographicsResult[] = [];

      for (let i = 0; i < zipcodes.length; i += BATCH_SIZE) {
        const batch = zipcodes.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((zip) => this.fetchZipDemographics(zip, fields))
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
        (aggregated as any).aggregatedZipcodes = results.map((r) => r.zipcode).filter(Boolean);
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
