/**
 * Lifecycle-safe map listeners on gk-map — map.on ergonomics over gk-map-* DOM events.
 */

import type { GkMapClickDetail, GkMapMoveEndDetail } from './map-semantic-events';

export type GkMapListenEvent = 'moveend' | 'click';

export type GkMapEventDetailMap = {
  moveend: GkMapMoveEndDetail;
  click: GkMapClickDetail;
};

export type GkMapEventHandler<E extends GkMapListenEvent> = (
  detail: GkMapEventDetailMap[E]
) => void;

const DOM_EVENT_BY_MAP_EVENT: Record<GkMapListenEvent, string> = {
  moveend: 'gk-map-moveend',
  click: 'gk-map-click',
};

const handlerWrappers = new WeakMap<Function, EventListener>();

function domEventFor(event: GkMapListenEvent): string {
  return DOM_EVENT_BY_MAP_EVENT[event];
}

function listenerFor<E extends GkMapListenEvent>(
  handler: GkMapEventHandler<E>
): EventListener {
  const existing = handlerWrappers.get(handler);
  if (existing) return existing;

  const wrapper: EventListener = (event: Event) => {
    handler((event as CustomEvent<GkMapEventDetailMap[E]>).detail);
  };
  handlerWrappers.set(handler, wrapper);
  return wrapper;
}

/** Subscribe to a map event on gk-map (backed by gk-map-moveend / gk-map-click). */
export function onGkMapEvent<E extends GkMapListenEvent>(
  element: HTMLElement,
  event: E,
  handler: GkMapEventHandler<E>
): () => void {
  const listener = listenerFor(handler);
  element.addEventListener(domEventFor(event), listener);
  return () => offGkMapEvent(element, event, handler);
}

/** Unsubscribe a handler previously passed to onGkMapEvent or gk-map.on. */
export function offGkMapEvent<E extends GkMapListenEvent>(
  element: HTMLElement,
  event: E,
  handler: GkMapEventHandler<E>
): void {
  const listener = handlerWrappers.get(handler);
  if (!listener) return;
  element.removeEventListener(domEventFor(event), listener);
}
