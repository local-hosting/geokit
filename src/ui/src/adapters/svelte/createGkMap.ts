import { bindGkMapLifecycle } from '../shared/map-lifecycle';
import type { GkMapElement, GkMapLifecycleHandlers } from '../shared/types';
import { createStore } from './subscribe';

export type CreateGkMapOptions = GkMapLifecycleHandlers;

export type GkMapState = {
  mapElement: GkMapElement | null;
  mapInstance: unknown;
  isReady: boolean;
};

/** Svelte-friendly gk-map state with store-compatible subscribe(). */
export function createGkMap(options: CreateGkMapOptions = {}) {
  const store = createStore<GkMapState>({
    mapElement: null,
    mapInstance: null,
    isReady: false,
  });
  let unbind: (() => void) | null = null;

  function cleanup(): void {
    unbind?.();
    unbind = null;
  }

  function setMapElement(element: GkMapElement | null): void {
    cleanup();
    if (!element) {
      store.set({ mapElement: null, mapInstance: null, isReady: false });
      return;
    }

    unbind = bindGkMapLifecycle(element, {
      onReady: async detail => {
        store.set({
          mapElement: detail.element,
          mapInstance: detail.map,
          isReady: true,
        });
        detail.element.hidePlaceholder?.();
        await options.onReady?.(detail);
      },
      onUnload: detail => {
        store.set({ mapElement: detail.element, mapInstance: null, isReady: false });
        options.onUnload?.(detail);
      },
      onFreeze: options.onFreeze,
      onUnfreeze: async detail => {
        store.set({
          mapElement: detail.element,
          mapInstance: detail.map,
          isReady: true,
        });
        await options.onUnfreeze?.(detail);
      },
      onFailed: detail => {
        store.set({ mapElement: detail.element, mapInstance: null, isReady: false });
        options.onFailed?.(detail);
      },
      onStuck: options.onStuck,
    });
  }

  function destroy(): void {
    cleanup();
    store.set({ mapElement: null, mapInstance: null, isReady: false });
    store.clearSubscribers();
  }

  return {
    subscribe: store.subscribe,
    get: store.get,
    setMapElement,
    destroy,
  };
}
