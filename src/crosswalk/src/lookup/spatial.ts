import type { MultiPolygon, Polygon } from 'geojson';
import { pointInGeometry } from '@twinfile/geokit/core';
import {
  joinCellMapToPolygon,
  type JoinCellMapToPolygonOptions,
} from '@twinfile/geokit/h3';
import { GKH3, GKPoint } from '@twinfile/geokit/core';
import { GeoKind } from '../geo-kind.js';
import { getUsCrosswalkTables, requireUsCrosswalkLookups } from '../load/registry';
import { crosswalk } from './crosswalk';
import { pointForZip } from './convert';

const DEFAULT_H3_RESOLUTION = 5;

export type ZipCentroid = {
  zip: string;
  lat: number;
  lon: number;
};

export type ZipsInPolygonOptions = JoinCellMapToPolygonOptions & {
  resolution?: number;
};

let cachedZipCentroids: ZipCentroid[] | null = null;

function requireH3R5ToZips(): Readonly<Record<string, readonly string[]>> {
  const tables = getUsCrosswalkTables();
  const h3R5ToZips = tables?.h3R5ToZips;
  if (!h3R5ToZips) {
    throw new Error(
      'h3R5ToZips not loaded — call loadCrosswalk("us", { tables: ["h3R5ToZips", ...] }) first.'
    );
  }
  return h3R5ToZips;
}

/**
 * ZIP codes whose H3 r5 cells cover a polygon geometry.
 */
export function zipsInPolygon(
  geometry: Polygon | MultiPolygon,
  options?: ZipsInPolygonOptions
): string[] {
  const { resolution = DEFAULT_H3_RESOLUTION, ...joinOptions } = options ?? {};
  return joinCellMapToPolygon(geometry, requireH3R5ToZips(), resolution, joinOptions);
}

/**
 * Filter ZIP centroids to those whose coordinates fall inside a polygon.
 */
export function filterZipsByPolygon<T extends ZipCentroid>(
  zips: readonly T[],
  geometry: Polygon | MultiPolygon
): T[] {
  return zips.filter((zip) => pointInGeometry([zip.lat, zip.lon], geometry));
}

/**
 * All ZIP centroids from the loaded zipToH3R5 crosswalk table.
 */
export function allZipCentroids(): ZipCentroid[] {
  if (cachedZipCentroids) return cachedZipCentroids;

  const tables = getUsCrosswalkTables();
  const zipToH3R5 = tables?.zipToH3R5;
  if (!zipToH3R5) {
    throw new Error(
      'zipToH3R5 not loaded — call loadCrosswalk("us", { tables: ["zipToH3R5", ...] }) first.'
    );
  }

  const list: ZipCentroid[] = [];
  for (const zip of Object.keys(zipToH3R5)) {
    const point = pointForZip(zip);
    if (!point) continue;
    list.push({ zip, lat: point[0], lon: point[1] });
  }

  cachedZipCentroids = list;
  return list;
}

/** Test-only — clear cached ZIP centroids between cases. */
export function clearZipCentroidCache(): void {
  cachedZipCentroids = null;
}

/**
 * USPS state abbreviation (lowercase) for a ZIP code.
 */
export function stateForZip(zip: string): string | undefined {
  return requireUsCrosswalkLookups().stateForZip(zip);
}

/**
 * USPS state abbreviation (lowercase) for a lat/lon point via crosswalk.
 */
export function stateForPoint(lat: number, lon: number): string | undefined {
  const result = crosswalk(GKPoint(lat, lon), { to: [GeoKind.State] });
  return result.state?.[0];
}

/**
 * USPS state abbreviation (lowercase) for an H3 cell via crosswalk.
 */
export function stateForH3Cell(h3Cell: string): string | undefined {
  const result = crosswalk(GKH3(h3Cell), { to: [GeoKind.State] });
  return result.state?.[0];
}

/**
 * Build a ZIP → state map for the given ZIP codes.
 */
export function buildZipToStateMap(zips: Iterable<string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const zip of zips) {
    const state = stateForZip(zip);
    if (state) out[zip] = state;
  }
  return out;
}

/**
 * Sorted unique USPS state abbreviations (lowercase) from the loaded zipToState table.
 */
export function usStateAbbrs(): readonly string[] {
  const tables = getUsCrosswalkTables();
  const zipToState = tables?.zipToState;
  if (!zipToState) {
    throw new Error(
      'zipToState not loaded — call loadCrosswalk("us", { tables: ["zipToState", ...] }) first.'
    );
  }
  return [...new Set(Object.values(zipToState).map((state) => state.trim().toLowerCase()))].sort();
}
