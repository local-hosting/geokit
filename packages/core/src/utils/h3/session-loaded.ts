/**
 * Session-scoped H3 cell loaded-at tracking for viewport highlight fade.
 */

import { compactH3CellId } from './cell-id';

export type H3SessionLoadedTrackerOptions = {
  onCellLoaded?: (id: string, detail?: Record<string, unknown>) => void;
};

export type ViewportH3Refresh = {
  cells: string[];
  newOnRefresh: ReadonlySet<string>;
};

export function createH3SessionLoadedTracker(options?: H3SessionLoadedTrackerOptions) {
  const sessionLoadedH3Cells = new Set<string>();
  const sessionLoadedAt = new Map<string, number>();

  function canonicalH3CellId(h3: string): string {
    return compactH3CellId(h3.trim());
  }

  function resetH3RenderLog(): void {
    sessionLoadedH3Cells.clear();
    sessionLoadedAt.clear();
  }

  function getSessionLoadedH3Cells(): ReadonlySet<string> {
    return sessionLoadedH3Cells;
  }

  function getH3CellLoadedAt(h3: string): number | undefined {
    return sessionLoadedAt.get(canonicalH3CellId(h3));
  }

  function hasLoadedH3Cell(h3: string): boolean {
    const id = canonicalH3CellId(h3);
    return id.length > 0 && sessionLoadedH3Cells.has(id);
  }

  function markSessionLoaded(id: string, detail?: Record<string, unknown>): void {
    if (sessionLoadedH3Cells.has(id)) return;
    sessionLoadedH3Cells.add(id);
    sessionLoadedAt.set(id, Date.now());
    options?.onCellLoaded?.(id, detail);
  }

  function logRenderedH3Cell(h3: string, detail?: Record<string, unknown>): boolean {
    const id = canonicalH3CellId(h3);
    if (!id || sessionLoadedH3Cells.has(id)) return false;
    markSessionLoaded(id, detail);
    return true;
  }

  function trackViewportH3Refresh(cells: Iterable<string>, logSource?: string): ViewportH3Refresh {
    const current = new Set<string>();
    const newlyLoaded = new Set<string>();

    for (const cell of cells) {
      const id = canonicalH3CellId(cell);
      if (!id) continue;
      current.add(id);
      if (sessionLoadedH3Cells.has(id)) continue;

      newlyLoaded.add(id);
      markSessionLoaded(id, logSource ? { source: logSource } : undefined);
    }

    return { cells: [...current], newOnRefresh: newlyLoaded };
  }

  function isNewOnViewportRefresh(h3: string, newOnRefresh: ReadonlySet<string>): boolean {
    return newOnRefresh.has(canonicalH3CellId(h3));
  }

  return {
    canonicalH3CellId,
    resetH3RenderLog,
    getSessionLoadedH3Cells,
    getH3CellLoadedAt,
    hasLoadedH3Cell,
    logRenderedH3Cell,
    trackViewportH3Refresh,
    isNewOnViewportRefresh,
  };
}

export type H3SessionLoadedTracker = ReturnType<typeof createH3SessionLoadedTracker>;
