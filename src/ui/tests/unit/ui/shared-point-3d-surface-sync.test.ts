import { describe, expect, it, vi } from 'vitest';

import {
  isSharedPoint3dSurfaceActive,
  revertSharedPointLayersFrom3dExtrusions,
  syncSharedPointLayersFor3dSurface,
} from '../../../src/utils/paint/shared-point/layer-ids';

describe('shared point 3D surface sync', () => {
  const pointLayerId = 'canvas-places-point';
  const glowLayerId = 'canvas-places-glow';
  const ids = { pointLayerId, glowLayerId };

  it('isSharedPoint3dSurfaceActive is true with terrain or gk-3d-buildings', () => {
    expect(
      isSharedPoint3dSurfaceActive({
        getTerrain: () => ({ source: 'dem' }),
        getLayer: () => null,
      } as never),
    ).toBe(true);
    expect(
      isSharedPoint3dSurfaceActive({
        getTerrain: () => null,
        getLayer: (id: string) => (id === 'gk-3d-buildings' ? { id } : null),
      } as never),
    ).toBe(true);
    expect(
      isSharedPoint3dSurfaceActive({
        getTerrain: () => null,
        getLayer: () => null,
      } as never),
    ).toBe(false);
  });

  it('revertSharedPointLayersFrom3dExtrusions clears emissive heal on flat map', () => {
    const layers = new Set([glowLayerId, pointLayerId]);
    const setPaintProperty = vi.fn();
    const setLayoutProperty = vi.fn();
    const setSlot = vi.fn();
    const map = {
      getLayer: (id: string) => (layers.has(id) ? { id, type: 'circle' } : null),
      setPaintProperty,
      setLayoutProperty,
      setSlot,
    };
    revertSharedPointLayersFrom3dExtrusions(map as never, ids);
    expect(setPaintProperty).toHaveBeenCalledWith(pointLayerId, 'circle-emissive-strength', 0);
    expect(setPaintProperty).toHaveBeenCalledWith(pointLayerId, 'circle-occlusion-opacity', 1);
    expect(setSlot).toHaveBeenCalledWith(pointLayerId, undefined);
  });

  it('syncSharedPointLayersFor3dSurface reverts emissive on flat map and heals on terrain', () => {
    const layers = new Set([glowLayerId, pointLayerId]);
    const setPaintProperty = vi.fn();
    const setSlot = vi.fn();
    const baseMap = {
      getLayer: (id: string) => (layers.has(id) ? { id, type: 'circle' } : null),
      setPaintProperty,
      setLayoutProperty: vi.fn(),
      setSlot,
    };

    syncSharedPointLayersFor3dSurface(
      { ...baseMap, getTerrain: () => null, getLayer: baseMap.getLayer } as never,
      ids,
    );
    expect(setPaintProperty).toHaveBeenCalledWith(pointLayerId, 'circle-emissive-strength', 0);

    setPaintProperty.mockClear();
    setSlot.mockClear();
    syncSharedPointLayersFor3dSurface(
      {
        ...baseMap,
        getTerrain: () => ({ source: 'dem' }),
      } as never,
      ids,
    );
    expect(setPaintProperty).toHaveBeenCalledWith(pointLayerId, 'circle-emissive-strength', 1);
    expect(setSlot).toHaveBeenCalledWith(pointLayerId, 'top');
  });
});