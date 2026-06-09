/**
 * H3 cursor dwell — reveal a cell only after the pointer rests on it for dwellMs.
 */

export type H3CursorDwellOptions = {
  dwellMs?: number;
  resolveCellId: (lat: number, lng: number) => string | null;
  onReveal: (cellId: string) => void;
  isAlreadyRevealed?: (cellId: string) => boolean;
};

export type H3CursorDwell = {
  onCursorMove(lat: number, lng: number): void;
  onCursorLeave(): void;
  clear(): void;
  dispose(): void;
};

const DEFAULT_DWELL_MS = 1_000;

/** Debounced cursor dwell; call onCursorMove from mousemove and onCursorLeave from mouseout. */
export function createH3CursorDwell(options: H3CursorDwellOptions): H3CursorDwell {
  const dwellMs = options.dwellMs ?? DEFAULT_DWELL_MS;
  let dwellTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingCellId: string | null = null;
  let syncRaf: number | null = null;

  function clear(): void {
    if (dwellTimeout !== null) {
      clearTimeout(dwellTimeout);
      dwellTimeout = null;
    }
    pendingCellId = null;
  }

  function onCursorPosition(lat: number, lng: number): void {
    const cellId = options.resolveCellId(lat, lng);
    if (!cellId) {
      clear();
      return;
    }
    if (options.isAlreadyRevealed?.(cellId)) {
      clear();
      return;
    }
    if (pendingCellId === cellId) return;

    clear();
    pendingCellId = cellId;
    dwellTimeout = setTimeout(() => {
      dwellTimeout = null;
      pendingCellId = null;
      options.onReveal(cellId);
    }, dwellMs);
  }

  function onCursorMove(lat: number, lng: number): void {
    if (syncRaf !== null) cancelAnimationFrame(syncRaf);
    syncRaf = requestAnimationFrame(() => {
      syncRaf = null;
      onCursorPosition(lat, lng);
    });
  }

  function onCursorLeave(): void {
    clear();
  }

  function dispose(): void {
    clear();
    if (syncRaf !== null) {
      cancelAnimationFrame(syncRaf);
      syncRaf = null;
    }
  }

  return { onCursorMove, onCursorLeave, clear, dispose };
}
