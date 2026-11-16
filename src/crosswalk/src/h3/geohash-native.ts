/**
 * Build native geohash crosswalk cells from H3 r5 coverage.
 */

import { cellToBoundary, cellToLatLng } from 'h3-js';
import { encodeGeohash } from '@local-hosting/geokit/core/geohash';
import { expandH3CellId } from './cell-id.js';

export type H3ToZips = Record<string, string[]>;
export type GeohashToZips = Record<string, string[]>;

function h3CellSamplePoints(h3Cell: string): Array<[number, number]> {
  const cellId = expandH3CellId(h3Cell);
  const points: Array<[number, number]> = [cellToLatLng(cellId)];
  for (const [lat, lng] of cellToBoundary(cellId, true)) {
    points.push([lat, lng]);
  }
  return points;
}

export function buildGeohashNativeFromH3(
  h3ToZips: H3ToZips,
  nativePrecision: number,
): GeohashToZips {
  const encode = encodeGeohash(nativePrecision);
  const byHash = new Map<string, Set<string>>();

  for (const [h3, zips] of Object.entries(h3ToZips)) {
    if (zips.length === 0) continue;
    try {
      for (const [lat, lng] of h3CellSamplePoints(h3)) {
        const hash = encode([lat, lng]);
        let bucket = byHash.get(hash);
        if (!bucket) {
          bucket = new Set<string>();
          byHash.set(hash, bucket);
        }
        for (const zip of zips) bucket.add(zip);
      }
    } catch {
      continue;
    }
  }

  const out: GeohashToZips = {};
  for (const [hash, bucket] of byHash) {
    out[hash] = [...bucket].sort();
  }
  return out;
}
