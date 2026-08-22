import { describe, expect, it, vi } from 'vitest';
import {
  clampCenterToContainBoundsAtZoom,
  focusPointKeepingBoundsVisible,
  getContainedFrameZoom,
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
