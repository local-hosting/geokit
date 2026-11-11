import { onUnmounted, ref, watch, type Ref } from 'vue';
import { bindGkMapLifecycle } from '../shared/map-lifecycle';
import type { GkMapElement, GkMapLifecycleHandlers } from '../shared/types';

export type UseGkMapOptions = GkMapLifecycleHandlers;

export type UseGkMapReturn = {
  mapElement: Ref<GkMapElement | null>;
  mapInstance: Ref<unknown>;
  isReady: Ref<boolean>;
  setMapElement: (element: GkMapElement | null) => void;
};

/** Track a declarative gk-map ref: ready state, map instance, lifecycle callbacks. */
export function useGkMap(
  elementRef?: Ref<GkMapElement | null | undefined>,
  options: UseGkMapOptions = {}
): UseGkMapReturn {
  const mapElement = ref<GkMapElement | null>(null);
  const mapInstance = ref<unknown>(null);
  const isReady = ref(false);
  let unbind: (() => void) | null = null;

  function cleanup(): void {
    unbind?.();
    unbind = null;
  }

  function setMapElement(element: GkMapElement | null): void {
    cleanup();
    mapElement.value = element;
    mapInstance.value = null;
    isReady.value = false;
    if (!element) return;

    unbind = bindGkMapLifecycle(element, {
      onReady: async (detail) => {
        mapElement.value = detail.element;
        mapInstance.value = detail.map;
        isReady.value = true;
        detail.element.hidePlaceholder?.();
        await options.onReady?.(detail);
      },
      onUnload: (detail) => {
        isReady.value = false;
        mapInstance.value = null;
        options.onUnload?.(detail);
      },
      onFreeze: options.onFreeze,
      onUnfreeze: async (detail) => {
        mapInstance.value = detail.map;
        isReady.value = true;
        await options.onUnfreeze?.(detail);
      },
      onFailed: (detail) => {
        isReady.value = false;
        options.onFailed?.(detail);
      },
      onStuck: options.onStuck,
    });

    const existingMap =
      typeof element.getMap === 'function' ? (element.getMap() as unknown) : null;
    if (existingMap) {
      mapInstance.value = existingMap;
      isReady.value = true;
      element.hidePlaceholder?.();
    }
  }

  if (elementRef) {
    watch(
      elementRef,
      (el) => {
        setMapElement(el ?? null);
      },
      { immediate: true }
    );
  }

  onUnmounted(cleanup);

  return { mapElement, mapInstance, isReady, setMapElement };
}
