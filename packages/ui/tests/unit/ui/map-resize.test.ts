import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  getMapResizeTarget,
  hasRenderableMapSize,
  safeResizeMap,
  syncMapDevicePixelRatio,
  wrapMapResize,
} from '../../../src/utils/map-utils';

function mockRect(element: HTMLElement, width: number, height: number): MockInstance<[], DOMRect> {
  return vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('map resize guards', () => {
  let host: HTMLDivElement;

  afterEach(() => {
    host?.remove();
    vi.restoreAllMocks();
  });

  it('skips resize when the host has zero dimensions', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    mockRect(host, 0, 0);

    const resize = vi.fn();
    const map = { resize, getContainer: () => host };

    expect(hasRenderableMapSize(host)).toBe(false);
    expect(safeResizeMap(map, host)).toBe(false);
    expect(resize).not.toHaveBeenCalled();
  });

  it('resizes when the host has visible dimensions', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    mockRect(host, 320, 240);

    const resize = vi.fn();
    const map = { resize, getContainer: () => host };

    expect(hasRenderableMapSize(host)).toBe(true);
    expect(safeResizeMap(map, host)).toBe(true);
    expect(resize).toHaveBeenCalledOnce();
  });

  it('wrapMapResize no-ops hidden containers and swallows SDK resize errors', () => {
    host = document.createElement('div');
    host.style.display = 'none';
    document.body.appendChild(host);
    mockRect(host, 320, 240);

    const originalResize = vi.fn(() => {
      throw new TypeError("Cannot read properties of null (reading '0')");
    });
    const map = { resize: originalResize, getContainer: () => host };

    wrapMapResize(map);
    map.resize();
    map.resize();

    expect(originalResize).not.toHaveBeenCalled();
  });

  it('getMapResizeTarget prefers the explicit host element', () => {
    host = document.createElement('div');
    const container = document.createElement('div');
    const map = { getContainer: () => container };

    expect(getMapResizeTarget(map, host)).toBe(host);
    expect(getMapResizeTarget(map)).toBe(container);
  });

  it('syncMapDevicePixelRatio updates map when DPR differs', () => {
    const setPixelRatio = vi.fn();
    const map = { getPixelRatio: () => 1, setPixelRatio };
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    syncMapDevicePixelRatio(map);
    expect(setPixelRatio).toHaveBeenCalledWith(2);
  });
});
