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
 * Census API allows up to 50 variables per request
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
    'B25077_001E', // Median home value
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
    'C16001_003E', // Spanish: speak English very well
    'C16001_004E', // Spanish: speak English less than very well
    'C16001_005E', // French, Haitian, Cajun: very well
    'C16001_006E', // French, Haitian, Cajun: less well
    'C16001_007E', // German, West Germanic: very well
    'C16001_008E', // German, West Germanic: less well
    'C16001_009E', // Russian, Polish, Slavic: very well
    'C16001_010E', // Russian, Polish, Slavic: less well
    'C16001_011E', // Other Indo-European: very well
    'C16001_012E', // Other Indo-European: less well
    'C16001_013E', // Korean: very well
    'C16001_014E', // Korean: less well
    'C16001_015E', // Chinese: very well
    'C16001_016E', // Chinese: less well
    'C16001_017E', // Vietnamese: very well
    'C16001_018E', // Vietnamese: less well
    'C16001_019E', // Tagalog: very well
    'C16001_020E', // Tagalog: less well
    'C16001_021E', // Other Asian/Pacific Island: very well
    'C16001_022E', // Other Asian/Pacific Island: less well
    'C16001_023E', // Arabic: very well
    'C16001_024E', // Arabic: less well
    'C16001_025E', // Other/unspecified: very well
    'C16001_026E', // Other/unspecified: less well
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
  // NEW: Internet subscription type (B28011)
  internet: [
    'B28011_001E', // Total households
    'B28011_002E', // With an Internet subscription
    'B28011_004E', // Cellular data plan only
    'B28011_008E', // Without an Internet subscription
  ],
  // NEW: Commute/transportation to work (B08301)
  commute: [
    'B08301_001E', // Total workers 16+
    'B08301_003E', // Car, truck, or van - drove alone
    'B08301_004E', // Car, truck, or van - carpooled
    'B08301_010E', // Public transportation
    'B08301_021E', // Worked from home
  ],
  // NEW: Occupation (C24010)
  occupation: [
    'C24010_001E', // Total civilian employed 16+
    'C24010_003E', // Management, business, science, arts (male)
    'C24010_039E', // Management, business, science, arts (female)
    'C24010_019E', // Service occupations (male)
    'C24010_055E', // Service occupations (female)
    'C24010_027E', // Sales and office (male)
    'C24010_063E', // Sales and office (female)
    'C24010_030E', // Natural resources, construction, maintenance (male)
    'C24010_066E', // Natural resources, construction, maintenance (female)
    'C24010_034E', // Production, transportation, material moving (male)
    'C24010_070E', // Production, transportation, material moving (female)
  ],
  // NEW: Telephone service (B28001)
  phone: [
    'B28001_001E', // Total households
    'B28001_002E', // With telephone service
    'B28001_005E', // With landline only
    'B28001_006E', // With cellular only
    'B28001_011E', // No telephone service
  ],
  // NEW: Vehicle access (B08201)
  vehicles: [
    'B08201_001E', // Total households
    'B08201_002E', // No vehicle available
    'B08201_003E', // 1 vehicle available
    'B08201_004E', // 2 vehicles available
    'B08201_005E', // 3 vehicles available
    'B08201_006E', // 4 or more vehicles available
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

      // Find non-English languages (C16001: each language = very well + less than very well)
      const MINORITY_LANGUAGE_PCT_THRESHOLD = 3;
      let topLanguage: string | undefined;
      let topLanguagePct: number | undefined;
      let secondLanguage: string | undefined;
      let secondLanguagePct: number | undefined;
      let otherLanguages: { name: string; pct: number }[] | undefined;

      const langPop = getValue('C16001_001E') || 0; // Population 5+ years
      if (langPop > 0) {
        const languages = [
          {
            name: 'Spanish',
            count: (getValue('C16001_003E') || 0) + (getValue('C16001_004E') || 0),
          },
          {
            name: 'French / Haitian / Cajun',
            count: (getValue('C16001_005E') || 0) + (getValue('C16001_006E') || 0),
          },
          {
            name: 'German',
            count: (getValue('C16001_007E') || 0) + (getValue('C16001_008E') || 0),
          },
          {
            name: 'Russian / Polish / Slavic',
            count: (getValue('C16001_009E') || 0) + (getValue('C16001_010E') || 0),
          },
          {
            name: 'Other Indo-European',
            count: (getValue('C16001_011E') || 0) + (getValue('C16001_012E') || 0),
          },
          {
            name: 'Korean',
            count: (getValue('C16001_013E') || 0) + (getValue('C16001_014E') || 0),
          },
          {
            name: 'Chinese',
            count: (getValue('C16001_015E') || 0) + (getValue('C16001_016E') || 0),
          },
          {
            name: 'Vietnamese',
            count: (getValue('C16001_017E') || 0) + (getValue('C16001_018E') || 0),
          },
          {
            name: 'Tagalog',
            count: (getValue('C16001_019E') || 0) + (getValue('C16001_020E') || 0),
          },
          {
            name: 'Other Asian / Pacific Island',
            count: (getValue('C16001_021E') || 0) + (getValue('C16001_022E') || 0),
          },
          {
            name: 'Arabic',
            count: (getValue('C16001_023E') || 0) + (getValue('C16001_024E') || 0),
          },
          {
            name: 'Other languages',
            count: (getValue('C16001_025E') || 0) + (getValue('C16001_026E') || 0),
          },
        ];

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
        // Additional minority languages over threshold (exclude top two)
        const rest = sortedLangs.slice(2);
        const overThreshold = rest
          .map((l) => ({ name: l.name, pct: Math.round((l.count / langPop) * 100) }))
          .filter((l) => l.pct > MINORITY_LANGUAGE_PCT_THRESHOLD);
        if (overThreshold.length > 0) {
          otherLanguages = overThreshold;
        }
      }

      // Calculate internet access percentages (B28011)
      const internetTotal = getValue('B28011_001E') || 0;
      let broadbandPct: number | undefined;
      let cellularOnlyPct: number | undefined;
      let noInternetPct: number | undefined;

      if (internetTotal > 0) {
        const withInternet = getValue('B28011_002E') || 0;
        const cellularOnly = getValue('B28011_004E') || 0;
        const noInternet = getValue('B28011_008E') || 0;
        broadbandPct = Math.round((withInternet / internetTotal) * 100);
        cellularOnlyPct = Math.round((cellularOnly / internetTotal) * 100);
        noInternetPct = Math.round((noInternet / internetTotal) * 100);
      }

      // Calculate commute/transportation percentages (B08301)
      const commuteTotal = getValue('B08301_001E') || 0;
      let droveAlonePct: number | undefined;
      let carpoolPct: number | undefined;
      let publicTransitPct: number | undefined;
      let workedFromHomePct: number | undefined;

      if (commuteTotal > 0) {
        droveAlonePct = Math.round(((getValue('B08301_003E') || 0) / commuteTotal) * 100);
        carpoolPct = Math.round(((getValue('B08301_004E') || 0) / commuteTotal) * 100);
        publicTransitPct = Math.round(((getValue('B08301_010E') || 0) / commuteTotal) * 100);
        workedFromHomePct = Math.round(((getValue('B08301_021E') || 0) / commuteTotal) * 100);
      }

      // Calculate occupation percentages (C24010) - male + female combined
      const occupationTotal = getValue('C24010_001E') || 0;
      let professionalPct: number | undefined;
      let servicePct: number | undefined;
      let salesOfficePct: number | undefined;
      let constructionPct: number | undefined;
      let productionPct: number | undefined;

      if (occupationTotal > 0) {
        const professional = (getValue('C24010_003E') || 0) + (getValue('C24010_039E') || 0);
        const service = (getValue('C24010_019E') || 0) + (getValue('C24010_055E') || 0);
        const salesOffice = (getValue('C24010_027E') || 0) + (getValue('C24010_063E') || 0);
        const construction = (getValue('C24010_030E') || 0) + (getValue('C24010_066E') || 0);
        const production = (getValue('C24010_034E') || 0) + (getValue('C24010_070E') || 0);

        professionalPct = Math.round((professional / occupationTotal) * 100);
        servicePct = Math.round((service / occupationTotal) * 100);
        salesOfficePct = Math.round((salesOffice / occupationTotal) * 100);
        constructionPct = Math.round((construction / occupationTotal) * 100);
        productionPct = Math.round((production / occupationTotal) * 100);
      }

      // Calculate phone service percentages (B28001)
      const phoneTotal = getValue('B28001_001E') || 0;
      let landlinePct: number | undefined;
      let cellphoneOnlyPct: number | undefined;
      let noPhonePct: number | undefined;

      if (phoneTotal > 0) {
        landlinePct = Math.round(((getValue('B28001_005E') || 0) / phoneTotal) * 100);
        cellphoneOnlyPct = Math.round(((getValue('B28001_006E') || 0) / phoneTotal) * 100);
        noPhonePct = Math.round(((getValue('B28001_011E') || 0) / phoneTotal) * 100);
      }

      // Calculate vehicle access percentages (B08201)
      const vehicleTotal = getValue('B08201_001E') || 0;
      let noVehiclePct: number | undefined;
      let oneVehiclePct: number | undefined;
      let twoOrMoreVehiclesPct: number | undefined;

      if (vehicleTotal > 0) {
        noVehiclePct = Math.round(((getValue('B08201_002E') || 0) / vehicleTotal) * 100);
        oneVehiclePct = Math.round(((getValue('B08201_003E') || 0) / vehicleTotal) * 100);
        const twoPlus =
          (getValue('B08201_004E') || 0) +
          (getValue('B08201_005E') || 0) +
          (getValue('B08201_006E') || 0);
        twoOrMoreVehiclesPct = Math.round((twoPlus / vehicleTotal) * 100);
      }

      const result: DemographicsResult = {
        totalPopulation: getValue('B01001_001E'),
        medianHouseholdIncome: getValue('B19013_001E'),
        medianRent: getValue('B25064_001E'),
        medianAge: getValue('B01002_001E'),
        medianHomeValue: getValue('B25077_001E'),
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
        otherLanguages,
        // Internet access
        broadbandPct,
        cellularOnlyPct,
        noInternetPct,
        // Commute/transportation
        droveAlonePct,
        carpoolPct,
        publicTransitPct,
        workedFromHomePct,
        // Occupation
        professionalPct,
        servicePct,
        salesOfficePct,
        constructionPct,
        productionPct,
        // Phone service
        landlinePct,
        cellphoneOnlyPct,
        noPhonePct,
        // Vehicle access
        noVehiclePct,
        oneVehiclePct,
        twoOrMoreVehiclesPct,
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
