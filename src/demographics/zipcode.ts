/**
 * ZIP Code Utilities for Demographics
 *
 * Functions to find and filter ZIP codes for demographic queries.
 *
 * Two modes:
 * 1. H3 Index (fast) - Uses pre-computed H3 cell → ZIP mapping for instant lookups
 * 2. API Fallback (slow) - Uses Mapbox reverse geocoding if index not available
 *
 * To enable fast mode, load the H3-to-ZIP index (from CDN, lockers, or pipeline):
 * ```typescript
 * loadH3ZipIndex(indexData);
 * // CDN: /cell/index.json + tier shards (/cell/r{N}/{cellId}); compile source stays r5
 * ```
 */

import type { Polygon, MultiPolygon } from 'geojson';
import { latLngToCell } from 'h3-js';
import { haversineMeters } from '../index.js';
import { pointInGeometry } from '../index.js';
import { getProviderForCapability } from '../api/providers/registry.js';
import { ensureGeocodingRouterReady } from '../api/providers/setup-capability-routers.js';
import { polygonToH3 } from '../utils/h3/index.js';
import { getBounds } from '../utils/bounds/index.js';

/**
 * H3-to-ZIP index for instant lookups
 * Loaded lazily when first needed
 */
let h3ZipIndex: Record<string, string[]> | null = null;
/** Native zip-h3-index resolution (r5); platform grid rolls up via @twinfile/geo. */
const H3_INDEX_RESOLUTION = 5;

/**
 * Simple LRU cache for polygonToH3 results
 * Key is polygon hash, value is H3 cells
 */
const polygonH3Cache = new Map<string, string[]>();
const POLYGON_CACHE_MAX_SIZE = 50;

function getPolygonHash(polygon: Polygon | MultiPolygon): string {
  // Simple hash based on first few coordinates
  const coords =
    polygon.type === 'Polygon'
      ? polygon.coordinates[0]
      : polygon.coordinates[0]?.[0] || [];
  const sample = coords.slice(0, 4);
  return sample
    .map(([lng, lat]) => `${lng.toFixed(4)},${lat.toFixed(4)}`)
    .join('|');
}

/**
 * Pre-fetched demographics data for instant lookups
 * Loaded from local data files (no Census API calls needed)
 */
let demographicsData: Record<string, any> | null = null;

/**
 * Load pre-fetched demographics data into memory
 * @param data - Demographics data keyed by ZIP code
 */
export function loadDemographicsData(data: Record<string, any>): void {
  // Merge with existing data (allows loading multiple market files)
  // Use Object.assign for better performance than spread operator
  if (demographicsData) {
    Object.assign(demographicsData, data);
  } else {
    demographicsData = data;
  }
}

/**
 * Load demographics data from URL
 */
/**
 * Check if any demographics data is loaded
 */
export function isDemographicsDataLoaded(): boolean {
  return demographicsData !== null;
}

/**
 * Get local demographics for a ZIP code
 * Returns null if not in local data
 */
export function getLocalDemographics(zipcode: string): any | null {
  if (!demographicsData) return null;
  return demographicsData[zipcode] || null;
}

/**
 * Find ZIPs in a polygon using embedded H3 cells in demographics data
 * This is an alternative to using the separate H3 index file
 * Returns null if demographics data doesn't have H3 cells embedded
 */
export function findZipsFromEmbeddedH3(h3Cells: Set<string>): string[] | null {
  if (!demographicsData) return null;

  // Check if demographics data has embedded H3 cells
  const firstZip = Object.keys(demographicsData)[0];
  if (!firstZip || !demographicsData[firstZip]?.h3) {
    return null; // No embedded H3 cells
  }

  // Find all ZIPs whose H3 cell matches one in the polygon
  const matchingZips: string[] = [];
  for (const [zipcode, data] of Object.entries(demographicsData)) {
    if (data?.h3 && h3Cells.has(data.h3)) {
      matchingZips.push(zipcode);
    }
  }

  return matchingZips;
}

// Legacy aliases for backward compatibility
export const getCachedDemographics = getLocalDemographics;
export const isDemographicsCacheLoaded = isDemographicsDataLoaded;

