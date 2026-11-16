/**
 * gk-map shared point layer event wiring — framework-agnostic.
 */

export interface GkPointEventDetail {
  lngLat?: { lng: number; lat: number };
  features?: Array<{
    id?: string | number;
    properties?: Record<string, unknown>;
    geometry?: { type?: string; coordinates?: number[] };
  }>;
  sourceId?: string;
  map?: unknown;
  /** gk-map element that dispatched the event (preferred for routing). */
  element?: HTMLElement;
}

/** `gk-map-click` that hit no shared-point marker. */
export interface GkBackgroundClickDetail {
  lngLat?: { lng: number; lat: number };
  map?: unknown;
  element?: HTMLElement;
  originalEvent?: Event;
}

export interface GkPointEventHandlers {
  onClick?: (detail: GkPointEventDetail) => void | Promise<void>;
  /** Map clicked off every marker — e.g. clear the selection. */
  onBackgroundClick?: (detail: GkBackgroundClickDetail) => void;
  onHover?: (detail: GkPointEventDetail) => void;
  onHoverEnd?: (detail: GkPointEventDetail) => void;
  onFocus?: (event: Event) => void;
  onBlur?: (event: Event) => void;
}

function detailFromEvent(event: Event): GkPointEventDetail {
  return ((event as CustomEvent).detail ?? {}) as GkPointEventDetail;
}

/** True when the event belongs to this gk-map (element identity beats map ref). */
export function eventMatchesGkMap(
  detail: GkPointEventDetail,
  gkMap: HTMLElement | null | undefined
): boolean {
  if (!gkMap) return false;
  if (detail.element) return detail.element === gkMap;
  if (!detail.map) return true;
  const ourMap = (gkMap as { getMap?: () => unknown }).getMap?.();
  return !ourMap || detail.map === ourMap;
}

function matchesMap(detail: GkPointEventDetail, mapInstance: unknown | undefined): boolean {
  if (mapInstance == null) return true;
  return detail.map === mapInstance;
}

/** Bind gk-point-* events on a gk-map element; returns teardown. */
export function bindGkPointLayerEvents(
  gkMap: HTMLElement,
  handlers: GkPointEventHandlers,
  options: { mapInstance?: unknown; targetGkMap?: HTMLElement } = {}
): () => void {
  const { mapInstance, targetGkMap } = options;

  function shouldHandle(detail: GkPointEventDetail): boolean {
    if (targetGkMap) return eventMatchesGkMap(detail, targetGkMap);
    return matchesMap(detail, mapInstance);
  }

  // MapLibre fires the map click and the marker-layer click in either order — wait a
  // macrotask, then treat the map click as background only if no marker claimed it.
  const pointClickEvents = new WeakSet<Event>();
  const pendingBackground = new Set<ReturnType<typeof setTimeout>>();

  const onClick = (e: Event) => {
    const detail = detailFromEvent(e);
    if (!shouldHandle(detail)) return;
    const originalEvent = (detail as GkBackgroundClickDetail).originalEvent;
    if (originalEvent) pointClickEvents.add(originalEvent);
    void handlers.onClick?.(detail);
  };
  const onMapClick = (e: Event) => {
    if (!handlers.onBackgroundClick) return;
    const detail = ((e as CustomEvent).detail ?? {}) as GkBackgroundClickDetail;
    if (!shouldHandle(detail)) return;
    const timer = setTimeout(() => {
      pendingBackground.delete(timer);
      if (detail.originalEvent && pointClickEvents.has(detail.originalEvent)) return;
      handlers.onBackgroundClick?.(detail);
    }, 0);
    pendingBackground.add(timer);
  };
  const onHover = (e: Event) => {
    const detail = detailFromEvent(e);
    if (!shouldHandle(detail)) return;
    handlers.onHover?.(detail);
  };
  const onHoverEnd = (e: Event) => {
    const detail = detailFromEvent(e);
    if (!shouldHandle(detail)) return;
    handlers.onHoverEnd?.(detail);
  };
  const onFocus = (e: Event) => handlers.onFocus?.(e);
  const onBlur = (e: Event) => handlers.onBlur?.(e);

  gkMap.addEventListener('gk-point-click', onClick);
  gkMap.addEventListener('gk-map-click', onMapClick);
  gkMap.addEventListener('gk-point-hover', onHover);
  gkMap.addEventListener('gk-point-hover-end', onHoverEnd);
  gkMap.addEventListener('gk-point-focus', onFocus);
  gkMap.addEventListener('gk-point-blur', onBlur);

  return () => {
    gkMap.removeEventListener('gk-point-click', onClick);
    gkMap.removeEventListener('gk-map-click', onMapClick);
    for (const timer of pendingBackground) clearTimeout(timer);
    pendingBackground.clear();
    gkMap.removeEventListener('gk-point-hover', onHover);
    gkMap.removeEventListener('gk-point-hover-end', onHoverEnd);
    gkMap.removeEventListener('gk-point-focus', onFocus);
    gkMap.removeEventListener('gk-point-blur', onBlur);
  };
}

export interface DebouncedHoverStateHandlers {
  onHover?: (payload: GkPointEventDetail, sourceId: string) => void;
  onHoverEnd?: () => void;
  hoverDebounceMs?: number;
}

/** Generic debounced hover state for shared point layers. */
export function createDebouncedHoverState(handlers: DebouncedHoverStateHandlers = {}) {
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  let current: { lng: number; lat: number } | null = null;
  const debounceMs = handlers.hoverDebounceMs ?? 0;

  function clearHoverTimeout(): void {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
  }

  function onHover(payload: GkPointEventDetail, sourceId: string): void {
    const features = payload.features;
    if (!features?.length) {
      onHoverEnd();
      return;
    }

    const coords = payload.lngLat;
    if (!coords) {
      onHoverEnd();
      return;
    }

    if (current && current.lat === coords.lat && current.lng === coords.lng) {
      return;
    }

    current = { lng: coords.lng, lat: coords.lat };
    clearHoverTimeout();

    if (debounceMs <= 0) {
      handlers.onHover?.(payload, sourceId);
      return;
    }

    hoverTimeout = setTimeout(() => {
      hoverTimeout = null;
      handlers.onHover?.(payload, sourceId);
    }, debounceMs);
  }

  function onHoverEnd(): void {
    clearHoverTimeout();
    current = null;
    handlers.onHoverEnd?.();
  }

  function cleanup(): void {
    onHoverEnd();
  }

  return { onHover, onHoverEnd, cleanup };
}
