import { h3CellToLatLng, latLngToH3Cell, isH3ProjectionLoaded } from '../h3/project.js';
import {
  geohashForPoint,
  pointForGeohash,
} from './geohash.js';
import { requireUsCrosswalkLookups } from '../load/registry.js';

const DEFAULT_H3_RESOLUTION = 5;

export function dmaForH3(h3Cell: string): string | undefined {
  return requireUsCrosswalkLookups().dmaForH3(h3Cell);
}

export function zipsForH3(h3Cell: string): readonly string[] {
  return requireUsCrosswalkLookups().zipsForH3(h3Cell);
}

export function h3ForZip(zip: string): string | undefined {
  return requireUsCrosswalkLookups().h3ForZip(zip);
}

export function dmaForGeohash(geohashCell: string): string | undefined {
  return requireUsCrosswalkLookups().dmaForGeohash(geohashCell);
}

export function zipsForGeohash(geohashCell: string): readonly string[] {
  return requireUsCrosswalkLookups().zipsForGeohash(geohashCell);
}

export function geohashForZip(zip: string): string | undefined {
  return requireUsCrosswalkLookups().geohashForZip(zip);
}

export function dmaForZip(zip: string): string | undefined {
  return requireUsCrosswalkLookups().dmaForZip(zip);
}

export function zipsInDma(dmaSlug: string): readonly string[] {
  return requireUsCrosswalkLookups().zipsInDma(dmaSlug);
}

export function countiesInDma(dmaSlug: string): readonly string[] {
  return requireUsCrosswalkLookups().countiesInDma(dmaSlug);
}

export function dmaForPoint(lat: number, lon: number): string | undefined {
  if (isH3ProjectionLoaded()) {
    const h3 = latLngToH3Cell(lat, lon, DEFAULT_H3_RESOLUTION);
    return dmaForH3(h3);
  }
  const geohash = geohashForPoint(lat, lon);
  return dmaForGeohash(geohash);
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

export { geohashForPoint, geohashForLatLon, pointForGeohash, geohashCellToLatLon } from './geohash.js';
export { decodeGeohash } from './geohash.js';
export { crosswalk } from './crosswalk.js';
