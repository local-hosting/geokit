import type { MapCollectionElement } from '../components/elements/map-collection/map-collection';
import type { MapElement } from '../components/elements/map/map';
import { reconcileLiveMapCountFromDom } from '../components/elements/map/lifecycle/map-webgl-budget';

const GK_MAP_VITE_RESTORE_DEBOUNCE_MS = 150;

const afterRestoreListeners = new Set<() => void>();

/** Subscribe to dev HMR restore (after connected maps are unfrozen / collections refreshed). */
export function onGkMapsRestoredAfterViteHmr(listener: () => void): () => void {
  afterRestoreListeners.add(listener);
  return () => {
    afterRestoreListeners.delete(listener);
  };
}

function notifyGkMapsRestoredAfterViteHmr(): void {
  for (const listener of afterRestoreListeners) {
    listener();
  }
}

function isPoolManagedMap(el: Element): boolean {
  return Boolean(el.closest('gk-map-collection'));
}

/** Tear down live maps before a gk-map module HMR swap (releases WebGL). */
export function freezeGkMapsForViteHmr(root: ParentNode = document): void {
  for (const el of root.querySelectorAll('gk-map-collection')) {
    const collection = el as MapCollectionElement;
    void collection.freezeAll?.();
  }
  for (const el of root.querySelectorAll('gk-map')) {
    const map = el as MapElement;
    void map.freeze?.();
  }
  reconcileLiveMapCountFromDom(root);
}

/** Re-init maps that stayed in the document after module HMR (dispose freezes without reconnect). */
export function restoreConnectedGkMapsAfterViteHmr(root: ParentNode = document): void {
  // Drop leaked budget counts before unfreeze so createMap is not blocked forever.
  reconcileLiveMapCountFromDom(root);

  for (const el of root.querySelectorAll('gk-map-collection')) {
    const collection = el as MapCollectionElement;
    collection.syncActiveCount?.();
    collection.refresh?.();
  }

  for (const el of root.querySelectorAll('gk-map')) {
    const map = el as MapElement;
    if (!map.isConnected) continue;
    if (isPoolManagedMap(el)) continue;
    void map.unfreeze?.();
  }
}

type ViteHotLike = {
  dispose: (cb: () => void) => void;
  accept: (cb: () => void) => void;
  on: (event: string, cb: () => void) => void;
};

let moduleHmrRegistered = false;
let afterUpdateScheduled = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDebouncedRestore(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    restoreConnectedGkMapsAfterViteHmr();
    notifyGkMapsRestoredAfterViteHmr();
  }, GK_MAP_VITE_RESTORE_DEBOUNCE_MS);
}

/**
 * Debounced restore for Vue / app HMR that does not run geokit module `accept`.
 * Safe to call once per app entry (idempotent).
 */
export function scheduleGkMapRestoreOnViteAfterUpdate(hot: Pick<ViteHotLike, 'on'>): void {
  if (afterUpdateScheduled) return;
  afterUpdateScheduled = true;

  hot.on('vite:afterUpdate', () => {
    scheduleDebouncedRestore();
  });
}

/** Register dispose/accept handlers once per dev session. */
export function registerGkMapViteHmrHandlers(): void {
  if (moduleHmrRegistered) return;
  if (typeof import.meta === 'undefined' || !import.meta.hot) return;

  moduleHmrRegistered = true;
  const hot = import.meta.hot as ViteHotLike;

  hot.dispose(() => {
    freezeGkMapsForViteHmr();
  });
  hot.accept(() => {
    restoreConnectedGkMapsAfterViteHmr();
  });
  scheduleGkMapRestoreOnViteAfterUpdate(hot);
}