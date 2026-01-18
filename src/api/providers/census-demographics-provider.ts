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
} from './types';
import {
  findZipsInPolygon,
  getZipForPoint,
  estimateTravelRadius,
} from '../../utils/demographics/zipcode';
import { aggregateDemographics } from '../../utils/demographics/aggregate';
import { ProviderCache, roundForCacheKey, type CacheStats } from './cache';
import type { Polygon, MultiPolygon } from 'geojson';

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
   */
  async fetchZipDemographics(zipcode: string): Promise<DemographicsResult | null> {
    // Check cache first
    const cached = this.zipCache.get(zipcode);
    if (cached) {
      return cached;
    }

    try {
      // Split into two requests to stay under Census API variable limit (~50)
      const basicVariables = [
        'NAME',
        'B01001_001E', // Total population
        'B19013_001E', // Median household income
        'B25077_001E', // Median home value
        'B25064_001E', // Median gross rent
        'B01002_001E', // Median age
        'B25010_001E', // Average household size
        'B25003_001E', // Total occupied housing units
        'B25003_002E', // Owner-occupied housing units
        'B25003_003E', // Renter-occupied housing units
      ].join(',');

      const ageVariables = [
        // Age groups for generation calculation (Male)
        'B01001_005E', // 10-14
        'B01001_006E', // 15-17
        'B01001_007E', // 18-19
        'B01001_008E', // 20
        'B01001_009E', // 21
        'B01001_010E', // 22-24
        'B01001_011E', // 25-29
        'B01001_012E', // 30-34
        'B01001_013E', // 35-39
        'B01001_014E', // 40-44
        'B01001_015E', // 45-49
        'B01001_016E', // 50-54
        'B01001_017E', // 55-59
        'B01001_018E', // 60-61
        'B01001_019E', // 62-64
        'B01001_020E', // 65-66
        'B01001_021E', // 67-69
        'B01001_022E', // 70-74
        'B01001_023E', // 75-79
        // Age groups for generation calculation (Female)
        'B01001_029E', // 10-14
        'B01001_030E', // 15-17
        'B01001_031E', // 18-19
        'B01001_032E', // 20
        'B01001_033E', // 21
        'B01001_034E', // 22-24
        'B01001_035E', // 25-29
        'B01001_036E', // 30-34
        'B01001_037E', // 35-39
        'B01001_038E', // 40-44
        'B01001_039E', // 45-49
        'B01001_040E', // 50-54
        'B01001_041E', // 55-59
        'B01001_042E', // 60-61
        'B01001_043E', // 62-64
        'B01001_044E', // 65-66
        'B01001_045E', // 67-69
        'B01001_046E', // 70-74
        'B01001_047E', // 75-79
      ].join(',');

      // Language spoken at home (C16001 collapsed table)
      const languageVariables = [
        'C16001_001E', // Total population 5 years and over
        'C16001_002E', // Speak only English
        'C16001_003E', // Spanish
        'C16001_006E', // French, Haitian, or Cajun
        'C16001_009E', // German or other West Germanic
        'C16001_012E', // Russian, Polish, or other Slavic
        'C16001_015E', // Other Indo-European
        'C16001_018E', // Korean
        'C16001_021E', // Chinese (incl. Mandarin, Cantonese)
        'C16001_024E', // Vietnamese
        'C16001_027E', // Tagalog (incl. Filipino)
        'C16001_030E', // Other Asian and Pacific Island
        'C16001_033E', // Arabic
        'C16001_036E', // Other languages
      ].join(',');

      const baseUrl = 'https://api.census.gov/data/2023/acs/acs5';
      const forClause = `for=zip%20code%20tabulation%20area:${zipcode}`;

      // Fetch all requests in parallel
      const [basicResponse, ageResponse, langResponse] = await Promise.all([
        fetch(`${baseUrl}?get=${basicVariables}&${forClause}`),
        fetch(`${baseUrl}?get=${ageVariables}&${forClause}`),
        fetch(`${baseUrl}?get=${languageVariables}&${forClause}`),
      ]);

      if (!basicResponse.ok) {
        throw new Error(`Census API error: ${basicResponse.statusText}`);
      }

      const basicData = await basicResponse.json();

      // Parse Census API response (it returns arrays, not objects)
      if (!Array.isArray(basicData) || basicData.length < 2) {
        return null;
      }

      const basicHeaders = basicData[0] as string[];
      const basicValues = basicData[1] as string[];

      // Parse age data if available
      let ageHeaders: string[] = [];
      let ageValues: string[] = [];
      if (ageResponse.ok) {
        const ageData = await ageResponse.json();
        if (Array.isArray(ageData) && ageData.length >= 2) {
          ageHeaders = ageData[0] as string[];
          ageValues = ageData[1] as string[];
        }
      }

      // Parse language data if available
      let langHeaders: string[] = [];
      let langValues: string[] = [];
      if (langResponse.ok) {
        const langData = await langResponse.json();
        if (Array.isArray(langData) && langData.length >= 2) {
          langHeaders = langData[0] as string[];
          langValues = langData[1] as string[];
        }
      }

      const getValue = (varName: string): number | undefined => {
        // Check basic data first
        let index = basicHeaders.indexOf(varName);
        if (index !== -1) {
          const value = parseFloat(basicValues[index]);
          return isNaN(value) ? undefined : value;
        }
        // Then check age data
        index = ageHeaders.indexOf(varName);
        if (index !== -1) {
          const value = parseFloat(ageValues[index]);
          return isNaN(value) ? undefined : value;
        }
        // Then check language data
        index = langHeaders.indexOf(varName);
        if (index !== -1) {
          const value = parseFloat(langValues[index]);
          return isNaN(value) ? undefined : value;
        }
        return undefined;
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
        zipcode,
        dataSource: 'census',
        year: 2023, // ACS 5-year estimates (2019-2023)
        lastUpdated: new Date().toISOString(),
      };

      // Cache the result
      this.zipCache.set(zipcode, result);

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
    // Polygon-based query: find ZIPs in polygon and aggregate
    if (options.polygon) {
      return this.fetchPolygonDemographics(options);
    }

    // Direct ZIP code query
    if (options.zipcode) {
      return this.fetchZipDemographics(options.zipcode);
    }

    // Point-based query: geocode to ZIP first
    if (options.latitude !== undefined && options.longitude !== undefined) {
      const zipcode = await getZipForPoint(options.latitude, options.longitude);
      if (!zipcode) {
        console.warn('[Census Demographics] Could not geocode point to ZIP code');
        return null;
      }
      return this.fetchZipDemographics(zipcode);
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

    // Generate cache key and check cache
    const cacheKey = getPolygonCacheKey(options.polygon, centerLat, centerLng, radiusMeters);
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
        const batchResults = await Promise.all(batch.map((zip) => this.fetchZipDemographics(zip)));

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
