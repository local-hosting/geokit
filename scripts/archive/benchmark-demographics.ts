#!/usr/bin/env npx tsx
/**
 * Demographics Benchmark Script
 *
 * Measures performance of each step in the demographic data loading pipeline:
 * 1. ZIP code lookup (H3 index vs API reverse geocoding)
 * 2. Census API calls (individual ZIP lookups)
 * 3. Aggregation (combining multiple ZIPs)
 *
 * Usage: npx tsx scripts/archive/benchmark-demographics.ts
 */

import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { CensusDemographicsProvider } from '../src/api/providers/census-demographics-provider';
import { registerAPIProvider, getProviderForCapability } from '../src/api/providers/registry';
import { MapboxAPIProvider } from '../src/api/providers/mapbox-provider';
import * as zipModule from '../src/utils/demographics/zipcode';

const {
  findZipsInPolygon,
  findZipsInPolygonLocal,
  getZipForPoint,
  isH3IndexLoaded,
  clearZipCache,
  loadH3ZipIndex,
} = zipModule;
import { aggregateDemographics } from '../src/utils/demographics/aggregate';
import type { Polygon } from 'geojson';
import type { DemographicsResult } from '../src/api/providers/types';

// ============================================================================
// Test Data
// ============================================================================

// Sample location: Times Square, NYC
const NYC_LAT = 40.758;
const NYC_LNG = -73.9855;

// Sample polygon: ~15 minute drive around Times Square (approx)
const NYC_POLYGON: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-74.02, 40.72],
      [-73.95, 40.72],
      [-73.95, 40.8],
      [-74.02, 40.8],
      [-74.02, 40.72],
    ],
  ],
};

// Sample ZIP codes in NYC
const NYC_ZIPS = ['10001', '10002', '10003', '10004', '10005'];

// ============================================================================
// Benchmark Utilities
// ============================================================================

interface BenchmarkResult {
  name: string;
  duration: number;
  success: boolean;
  details?: Record<string, unknown>;
}

