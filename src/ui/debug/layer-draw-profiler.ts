/**
 * MapLibre layer draw profiler — wraps painter.renderLayer to time each layer pass.
 */

const SLOW_DRAW_MS = 1;
const VERY_SLOW_DRAW_MS = 5;
const SUMMARY_MIN_TOTAL_MS = 8;

export type LayerDrawDetail = {
  layerId: string;
  layerType: string;
  sourceType: string | null;
  tiles: number;
  features: number | null;
  ms: number;
  zoom: number;
};

export type LayerDrawIdleSnapshot = {
  layerDraws: number;
  maxDrawsPerFrame: number;
  frames: number;
  slowFrames: number;
  maxFrameMs: number;
  topLayers: Array<{ layer: string; totalMs: number; draws: number }>;
  sourceLoads: number;
  customSourceLoads: number;
  customLayerCount: number | null;
};

export type LayerDrawProfilerOptions = {
  enabled?: boolean;
  verbose?: boolean;
  onDraw?: (
    detail: LayerDrawDetail & { source: string | null; hidden: boolean; hint: string | null }
  ) => void;
  onSlowFrame?: (detail: {
    frameMs: number;
    topLayers: Array<{ layer: string; ms: number }>;
  }) => void;
  onIdleSummary?: (snapshot: LayerDrawIdleSnapshot) => void;
  onVerboseIdleLayers?: (layers: unknown[]) => void;
  onVerboseIdleSources?: (sources: unknown[]) => void;
  onAttach?: (detail: { zoom: number | null }) => void;
  onDetach?: () => void;
  onSkipped?: (reason: string) => void;
  slowHint?: (detail: LayerDrawDetail) => string | null;
  globalKeyPrefix?: string;
};

type LayerDrawStats = {
  draws: number;
  totalMs: number;
  maxMs: number;
  lastType: string;
  lastSource: string | null;
  lastTiles: number;
  lastHint: string | null;
};

type SourceLoadStats = {
  loads: number;
  totalMs: number;
  maxMs: number;
  lastType: string | null;
};

interface StyleLayerLike {
  id: string;
  type: string;
  source?: string;
  isHidden?: (zoom: number) => boolean;
}

interface SourceCacheLike {
  id?: string;
  _source?: { type?: string };
  getSource?: () => { type?: string } | undefined;
  _tiles?: Record<string, unknown>;
}

interface PainterLike {
  renderLayer: (
    painter: unknown,
    sourceCache: SourceCacheLike | undefined,
    layer: StyleLayerLike,
    coords?: unknown[]
  ) => void;
  render?: (...args: unknown[]) => void;
}

interface MapboxMapLike {
  painter?: PainterLike;
  _painter?: PainterLike;
  getZoom?: () => number;
  getSource?: (id: string) =>
    | {
        type?: string;
        _data?: { features?: unknown[] };
        serialize?: () => { features?: unknown[] };
      }
    | undefined;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
}

type ProfilerRuntime = {
  enabled: boolean;
  verbose: boolean;
};

function resolveRuntime(options: LayerDrawProfilerOptions): ProfilerRuntime {
  return {
    enabled: options.enabled !== false,
    verbose: options.verbose === true,
  };
}

function getPainter(map: MapboxMapLike): PainterLike | null {
  return map.painter ?? map._painter ?? null;
}

function sourceIdFromCache(
  sourceCache: SourceCacheLike | undefined,
  layer: StyleLayerLike
): string | null {
  if (sourceCache?.id) return String(sourceCache.id);
  if (layer.source) return String(layer.source);
  return null;
}

function sourceType(
  map: MapboxMapLike,
  sourceCache: SourceCacheLike | undefined,
  sourceId: string | null
): string | null {
  const fromCache = sourceCache?._source?.type ?? sourceCache?.getSource?.()?.type ?? null;
  if (fromCache) return fromCache;
  if (!sourceId || !map.getSource) return null;
  return map.getSource(sourceId)?.type ?? null;
}

