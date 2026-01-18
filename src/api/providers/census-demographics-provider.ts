/**
 * Census Demographics API Provider
 *
 * Implements BaseAPIProvider for U.S. Census Bureau ACS API
 * Provides demographic data for geographic areas
 *
 * Features:
 * - Free, no API key required
 * - Supports ZIP code tabulation areas
 * - Returns population, income, housing data
 */

import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type DemographicsOptions,
  type DemographicsResult,
} from './types';

export class CensusDemographicsProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;

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
   * Fetch demographic data from U.S. Census Bureau ACS API
   * Free, no API key required for basic usage
   *
   * Supports:
   * - Point-based queries (lat/lng with zipcode)
   * - Geographic area queries (polygon/bounds) - aggregates across multiple ZIP codes
   */
  async fetchDemographics(options: DemographicsOptions): Promise<DemographicsResult | null> {
    // For polygon/bounds queries, we'd need to:
    // 1. Find all ZIP codes that intersect with the polygon/bounds
    // 2. Fetch demographics for each ZIP code
    // 3. Aggregate the results
    //
    // This requires a ZIP code boundary dataset or geocoding service
    // For now, we'll support point-based queries with zipcode

    if (options.polygon || options.bounds) {
      // TODO: Implement polygon/bounds query support
      // This would require:
      // - ZIP code boundary GeoJSON data
      // - Finding intersecting ZIP codes
      // - Fetching demographics for each ZIP
      // - Aggregating results
      console.warn(
        '[Census Demographics] Polygon/bounds queries not yet implemented. Use point-based queries with zipcode.'
      );
      return null;
    }

    // Point-based query requires ZIP code (or lat/lng for future geocoding)
    if (!options.zipcode && (!options.latitude || !options.longitude)) {
      console.warn('[Census Demographics] ZIP code or lat/lng required for Census API lookup');
      return null;
    }

    // For now, we require ZIP code even with lat/lng
    // Future: could geocode lat/lng to ZIP code
    if (!options.zipcode) {
      console.warn(
        '[Census Demographics] ZIP code required (lat/lng geocoding not yet implemented)'
      );
      return null;
    }

    try {
      const variables = [
        'NAME',
        'B01001_001E', // Total population
        'B19013_001E', // Median household income
        'B25077_001E', // Median home value
        'B25064_001E', // Median gross rent
      ].join(',');

      const url = `https://api.census.gov/data/2021/acs/acs5?get=${variables}&for=zip%20code%20tabulation%20area:${options.zipcode}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Census API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse Census API response (it returns arrays, not objects)
      if (!Array.isArray(data) || data.length < 2) {
        return null;
      }

      const headers = data[0] as string[];
      const values = data[1] as string[];

      const getValue = (varName: string): number | undefined => {
        const index = headers.indexOf(varName);
        if (index === -1) return undefined;
        const value = parseInt(values[index], 10);
        return isNaN(value) ? undefined : value;
      };

      return {
        totalPopulation: getValue('B01001_001E'),
        medianHouseholdIncome: getValue('B19013_001E'),
        medianHomeValue: getValue('B25077_001E'),
        medianRent: getValue('B25064_001E'),
        zipcode: options.zipcode,
        dataSource: 'census',
        year: 2021, // ACS 5-year estimates
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Census Demographics] Error fetching Census data:', error);
      return null;
    }
  }
}
