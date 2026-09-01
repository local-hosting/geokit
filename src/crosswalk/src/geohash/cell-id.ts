/** Geohash cell id helpers — no external dependency. */

export const GEOHASH_ZIP_INDEX_PRECISION = 8;

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function normalizeGeohashCellId(cellId: string): string {
  return cellId.trim().toLowerCase();
}

export function isValidGeohashCellId(cellId: string): boolean {
  const normalized = normalizeGeohashCellId(cellId);
  if (normalized.length === 0) return false;
  for (const char of normalized) {
    if (!GEOHASH_BASE32.includes(char)) return false;
  }
  return true;
}

export function truncateGeohashCellId(cellId: string, precision = GEOHASH_ZIP_INDEX_PRECISION): string {
  return normalizeGeohashCellId(cellId).slice(0, precision);
}

export function geohashCellIdForLookup(
  cellId: string,
  precision = GEOHASH_ZIP_INDEX_PRECISION
): string {
  const normalized = normalizeGeohashCellId(cellId);
  if (normalized.length > precision) {
    return normalized.slice(0, precision);
  }
  return normalized;
}