function geojsonFeatureCount(
  map: MapboxMapLike,
  sourceId: string | null,
  srcType: string | null
): number | null {
  if (!sourceId || srcType !== 'geojson' || !map.getSource) return null;
  const source = map.getSource(sourceId);
  if (!source) return null;
  const data = source._data ?? source.serialize?.();
  const features = data?.features;
  return Array.isArray(features) ? features.length : null;
}

function tileCount(sourceCache: SourceCacheLike | undefined): number {
  const tiles = sourceCache?._tiles;
  return tiles ? Object.keys(tiles).length : 0;
}

function slowHint(detail: {
  layerId: string;
  layerType: string;
  sourceType: string | null;
  tiles: number;
  features: number | null;
  ms: number;
  zoom: number;
}): string | null {
  const hints: string[] = [];

  if (detail.ms >= VERY_SLOW_DRAW_MS) {
    hints.push(`draw took ${detail.ms.toFixed(1)}ms`);
  }

  if (detail.layerType === 'symbol') {
    hints.push('symbol/text layout and glyph rasterization');
  }

  if (detail.layerType === 'fill' && detail.sourceType === 'geojson') {
    hints.push('geojson fill — CPU tessellation + GPU fill');
    if (detail.features !== null && detail.features !== undefined && detail.features > 200) {
      hints.push(`${detail.features} features in source`);
    }
  }

  if (detail.layerType === 'line' && detail.sourceType === 'geojson') {
    hints.push('geojson line — dense vertex rings cost more');
    if (detail.features !== null && detail.features !== undefined && detail.features > 100) {
      hints.push(`${detail.features} line features`);
    }
  }

  if (detail.layerType === 'circle') {
    hints.push('circle layer — scales with visible point count');
  }

  if (detail.layerType === 'heatmap') {
    hints.push('heatmap offscreen pass + blur');
  }

  if (detail.layerType === 'fill-extrusion' || detail.layerType === 'model') {
    hints.push('3D geometry pass');
  }

  if (detail.tiles >= 24) {
    hints.push(`${detail.tiles} tiles in view`);
  } else if (detail.tiles >= 12 && detail.ms >= SLOW_DRAW_MS) {
    hints.push(`${detail.tiles} tiles`);
  }

  if (detail.zoom < 5 && detail.layerType === 'line' && detail.tiles > 8) {
    hints.push('many boundary tiles at low zoom');
  }

  return hints.length > 0 ? hints.join('; ') : null;
}

function recordDraw(
  map: MapboxMapLike,
  layer: StyleLayerLike,
  sourceCache: SourceCacheLike | undefined,
  coords: unknown[] | undefined,
  ms: number,
  layerStats: Map<string, LayerDrawStats>,
  frameStats: Map<string, number>,
  runtime: ProfilerRuntime,
  options: LayerDrawProfilerOptions
): void {
  const layerId = layer.id;
  const verbose = runtime.verbose;
  const srcId = sourceIdFromCache(sourceCache, layer);
  let srcType: string | null = null;
  let tiles = coords?.length ?? 0;
  let features: number | null = null;
  let zoom = 0;
  let hint: string | null = null;

  if (verbose) {
    srcType = sourceType(map, sourceCache, srcId);
    tiles = coords?.length ?? tileCount(sourceCache);
    features = geojsonFeatureCount(map, srcId, srcType);
    zoom = map.getZoom?.() ?? 0;
    const detail: LayerDrawDetail = {
      layerId,
      layerType: layer.type,
      sourceType: srcType,
      tiles,
      features,
      ms,
      zoom,
    };
    hint = options.slowHint?.(detail) ?? slowHint(detail);
  }

  const prev =
    layerStats.get(layerId) ??
    ({
      draws: 0,
      totalMs: 0,
      maxMs: 0,
      lastType: layer.type,
      lastSource: srcId,
      lastTiles: tiles,
      lastHint: hint,
    } satisfies LayerDrawStats);

  prev.draws += 1;
  prev.totalMs += ms;
  prev.maxMs = Math.max(prev.maxMs, ms);
  prev.lastType = layer.type;
  prev.lastSource = srcId;
  prev.lastTiles = tiles;
  if (verbose) prev.lastHint = hint;
  layerStats.set(layerId, prev);

  if (verbose) {
    frameStats.set(layerId, (frameStats.get(layerId) ?? 0) + ms);
  }

  if (!verbose || ms < SLOW_DRAW_MS) return;

  options.onDraw?.({
    layerId,
    layerType: layer.type,
    sourceType: srcType,
    tiles,
    features,
    ms,
    zoom,
    source: srcId,
    hidden: layer.isHidden?.(zoom) ?? false,
    hint,
  });
}

