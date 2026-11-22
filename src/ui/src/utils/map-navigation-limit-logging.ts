/** Plain message prefix — pino shows `[gk-map]` from the scoped logger when wired. */
export const MAP_NAV_LIMIT_LOG_PREFIX = '';

export type MapBoundsEdges = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type MapNavigationLimitLogHost = {
  getCanvas?: () => HTMLCanvasElement;
  getZoom?: () => number;
  getMinZoom?: () => number;
  getMaxZoom?: () => number;
  getCenter?: () => { lng: number; lat: number };
  getMaxBounds?: () => unknown;
};

export type BindMapNavigationProhibitedLoggingOptions = {
  enabled?: boolean;
  throttleMs?: number;
  log?: (...args: unknown[]) => void;
  zoomEpsilon?: number;
  lngLatEpsilon?: number;
};

export function wheelRequestsZoomOut(deltaY: number): boolean {
  return deltaY > 0;
}

export function wheelRequestsZoomIn(deltaY: number): boolean {
  return deltaY < 0;
}

export function wheelGestureIsPrimarilyZoom(deltaX: number, deltaY: number): boolean {
  if (deltaY === 0) return false;
  return Math.abs(deltaY) >= Math.abs(deltaX);
}

export function zoomOutWasBlocked(
  zoomBefore: number,
  zoomAfter: number,
  deltaY: number,
  zoomEpsilon = 1e-4,
): boolean {
  if (!wheelRequestsZoomOut(deltaY)) return false;
  return zoomAfter >= zoomBefore - zoomEpsilon;
}

export function classifyBlockedZoomOut(
  zoom: number,
  navigationMinZoom: number,
  hasMaxBounds: boolean,
  zoomEpsilon = 1e-4,
): 'minZoom' | 'maxBounds' | null {
  if (zoom <= navigationMinZoom + zoomEpsilon) return 'minZoom';
  if (hasMaxBounds) return 'maxBounds';
  return null;
}

export function prohibitedZoomOnWheelDelta(
  zoom: number,
  minZoom: number,
  maxZoom: number,
  deltaY: number,
  zoomEpsilon = 1e-4,
): 'min' | 'max' | null {
  if (deltaY === 0) return null;
  if (deltaY > 0 && zoom <= minZoom + zoomEpsilon) return 'min';
  if (deltaY < 0 && zoom >= maxZoom - zoomEpsilon) return 'max';
  return null;
}

function readMapNumber(
  map: MapNavigationLimitLogHost,
  read: (host: MapNavigationLimitLogHost) => number | undefined,
): number | null {
  try {
    const value = read(map);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function readMapNavigationZoom(map: MapNavigationLimitLogHost): number | null {
  return readMapNumber(map, (host) => host.getZoom?.());
}

function readMapNavigationMinZoom(map: MapNavigationLimitLogHost): number | null {
  return readMapNumber(map, (host) => host.getMinZoom?.());
}

function readMapNavigationMaxZoom(map: MapNavigationLimitLogHost): number | null {
  return readMapNumber(map, (host) => host.getMaxZoom?.());
}

function readMapNavigationCenter(
  map: MapNavigationLimitLogHost,
): { lng: number; lat: number } | null {
  try {
    const center = map.getCenter?.();
    if (!center || !Number.isFinite(center.lng) || !Number.isFinite(center.lat)) return null;
    return center;
  } catch {
    return null;
  }
}

export function readMapMaxBoundsEdges(getMaxBounds?: () => unknown): MapBoundsEdges | null {
  let raw: unknown;
  try {
    raw = getMaxBounds?.();
  } catch {
    return null;
  }
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length >= 4) {
    const [west, south, east, north] = raw as number[];
    return { west, south, east, north };
  }
  if (typeof raw === 'object' && raw !== null && 'getWest' in raw) {
    const bounds = raw as {
      getWest: () => number;
      getSouth: () => number;
      getEast: () => number;
      getNorth: () => number;
    };
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };
  }
  return null;
}

export function edgesAtPanLimit(
  center: { lng: number; lat: number },
  bounds: MapBoundsEdges,
  epsilon = 1e-5,
): { west: boolean; east: boolean; south: boolean; north: boolean } {
  return {
    west: center.lng <= bounds.west + epsilon,
    east: center.lng >= bounds.east - epsilon,
    south: center.lat <= bounds.south + epsilon,
    north: center.lat >= bounds.north - epsilon,
  };
}

export function prohibitedPanOnWheelDelta(
  center: { lng: number; lat: number },
  bounds: MapBoundsEdges,
  deltaX: number,
  deltaY: number,
  lngLatEpsilon = 1e-5,
): Array<'west' | 'east' | 'south' | 'north'> {
  if (deltaX === 0 && deltaY === 0) return [];
  const at = edgesAtPanLimit(center, bounds, lngLatEpsilon);
  const blocked: Array<'west' | 'east' | 'south' | 'north'> = [];
  if (at.west && deltaX > 0) blocked.push('west');
  if (at.east && deltaX < 0) blocked.push('east');
  if (at.south && deltaY > 0) blocked.push('south');
  if (at.north && deltaY < 0) blocked.push('north');
  return blocked;
}

