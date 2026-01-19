/**
 * ZIP Code Utilities for Demographics
 *
 * Functions to find and filter ZIP codes for demographic queries.
 *
 * Two modes:
 * 1. H3 Index (fast) - Uses pre-computed H3 cell → ZIP mapping for instant lookups
 * 2. API Fallback (slow) - Uses Mapbox reverse geocoding if index not available
 *
 * To enable fast mode, load the H3-to-ZIP index:
 * ```typescript
 * // Option 1: Load from URL
 * await loadH3ZipIndexFromUrl('/data/zip-h3-index.json');
 *
 * // Option 2: Load directly
 * loadH3ZipIndex(indexData);
 * ```
 */

import type { Polygon, MultiPolygon } from 'geojson';
import { latLngToCell } from 'h3-js';
import { haversineMeters } from '../distance/haversine';
import { pointInGeometry } from '../containment/point-in-geometry';
import { getProviderForCapability } from '../../api/providers/registry';
import { polygonToH3 } from '../h3';

/**
 * H3-to-ZIP index for instant lookups
 * Loaded lazily when first needed
 */
let h3ZipIndex: Record<string, string[]> | null = null;
const H3_INDEX_RESOLUTION = 5;

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
  demographicsData = demographicsData ? { ...demographicsData, ...data } : data;
}

/**
 * Load demographics data from URL
 */
export async function loadDemographicsDataFromUrl(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    loadDemographicsData(data);
  } catch (error) {
    console.warn(`[Demographics] Failed to load from ${url}:`, error);
    throw error;
  }
}

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

// Legacy aliases for backward compatibility
export const loadDemographicsCache = loadDemographicsData;
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
  h3ZipIndex = indexData;
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
export function getH3IndexStats(): { loaded: boolean; cellCount: number; zipCount: number } | null {
  if (!h3ZipIndex) {
    return { loaded: false, cellCount: 0, zipCount: 0 };
  }
  return {
    loaded: true,
    cellCount: Object.keys(h3ZipIndex).length,
    zipCount: Object.values(h3ZipIndex).reduce((sum, zips) => sum + zips.length, 0),
  };
}

/**
 * Find ZIP codes using H3 index (instant, no API calls)
 * Returns null if index not loaded - caller should fall back to API method
 *
 * Uses multiple strategies to find ZIPs:
 * 1. Fill polygon with H3 cells (works for large polygons)
 * 2. Sample polygon vertices (catches edge cases)
 * 3. Sample polygon centroid (fallback for small polygons)
 */