function countStyleLayers(map: MapboxMapLike): number | null {
  try {
    const layers = (map as { getStyle?: () => { layers?: unknown[] } }).getStyle?.()?.layers;
    return Array.isArray(layers) ? layers.length : null;
  } catch {
    return null;
  }
}

function snapshotStyleSourceIds(map: MapboxMapLike): Set<string> {
  try {
    const sources = (map as { getStyle?: () => { sources?: Record<string, unknown> } }).getStyle?.()
      ?.sources;
    return new Set(Object.keys(sources ?? {}));
  } catch {
    return new Set();
  }
}

function flushIdleSummary(
  map: MapboxMapLike,
  layerStats: Map<string, LayerDrawStats>,
  sourceStats: Map<string, SourceLoadStats>,
  frameCounter: {
    frames: number;
    totalFrameMs: number;
    slowFrames: number;
    maxFrameMs: number;
    layerDraws: number;
    drawsThisFrame: number;
    maxDrawsPerFrame: number;
  },
  customSourceLoadCounter: { count: number },
  runtime: ProfilerRuntime,
  options: LayerDrawProfilerOptions
): void {
  if (layerStats.size === 0 && sourceStats.size === 0) return;

  const ranked = [...layerStats.entries()]
    .map(([layerId, stats]) => ({
      layerId,
      ...stats,
      avgMs: stats.totalMs / Math.max(stats.draws, 1),
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const top = ranked.filter((row) => row.totalMs >= SUMMARY_MIN_TOTAL_MS).slice(0, 12);

  const topLayers = ranked.slice(0, 8).map((row) => ({
    layer: row.layerId,
    totalMs: Math.round(row.totalMs * 10) / 10,
    draws: row.draws,
  }));

  options.onIdleSummary?.({
    layerDraws: frameCounter.layerDraws,
    maxDrawsPerFrame: frameCounter.maxDrawsPerFrame,
    frames: frameCounter.frames,
    slowFrames: frameCounter.slowFrames,
    maxFrameMs: Math.round(frameCounter.maxFrameMs * 10) / 10,
    topLayers,
    sourceLoads: [...sourceStats.values()].reduce((n, s) => n + s.loads, 0),
    customSourceLoads: customSourceLoadCounter.count,
    customLayerCount: countStyleLayers(map),
  });

  if (top.length > 0 && runtime.verbose) {
    options.onVerboseIdleLayers?.(
      top.map((row) => ({
        layer: row.layerId,
        type: row.lastType,
        source: row.lastSource,
        draws: row.draws,
        totalMs: Math.round(row.totalMs * 10) / 10,
        avgMs: Math.round(row.avgMs * 100) / 100,
        maxMs: Math.round(row.maxMs * 100) / 100,
        tiles: row.lastTiles,
        why: row.lastHint,
        frames: frameCounter.frames,
        frameMs: Math.round(frameCounter.totalFrameMs * 10) / 10,
      }))
    );
  }

  const slowSources = [...sourceStats.entries()]
    .map(([sourceId, stats]) => ({
      sourceId,
      ...stats,
      avgMs: stats.totalMs / Math.max(stats.loads, 1),
    }))
    .filter((row) => row.totalMs >= 4)
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 8);

  if (slowSources.length > 0 && runtime.verbose) {
    options.onVerboseIdleSources?.(
      slowSources.map((row) => ({
        source: row.sourceId,
        type: row.lastType,
        loads: row.loads,
        totalMs: Math.round(row.totalMs * 10) / 10,
        maxMs: Math.round(row.maxMs * 10) / 10,
        why:
          row.lastType === 'geojson'
            ? 'geojson parse + tile index on main thread'
            : row.lastType === 'vector'
              ? 'vector tile fetch/decode'
              : row.lastType === 'raster'
                ? 'raster tile decode'
                : null,
      }))
    );
  }

  layerStats.clear();
  sourceStats.clear();
  frameCounter.frames = 0;
  frameCounter.totalFrameMs = 0;
  frameCounter.slowFrames = 0;
  frameCounter.maxFrameMs = 0;
  frameCounter.layerDraws = 0;
  frameCounter.drawsThisFrame = 0;
  frameCounter.maxDrawsPerFrame = 0;
  customSourceLoadCounter.count = 0;
}

export type MapLayerDrawProfilerCleanup = () => void;

/**
 * Attach per-layer draw timing to a Mapbox map instance.
 * Safe to call once per map; no-op when profiler is disabled.
 */
export function attachLayerDrawProfiler(
  map: unknown,
  options: LayerDrawProfilerOptions = {}
): MapLayerDrawProfilerCleanup {
  const runtime = resolveRuntime(options);
  if (!runtime.enabled) return () => {};

  const mapbox = map as MapboxMapLike;
  const painter = getPainter(mapbox);
  if (!painter?.renderLayer) {
    options.onSkipped?.('painter.renderLayer unavailable');
    return () => {};
  }

  const layerStats = new Map<string, LayerDrawStats>();
  const sourceStats = new Map<string, SourceLoadStats>();
  const frameCounter = {
    frames: 0,
    totalFrameMs: 0,
    slowFrames: 0,
    maxFrameMs: 0,
    layerDraws: 0,
    drawsThisFrame: 0,
    maxDrawsPerFrame: 0,
  };
  const frameLayerMs = new Map<string, number>();
  let frameStart = 0;
  const baselineStyleSourceIds = snapshotStyleSourceIds(mapbox);
  const customSourceLoadCounter = { count: 0 };

  // Must use .apply(this, args) — MapTiler passes renderOptions as a 5th arg and
  // relies on `this`; .bind(painter) breaks isRenderingToTexture destructuring.
  const originalRenderLayer = painter.renderLayer;
  painter.renderLayer = function (...args: unknown[]) {
    const sourceCache = args[1] as SourceCacheLike | undefined;
    const layer = args[2] as StyleLayerLike | undefined;
    const coords = args[3] as unknown[] | undefined;
    const t0 = performance.now();
    let result: unknown;
    try {
      result = (originalRenderLayer as (...a: unknown[]) => unknown).apply(this, args);
    } finally {
      if (layer?.id) {
        const ms = performance.now() - t0;
        frameCounter.layerDraws += 1;
        frameCounter.drawsThisFrame += 1;
        recordDraw(
          mapbox,
          layer,
          sourceCache,
          coords,
          ms,
          layerStats,
          frameLayerMs,
          runtime,
          options
        );
      }
    }
    return result;
  };

  let originalRender: ((...args: unknown[]) => unknown) | null = null;
  if (typeof painter.render === 'function') {
    originalRender = painter.render;
    painter.render = function (...args: unknown[]) {
      frameCounter.drawsThisFrame = 0;
      frameStart = performance.now();
      let result: unknown;
      try {
        result = (originalRender as (...a: unknown[]) => unknown).apply(this, args);
      } finally {
        const frameMs = performance.now() - frameStart;
        frameCounter.frames += 1;
        frameCounter.totalFrameMs += frameMs;
        frameCounter.maxFrameMs = Math.max(frameCounter.maxFrameMs, frameMs);
        frameCounter.maxDrawsPerFrame = Math.max(
          frameCounter.maxDrawsPerFrame,
          frameCounter.drawsThisFrame
        );
        if (frameMs >= 32) frameCounter.slowFrames += 1;

        if (frameMs >= 16 || frameLayerMs.size > 0) {
          const contributors = [...frameLayerMs.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([layerId, ms]) => ({
              layer: layerId,
              ms: Math.round(ms * 100) / 100,
            }));

          if (frameMs >= 32 && runtime.verbose) {
            options.onSlowFrame?.({
              frameMs: Math.round(frameMs * 10) / 10,
              topLayers: contributors,
            });
          }
        }
        frameLayerMs.clear();
      }
      return result;
    };
  }

  const sourceLoadStart = new Map<string, number>();

  const onSourceDataLoading = (event: unknown) => {
    const e = event as { sourceId?: string; dataType?: string };
    if (!e.sourceId || e.dataType !== 'source') return;
    sourceLoadStart.set(e.sourceId, performance.now());
  };

  const onSourceData = (event: unknown) => {
    const e = event as {
      sourceId?: string;
      isSourceLoaded?: boolean;
      sourceDataType?: string;
    };
    if (!e.sourceId || e.sourceDataType !== 'metadata') return;
    const started = sourceLoadStart.get(e.sourceId);
    if (started === null || started === undefined) return;
    sourceLoadStart.delete(e.sourceId);

    const ms = performance.now() - started;
    if (ms < 2) return;

    const srcType = mapbox.getSource?.(e.sourceId)?.type ?? null;
    const prev =
      sourceStats.get(e.sourceId) ??
      ({
        loads: 0,
        totalMs: 0,
        maxMs: 0,
        lastType: srcType,
      } satisfies SourceLoadStats);

    prev.loads += 1;
    prev.totalMs += ms;
    prev.maxMs = Math.max(prev.maxMs, ms);
    prev.lastType = srcType;
    sourceStats.set(e.sourceId, prev);

    if (!baselineStyleSourceIds.has(e.sourceId)) {
      customSourceLoadCounter.count += 1;
    }

    if (ms >= 8 && runtime.verbose) {
      options.onDraw?.({
        layerId: `source:${e.sourceId}`,
        layerType: 'source-load',
        sourceType: srcType,
        tiles: 0,
        features: null,
        ms,
        zoom: mapbox.getZoom?.() ?? 0,
        source: e.sourceId,
        hidden: false,
        hint: null,
      });
    }
  };

  const onIdle = () => {
    flushIdleSummary(
      mapbox,
      layerStats,
      sourceStats,
      frameCounter,
      customSourceLoadCounter,
      runtime,
      options
    );
  };

  mapbox.on?.('dataloading', onSourceDataLoading);
  mapbox.on?.('sourcedata', onSourceData);
  mapbox.on?.('idle', onIdle);

  options.onAttach?.({
    zoom: mapbox.getZoom ? Math.round((mapbox.getZoom() ?? 0) * 100) / 100 : null,
  });

  const cleanup = () => {
    painter.renderLayer = originalRenderLayer;
    if (originalRender) {
      painter.render = originalRender;
    }
    mapbox.off?.('dataloading', onSourceDataLoading);
    mapbox.off?.('sourcedata', onSourceData);
    mapbox.off?.('idle', onIdle);
    layerStats.clear();
    sourceStats.clear();
    sourceLoadStart.clear();
    frameLayerMs.clear();
    options.onDetach?.();
  };

  if (typeof window !== 'undefined') {
    const prefix = options.globalKeyPrefix ?? 'geokit';
    const win = window as unknown as Record<string, unknown>;
    win[`__${prefix}DetachLayerDrawProfiler`] = cleanup;
    win[`__${prefix}LayerDrawSummary`] = () => {
      flushIdleSummary(
        mapbox,
        layerStats,
        sourceStats,
        frameCounter,
        customSourceLoadCounter,
        runtime,
        options
      );
    };
  }

  return cleanup;
}
