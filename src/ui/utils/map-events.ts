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
}

export interface GkPointEventHandlers {
  onClick?: (detail: GkPointEventDetail) => void | Promise<void>;
  onHover?: (detail: GkPointEventDetail) => void;
  onHoverEnd?: (detail: GkPointEventDetail) => void;
  onFocus?: (event: Event) => void;
  onBlur?: (event: Event) => void;
}

function detailFromEvent(event: Event): GkPointEventDetail {
  return ((event as CustomEvent).detail ?? {}) as GkPointEventDetail;
}

function matchesMap(detail: GkPointEventDetail, mapInstance: unknown | undefined): boolean {
  if (mapInstance == null) return true;
  return detail.map === mapInstance;
}

/** Bind gk-point-* events on a gk-map element; returns teardown. */
export function bindGkPointLayerEvents(
  gkMap: HTMLElement,
  handlers: GkPointEventHandlers,
  options: { mapInstance?: unknown } = {}
): () => void {
  const { mapInstance } = options;

  const onClick = (e: Event) => {
    const detail = detailFromEvent(e);
    if (!matchesMap(detail, mapInstance)) return;
    void handlers.onClick?.(detail);
  };
  const onHover = (e: Event) => {
    const detail = detailFromEvent(e);
    if (!matchesMap(detail, mapInstance)) return;
    handlers.onHover?.(detail);
  };
  const onHoverEnd = (e: Event) => {
    const detail = detailFromEvent(e);
    if (!matchesMap(detail, mapInstance)) return;
    handlers.onHoverEnd?.(detail);
  };
  const onFocus = (e: Event) => handlers.onFocus?.(e);
  const onBlur = (e: Event) => handlers.onBlur?.(e);

  gkMap.addEventListener('gk-point-click', onClick);
  gkMap.addEventListener('gk-point-hover', onHover);
  gkMap.addEventListener('gk-point-hover-end', onHoverEnd);
  gkMap.addEventListener('gk-point-focus', onFocus);
  gkMap.addEventListener('gk-point-blur', onBlur);

  return () => {
    gkMap.removeEventListener('gk-point-click', onClick);
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
