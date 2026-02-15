/**
 * Map freeze/unfreeze helpers (Single Responsibility: style ready, resize, WebGL release delay)
 */

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

  if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
    return Promise.resolve();
  }
  if (typeof map.getStyle === 'function') {
    const style = map.getStyle();
    if (style && typeof style === 'object') {
      return Promise.resolve();
    }
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

    const checkReady = () => {
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
 */
export function resizeAndRepaintMap(map: MapLike | null): void {
  if (!map) return;
  requestAnimationFrame(() => {
    if (typeof map.resize === 'function') {
      map.resize();
    }
    if (typeof map.triggerRepaint === 'function') {
      map.triggerRepaint();
    }
  });
}

/**
 * Wait for WebGL context to be released (double rAF + 50ms). Call after map.remove().
 */
export function delayForWebGLRelease(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 50);
      });
    });
  });
}
