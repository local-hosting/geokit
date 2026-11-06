import { describe, expect, it } from 'vitest';

import { applyMapCameraAttribute } from '../../../src/components/elements/map/map-camera-attribute';
import type { MapInstance } from '../../../src/providers/types';

function cameraMap() {
  const map = {
    center: null as [number, number] | null,
    zoom: null as number | null,
    pitch: null as number | null,
    jumpTo(center: [number, number]) {
      this.center = center;
    },
    setCenter(center: [number, number]) {
      this.jumpTo(center);
    },
    setZoom(zoom: number) {
      this.zoom = zoom;
    },
    setPitch(pitch: number) {
      this.pitch = pitch;
    },
  };
  return map;
}

describe('applyMapCameraAttribute', () => {
  it('keeps the map as this when recentering', () => {
    const map = cameraMap();
    applyMapCameraAttribute(map as MapInstance, 'lat', '40.758', '-73.985', null);
    expect(map.center).toEqual([-73.985, 40.758]);
  });

  it('applies zoom and pitch on the map instance', () => {
    const map = cameraMap();
    applyMapCameraAttribute(map as MapInstance, 'zoom', null, null, '12.5');
    applyMapCameraAttribute(map as MapInstance, 'pitch', null, null, '40');
    expect(map.zoom).toBe(12.5);
    expect(map.pitch).toBe(40);
  });

  it('ignores camera methods the provider does not implement', () => {
    const map = cameraMap();
    expect(() =>
      applyMapCameraAttribute(map as MapInstance, 'bearing', null, null, '20'),
    ).not.toThrow();
  });
});
