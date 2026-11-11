import type { MapCollectionElement } from '../components/elements/map-collection/map-collection';
import type { MapElement } from '../components/elements/map/map';

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
}

/** Re-init maps that stayed in the document after module HMR (dispose freezes without reconnect). */
export function restoreConnectedGkMapsAfterViteHmr(root: ParentNode = document): void {
  for (const el of root.querySelectorAll('gk-map')) {
    const map = el as MapElement;
    if (!map.isConnected) continue;
    void map.unfreeze?.();
  }
}

let registered = false;

/** Register dispose/accept handlers once per dev session. */
export function registerGkMapViteHmrHandlers(): void {
  if (registered) return;
  if (typeof import.meta === 'undefined' || !import.meta.hot) return;

  registered = true;
  import.meta.hot.dispose(() => {
    freezeGkMapsForViteHmr();
  });
  import.meta.hot.accept(() => {
    restoreConnectedGkMapsAfterViteHmr();
  });
}
