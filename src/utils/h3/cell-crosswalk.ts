import { validateH3 } from './core';
import { h3ToParent } from './hierarchy';

export type H3CellMultiMap<T extends string = string> = Readonly<
  Record<string, readonly T[] | T[]>
>;

export type InvertCellMapOptions = {
  /** Keep the first or last native cell when a value appears in multiple cells. */
  onDuplicate?: 'first' | 'last';
};

/**
 * Invert a native-cell → values[] map to value → native cell (first match wins by default).
 */
export function invertCellMap<T extends string>(
  cellToValues: H3CellMultiMap<T>,
  options?: InvertCellMapOptions,
): Record<T, string> {
  const onDuplicate = options?.onDuplicate ?? 'first';
  const out = {} as Record<T, string>;

  for (const [cell, values] of Object.entries(cellToValues)) {
    for (const value of values ?? []) {
      const key = value as T;
      if (onDuplicate === 'first' && out[key]) continue;
      out[key] = cell;
    }
  }

  return out;
}

/**
 * Roll a native-cell map up to a parent H3 resolution, unioning values per parent cell.
 */
export function rollupCellMap<T extends string>(
  cellToValues: H3CellMultiMap<T>,
  parentResolution: number,
): Record<string, T[]> {
  const byCell = new Map<string, Set<T>>();

  for (const [nativeCell, values] of Object.entries(cellToValues)) {
    if (!validateH3(nativeCell)) continue;
    const parentCell = h3ToParent(nativeCell, parentResolution);
    let bucket = byCell.get(parentCell);
    if (!bucket) {
      bucket = new Set<T>();
      byCell.set(parentCell, bucket);
    }
    for (const value of values ?? []) {
      bucket.add(value);
    }
  }

  const out: Record<string, T[]> = {};
  for (const [cell, bucket] of byCell) {
    out[cell] = [...bucket].sort();
  }
  return out;
}

/**
 * Resolve a feature key to a parent H3 cell using a row value or inverted native-cell map.
 */
export function keyToParentCell(
  key: string,
  keyOnRow: unknown,
  keyToNativeCell: Record<string, string>,
  parentResolution: number,
): string | null {
  const nativeCell =
    typeof keyOnRow === 'string' && keyOnRow.length > 0 ? keyOnRow : keyToNativeCell[key];
  if (!nativeCell || !validateH3(nativeCell)) return null;
  try {
    return h3ToParent(nativeCell, parentResolution);
  } catch {
    return null;
  }
}

/** @deprecated Use `H3CellMultiMap` */
export type H3ToZips = H3CellMultiMap<string>;

/** @deprecated Use `invertCellMap` */
export const invertH3ToZips = invertCellMap;

/** @deprecated Use `rollupCellMap` */
export const rollupH3ToZips = rollupCellMap;

/** @deprecated Use `keyToParentCell` */
export const zipToH3ParentCell = keyToParentCell;