export function findZipsInPolygonLocal(polygon: Polygon | MultiPolygon): string[] | null {
  if (!h3ZipIndex) {
    return null; // Index not loaded, fall back to API
  }

  try {
    const zips = new Set<string>();

    // Strategy 1: Get H3 cells that fill the polygon
    let allCells: string[] = [];

    if (polygon.type === 'Polygon') {
      allCells = polygonToH3(polygon, H3_INDEX_RESOLUTION);
    } else {
      // MultiPolygon: process each polygon and combine cells
      for (const coords of polygon.coordinates) {
        const subPolygon: Polygon = { type: 'Polygon', coordinates: coords };
        const cells = polygonToH3(subPolygon, H3_INDEX_RESOLUTION);
        allCells.push(...cells);
      }
    }

    // Collect ZIPs from filled cells
    for (const cell of allCells) {
      const cellZips = h3ZipIndex[cell];
      if (cellZips) {
        for (const zip of cellZips) {
          zips.add(zip);
        }
      }
    }

    // Strategy 2: Sample polygon vertices (catches edges the fill might miss)
    const outerRing =
      polygon.type === 'Polygon' ? polygon.coordinates[0] : polygon.coordinates[0]?.[0] || [];

    // Sample every Nth vertex plus corners
    const sampleInterval = Math.max(1, Math.floor(outerRing.length / 8));
    for (let i = 0; i < outerRing.length; i += sampleInterval) {
      const [lng, lat] = outerRing[i];
      try {
        const cell = latLngToCell(lat, lng, H3_INDEX_RESOLUTION);
        const cellZips = h3ZipIndex[cell];
        if (cellZips) {
          for (const zip of cellZips) {
            zips.add(zip);
          }
        }
      } catch {
        // Skip invalid coordinates
      }
    }

    // Strategy 3: Sample centroid (fallback for very small polygons)
    if (zips.size === 0 && outerRing.length >= 3) {
      // Calculate simple centroid
      let sumLat = 0;
      let sumLng = 0;
      for (const [lng, lat] of outerRing) {
        sumLat += lat;
        sumLng += lng;
      }
      const centroidLat = sumLat / outerRing.length;
      const centroidLng = sumLng / outerRing.length;

      try {
        const cell = latLngToCell(centroidLat, centroidLng, H3_INDEX_RESOLUTION);
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
 */
const zipCache = new Map<string, ZipCentroid[]>();

/**
 * Get ZIP code for a point using the registered geocoding provider (Mapbox)
 * Uses existing API key configuration with full CORS support
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns ZIP code string or null
 */
export async function getZipForPoint(lat: number, lng: number): Promise<string | null> {
  try {
    // Get a provider that supports geocoding (Mapbox has reverseGeocode)
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
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${radiusMeters}`;
  const cached = zipCache.get(cacheKey);
  if (cached) {
    return cached.map((z) => z.zipcode);
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
    const results = await Promise.all(batch.map(([pLat, pLng]) => getZipForPoint(pLat, pLng)));

    for (const zip of results) {
      if (zip) zips.add(zip);
    }
  }

  const zipArray = Array.from(zips);

  // Cache the results
  zipCache.set(
    cacheKey,
    zipArray.map((z) => ({ zipcode: z, lat, lng }))
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
  return zips.filter((zip) => pointInGeometry([zip.lat, zip.lng], polygon));
}

/**
 * Get the bounding box of a polygon
 */
function getPolygonBounds(polygon: Polygon | MultiPolygon): {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
} {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const rings = polygon.type === 'Polygon' ? polygon.coordinates : polygon.coordinates.flat();

  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  return { minLng, maxLng, minLat, maxLat };
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
    polygon.type === 'Polygon' ? polygon.coordinates[0] : polygon.coordinates[0]?.[0] || [];

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
    // Fallback: polygon bounds
    const bounds = getPolygonBounds(polygon);
    cacheKey = `poly3:${centerLat.toFixed(4)},${centerLng.toFixed(4)}:${bounds.minLng.toFixed(3)},${bounds.minLat.toFixed(3)},${bounds.maxLng.toFixed(3)},${bounds.maxLat.toFixed(3)}`;
  }
  const cached = zipCache.get(cacheKey);
  if (cached) {
    return cached.map((z) => z.zipcode);
  }

  // Find points on polygon perimeter closest to each cardinal/diagonal direction
  const findPerimeterPoint = (targetAngle: number): [number, number] | null => {
    let bestPoint: [number, number] | null = null;
    let bestAngleDiff = Infinity;

    for (const [lng, lat] of outerRing) {
      const angle = Math.atan2(lat - centerLat, lng - centerLng);
      const angleDiff = Math.abs(((angle - targetAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
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
  const results = await Promise.all(samplePoints.map(([pLat, pLng]) => getZipForPoint(pLat, pLng)));

  const zips = new Set<string>();
  for (const zip of results) {
    if (zip) zips.add(zip);
  }

  const zipArray = Array.from(zips);

  // Cache the results
  zipCache.set(
    cacheKey,
    zipArray.map((z) => ({ zipcode: z, lat: centerLat, lng: centerLng }))
  );

  return zipArray;
}

/**
 * Estimate travel radius in meters based on travel time and mode
 *
 * @param timeMinutes - Travel time in minutes
 * @param mode - Travel mode (driving, walking, cycling)
 * @returns Estimated radius in meters
 */
export function estimateTravelRadius(timeMinutes: number, mode: string): number {
  // Average speeds in km/h
  const speeds: Record<string, number> = {
    driving: 50, // ~30 mph average (accounting for traffic, turns)
    cycling: 15, // ~9 mph average
    walking: 5, // ~3 mph average
  };

  const speedKmh = speeds[mode] || speeds.driving;
  const distanceKm = (speedKmh * timeMinutes) / 60;

  return distanceKm * 1000; // Convert to meters
}

/**
 * Clear the ZIP cache (useful for testing or memory management)
 */
export function clearZipCache(): void {
  zipCache.clear();
}
