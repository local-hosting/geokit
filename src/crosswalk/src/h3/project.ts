/**
 * Optional H3 projection via h3-js (peer dependency).
 */

import type { LatLon } from '../types';
import { compactH3CellId, expandH3CellId } from '@doppler-group/geokit/h3/lite';

type LatLngToCell = (lat: number, lon: number, resolution: number) => string;
type CellToLatLng = (cell: string) => [number, number];

let latLngToCellFn: LatLngToCell | null = null;
let cellToLatLngFn: CellToLatLng | null = null;
let loadError: string | null = null;

export async function ensureH3Projection(): Promise<void> {
  if (latLngToCellFn) return;
  if (loadError) throw new Error(loadError);
  try {
    const h3 = await import('h3-js');
    latLngToCellFn = h3.latLngToCell;
    cellToLatLngFn = h3.cellToLatLng;
  } catch (err) {
    loadError = 'h3-js is required for lat/lon → H3 projection. Install: yarn add h3-js';
    const error = new Error(loadError);
    Object.assign(error, { cause: err });
    throw error;
  }
}

export function isH3ProjectionLoaded(): boolean {
  return latLngToCellFn !== null;
}

export function latLngToH3Cell(lat: number, lon: number, resolution = 5): string {
  if (!latLngToCellFn) {
    throw new Error(
      'H3 projection not loaded. Call ensureH3Projection() or loadCrosswalk() first.'
    );
  }
  return compactH3CellId(latLngToCellFn(lat, lon, resolution));
}

export function h3CellToLatLng(h3Cell: string): LatLon {
  if (!cellToLatLngFn) {
    throw new Error(
      'H3 projection not loaded. Call ensureH3Projection() or loadCrosswalk() first.'
    );
  }
  const [lat, lon] = cellToLatLngFn(expandH3CellId(h3Cell));
  return [lat, lon];
}
