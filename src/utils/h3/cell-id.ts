/** H3 cell index helpers — compact ids for catalog/CDN catalogs (no trailing `f` padding). */

import { cellToLatLng, cellToParent, getResolution, latLngToCell } from 'h3-js';

const H3_INDEX_HEX_LEN = 15;

export function compactH3CellId(cellId: string): string {
  const normalized = cellId.trim().toLowerCase();
  const compact = normalized.replace(/f+$/i, '');
  return compact || normalized;
}

export function expandH3CellId(cellId: string): string {
  const normalized = cellId.trim().toLowerCase();
  if (normalized.length >= H3_INDEX_HEX_LEN) {
    return normalized.slice(0, H3_INDEX_HEX_LEN);
  }
  return normalized.padEnd(H3_INDEX_HEX_LEN, 'f');
}

/** Roll a cell id up/down to a target H3 resolution (compact id out). */
export function normalizeH3CellToResolution(cellId: string, resolution: number): string {
  const expanded = expandH3CellId(cellId.trim());
  if (!expanded) return compactH3CellId(cellId);

  let res = getResolution(expanded);
  if (res < 0) return compactH3CellId(cellId);

  let cursor = expanded;
  while (res > resolution) {
    cursor = cellToParent(cursor, res - 1);
    res -= 1;
  }
  if (res < resolution) {
    const [lat, lng] = cellToLatLng(cursor);
    cursor = latLngToCell(lat, lng, resolution);
  }
  return compactH3CellId(cursor);
}
