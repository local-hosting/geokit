/**
 * Map URL hash sync (Single Responsibility: parse and apply #map=zoom/lat/lng/pitch/bearing)
 */

export interface UrlHashState {
  zoom: number;
  lat: number;
  lng: number;
  pitch: number;
  bearing: number;
}

/**
 * Parse map state from URL hash. Format: #map=zoom/lat/lng[/pitch][/bearing]
 */
export function parseUrlHashState(): UrlHashState | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#map=')) return null;

  try {
    const parts = hash.slice(5).split('/');
    if (parts.length < 3) return null;

    const zoom = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    const lng = parseFloat(parts[2]);
    const pitch = parts.length > 3 ? parseFloat(parts[3]) : 0;
    const bearing = parts.length > 4 ? parseFloat(parts[4]) : 0;

    if (isNaN(zoom) || isNaN(lat) || isNaN(lng) || isNaN(pitch) || isNaN(bearing)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return { zoom, lat, lng, pitch, bearing };
  } catch {
    return null;
  }
}

/**
 * Build hash string from state (only include pitch/bearing if non-zero).
 */
export function buildHashFromState(state: UrlHashState): string {
  const roundedZoom = Math.round(state.zoom * 100) / 100;
  const roundedLat = Math.round(state.lat * 100000) / 100000;
  const roundedLng = Math.round(state.lng * 100000) / 100000;
  const roundedPitch = Math.round(state.pitch * 10) / 10;
  const roundedBearing = Math.round(state.bearing * 10) / 10;

  let hashString = `#map=${roundedZoom}/${roundedLat}/${roundedLng}`;
  if (roundedPitch !== 0 || roundedBearing !== 0) {
    hashString += `/${roundedPitch}/${roundedBearing}`;
  }
  return hashString;
}

/**
 * Apply state to map via jumpTo. Map must have jumpTo(center, zoom, pitch, bearing).
 */
export function applyStateToMap(
  map: {
    jumpTo?: (opts: {
      center: [number, number];
      zoom: number;
      pitch?: number;
      bearing?: number;
    }) => void;
  },
  state: UrlHashState
): void {
  if (!map?.jumpTo) return;
  map.jumpTo({
    center: [state.lng, state.lat],
    zoom: state.zoom,
    pitch: state.pitch,
    bearing: state.bearing,
  });
}


/**
 * Strip pitch/bearing from #map= hash (flat maps when terrain is off).
 */
export function sanitizeMapHashFlatView(options: {
  terrainEnabled?: boolean;
  onFlattened?: (detail: { hadPitch: number; hadBearing: number }) => void;
} = {}): void {
  if (options.terrainEnabled) return;
  if (typeof window === 'undefined') return;
  if (!window.location.hash.startsWith('#map=')) return;
  try {
    const parts = window.location.hash.slice(5).split('/');
    if (parts.length <= 3) return;
    const pitch = parts.length > 3 ? parseFloat(parts[3]) : 0;
    const bearing = parts.length > 4 ? parseFloat(parts[4]) : 0;
    if (
      (!pitch || Number.isNaN(pitch)) &&
      (!bearing || Number.isNaN(bearing))
    ) {
      return;
    }
    const hashString = `#map=${parts[0]}/${parts[1]}/${parts[2]}`;
    if (window.location.hash !== hashString) {
      history.replaceState(history.state, '', hashString);
      options.onFlattened?.({ hadPitch: pitch, hadBearing: bearing });
    }
  } catch {
    // Ignore malformed hash
  }
}

type MapMoveendLike = {
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  getCenter?: () => { lat: number; lng: number };
  getZoom?: () => number;
  getPitch?: () => number;
  getBearing?: () => number;
};

export type MapUrlSyncHandle = {
  unbind: () => void;
};

/**
 * Debounced moveend → #map= hash sync (app-side; complements gk-map sync-url).
 */
export function bindMapMoveendUrlSync(
  map: MapMoveendLike | null | undefined,
  options: { debounceMs?: number; includePitchBearing?: boolean } = {}
): MapUrlSyncHandle {
  const debounceMs = options.debounceMs ?? 300;
  const includePitchBearing = options.includePitchBearing ?? true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const handler = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const center = map?.getCenter?.();
      const zoom = map?.getZoom?.();
      const pitch = map?.getPitch?.();
      const bearing = map?.getBearing?.();
      if (!center || zoom === undefined) return;
      const state = {
        zoom,
        lat: center.lat,
        lng: center.lng,
        pitch: pitch ?? 0,
        bearing: bearing ?? 0,
      };
      const hashString = includePitchBearing
        ? buildHashFromState(state)
        : buildHashFromState({ ...state, pitch: 0, bearing: 0 });
      if (window.location.hash !== hashString) {
        history.replaceState(history.state, '', hashString);
      }
    }, debounceMs);
  };

  map?.on?.('moveend', handler);

  return {
    unbind: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      map?.off?.('moveend', handler);
    },
  };
}
