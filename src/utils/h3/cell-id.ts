/** H3 cell index helpers — compact ids for catalog/CDN catalogs (no trailing `f` padding). */

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