/**
 * Load the H3-to-ZIP index from data object
 *
 * @param indexData - H3 cell to ZIP code mapping
 *
 * @example
 * ```typescript
 * const indexData = await fetch('/data/zip-h3-index.json').then(r => r.json());
 * loadH3ZipIndex(indexData);
 * ```
 */
export function loadH3ZipIndex(indexData: Record<string, string[]>): void {
  if (!h3ZipIndex) {
    h3ZipIndex = indexData;
    return;
  }
  // Merge new entries into existing index (supports incremental loading)
  for (const [cell, zips] of Object.entries(indexData)) {
    const existing = h3ZipIndex[cell];
    if (!existing) {
      h3ZipIndex[cell] = zips;
    } else {
      for (const zip of zips) {
        if (!existing.includes(zip)) existing.push(zip);
      }
    }
  }
}

/**
 * Load the H3-to-ZIP index from a URL
 *
 * @param url - URL to fetch the index JSON from
 * @returns Promise that resolves when index is loaded
 *
 * @example
 * ```typescript
 * await loadH3ZipIndexFromUrl('/data/zip-h3-index.json');
 * // Now findZipsInPolygon will use instant H3 lookups
 * ```
 */
export async function loadH3ZipIndexFromUrl(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const indexData = await response.json();
    loadH3ZipIndex(indexData);
  } catch (error) {
    console.warn(`[H3 Index] Failed to load from ${url}:`, error);
    throw error;
  }
}

/**
 * Check if H3 index is loaded
 */
export function isH3IndexLoaded(): boolean {
  return h3ZipIndex !== null;
}

/**
 * Get H3 index statistics (for debugging)
 */
export function getH3IndexStats(): {
  loaded: boolean;
  cellCount: number;
  zipCount: number;
} | null {
  if (!h3ZipIndex) {
    return { loaded: false, cellCount: 0, zipCount: 0 };
  }
  return {
    loaded: true,
    cellCount: Object.keys(h3ZipIndex).length,
    zipCount: Object.values(h3ZipIndex).reduce(
      (sum, zips) => sum + zips.length,
      0
    ),
  };
}

/**
 * Get H3 cells that cover a polygon (with caching)
 * Shared between H3 index lookup and embedded H3 lookup
 */
function getPolygonH3Cells(polygon: Polygon | MultiPolygon): string[] {
  const polygonHash = getPolygonHash(polygon);
  let allCells = polygonH3Cache.get(polygonHash);

  if (!allCells) {
    allCells = [];
    if (polygon.type === 'Polygon') {
      allCells = polygonToH3(polygon, H3_INDEX_RESOLUTION) ?? [];
    } else {
      // MultiPolygon: process each polygon and combine cells
      for (const coords of polygon.coordinates) {
        const subPolygon: Polygon = { type: 'Polygon', coordinates: coords };
        const cells = polygonToH3(subPolygon, H3_INDEX_RESOLUTION);
        allCells.push(...cells);
      }
    }

    // Add vertex samples to catch edges
    const outerRing =
      polygon.type === 'Polygon'
        ? polygon.coordinates[0]
        : polygon.coordinates[0]?.[0] || [];
    const sampleInterval = Math.max(1, Math.floor(outerRing.length / 8));
    for (let i = 0; i < outerRing.length; i += sampleInterval) {
      const [lng, lat] = outerRing[i];
      try {
        const cell = latLngToCell(lat, lng, H3_INDEX_RESOLUTION);
        if (!allCells.includes(cell)) {
          allCells.push(cell);
        }
      } catch {
        // Skip invalid coordinates
      }
    }

    // Cache result (with size limit)
    if (polygonH3Cache.size >= POLYGON_CACHE_MAX_SIZE) {
      const firstKey = polygonH3Cache.keys().next().value;
      if (firstKey) polygonH3Cache.delete(firstKey);
    }
    polygonH3Cache.set(polygonHash, allCells);
  }

  return allCells;
}

