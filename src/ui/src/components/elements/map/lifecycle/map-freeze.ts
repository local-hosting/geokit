/**
 * Map freeze/unfreeze helpers (Single Responsibility: style ready, resize, WebGL release delay)
 */

import { safeResizeMap } from '../../../../utils/map-surface/map-utils';
import {
  canCreateAnotherMap,
  reconcileLiveMapCountFromDom,
} from './map-webgl-budget';

export {
  WEBGL_CONTEXTS_PER_MAP,
  WEBGL_CONTEXT_BUDGET,
  getWebGLMapBudget,
  getLiveMapCount,
  registerLiveMap,
  unregisterLiveMap,
  reconcileLiveMapCountFromDom,
  canCreateAnotherMap,
  getMaxActiveMaps,
} from './map-webgl-budget';

type MapLike = {
  isStyleLoaded?: () => boolean;
  getStyle?: () => unknown;
  off?: (event: string, fn: () => void) => void;
  on?: (event: string, fn: () => void) => void;
  resize?: () => void;
  triggerRepaint?: () => void;
  loaded?: () => boolean;
  once?: (event: string, fn: () => void) => void;
};

/**
 * Wait for map style to be loaded. Resolves after timeout if events don't fire.
 */
export function whenStyleReady(map: MapLike | null, timeout: number = 2000): Promise<void> {
  if (!map) {
    throw new Error('[gk-map] No map instance');
  }

  if (typeof map.isStyleLoaded === 'function') {
    if (map.isStyleLoaded()) {
      return Promise.resolve();
    }
    // Do not treat loaded() as equivalent — MapTiler can return loaded() while style is still loading.
  } else if (typeof map.loaded === 'function' && map.loaded()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      map.off?.('style.load', handleStyleLoad);
      map.off?.('load', handleLoad);
      resolve();
    }, timeout);

    const handleStyleLoad = () => {
      clearTimeout(timeoutId);
      map.off?.('load', handleLoad);
      resolve();
    };

    const handleLoad = () => {
      if (map.isStyleLoaded?.()) {
        clearTimeout(timeoutId);
        map.off?.('style.load', handleStyleLoad);
        resolve();
      }
    };

    map.on?.('style.load', handleStyleLoad);
    map.on?.('load', handleLoad);

    const isSurfaceAlive = () => {
      const getContainer = (map as { getContainer?: () => HTMLElement | null }).getContainer;
      if (typeof getContainer !== 'function') return true;
      const container = getContainer.call(map);
      return container != null && container.isConnected;
    };

    const checkReady = () => {
      if (!isSurfaceAlive()) {
        clearTimeout(timeoutId);
        map.off?.('style.load', handleStyleLoad);
        map.off?.('load', handleLoad);
        resolve();
        return;
      }
      if (map.isStyleLoaded?.()) {
        clearTimeout(timeoutId);
        map.off?.('style.load', handleStyleLoad);
        map.off?.('load', handleLoad);
        resolve();
      } else {
        requestAnimationFrame(checkReady);
      }
    };
    requestAnimationFrame(checkReady);
  });
}

/**
 * Wait for map to be fully ready (idle state).
 */
export function waitForReady(map: MapLike | null, timeout: number = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!map) {
      reject(new Error('No map instance'));
      return;
    }

    if (typeof map.loaded === 'function' && map.loaded()) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new Error('Map ready timeout'));
    }, timeout);

    const handleIdle = () => {
      clearTimeout(timeoutId);
      resolve();
    };

    if (typeof map.once === 'function') {
      map.once('idle', handleIdle);
    } else {
      setTimeout(() => {
        clearTimeout(timeoutId);
        resolve();
      }, 500);
    }
  });
}

/**
 * Resize map to container and trigger repaint.
 * Skips resize when the host/container is hidden or zero-size to avoid MapTiler transformMat4 crashes.
 */
export function resizeAndRepaintMap(map: MapLike | null, hostElement?: HTMLElement | null): void {
  if (!map) return;
  requestAnimationFrame(() => {
    safeResizeMap(map, hostElement);
    if (typeof map.triggerRepaint === 'function') {
      try {
        map.triggerRepaint();
      } catch {
        // Repaint can fail when the map was torn down between scheduling and execution.
      }
    }
  });
}

/**
 * Wait until a new map can be created without exceeding the WebGL budget.
 * Returns false when the budget stays full past timeoutMs.
 */
export async function waitUntilCanCreateMap(timeoutMs: number = 8000): Promise<boolean> {
  if (typeof document !== 'undefined') {
    reconcileLiveMapCountFromDom(document);
  }
  const start = Date.now();
  while (!canCreateAnotherMap()) {
    if (Date.now() - start > timeoutMs) {
      if (typeof document !== 'undefined') {
        reconcileLiveMapCountFromDom(document);
        if (canCreateAnotherMap()) return true;
      }
      return false;
    }
    await delayForWebGLRelease(150);
    if (typeof document !== 'undefined') {
      reconcileLiveMapCountFromDom(document);
    }
  }
  return true;
}

/**
 * Wait for WebGL context to be released (double rAF + delay). Call after map.remove().
 */
export function delayForWebGLRelease(delayMs: number = 150): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, delayMs);
      });
    });
  });
}
