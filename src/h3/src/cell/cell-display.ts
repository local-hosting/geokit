import { compactH3CellId, expandH3CellId } from './cell-id';
import { getResolution } from 'h3-js';

/** Venue H3 cell ids — compact hex without trailing f padding. */
export function canonicalVenueH3CellId(cellId: string): string {
  return compactH3CellId(cellId);
}



/** Max compact id length per resolution tier in published crosswalk indexes. */
export const COMPACT_H3_TIER_DISPLAY_LENGTH: Record<number, number> = {
  0: 4,
  1: 5,
  2: 6,
  3: 6,
  4: 7,
  5: 8,
};

export function formatCompactH3CellIdForDisplay(cellId: string, resolution: number): string {
  const normalized = cellId.trim().toLowerCase();
  const target = COMPACT_H3_TIER_DISPLAY_LENGTH[resolution];
  if (!target) return normalized;
  return padCompactH3CellIdForDisplay(normalized, target);
}

/** Pad compact H3 ids with trailing zeros for fixed-width browse labels within a tier. */
export function padCompactH3CellIdForDisplay(cellId: string, targetLength: number): string {
  const normalized = cellId.trim().toLowerCase();
  if (!normalized || targetLength <= 0) return normalized;
  if (normalized.length >= targetLength) return normalized;
  return normalized + '0'.repeat(targetLength - normalized.length);
}


/** Crosswalk tier resolution for a compact published cell id. */
export function compactH3CrosswalkResolutionFromCellId(cellId: string): number | null {
  const id = cellId.trim().toLowerCase();
  if (!id) return null;
  try {
    return getResolution(expandH3CellId(id));
  } catch {
    const matches = Object.entries(COMPACT_H3_TIER_DISPLAY_LENGTH)
      .filter(([, displayLen]) => displayLen === id.length)
      .map(([resolution]) => Number(resolution));
    if (matches.length === 0) return null;
    return matches[0]!;
  }
}