/**
 * Find ZIP codes using H3 index (instant, no API calls)
 * Returns null if neither H3 index nor embedded H3 data available
 *
 * Tries two approaches:
 * 1. Separate H3 index file (h3ZipIndex) - traditional approach
 * 2. Embedded H3 cells in demographics data - no separate file needed
 *
 * Falls back to API if neither is available.
 */
export function findZipsInPolygonLocal(
  polygon: Polygon | MultiPolygon
): string[] | null {
  // Get H3 cells for the polygon (cached)
  const allCells = getPolygonH3Cells(polygon);
  const cellSet = new Set(allCells);

  // APPROACH 1: Try embedded H3 cells in demographics data first
  // This eliminates the need for the separate 692KB H3 index file
  if (demographicsData) {
    const embeddedResult = findZipsFromEmbeddedH3(cellSet);
    if (embeddedResult !== null && embeddedResult.length > 0) {
      return embeddedResult;
    }
  }

  // APPROACH 2: Use separate H3 index if loaded
  if (!h3ZipIndex) {
    return null; // No H3 data available, fall back to API
  }

  try {
    const zips = new Set<string>();

    // Collect ZIPs from H3 cells (already computed and cached above)
    for (const cell of allCells) {
      const cellZips = h3ZipIndex[cell];
      if (cellZips) {
        for (const zip of cellZips) {
          zips.add(zip);
        }
      }
    }

    // Fallback: Sample centroid for very small polygons
    if (zips.size === 0) {
      const outerRing =
        polygon.type === 'Polygon'
          ? polygon.coordinates[0]
          : polygon.coordinates[0]?.[0] || [];

      if (outerRing.length >= 3) {
        let sumLat = 0;
        let sumLng = 0;
        for (const [lng, lat] of outerRing) {
          sumLat += lat;
          sumLng += lng;
        }
        const centroidLat = sumLat / outerRing.length;
        const centroidLng = sumLng / outerRing.length;

        try {
          const cell = latLngToCell(
            centroidLat,
            centroidLng,
            H3_INDEX_RESOLUTION
          );
          const cellZips = h3ZipIndex[cell];
          if (cellZips) {
            for (const zip of cellZips) {
              zips.add(zip);
            }
          }
        } catch {
          // Skip invalid centroid
        }
      }
    }

    return Array.from(zips);
  } catch {
    return null; // Error, fall back to API
  }
}

/**
 * ZIP code centroid with location
 */
export interface ZipCentroid {
  zipcode: string;
  lat: number;
  lng: number;
}

/**
 * Cache for ZIP code lookups (avoid repeated API calls)
 * Using LRU cache with size limit to prevent memory leaks
 */
import { GeoCache } from '../index.js';
const zipCache = new GeoCache<ZipCentroid[]>({
  maxEntries: 200,
  ttlMs: 30 * 60 * 1000, // 30 minutes
  name: 'ZipLookupCache',
});

/**
 * Get ZIP code for a point using the registered geocoding provider (Mapbox)
 * Uses existing API key configuration with full CORS support
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns ZIP code string or null
 */
export async function getZipForPoint(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    await ensureGeocodingRouterReady();
    const provider = getProviderForCapability('geocoding');

    if (!provider) {
      console.warn('[ZIP] No geocoding provider available');
      return null;
    }

    // Use reverse geocoding to get the postal code
    if (typeof provider.reverseGeocode === 'function') {
      const result = await provider.reverseGeocode({
        lat,
        lng,
        types: ['postcode'], // Request postal code specifically
      });

      if (result?.postcode) {
        // US ZIP codes are 5 digits, sometimes with -XXXX extension
        // Extract just the 5-digit part
        const match = result.postcode.match(/^\d{5}/);
        return match ? match[0] : result.postcode;
      }
    }

    return null;
  } catch (error) {
    console.warn('[ZIP] Error getting ZIP for point:', error);
    return null;
  }
}

/**
 * Find ZIP codes within a radius of a point by sampling the area
 * Uses a grid sampling approach to find multiple ZIPs
 *
 * @param lat - Center latitude
 * @param lng - Center longitude
 * @param radiusMeters - Search radius in meters
 * @param sampleCount - Number of sample points (default 9 for 3x3 grid)
 * @returns Array of unique ZIP codes found
 */
