/**
 * ZIP Code Utilities for Demographics
 *
 * Functions to find and filter ZIP codes for demographic queries.
 * Uses Mapbox reverse geocoding API (with CORS support) and spatial filtering.
 */

import type { Polygon, MultiPolygon } from 'geojson';
import { haversineMeters } from '../distance/haversine';
import { pointInGeometry } from '../containment/point-in-geometry';
import { getProviderForCapability } from '../../api/providers/registry';

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
 * Uses three sampling strategies for comprehensive coverage:
 * 1. Perimeter sampling - points along the polygon boundary (catches edge ZIPs)
 * 2. Radial sampling - lines from center to perimeter (catches interior ZIPs)
 * 3. Center point - the store location itself
 *
 * @param centerLat - Center latitude (store location)
 * @param centerLng - Center longitude (store location)
 * @param polygon - Isochrone polygon (the actual travel area)
 * @param _searchRadiusMeters - Deprecated, not used (polygon defines the area)
 * @returns Array of ZIP codes within the polygon
 */
export async function findZipsInPolygon(
  centerLat: number,
  centerLng: number,
  polygon: Polygon | MultiPolygon,
  _searchRadiusMeters?: number
): Promise<string[]> {
  // Get the outer ring of the polygon
  const outerRing =
    polygon.type === 'Polygon' ? polygon.coordinates[0] : polygon.coordinates[0]?.[0] || [];

  if (outerRing.length < 3) {
    return [];
  }

  // Calculate perimeter length to determine sampling density
  let perimeterLength = 0;
  for (let i = 0; i < outerRing.length - 1; i++) {
    const [lng1, lat1] = outerRing[i];
    const [lng2, lat2] = outerRing[i + 1];
    perimeterLength += Math.sqrt((lng2 - lng1) ** 2 + (lat2 - lat1) ** 2);
  }

  // Generate cache key based on polygon shape (use perimeter + center)
  const bounds = getPolygonBounds(polygon);
  const cacheKey = `poly2:${centerLat.toFixed(4)},${centerLng.toFixed(4)}:${perimeterLength.toFixed(3)}:${bounds.minLng.toFixed(3)},${bounds.maxLng.toFixed(3)}`;
  const cached = zipCache.get(cacheKey);
  if (cached) {
    return cached.map((z) => z.zipcode);
  }

  const samplePoints: Array<[number, number]> = [];
  const addedPoints = new Set<string>();

  const addPoint = (lat: number, lng: number) => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (!addedPoints.has(key)) {
      addedPoints.add(key);
      samplePoints.push([lat, lng]);
    }
  };

  // 1. Always include center point
  addPoint(centerLat, centerLng);

  // 2. Sample along the polygon perimeter
  // More points for larger polygons (1 point per ~0.02 degrees, roughly 1-2 km)
  const perimeterSampleCount = Math.max(12, Math.min(40, Math.ceil(perimeterLength / 0.02)));
  const perimeterStep = (outerRing.length - 1) / perimeterSampleCount;

  for (let i = 0; i < perimeterSampleCount; i++) {
    const idx = Math.floor(i * perimeterStep);
    const [lng, lat] = outerRing[Math.min(idx, outerRing.length - 1)];
    addPoint(lat, lng);
  }

  // 3. Sample along radial lines from center to perimeter
  // This catches interior ZIP codes that perimeter sampling might miss
  const radialCount = Math.max(8, Math.min(16, Math.ceil(perimeterLength / 0.05)));
  const radialSteps = 3; // Sample at 33%, 66%, and near-edge along each radial

  for (let r = 0; r < radialCount; r++) {
    // Pick evenly spaced points on the perimeter
    const perimeterIdx = Math.floor((r / radialCount) * (outerRing.length - 1));
    const [edgeLng, edgeLat] = outerRing[perimeterIdx];

    // Sample along the line from center to edge
    for (let s = 1; s <= radialSteps; s++) {
      const t = s / (radialSteps + 1); // 0.25, 0.5, 0.75
      const sampleLat = centerLat + (edgeLat - centerLat) * t;
      const sampleLng = centerLng + (edgeLng - centerLng) * t;

      // Verify point is inside polygon (radial might exit concave shapes)
      if (pointInGeometry([sampleLat, sampleLng], polygon)) {
        addPoint(sampleLat, sampleLng);
      }
    }
  }

  // Fetch ZIPs for sample points (with concurrency limit)
  const zips = new Set<string>();
  const BATCH_SIZE = 5;

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
