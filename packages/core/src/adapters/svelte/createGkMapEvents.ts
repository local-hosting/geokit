import {
  bindGkPointLayerEvents,
  type GkPointEventHandlers,
} from '../../ui/utils/map-events.js';
import type { GkMapElement } from '../shared/types.js';

export type CreateGkMapEventsOptions = {
  mapInstance?: () => unknown;
};

/** Bind gk-point-* events; call returned teardown from onDestroy. */
export function createGkMapEvents(
  getMapElement: () => GkMapElement | null,
  handlers: GkPointEventHandlers,
  options: CreateGkMapEventsOptions = {}
): () => void {
  const element = getMapElement();
  if (!element) return () => {};
  return bindGkPointLayerEvents(element, handlers, {
    mapInstance: options.mapInstance?.(),
  });
}
