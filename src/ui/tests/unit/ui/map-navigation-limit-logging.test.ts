/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from 'vitest';

import {
  bindMapNavigationProhibitedLogging,
  classifyBlockedZoomOut,
  prohibitedZoomOnWheelDelta,
  readMapMaxBoundsEdges,
  readMapNavigationZoom,
  wheelGestureIsPrimarilyZoom,
  zoomOutWasBlocked,
} from '../../../src/utils/map-navigation-limit-logging';

describe('readMapNavigationZoom', () => {
  it('reads zoom through the map receiver (not an unbound method ref)', () => {
    const map = {
      transform: { zoom: 11.47 },
      getZoom(this: { transform: { zoom: number } }) {
        return this.transform.zoom;
      },
    };
    const unbound = map.getZoom;
    expect(() => unbound()).toThrow();
    expect(readMapNavigationZoom(map as never)).toBeCloseTo(11.47, 5);
  });
});

describe('wheelGestureIsPrimarilyZoom', () => {
  it('treats dominant vertical delta as zoom', () => {
    expect(wheelGestureIsPrimarilyZoom(2, 80)).toBe(true);
    expect(wheelGestureIsPrimarilyZoom(80, 2)).toBe(false);
    expect(wheelGestureIsPrimarilyZoom(0, 0)).toBe(false);
  });
});

describe('prohibitedZoomOnWheelDelta', () => {
  it('flags zoom-out at min zoom (positive deltaY)', () => {
    expect(prohibitedZoomOnWheelDelta(5.75, 5.75, 18, 120)).toBe('min');
  });

  it('flags zoom-in at max zoom (negative deltaY)', () => {
    expect(prohibitedZoomOnWheelDelta(18, 2, 18, -80)).toBe('max');
  });

  it('returns null when zoom can still change', () => {
    expect(prohibitedZoomOnWheelDelta(10, 2, 18, 120)).toBeNull();
    expect(prohibitedZoomOnWheelDelta(10, 2, 18, -80)).toBeNull();
    expect(prohibitedZoomOnWheelDelta(5.75, 5.75, 18, 0)).toBeNull();
  });
});

describe('zoomOutWasBlocked', () => {
  it('detects zoom-out wheel that did not reduce zoom', () => {
    expect(zoomOutWasBlocked(11.47, 11.47, 80)).toBe(true);
    expect(zoomOutWasBlocked(11.47, 11.2, 80)).toBe(false);
    expect(zoomOutWasBlocked(11.47, 11.47, -80)).toBe(false);
  });
});

describe('classifyBlockedZoomOut', () => {
  it('distinguishes navigation minZoom from maxBounds pinch', () => {
    expect(classifyBlockedZoomOut(5.75, 5.75, true)).toBe('minZoom');
    expect(classifyBlockedZoomOut(11.47, 5.75, true)).toBe('maxBounds');
    expect(classifyBlockedZoomOut(11.47, 5.75, false)).toBeNull();
  });
});

describe('readMapMaxBoundsEdges', () => {
  it('reads MapLibre LngLatBounds', () => {
    expect(
      readMapMaxBoundsEdges(() => ({
        getWest: () => -86,
        getSouth: () => 34,
        getEast: () => -84,
        getNorth: () => 36,
      })),
    ).toEqual({ west: -86, south: 34, east: -84, north: 36 });
  });

  it('returns null when getMaxBounds throws (e.g. missing map transform)', () => {
    expect(
      readMapMaxBoundsEdges(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'transform')");
      }),
    ).toBeNull();
  });
});

describe('bindMapNavigationProhibitedLogging', () => {
  it('logs when wheel scroll hits prohibited zoom min', () => {
    const canvas = document.createElement('canvas');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const stop = bindMapNavigationProhibitedLogging(
      {
        getCanvas: () => canvas,
        getZoom: () => 5.75,
        getMinZoom: () => 5.75,
        getMaxZoom: () => 18,
        getCenter: () => ({ lng: -85, lat: 35 }),
        getMaxBounds: () => null,
      },
      { enabled: true, throttleMs: 0 },
    );

    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 50, bubbles: true }));

    expect(log).toHaveBeenCalledWith(expect.stringMatching(/prohibited zoom min/i));

    stop();
    log.mockRestore();
  });

  it('logs maxBounds when zoom-out is blocked above navigation minZoom', async () => {
    const canvas = document.createElement('canvas');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const stop = bindMapNavigationProhibitedLogging(
      {
        getCanvas: () => canvas,
        getZoom: () => 11.47,
        getMinZoom: () => 5.75,
        getMaxZoom: () => 18,
        getCenter: () => ({ lng: -85.30318, lat: 35.08382 }),
        getMaxBounds: () => ({
          getWest: () => -86,
          getSouth: () => 34,
          getEast: () => -84,
          getNorth: () => 36,
        }),
      },
      { enabled: true, throttleMs: 0 },
    );

    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 80, bubbles: true }));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    expect(log).toHaveBeenCalledWith(expect.stringMatching(/prohibited zoom.*maxBounds/i));

    stop();
    log.mockRestore();
  });

  it('does not throw when getMaxBounds must be called on the map receiver', () => {
    const canvas = document.createElement('canvas');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const map = {
      transform: { ready: true },
      getCanvas: () => canvas,
      getZoom: () => 10,
      getMinZoom: () => 2,
      getMaxZoom: () => 18,
      getCenter: () => ({ lng: -85, lat: 35 }),
      getMaxBounds(this: { transform: { ready: boolean } }) {
        if (!this.transform) {
          throw new TypeError("Cannot read properties of undefined (reading 'transform')");
        }
        return {
          getWest: () => -86,
          getSouth: () => 34,
          getEast: () => -84,
          getNorth: () => 36,
        };
      },
    };

    const unbound = map.getMaxBounds;
    expect(() => unbound()).toThrow();

    const stop = bindMapNavigationProhibitedLogging(map as never, {
      enabled: true,
      throttleMs: 0,
    });

    expect(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 0, deltaX: 10, bubbles: true }));
    }).not.toThrow();

    stop();
    log.mockRestore();
  });
});