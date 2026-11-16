import type { MapCameraFrame, MapLocalPersistScope } from '@doppler-group/geokit/core/contract/offline';
import { MapOfflineDefaults } from '@doppler-group/geokit/core/contract/offline';
import { MapLocalStore } from '../../../../storage/map-local-store';

type MapMoveendLike = {
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  getCenter?: () => { lat: number; lng: number };
  getZoom?: () => number;
  getPitch?: () => number;
  getBearing?: () => number;
  jumpTo?: (opts: {
    center: [number, number];
    zoom: number;
    pitch?: number;
    bearing?: number;
  }) => void;
};

export type MapLocalSyncHandle = {
  unbind: () => void;
};

export function readCameraFrameFromMap(map: MapMoveendLike | null | undefined): MapCameraFrame | null {
  const center = map?.getCenter?.();
  const zoom = map?.getZoom?.();
  if (!center || zoom === undefined || Number.isNaN(zoom)) return null;
  return {
    centerLatitude: center.lat,
    centerLongitude: center.lng,
    zoom,
    pitch: map?.getPitch?.() ?? 0,
    bearing: map?.getBearing?.() ?? 0,
  };
}

export function normalizeStoredCameraFrame(frame: unknown): MapCameraFrame | null {
  if (!frame || typeof frame !== 'object') return null;
  const record = frame as Record<string, unknown>;
  if (typeof record.centerLatitude === 'number' && typeof record.centerLongitude === 'number') {
    return {
      centerLatitude: record.centerLatitude,
      centerLongitude: record.centerLongitude,
      zoom: Number(record.zoom),
      pitch: Number(record.pitch ?? 0),
      bearing: Number(record.bearing ?? 0),
    };
  }
  const center = record.center as { latitude?: number; longitude?: number } | undefined;
  if (center && typeof center.latitude === 'number' && typeof center.longitude === 'number') {
    return {
      centerLatitude: center.latitude,
      centerLongitude: center.longitude,
      zoom: Number(record.zoom),
      pitch: Number(record.pitch ?? 0),
      bearing: Number(record.bearing ?? 0),
    };
  }
  return null;
}

export function applyCameraFrameToMap(
  map: MapMoveendLike | null | undefined,
  frame: MapCameraFrame,
): void {
  if (!map?.jumpTo) return;
  map.jumpTo({
    center: [frame.centerLongitude, frame.centerLatitude],
    zoom: frame.zoom,
    pitch: frame.pitch,
    bearing: frame.bearing,
  });
}

export async function loadLocalCameraFrame(
  mapId: string,
  scope: MapLocalPersistScope = MapOfflineDefaults.durablePersistScope,
): Promise<MapCameraFrame | null> {
  const state = await MapLocalStore.getInstance().getLocalState(mapId, scope);
  if (!state?.cameraFrame) return null;
  return normalizeStoredCameraFrame(state.cameraFrame);
}

export async function restoreLocalCameraToMap(
  map: MapMoveendLike | null | undefined,
  mapId: string,
  scope: MapLocalPersistScope = MapOfflineDefaults.durablePersistScope,
): Promise<boolean> {
  const frame = await loadLocalCameraFrame(mapId, scope);
  if (!frame) return false;
  applyCameraFrameToMap(map, frame);
  return true;
}

/**
 * Debounced moveend → `MapLocalStore` camera frame (session/durable), keyed by `mapId`.
 */
export function bindMapMoveendLocalSync(
  map: MapMoveendLike | null | undefined,
  options: {
    mapId: string;
    persistScope?: MapLocalPersistScope;
    debounceMs?: number;
  },
): MapLocalSyncHandle {
  const debounceMs = options.debounceMs ?? 300;
  const scope = options.persistScope ?? 'session';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const handler = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const cameraFrame = readCameraFrameFromMap(map);
      if (!cameraFrame) return;
      void MapLocalStore.getInstance().patchLocalState(
        options.mapId,
        { cameraFrame, persistScope: scope },
        scope,
      );
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
