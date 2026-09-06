/**
 * Resolve H3 or geohash cell→ZIP indexes to any platform tier (rollup or refine).
 */

import { h3ToChildren, validateH3, keyToParentCell, rollupCellMap } from '@twinfile/geokit/h3';
import { rollupGeohashMap } from '@twinfile/geokit/core/geohash';
import { buildGeohashNativeFromH3, type GeohashToZips, type H3ToZips } from './geohash-native.js';

export type { GeohashToZips, H3ToZips };

export const rollupH3ToZips = (h3ToZips: H3ToZips, parentResolution: number) =>
  rollupCellMap(h3ToZips, parentResolution);

export const zipToH3ParentCell = keyToParentCell;
export const rollupGeohashToZips = rollupGeohashMap;

export function invertH3ToZips(h3ToZips: H3ToZips): Record<string, string> {
  const zipToH3: Record<string, string> = {};
  for (const [h3, zips] of Object.entries(h3ToZips)) {
    for (const zip of zips) {
      if (!zipToH3[zip]) zipToH3[zip] = h3;
    }
  }
  return zipToH3;
}

export function resolveH3ToZipsAtResolution(
  nativeH3ToZips: H3ToZips,
  resolution: number,
  nativeResolution: number,
): H3ToZips {
  if (resolution === nativeResolution) return nativeH3ToZips;
  if (resolution < nativeResolution) {
    return rollupH3ToZips(nativeH3ToZips, resolution);
  }

  const byCell = new Map<string, Set<string>>();
  for (const [h3, zips] of Object.entries(nativeH3ToZips)) {
    if (!validateH3(h3) || zips.length === 0) continue;
    let children: string[];
    try {
      children = h3ToChildren(h3, resolution);
    } catch {
      continue;
    }
    for (const child of children) {
      let bucket = byCell.get(child);
      if (!bucket) {
        bucket = new Set<string>();
        byCell.set(child, bucket);
      }
      for (const zip of zips) bucket.add(zip);
    }
  }

  const out: H3ToZips = {};
  for (const [cell, bucket] of byCell) {
    out[cell] = [...bucket].sort();
  }
  return out;
}

export function resolveGeohashToZipsAtPrecision(
  h3ToZips: H3ToZips,
  nativeGeohashToZips: GeohashToZips,
  precision: number,
  nativePrecision: number,
): GeohashToZips {
  if (precision === nativePrecision) return nativeGeohashToZips;
  if (precision < nativePrecision) {
    return rollupGeohashToZips(nativeGeohashToZips, precision);
  }
  return buildGeohashNativeFromH3(h3ToZips, precision);
}
