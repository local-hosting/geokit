/** Minimal geohash encode — no external dependency. */

import type { LatLon } from './types.js';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

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

export function geohashForPoint(lat: number, lon: number, precision = 10): string {
  return encodeGeohash(lat, lon, precision);
}

export function geohashForLatLon(point: LatLon, precision = 10): string {
  return encodeGeohash(point[0], point[1], precision);
}

export function truncateGeohash(hash: string, precision: number): string {
  return hash.slice(0, precision);
}
