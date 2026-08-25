import { useEffect } from 'react';
import type { GkMapElement } from '../shared/types';

/** Keep gk-map map-style attribute in sync with a style id/url. */
export function useGkMapStyle(
  mapElement: GkMapElement | null,
  mapStyle: string
): void {
  useEffect(() => {
    mapElement?.setAttribute?.('map-style', mapStyle);
  }, [mapElement, mapStyle]);
}
