/**
 * Resolve H3 cell ids to sparse CDN catalog keys (r1 compact ids vary from 4–5 hex chars).
 */

import { compactH3CellId, expandH3CellId } from '../utils/h3/cell-id';
import { getResolution } from 'h3-js';

function resolutionOf(cellId: string): number | null {
  try {
    const res = getResolution(expandH3CellId(cellId));
    return res >= 0 ? res : null;
  } catch {
    return null;
  }
}

function catalogExtensions(
  id: string,
  catalogIds: ReadonlySet<string>,
  resolution: number
): string[] {
  const extensions: string[] = [];
  for (const catalogId of catalogIds) {
    if (catalogId.length <= id.length || !catalogId.startsWith(id)) continue;
    if (resolutionOf(catalogId) !== resolution) continue;
    extensions.push(catalogId);
  }
  return extensions;
}

/** Map a viewport/tessellated id to a published catalog cell id, if any. */
export function resolvePublishedCellLayerId(
  cellId: string,
  catalogIds: ReadonlySet<string>
): string | null {
  const id = compactH3CellId(cellId.trim());
  if (!id || !catalogIds.size) return null;
  if (catalogIds.has(id)) return id;

  const resolution = resolutionOf(id);
  if (resolution == null) {
    for (let len = id.length - 1; len >= 1; len -= 1) {
      const prefix = id.slice(0, len);
      if (catalogIds.has(prefix) && resolutionOf(prefix) != null) return prefix;
    }
    return null;
  }

  const extensions = catalogExtensions(id, catalogIds, resolution);
  if (extensions.length === 1) return extensions[0]!;

  return null;
}

export function isPublishedCellLayerId(
  cellId: string,
  catalogIds: ReadonlySet<string> | null | undefined
): boolean {
  if (!catalogIds?.size) return false;
  return resolvePublishedCellLayerId(cellId, catalogIds) != null;
}
