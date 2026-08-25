import { onUnmounted, watch, type Ref } from 'vue';
import {
  bindGkPointLayerEvents,
  type GkPointEventHandlers,
} from '../../utils/map-events.js';
import type { GkMapElement } from '../shared/types.js';

export type UseGkMapEventsOptions = {
  mapInstance?: Ref<unknown>;
};

/** Bind gk-point-* events on a gk-map element with automatic cleanup. */
export function useGkMapEvents(
  mapElement: Ref<GkMapElement | null>,
  handlers: GkPointEventHandlers,
  options: UseGkMapEventsOptions = {}
): void {
  let unbind: (() => void) | null = null;

  function cleanup(): void {
    unbind?.();
    unbind = null;
  }

  watch(
    [mapElement, () => options.mapInstance?.value],
    ([element, mapInstance]) => {
      cleanup();
      if (!element) return;
      unbind = bindGkPointLayerEvents(element, handlers, { mapInstance });
    },
    { immediate: true }
  );

  onUnmounted(cleanup);
}
