import { cellToLatLng, cellToParent, getResolution, latLngToCell } from 'h3-js';
import { compactH3CellId, expandH3CellId } from './cell-id.js';

/** Roll a cell id up/down to a target H3 resolution (compact id out). Requires h3-js. */
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
