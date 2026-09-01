// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindGkPointLayerEvents } from '../../../src/utils/map-events';

describe('map-events', () => {
  it('bindGkPointLayerEvents forwards matching map events', () => {
    const gkMap = document.createElement('gk-map');
    const map = {};
    const onClick = vi.fn();
    const unbind = bindGkPointLayerEvents(gkMap, { onClick }, { mapInstance: map });

    gkMap.dispatchEvent(
      new CustomEvent('gk-point-click', {
        detail: { map, features: [{ properties: { slug: 'a' } }] },
      })
    );
    expect(onClick).toHaveBeenCalledTimes(1);

    gkMap.dispatchEvent(
      new CustomEvent('gk-point-click', {
        detail: { map: {}, features: [{ properties: { slug: 'b' } }] },
      })
    );
    expect(onClick).toHaveBeenCalledTimes(1);

    unbind();
  });

  it('bindGkPointLayerEvents matches by element when gkMap option is set', () => {
    const gkMap = document.createElement('gk-map');
    const otherMap = document.createElement('gk-map');
    const onClick = vi.fn();
    const unbind = bindGkPointLayerEvents(gkMap, { onClick }, { targetGkMap: gkMap });

    gkMap.dispatchEvent(
      new CustomEvent('gk-point-click', {
        detail: {
          element: gkMap,
          map: {},
          features: [{ properties: { slug: 'a' } }],
        },
      })
    );
    expect(onClick).toHaveBeenCalledTimes(1);

    gkMap.dispatchEvent(
      new CustomEvent('gk-point-click', {
        detail: {
          element: otherMap,
          map: {},
          features: [{ properties: { slug: 'b' } }],
        },
      })
    );
    expect(onClick).toHaveBeenCalledTimes(1);

    unbind();
  });
});
