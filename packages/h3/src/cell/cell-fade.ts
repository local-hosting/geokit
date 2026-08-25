/**
 * H3 cell highlight fade — newly loaded cells ease to base opacity over time.
 */

import type { FeatureCollection, Polygon } from 'geojson';

/** Duration for new-cell highlight to ease down to base opacity. */
export const H3_CELL_FADE_MS = 5_000;

export type H3OpacityLevels = { new: number; base: number };

export type H3CellLoadedAtLookup = (cellId: string) => number | undefined;

export type H3CellFadeOptions = {
  getLoadedAt?: H3CellLoadedAtLookup;
  normalizeCellId?: (cellId: string) => string;
  nowMs?: number;
};

function resolveLoadedAt(cellId: string, options: H3CellFadeOptions): number | undefined {
  const id = options.normalizeCellId ? options.normalizeCellId(cellId) : cellId;
  return options.getLoadedAt?.(id);
}

export function h3CellFadeProgress(loadedAtMs: number | undefined, nowMs = Date.now()): number {
  if (loadedAtMs === undefined) return 1;
  return Math.min(1, Math.max(0, (nowMs - loadedAtMs) / H3_CELL_FADE_MS));
}

/** Ease-out quad: slow settle toward base opacity. */
export function h3CellFadeOpacity(
  loadedAtMs: number | undefined,
  levels: H3OpacityLevels,
  nowMs = Date.now()
): number {
  const t = h3CellFadeProgress(loadedAtMs, nowMs);
  const eased = 1 - (1 - t) * (1 - t);
  return levels.new + (levels.base - levels.new) * eased;
}

export function h3CellFadeProperties(
  cellId: string,
  fillLevels: H3OpacityLevels,
  lineLevels: H3OpacityLevels,
  options: H3CellFadeOptions = {}
): { fillOpacity: number; lineOpacity: number } {
  const nowMs = options.nowMs ?? Date.now();
  const loadedAt = resolveLoadedAt(cellId, options);
  return {
    fillOpacity: h3CellFadeOpacity(loadedAt, fillLevels, nowMs),
    lineOpacity: h3CellFadeOpacity(loadedAt, lineLevels, nowMs),
  };
}

export function anyH3CellsFading(
  cellIds: Iterable<string>,
  options: H3CellFadeOptions = {}
): boolean {
  const nowMs = options.nowMs ?? Date.now();
  const normalize = options.normalizeCellId ?? ((id: string) => id);
  for (const cell of cellIds) {
    const id = normalize(cell);
    if (!id) continue;
    if (h3CellFadeProgress(resolveLoadedAt(id, options), nowMs) < 1) return true;
  }
  return false;
}

export function applyH3CellFadeToCollection(
  collection: FeatureCollection<Polygon>,
  fillLevels: H3OpacityLevels,
  lineLevels: H3OpacityLevels,
  options: H3CellFadeOptions = {}
): FeatureCollection<Polygon> {
  const nowMs = options.nowMs ?? Date.now();
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const h3 = String(feature.properties?.h3 ?? '');
      const fade = h3CellFadeProperties(h3, fillLevels, lineLevels, { ...options, nowMs });
      return {
        ...feature,
        properties: {
          ...feature.properties,
          fillOpacity: fade.fillOpacity,
          lineOpacity: fade.lineOpacity,
        },
      };
    }),
  };
}

export type H3FadeLoop = {
  notifyUpdate: () => void;
  stop: () => void;
};

/** Re-run onTick on rAF while any visible cell is still fading. */
export function createH3FadeLoop(
  getVisibleCells: () => string[],
  onTick: () => void,
  options: H3CellFadeOptions = {}
): H3FadeLoop {
  let fadeRaf: number | null = null;

  const step = () => {
    if (!anyH3CellsFading(getVisibleCells(), options)) {
      fadeRaf = null;
      return;
    }
    onTick();
    fadeRaf = requestAnimationFrame(step);
  };

  const notifyUpdate = () => {
    if (!anyH3CellsFading(getVisibleCells(), options)) return;
    if (fadeRaf !== null) return;
    fadeRaf = requestAnimationFrame(step);
  };

  const stop = () => {
    if (fadeRaf !== null) {
      cancelAnimationFrame(fadeRaf);
      fadeRaf = null;
    }
  };

  return { notifyUpdate, stop };
}
