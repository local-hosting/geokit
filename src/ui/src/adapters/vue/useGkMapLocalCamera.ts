import type { MapLocalPersistScope } from '@twinfile/geokit/core/contract/offline';
import { onUnmounted, watch, type Ref } from 'vue';
import {
  bindMapMoveendLocalSync,
  restoreLocalCameraToMap,
  type MapLocalSyncHandle,
} from '../shared/index';
import type { GkMapElement } from '../shared/types';

export type UseGkMapLocalCameraOptions = {
  mapId: string;
  mapElement: Ref<GkMapElement | null>;
  isReady: Ref<boolean>;
  persistScope?: MapLocalPersistScope;
  /** When true, applies the last stored frame after the map becomes ready. */
  restoreOnReady?: boolean;
  debounceMs?: number;
};

/** Persist gk-map camera to `MapLocalStore` and optionally restore on ready (same `mapId` across routes). */
export function useGkMapLocalCamera(options: UseGkMapLocalCameraOptions): void {
  let syncHandle: MapLocalSyncHandle | null = null;

  const stop = watch(
    [options.mapElement, options.isReady],
    async ([element, ready]) => {
      syncHandle?.unbind();
      syncHandle = null;
      if (!element || !ready) return;

      const map = element.getMap?.() as ReturnType<typeof element.getMap> | null;
      if (!map) return;

      if (options.restoreOnReady ?? true) {
        await restoreLocalCameraToMap(map, options.mapId, options.persistScope ?? 'session');
      }

      syncHandle = bindMapMoveendLocalSync(map, {
        mapId: options.mapId,
        persistScope: options.persistScope ?? 'session',
        debounceMs: options.debounceMs,
      });
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stop();
    syncHandle?.unbind();
    syncHandle = null;
  });
}