export async function findZipsInRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
  sampleCount = 9
): Promise<string[]> {
  const cacheKey = `radius:${lat.toFixed(4)},${lng.toFixed(4)},${radiusMeters}`;
  const cached = zipCache.get(cacheKey);
  if (cached) {
    return cached.map(z => z.zipcode);
  }

  const zips = new Set<string>();

  // Create a grid of sample points
  const gridSize = Math.ceil(Math.sqrt(sampleCount));
  const step = (radiusMeters * 2) / (gridSize - 1);

  // Convert meters to approximate degrees (rough approximation)
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const stepLat = step / metersPerDegreeLat;
  const stepLng = step / metersPerDegreeLng;

  const samplePoints: Array<[number, number]> = [];

  // Generate grid points
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const sampleLat = lat - radiusMeters / metersPerDegreeLat + i * stepLat;
      const sampleLng = lng - radiusMeters / metersPerDegreeLng + j * stepLng;

      // Only include points within the radius
      const distance = haversineMeters([lat, lng])([sampleLat, sampleLng]);
      if (distance <= radiusMeters) {
        samplePoints.push([sampleLat, sampleLng]);
      }
    }
  }

  // Always include center point
  samplePoints.unshift([lat, lng]);

  // Fetch ZIPs for sample points (with concurrency limit)
  const BATCH_SIZE = 3;
  for (let i = 0; i < samplePoints.length; i += BATCH_SIZE) {
    const batch = samplePoints.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(([pLat, pLng]) => getZipForPoint(pLat, pLng))
    );

    for (const zip of results) {
      if (zip) zips.add(zip);
    }
  }

  const zipArray = Array.from(zips);

  // Cache the results
  zipCache.set(
    cacheKey,
    zipArray.map(z => ({ zipcode: z, lat, lng }))
  );

  return zipArray;
}

/**
 * Filter ZIP centroids by polygon containment
 * Returns ZIPs whose centroids fall within the polygon
 *
 * @param zips - Array of ZIP centroids
 * @param polygon - Polygon or MultiPolygon to filter by
 * @returns Filtered array of ZIP centroids
 */
export function filterZipsByPolygon(
  zips: ZipCentroid[],
  polygon: Polygon | MultiPolygon
): ZipCentroid[] {
  return zips.filter(zip => pointInGeometry([zip.lat, zip.lng], polygon));
}

/**
 * Find ZIP codes within an isochrone polygon
 *
 * Uses H3 index for instant lookups if available (no API calls).
 * Falls back to strategic API sampling if index not loaded.
 *
 * @param centerLat - Center latitude (store location)
 * @param centerLng - Center longitude (store location)
 * @param polygon - Isochrone polygon (the actual travel area)
 * @param options - Optional cache hints (mode, timeMinutes) for better caching
 * @returns Array of ZIP codes within the polygon
 */
