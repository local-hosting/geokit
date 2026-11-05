import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapLocalStore } from '../../../../src/storage/map-local-store';
import {
  applyCameraFrameToMap,
  bindMapMoveendLocalSync,
  readCameraFrameFromMap,
  restoreLocalCameraToMap,
} from '../../../../src/components/elements/map/map-local-sync';

function createMapStub() {
  return {
    handlers: {} as Record<string, () => void>,
    on(event: string, handler: () => void) {
      this.handlers[event] = handler;
    },
    off(event: string) {
      delete this.handlers[event];
    },
    getCenter: () => ({ lat: 40.75, lng: -73.98 }),
    getZoom: () => 12,
    getPitch: () => 15,
    getBearing: () => 30,
    jumpTo: vi.fn(),
  };
}

afterEach(() => {
  MapLocalStore.resetForTesting();
  sessionStorage.clear();
});

describe('map local sync helpers', () => {
  it('readCameraFrameFromMap maps center, zoom, pitch, and bearing', () => {
    const map = createMapStub();
    expect(readCameraFrameFromMap(map)).toEqual({
      centerLatitude: 40.75,
      centerLongitude: -73.98,
      zoom: 12,
      pitch: 15,
      bearing: 30,
    });
  });

  it('bindMapMoveendLocalSync persists camera in session scope on moveend', async () => {
    vi.useFakeTimers();
    const map = createMapStub();
    const handle = bindMapMoveendLocalSync(map, { mapId: 'hero', persistScope: 'session' });
    map.handlers.moveend();
    vi.advanceTimersByTime(300);
    await vi.waitFor(async () => {
      const loaded = await MapLocalStore.getInstance().getLocalState('hero', 'session');
      expect(loaded?.cameraFrame).toEqual({
        centerLatitude: 40.75,
        centerLongitude: -73.98,
        zoom: 12,
        pitch: 15,
        bearing: 30,
      });
    });
    handle.unbind();
    vi.useRealTimers();
  });

  it('restoreLocalCameraToMap applies stored frame via jumpTo', async () => {
    const store = MapLocalStore.getInstance();
    await store.patchLocalState(
      'restore-me',
      {
        cameraFrame: {
          centerLatitude: 34,
          centerLongitude: -118,
          zoom: 9,
          pitch: 0,
          bearing: 45,
        },
        persistScope: 'session',
      },
      'session',
    );
    const map = createMapStub();
    const restored = await restoreLocalCameraToMap(map, 'restore-me', 'session');
    expect(restored).toBe(true);
    expect(map.jumpTo).toHaveBeenCalledWith({
      center: [-118, 34],
      zoom: 9,
      pitch: 0,
      bearing: 45,
    });
  });

  it('applyCameraFrameToMap uses jumpTo', () => {
    const map = createMapStub();
    applyCameraFrameToMap(map, {
      centerLatitude: 1,
      centerLongitude: 2,
      zoom: 3,
      pitch: 4,
      bearing: 5,
    });
    expect(map.jumpTo).toHaveBeenCalledWith({
      center: [2, 1],
      zoom: 3,
      pitch: 4,
      bearing: 5,
    });
  });
});
