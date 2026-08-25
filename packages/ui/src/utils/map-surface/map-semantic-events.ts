/**
 * Semantic gk-map events from MapLibre (moveend, background click).
 */

type MapLike = {
  on?: (event: string, layerOrHandler?: unknown, handler?: unknown) => void;
  off?: (event: string, layerOrHandler?: unknown, handler?: unknown) => void;
  getBounds?: () => unknown;
};

export type GkMapMoveEndDetail = {
  map: unknown;
  element: HTMLElement;
  bounds?: unknown;
};

export type GkMapClickDetail = {
  lngLat?: { lng: number; lat: number };
  map: unknown;
  element: HTMLElement;
  originalEvent?: Event;
};

/** Dispatch gk-map-moveend and gk-map-click from a MapLibre map instance. */
export function bindGkMapSemanticEvents(
  mapElement: HTMLElement,
  map: MapLike
): () => void {
  if (!map?.on) return () => {};

  const onMoveEnd = (): void => {
    mapElement.dispatchEvent(
      new CustomEvent<GkMapMoveEndDetail>('gk-map-moveend', {
        detail: {
          map,
          element: mapElement,
          bounds: map.getBounds?.(),
        },
        bubbles: true,
      })
    );
  };

  const onClick = (e: { lngLat?: { lng: number; lat: number }; originalEvent?: Event }): void => {
    mapElement.dispatchEvent(
      new CustomEvent<GkMapClickDetail>('gk-map-click', {
        detail: {
          lngLat: e.lngLat,
          map,
          element: mapElement,
          originalEvent: e.originalEvent,
        },
        bubbles: true,
        cancelable: true,
      })
    );
  };

  map.on('moveend', onMoveEnd);
  map.on('click', onClick);

  return () => {
    map.off?.('moveend', onMoveEnd);
    map.off?.('click', onClick);
  };
}
