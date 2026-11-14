/**
 * Process-wide WebGL map budget (Single Responsibility: live map count).
 * Kept free of map-utils so Vite HMR helpers can reconcile without loading providers.
 */

/** MapTiler/MapLibre may allocate more than one WebGL context per map instance. */
export const WEBGL_CONTEXTS_PER_MAP = 2;

/** Conservative per-page budget (Safari/WebKit is often ~8). */
export const WEBGL_CONTEXT_BUDGET = 8;

/** Live map instances on the page (one per gk-map with an active MapTiler/MapLibre map). */
let liveMapCount = 0;

/** Max map instances allowed before the browser drops older WebGL contexts. */
export function getWebGLMapBudget(): number {
  return Math.max(1, Math.floor(WEBGL_CONTEXT_BUDGET / WEBGL_CONTEXTS_PER_MAP));
}

export function getLiveMapCount(): number {
  return liveMapCount;
}

export function registerLiveMap(): void {
  liveMapCount++;
}

export function unregisterLiveMap(): void {
  liveMapCount = Math.max(0, liveMapCount - 1);
}

/**
 * Re-sync the module counter with connected gk-map instances that still hold a map.
 * HMR / failed teardowns can leave liveMapCount high while the DOM has zero live maps,
 * which permanently blocks createMap behind "Loading map...".
 */
export function reconcileLiveMapCountFromDom(root: ParentNode = document): number {
  let actual = 0;
  for (const el of root.querySelectorAll('gk-map')) {
    const mapHost = el as {
      map?: unknown;
      _registeredForWebGLBudget?: boolean;
    };
    if (mapHost.map || mapHost._registeredForWebGLBudget) {
      actual += 1;
    }
  }
  liveMapCount = actual;
  return actual;
}

export function canCreateAnotherMap(): boolean {
  return liveMapCount < getWebGLMapBudget();
}

/** Cap pool size so concurrent maps stay under typical WebGL limits. */
export function getMaxActiveMaps(requestedPoolSize: number): number {
  return Math.min(Math.max(1, requestedPoolSize), getWebGLMapBudget());
}