export async function findZipsInPolygon(
  centerLat: number,
  centerLng: number,
  polygon: Polygon | MultiPolygon,
  options?: { mode?: string; timeMinutes?: number }
): Promise<string[]> {
  // FAST PATH: Use H3 index if available (instant, no API calls)
  const localResult = findZipsInPolygonLocal(polygon);
  if (localResult !== null) {
    return localResult;
  }

  // SLOW PATH: Fall back to API-based sampling (H3 index not loaded)
  // SLOW PATH: Fall back to API-based sampling
  // Get the outer ring of the polygon
  const outerRing =
    polygon.type === 'Polygon'
      ? polygon.coordinates[0]
      : polygon.coordinates[0]?.[0] || [];

  if (outerRing.length < 3) {
    return [];
  }

  // Generate cache key - use store + mode + time if available (most specific)
  // Fall back to polygon bounds if mode/time not provided
  let cacheKey: string;
  if (options?.mode && options?.timeMinutes) {
    // Best cache key: store location + mode + time (covers all isochrone variations)
    cacheKey = `iso:${centerLat.toFixed(4)},${centerLng.toFixed(4)}:${options.mode}:${options.timeMinutes}`;
  } else {
    // Fallback: polygon bounds (use shared getBounds / Turf)
    const b = getBounds([polygon]);
    const [minLng, minLat, maxLng, maxLat] = b ?? [0, 0, 0, 0];
    cacheKey = `poly3:${centerLat.toFixed(4)},${centerLng.toFixed(4)}:${minLng.toFixed(3)},${minLat.toFixed(3)},${maxLng.toFixed(3)},${maxLat.toFixed(3)}`;
  }
  const cached = zipCache.get(cacheKey);
  if (cached) {
    return cached.map(z => z.zipcode);
  }

  // Find points on polygon perimeter closest to each cardinal/diagonal direction
  const findPerimeterPoint = (targetAngle: number): [number, number] | null => {
    let bestPoint: [number, number] | null = null;
    let bestAngleDiff = Infinity;

    for (const [lng, lat] of outerRing) {
      const angle = Math.atan2(lat - centerLat, lng - centerLng);
      const angleDiff = Math.abs(
        ((angle - targetAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      );
      if (angleDiff < bestAngleDiff) {
        bestAngleDiff = angleDiff;
        bestPoint = [lat, lng];
      }
    }
    return bestPoint;
  };

  // Strategic sample points: center + 8 directional edges
  const samplePoints: Array<[number, number]> = [[centerLat, centerLng]];

  // Cardinal directions (N, E, S, W) and diagonals (NE, SE, SW, NW)
  const angles = [
    Math.PI / 2, // N
    0, // E
    -Math.PI / 2, // S
    Math.PI, // W
    Math.PI / 4, // NE
    -Math.PI / 4, // SE
    (-3 * Math.PI) / 4, // SW
    (3 * Math.PI) / 4, // NW
  ];

  for (const angle of angles) {
    const point = findPerimeterPoint(angle);
    if (point) {
      samplePoints.push(point);
    }
  }

  // Fetch ALL points in parallel (only 9 points, no batching needed)
  const results = await Promise.all(
    samplePoints.map(([pLat, pLng]) => getZipForPoint(pLat, pLng))
  );

  const zips = new Set<string>();
  for (const zip of results) {
    if (zip) zips.add(zip);
  }

  const zipArray = Array.from(zips);

  // Cache the results
  zipCache.set(
    cacheKey,
    zipArray.map(z => ({ zipcode: z, lat: centerLat, lng: centerLng }))
  );

  return zipArray;
}

/** Average travel speeds by mode */
const TRAVEL_SPEEDS_KMH: Record<string, number> = {
  driving: 50, // ~30 mph average (accounting for traffic, turns)
  cycling: 15, // ~9 mph average
  walking: 5, // ~3 mph average
};

const KM_TO_MILES = 0.621371;

/**
 * Estimate travel radius in meters based on travel time and mode
 *
 * @param timeMinutes - Travel time in minutes
 * @param mode - Travel mode (driving, walking, cycling)
 * @returns Estimated radius in meters
 */
export function estimateTravelRadius(
  timeMinutes: number,
  mode: string
): number {
  const speedKmh = TRAVEL_SPEEDS_KMH[mode] || TRAVEL_SPEEDS_KMH.driving;
  const distanceKm = (speedKmh * timeMinutes) / 60;
  return distanceKm * 1000; // Convert to meters
}

/**
 * Estimate travel radius in miles based on travel time and mode.
 * Convenience wrapper around {@link estimateTravelRadius}.
 *
 * @param timeMinutes - Travel time in minutes
 * @param mode - Travel mode (driving, walking, cycling)
 * @returns Estimated radius in miles
 */
export function estimateTravelRadiusMiles(
  timeMinutes: number,
  mode: string
): number {
  const meters = estimateTravelRadius(timeMinutes, mode);
  return (meters / 1000) * KM_TO_MILES;
}

/**
 * Clear the ZIP cache (useful for testing or memory management)
 */
export function clearZipCache(): void {
  zipCache.clear();
}