async function benchmark(name: string, fn: () => Promise<unknown>): Promise<BenchmarkResult> {
  const start = performance.now();
  let success = true;
  let result: unknown;

  try {
    result = await fn();
  } catch (error) {
    success = false;
    result = error;
  }

  const duration = performance.now() - start;

  return {
    name,
    duration,
    success,
    details: typeof result === 'object' ? (result as Record<string, unknown>) : { result },
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printResult(result: BenchmarkResult) {
  const status = result.success ? '✓' : '✗';
  const color = result.success ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`${color}${status}${reset} ${result.name}: ${formatDuration(result.duration)}`);

  if (result.details && Object.keys(result.details).length > 0) {
    const detailStr = JSON.stringify(result.details, null, 2)
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n');
    console.log(`    Details: ${detailStr.slice(4)}`);
  }
}

// ============================================================================
// Benchmarks
// ============================================================================

async function runBenchmarks() {
  console.log('\n=== Demographics Performance Benchmark ===\n');

  // Check if Mapbox API key is available
  const mapboxKey = process.env.MAPBOX_ACCESS_TOKEN || process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!mapboxKey) {
    console.log('⚠️  No MAPBOX_ACCESS_TOKEN found - API-based tests will be skipped\n');
  } else {
    // Initialize Mapbox provider for reverse geocoding
    const mapbox = new MapboxAPIProvider();
    await mapbox.initialize({ accessToken: mapboxKey });
    registerAPIProvider('mapbox', mapbox);
    console.log('✓ Mapbox provider initialized\n');
  }

  // Initialize Census provider
  const census = new CensusDemographicsProvider();
  await census.initialize({});
  registerAPIProvider('census', census);
  console.log('✓ Census provider initialized\n');

  const results: BenchmarkResult[] = [];

  // -------------------------------------------------------------------------
  // 1. H3 Index Check
  // -------------------------------------------------------------------------
  console.log('--- ZIP Code Lookup ---\n');

  results.push(
    await benchmark('H3 Index Status', async () => {
      const loaded = isH3IndexLoaded();
      return {
        loaded,
        message: loaded
          ? 'H3 index loaded (fast path)'
          : 'H3 index NOT loaded (will use slow API path)',
      };
    })
  );
  printResult(results[results.length - 1]);

  // Try to load the H3 index if not already loaded
  if (!isH3IndexLoaded()) {
    try {
      const { readFileSync } = await import('fs');
      const indexPath = resolve(__dirname, '../data/zip-h3-index.json');
      const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));

      loadH3ZipIndex(indexData);
      console.log('  → Loaded H3 index from disk\n');
    } catch (e) {
      console.log('  → Could not load H3 index:', e);
    }
  }

  // -------------------------------------------------------------------------
  // 2. ZIP lookup via H3 (if loaded)
  // -------------------------------------------------------------------------
  if (isH3IndexLoaded()) {
    results.push(
      await benchmark('findZipsInPolygonLocal (H3 index)', async () => {
        const zips = findZipsInPolygonLocal(NYC_POLYGON);
        return { zipCount: zips?.length || 0, zips: zips?.slice(0, 5) };
      })
    );
    printResult(results[results.length - 1]);

    // Compare with a larger polygon
    const LARGE_POLYGON: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-74.5, 40.4],
          [-73.5, 40.4],
          [-73.5, 41.2],
          [-74.5, 41.2],
          [-74.5, 40.4],
        ],
      ],
    };

    results.push(
      await benchmark('findZipsInPolygonLocal (larger polygon)', async () => {
        const zips = findZipsInPolygonLocal(LARGE_POLYGON);
        return { zipCount: zips?.length || 0 };
      })
    );
    printResult(results[results.length - 1]);
  }

  // -------------------------------------------------------------------------
  // 3. Single point reverse geocode (if Mapbox available)
  // -------------------------------------------------------------------------
  if (mapboxKey) {
    clearZipCache(); // Clear cache for accurate timing

    results.push(
      await benchmark('getZipForPoint (single reverse geocode)', async () => {
        const zip = await getZipForPoint(NYC_LAT, NYC_LNG);
        return { zip };
      })
    );
    printResult(results[results.length - 1]);

    // -------------------------------------------------------------------------
    // 4. findZipsInPolygon via API (slow path)
    // -------------------------------------------------------------------------
    clearZipCache();

    results.push(
      await benchmark('findZipsInPolygon (API fallback - 9 points)', async () => {
        const zips = await findZipsInPolygon(NYC_LAT, NYC_LNG, NYC_POLYGON);
        return { zipCount: zips.length, zips: zips.slice(0, 5) };
      })
    );
    printResult(results[results.length - 1]);

    // Cached version
    results.push(
      await benchmark('findZipsInPolygon (cached)', async () => {
        const zips = await findZipsInPolygon(NYC_LAT, NYC_LNG, NYC_POLYGON);
        return { zipCount: zips.length };
      })
    );
    printResult(results[results.length - 1]);
  }

  // -------------------------------------------------------------------------
  // 5. Census API - Single ZIP
  // -------------------------------------------------------------------------
  console.log('\n--- Census API Calls ---\n');

  census.clearCache();

  results.push(
    await benchmark('fetchZipDemographics (single ZIP, basic fields)', async () => {
      const data = await census.fetchZipDemographics('10001', ['basic']);
      return { hasData: !!data, population: data?.totalPopulation };
    })
  );
  printResult(results[results.length - 1]);

  results.push(
    await benchmark('fetchZipDemographics (single ZIP, all fields)', async () => {
      census.clearCache();
      const data = await census.fetchZipDemographics('10002', [
        'basic',
        'age',
        'language',
        'ethnicity',
      ]);
      return { hasData: !!data, population: data?.totalPopulation };
    })
  );
  printResult(results[results.length - 1]);

  // Cached version
  // Run multiple times to test true cache performance
  for (let i = 0; i < 3; i++) {
    results.push(
      await benchmark(`fetchZipDemographics (cached run ${i + 1})`, async () => {
        const data = await census.fetchZipDemographics('10001', ['basic']);
        return { hasData: !!data };
      })
    );
    printResult(results[results.length - 1]);
  }

  // -------------------------------------------------------------------------
  // 5b. Census API - Break down individual calls
  // -------------------------------------------------------------------------
  console.log('\n--- Census API Breakdown ---\n');

  const CENSUS_BASE_URL = 'https://api.census.gov/data/2023/acs/acs5';

  // Time just the network request
  results.push(
    await benchmark('Census API - raw fetch (basic vars only)', async () => {
      const url = `${CENSUS_BASE_URL}?get=NAME,B01001_001E,B19013_001E&for=zip%20code%20tabulation%20area:10001`;
      const start = performance.now();
      const response = await fetch(url);
      const fetchTime = performance.now() - start;

      const parseStart = performance.now();
      const data = await response.json();
      const parseTime = performance.now() - parseStart;

      return {
        fetchTime: `${fetchTime.toFixed(0)}ms`,
        parseTime: `${parseTime.toFixed(0)}ms`,
        dataRows: Array.isArray(data) ? data.length : 0,
      };
    })
  );
  printResult(results[results.length - 1]);

  // Time 4 parallel requests (simulating all field groups)
  results.push(
    await benchmark('Census API - 4 parallel fetches (all field groups)', async () => {
      const urls = [
        `${CENSUS_BASE_URL}?get=NAME,B01001_001E,B19013_001E&for=zip%20code%20tabulation%20area:10003`,
        `${CENSUS_BASE_URL}?get=B01001_005E,B01001_006E,B01001_007E&for=zip%20code%20tabulation%20area:10003`,
        `${CENSUS_BASE_URL}?get=C16001_001E,C16001_002E,C16001_003E&for=zip%20code%20tabulation%20area:10003`,
        `${CENSUS_BASE_URL}?get=B02001_001E,B02001_002E,B02001_003E&for=zip%20code%20tabulation%20area:10003`,
      ];

      const results = await Promise.all(urls.map((url) => fetch(url)));
      return {
        successCount: results.filter((r) => r.ok).length,
      };
    })
  );
  printResult(results[results.length - 1]);

  // -------------------------------------------------------------------------
  // 6. Census API - Multiple ZIPs (batched)
  // -------------------------------------------------------------------------
  console.log('\n--- Multiple ZIP Fetches ---\n');

  census.clearCache();

  results.push(
    await benchmark(`fetchZipDemographics x${NYC_ZIPS.length} ZIPs (sequential)`, async () => {
      const allResults: DemographicsResult[] = [];
      for (const zip of NYC_ZIPS) {
        const data = await census.fetchZipDemographics(zip, ['basic', 'age', 'language']);
        if (data) allResults.push(data);
      }
      return { zipsFetched: allResults.length };
    })
  );
  printResult(results[results.length - 1]);

  census.clearCache();

  results.push(
    await benchmark(`fetchZipDemographics x${NYC_ZIPS.length} ZIPs (parallel)`, async () => {
      const promises = NYC_ZIPS.map((zip) =>
        census.fetchZipDemographics(zip, ['basic', 'age', 'language'])
      );
      const allResults = (await Promise.all(promises)).filter((r): r is DemographicsResult => !!r);
      return { zipsFetched: allResults.length };
    })
  );
  printResult(results[results.length - 1]);

  // -------------------------------------------------------------------------
  // 7. Aggregation
  // -------------------------------------------------------------------------
  console.log('\n--- Aggregation ---\n');

  // Fetch some data first
  const demoResults: DemographicsResult[] = [];
  for (const zip of NYC_ZIPS) {
    const data = await census.fetchZipDemographics(zip, ['basic', 'age', 'language']);
    if (data) demoResults.push(data);
  }

  results.push(
    await benchmark(`aggregateDemographics (${demoResults.length} results)`, async () => {
      const aggregated = aggregateDemographics(demoResults);
      return { totalPopulation: aggregated?.totalPopulation };
    })
  );
  printResult(results[results.length - 1]);

  // -------------------------------------------------------------------------
  // 8. Full Pipeline (if Mapbox available)
  // -------------------------------------------------------------------------
  if (mapboxKey) {
    console.log('\n--- Full Pipeline ---\n');

    census.clearCache();
    clearZipCache();

    results.push(
      await benchmark('Full fetchDemographics (polygon, uncached)', async () => {
        const data = await census.fetchDemographics({
          polygon: NYC_POLYGON,
          latitude: NYC_LAT,
          longitude: NYC_LNG,
          fields: ['basic', 'age', 'language'],
        });
        return {
          hasData: !!data,
          population: data?.totalPopulation,
          aggregatedZips: (data as any)?.aggregatedZipcodes?.length,
        };
      })
    );
    printResult(results[results.length - 1]);

    results.push(
      await benchmark('Full fetchDemographics (polygon, cached)', async () => {
        const data = await census.fetchDemographics({
          polygon: NYC_POLYGON,
          latitude: NYC_LAT,
          longitude: NYC_LNG,
          fields: ['basic', 'age', 'language'],
        });
        return { hasData: !!data };
      })
    );
    printResult(results[results.length - 1]);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n=== Summary ===\n');

  const slowest = results
    .filter((r) => r.success)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 3);

  console.log('Slowest operations:');
  for (const r of slowest) {
    console.log(`  - ${r.name}: ${formatDuration(r.duration)}`);
  }

  console.log('\nCache stats:');
  const stats = census.getCacheStats();
  console.log(
    `  ZIP cache: ${stats.zip.size} entries, ${stats.zip.hits} hits, ${stats.zip.misses} misses`
  );
  console.log(
    `  Polygon cache: ${stats.polygon.size} entries, ${stats.polygon.hits} hits, ${stats.polygon.misses} misses`
  );

  console.log('\nRecommendations:');
  if (!isH3IndexLoaded()) {
    console.log('  ⚠️  Load the H3-to-ZIP index for instant ZIP lookups (no API calls needed)');
  }
  console.log('  - Cache demographics results aggressively (they change yearly)');
  console.log('  - Prefetch common ZIP codes at app startup');
  console.log('  - Consider batching Census API calls');
}

// Run benchmarks
runBenchmarks().catch(console.error);
