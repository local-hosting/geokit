import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MAP_MAX_TILE_CACHE_SIZE,
  MAX_MAP_PIXEL_RATIO,
  bindMapDocumentVisibilityGpu,
  mapGpuCreateOptions,
  resolveMapPixelRatio,
  setMapGpuPaused,
} from '../../../src/utils/map-surface/map-gpu-budget';

describe('map GPU / memory budget', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('caps device pixel ratio to MAX_MAP_PIXEL_RATIO', () => {
    expect(MAX_MAP_PIXEL_RATIO).toBe(1.5);
    expect(resolveMapPixelRatio(1)).toBe(1);
    expect(resolveMapPixelRatio(1.25)).toBe(1.25);
    expect(resolveMapPixelRatio(2)).toBe(1.5);
    expect(resolveMapPixelRatio(3)).toBe(1.5);
  });

  it('returns lean MapLibre/Mapbox create options', () => {
    const opts = mapGpuCreateOptions(2);
    expect(opts).toEqual({
      antialias: false,
      preserveDrawingBuffer: false,
      fadeDuration: 0,
      maxTileCacheSize: DEFAULT_MAP_MAX_TILE_CACHE_SIZE,
      crossSourceCollisions: false,
      localIdeographFontFamily: false,
      pixelRatio: 1.5,
    });
    expect(DEFAULT_MAP_MAX_TILE_CACHE_SIZE).toBeLessThanOrEqual(50);
  });

  it('setMapGpuPaused stops _render and restores on resume', () => {
    const render = vi.fn();
    const triggerRepaint = vi.fn();
    const stop = vi.fn();
    const map = { _render: render, triggerRepaint, stop };

    setMapGpuPaused(map, true);
    map._render();
    map.triggerRepaint();
    expect(render).not.toHaveBeenCalled();
    expect(triggerRepaint).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledOnce();

    setMapGpuPaused(map, false);
    map._render();
    expect(render).toHaveBeenCalledOnce();
    expect(triggerRepaint).toHaveBeenCalled();
  });

  it('setMapGpuPaused nests pause reasons with a refcount', () => {
    const render = vi.fn();
    const map = { _render: render, triggerRepaint: vi.fn(), stop: vi.fn() };

    setMapGpuPaused(map, true);
    setMapGpuPaused(map, true);
    setMapGpuPaused(map, false);
    map._render();
    expect(render).not.toHaveBeenCalled();

    setMapGpuPaused(map, false);
    map._render();
    expect(render).toHaveBeenCalledOnce();
  });

  it('bindMapDocumentVisibilityGpu pauses while the document is hidden', () => {
    const render = vi.fn();
    const map = { _render: render, triggerRepaint: vi.fn(), stop: vi.fn() };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });

    const unbind = bindMapDocumentVisibilityGpu(map);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    map._render();
    expect(render).not.toHaveBeenCalled();

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    map._render();
    expect(render).toHaveBeenCalledOnce();

    unbind();
  });
});
