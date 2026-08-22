import { describe, expect, it, vi } from 'vitest';
import {
  boundsToLngLatCorners,
  clampCenterToContainBoundsAtZoom,
  fitMapToContainedBounds,
  focusPointKeepingBoundsVisible,
  getContainedFrameZoom,
  lockMaxZoomToContainedFrame,
  resolveContainedFrameZoom,
  type ContainedBoundsMap,
} from '../../../../src/utils/bounds/map-camera.js';

const CONTAIN_BOUNDS: [number, number, number, number] = [-96, 29, -93, 31];

function mockMap(frameZoom: number): ContainedBoundsMap {
  return {
    cameraForBounds: vi.fn(() => ({ center: [-94.5, 30], zoom: frameZoom })),
    getZoom: vi.fn(() => 10),
    easeTo: vi.fn(),
    setMaxZoom: vi.fn(),
  };
}

describe('map-camera', () => {
  it('getContainedFrameZoom reads cameraForBounds zoom', () => {
    const map = mockMap(7.2);
    expect(getContainedFrameZoom(map, CONTAIN_BOUNDS)).toBe(7.2);
  });

  it('focusPointKeepingBoundsVisible never zooms in past frame', () => {
    const map = mockMap(7);
    (map.getZoom as ReturnType<typeof vi.fn>).mockReturnValue(10);
    focusPointKeepingBoundsVisible(map, { lng: -94, lat: 30 }, CONTAIN_BOUNDS);
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 7 }));
  });

  it('clampCenterToContainBoundsAtZoom keeps center inside bounds', () => {
    const map = mockMap(8);
    const [lng, lat] = clampCenterToContainBoundsAtZoom(
      map,
      { lng: -96, lat: 29 },
      CONTAIN_BOUNDS,
      8
    );
    expect(lng).toBeGreaterThan(CONTAIN_BOUNDS[0]);
    expect(lat).toBeGreaterThan(CONTAIN_BOUNDS[1]);
  });
});

describe('map-camera framing helpers', () => {
  it('converts bounds to lng/lat corners', () => {
    expect(boundsToLngLatCorners(CONTAIN_BOUNDS)).toEqual([
      [CONTAIN_BOUNDS[0], CONTAIN_BOUNDS[1]],
      [CONTAIN_BOUNDS[2], CONTAIN_BOUNDS[3]],
    ]);
  });

  it('locks max zoom from contained frame', () => {
    const map = mockMap(6.5);
    lockMaxZoomToContainedFrame(map, CONTAIN_BOUNDS);
    expect(map.setMaxZoom).toHaveBeenCalledWith(6.5);
  });

  it('fits map to contained bounds and hooks moveend', () => {
    const handlers = new Map<string, () => void>();
    const map: ContainedBoundsMap = {
      ...mockMap(7),
      fitBounds: vi.fn(),
      once: vi.fn((event, handler) => handlers.set(event, handler)),
      off: vi.fn((event) => handlers.delete(event)),
      getZoom: vi.fn(() => 7),
    };
    fitMapToContainedBounds(map, CONTAIN_BOUNDS);
    expect(map.fitBounds).toHaveBeenCalled();
    handlers.get('moveend')?.();
    expect(map.setMaxZoom).toHaveBeenCalled();
  });

  it('resolveContainedFrameZoom respects existing max zoom cap', () => {
    const map = {
      ...mockMap(8),
      getMaxZoom: vi.fn(() => 7.5),
    };
    expect(resolveContainedFrameZoom(map, CONTAIN_BOUNDS)).toBe(7.5);
  });
});
