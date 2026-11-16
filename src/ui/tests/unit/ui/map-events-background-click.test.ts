// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindGkPointLayerEvents } from '../../../src/utils/map-events';

function mapClick(gkMap: HTMLElement, originalEvent: Event): void {
  gkMap.dispatchEvent(
    new CustomEvent('gk-map-click', {
      detail: { element: gkMap, map: {}, lngLat: { lng: 1, lat: 2 }, originalEvent },
    })
  );
}

function pointClick(gkMap: HTMLElement, originalEvent: Event): void {
  gkMap.dispatchEvent(
    new CustomEvent('gk-point-click', {
      detail: { element: gkMap, map: {}, features: [{ id: 'a' }], originalEvent },
    })
  );
}

describe('bindGkPointLayerEvents onBackgroundClick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires when the map is clicked off every marker', () => {
    const gkMap = document.createElement('gk-map');
    const onBackgroundClick = vi.fn();
    const unbind = bindGkPointLayerEvents(gkMap, { onBackgroundClick }, { targetGkMap: gkMap });

    mapClick(gkMap, new MouseEvent('click'));
    vi.runAllTimers();

    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
    expect(onBackgroundClick.mock.calls[0][0].lngLat).toEqual({ lng: 1, lat: 2 });
    unbind();
  });

  it('does not fire when the same click hit a marker (either dispatch order)', () => {
    const gkMap = document.createElement('gk-map');
    const onBackgroundClick = vi.fn();
    const unbind = bindGkPointLayerEvents(gkMap, { onBackgroundClick }, { targetGkMap: gkMap });

    const first = new MouseEvent('click');
    mapClick(gkMap, first);
    pointClick(gkMap, first);
    const second = new MouseEvent('click');
    pointClick(gkMap, second);
    mapClick(gkMap, second);
    vi.runAllTimers();

    expect(onBackgroundClick).not.toHaveBeenCalled();
    unbind();
  });

  it('stops listening after teardown', () => {
    const gkMap = document.createElement('gk-map');
    const onBackgroundClick = vi.fn();
    const unbind = bindGkPointLayerEvents(gkMap, { onBackgroundClick }, { targetGkMap: gkMap });

    mapClick(gkMap, new MouseEvent('click'));
    unbind();
    vi.runAllTimers();

    expect(onBackgroundClick).not.toHaveBeenCalled();
  });
});
