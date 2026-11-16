import { h3CellToLatLng, latLngToH3Cell, isH3ProjectionLoaded } from '../h3/project';
import {
  geohashForPoint,
  pointForGeohash,
} from './geohash';
import { requireUsCrosswalkLookups } from '../load/registry';
import { crosswalk, type CrosswalkOptions } from './crosswalk';
import type { CrosswalkResult, GeoRef } from '../types';
import type { ConvertOutput, GeoKind } from '@doppler-group/geokit/core';
import { pickConvertOutput } from './convert-output';

const DEFAULT_H3_RESOLUTION = 5;

export function convert<K extends GeoKind>(from: GeoRef, to: K): ConvertOutput<K>;
export function convert(from: GeoRef, options: CrosswalkOptions): CrosswalkResult;
export function convert<K extends GeoKind>(
  from: GeoRef,
  toOrOptions: K | CrosswalkOptions
): ConvertOutput<K> | CrosswalkResult {
  if (typeof toOrOptions === 'string') {
    const result = crosswalk(from, { to: [toOrOptions] });
    return pickConvertOutput(toOrOptions, result);
  }
  return crosswalk(from, toOrOptions);
}

export { crosswalk, type CrosswalkOptions } from './crosswalk';

export function zipsForH3(h3Cell: string): readonly string[] {
  return requireUsCrosswalkLookups().zipsForH3(h3Cell);
}

export function h3ForTract(geoid: string): string | undefined {
  return requireUsCrosswalkLookups().h3ForTract(geoid);
}

export function tractsForH3(h3Cell: string): readonly string[] {
  return requireUsCrosswalkLookups().tractsForH3(h3Cell);
}

export function h3ForZip(zip: string): string | undefined {
  return requireUsCrosswalkLookups().h3ForZip(zip);
}

export function zipsForGeohash(geohashCell: string): readonly string[] {
  return requireUsCrosswalkLookups().zipsForGeohash(geohashCell);
}

export function geohashForZip(zip: string): string | undefined {
  return requireUsCrosswalkLookups().geohashForZip(zip);
}

export function zipsInDma(dmaSlug: string): readonly string[] {
  return requireUsCrosswalkLookups().zipsInDMA(dmaSlug);
}

export function countiesInDma(dmaSlug: string): readonly string[] {
  return requireUsCrosswalkLookups().countiesInDMA(dmaSlug);
}

export function h3ForPoint(lat: number, lon: number, resolution = DEFAULT_H3_RESOLUTION): string {
  if (!isH3ProjectionLoaded()) {
    throw new Error('H3 projection not loaded. Call loadCrosswalk("us") first.');
  }
  return latLngToH3Cell(lat, lon, resolution);
}

export function pointForH3(h3Cell: string): readonly [number, number] {
  return h3CellToLatLng(h3Cell);
}

export function pointForZip(zip: string): readonly [number, number] | undefined {
  const geohash = geohashForZip(zip);
  if (geohash) return pointForGeohash(geohash);
  const h3 = h3ForZip(zip);
  if (!h3) return undefined;
  return pointForH3(h3);
}

export { geohashForPoint, geohashForLatLon, pointForGeohash, geohashCellToLatLon } from './geohash';
export { decodeGeohash } from './geohash';
