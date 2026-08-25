/** Minimal geohash encode/decode — no external dependency. */

import type { LatLon } from '../types.js';
import {
  GEOHASH_ZIP_INDEX_PRECISION,
  geohashCellIdForLookup,
  normalizeGeohashCellId,
} from '../geohash/cell-id.js';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export { GEOHASH_ZIP_INDEX_PRECISION };

export function encodeGeohash(lat: number, lon: number, precision = 10): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        idx = (idx << 1) + 1;
        lonMin = mid;
      } else {
        idx <<= 1;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = (idx << 1) + 1;
        latMin = mid;
      } else {
        idx <<= 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

export function geohashForPoint(
  lat: number,
  lon: number,
  precision = GEOHASH_ZIP_INDEX_PRECISION
): string {
  return encodeGeohash(lat, lon, precision);
}

export function geohashForLatLon(
  point: LatLon,
  precision = GEOHASH_ZIP_INDEX_PRECISION
): string {
  return encodeGeohash(point[0], point[1], precision);
}

export function truncateGeohash(hash: string, precision: number): string {
  return normalizeGeohashCellId(hash).slice(0, precision);
}

export function decodeGeohash(hash: string): LatLon {
  const normalized = normalizeGeohashCellId(hash);
  let evenBit = true;
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  for (const char of normalized) {
    const idx = BASE32.indexOf(char);
    if (idx < 0) {
      throw new Error(`Invalid geohash character: ${char}`);
    }
    for (let bit = 4; bit >= 0; bit -= 1) {
      const mask = 1 << bit;
      if (evenBit) {
        const mid = (lonMin + lonMax) / 2;
        if (idx & mask) lonMin = mid;
        else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (idx & mask) latMin = mid;
        else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }

  return [(latMin + latMax) / 2, (lonMin + lonMax) / 2];
}

export function pointForGeohash(hash: string): LatLon {
  return decodeGeohash(hash);
}

export function geohashCellToLatLon(
  geohashCell: string,
  precision = GEOHASH_ZIP_INDEX_PRECISION
): LatLon {
  return decodeGeohash(geohashCellIdForLookup(geohashCell, precision));
}
