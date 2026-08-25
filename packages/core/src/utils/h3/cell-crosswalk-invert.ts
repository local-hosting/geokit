export type H3CellMultiMap<T extends string = string> = Readonly<
  Record<string, readonly T[] | T[]>
>;

export type InvertCellMapOptions = {
  /** Keep the first or last native cell when a value appears in multiple cells. */
  onDuplicate?: 'first' | 'last';
};

/** @deprecated Use `H3CellMultiMap` */
export type H3ToZips = H3CellMultiMap<string>;

/**
 * Invert a native-cell → values[] map to value → native cell (first match wins by default).
 * Pure data transform — no h3-js dependency.
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

/** @deprecated Use `invertCellMap` */
export const invertH3ToZips = invertCellMap;