/** Dev helper: log when scroll/pinch zoom or pan hits navigation limits. */
export function bindMapNavigationProhibitedLogging(
  map: MapNavigationLimitLogHost,
  options?: BindMapNavigationProhibitedLoggingOptions,
): () => void {
  const enabled = options?.enabled ?? false;
  if (!enabled) return () => {};

  const log = options?.log ?? console.log.bind(console);
  const throttleMs = options?.throttleMs ?? 400;
  const zoomEpsilon = options?.zoomEpsilon ?? 1e-4;
  const lngLatEpsilon = options?.lngLatEpsilon ?? 1e-5;

  const canvas = map.getCanvas?.();
  if (!canvas) return () => {};

  const lastLogged = new Map<string, number>();

  const logOnce = (key: string, message: string) => {
    const now = Date.now();
    const prev = lastLogged.get(key) ?? 0;
    if (now - prev < throttleMs) return;
    lastLogged.set(key, now);
    log(message);
  };

  const onWheel = (event: WheelEvent) => {
    const zoomBefore = readMapNavigationZoom(map);
    const minZoom = readMapNavigationMinZoom(map);
    const maxZoom = readMapNavigationMaxZoom(map);
    if (zoomBefore == null || minZoom == null || maxZoom == null) return;

    const maxBounds = readMapMaxBoundsEdges(() => map.getMaxBounds?.());

    const zoomEdge = prohibitedZoomOnWheelDelta(
      zoomBefore,
      minZoom,
      maxZoom,
      event.deltaY,
      zoomEpsilon,
    );
    if (zoomEdge === 'min') {
      logOnce(
        'zoom-min',
        `${MAP_NAV_LIMIT_LOG_PREFIX} scroll hit prohibited zoom min (zoom ${zoomBefore.toFixed(2)}, minZoom ${minZoom.toFixed(2)})`,
      );
    } else if (zoomEdge === 'max') {
      logOnce(
        'zoom-max',
        `${MAP_NAV_LIMIT_LOG_PREFIX} scroll hit prohibited zoom max (zoom ${zoomBefore.toFixed(2)}, maxZoom ${maxZoom.toFixed(2)})`,
      );
    } else if (wheelRequestsZoomOut(event.deltaY)) {
      requestAnimationFrame(() => {
        const zoomAfter = readMapNavigationZoom(map);
        if (zoomAfter == null) return;
        if (!zoomOutWasBlocked(zoomBefore, zoomAfter, event.deltaY, zoomEpsilon)) return;
        const reason = classifyBlockedZoomOut(zoomAfter, minZoom, maxBounds != null, zoomEpsilon);
        if (reason === 'maxBounds') {
          logOnce(
            'zoom-maxBounds',
            `${MAP_NAV_LIMIT_LOG_PREFIX} scroll hit prohibited zoom maxBounds (zoom ${zoomAfter.toFixed(2)}, navigation minZoom ${minZoom.toFixed(2)} — map cannot fit a wider view inside project bounds)`,
          );
        } else if (reason === 'minZoom') {
          logOnce(
            'zoom-min',
            `${MAP_NAV_LIMIT_LOG_PREFIX} scroll hit prohibited zoom min (zoom ${zoomAfter.toFixed(2)}, minZoom ${minZoom.toFixed(2)})`,
          );
        }
      });
    } else if (wheelRequestsZoomIn(event.deltaY)) {
      requestAnimationFrame(() => {
        const zoomAfter = readMapNavigationZoom(map);
        if (zoomAfter == null) return;
        if (zoomAfter <= zoomBefore + zoomEpsilon) {
          logOnce(
            'zoom-max',
            `${MAP_NAV_LIMIT_LOG_PREFIX} scroll hit prohibited zoom max (zoom ${zoomAfter.toFixed(2)}, maxZoom ${maxZoom.toFixed(2)})`,
          );
        }
      });
    }

    const bounds = maxBounds;
    if (bounds && !wheelGestureIsPrimarilyZoom(event.deltaX, event.deltaY)) {
      const center = readMapNavigationCenter(map);
      if (!center) return;
      for (const edge of prohibitedPanOnWheelDelta(
        center,
        bounds,
        event.deltaX,
        event.deltaY,
        lngLatEpsilon,
      )) {
        logOnce(
          `pan-${edge}`,
          `${MAP_NAV_LIMIT_LOG_PREFIX} scroll hit prohibited pan ${edge} (center ${center.lng.toFixed(5)}, ${center.lat.toFixed(5)})`,
        );
      }
    }
  };

  canvas.addEventListener('wheel', onWheel, { passive: true });
  return () => canvas.removeEventListener('wheel', onWheel);
}