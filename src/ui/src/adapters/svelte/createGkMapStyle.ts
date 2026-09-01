import type { GkMapElement } from '../shared/types';

/** Keep gk-map map-style attribute in sync with a style id/url getter. */
export function createGkMapStyle(getMapElement: () => GkMapElement | null, getStyle: () => string) {
  return {
    sync() {
      const style = getStyle();
      getMapElement()?.setAttribute?.('map-style', style);
    },
  };
}
