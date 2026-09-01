import { useEffect, useRef } from 'react';
import {
  bindGkPointLayerEvents,
  type GkPointEventHandlers,
} from '../../utils/map-events';
import type { GkMapElement } from '../shared/types';

export type UseGkMapEventsOptions = {
  mapInstance?: unknown;
};

/** Bind gk-point-* events on a gk-map element with automatic cleanup. */
export function useGkMapEvents(
  mapElement: GkMapElement | null,
  handlers: GkPointEventHandlers,
  options: UseGkMapEventsOptions = {}
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!mapElement) return;
    return bindGkPointLayerEvents(
      mapElement,
      {
        onClick: (detail) => handlersRef.current.onClick?.(detail),
        onHover: (detail) => handlersRef.current.onHover?.(detail),
        onHoverEnd: (detail) => handlersRef.current.onHoverEnd?.(detail),
        onFocus: (event) => handlersRef.current.onFocus?.(event),
        onBlur: (event) => handlersRef.current.onBlur?.(event),
      },
      { mapInstance: options.mapInstance }
    );
  }, [mapElement, options.mapInstance]);
}
