import type { GkMapElement } from './types';
import { getGkMapInstance, isGkMapRenderable } from './gk-map-render-state';

export type MapReadyWatchdogOptions = {
  maxMs?: number;
  canvasReadyMs?: number;
  pollMs?: number;
  isCancelled?: () => boolean;
  isAlreadyHandled?: () => boolean;
  onReady: (detail: { element: GkMapElement; map: unknown }) => void | Promise<void>;
  onTimeout?: (detail: { element: GkMapElement; map: unknown | null }) => void;
  onForceReady?: (detail: {
    element: GkMapElement;
    map: unknown;
    styleLoaded: boolean;
    hasCanvas: boolean;
    elapsedMs: number;
  }) => void;
};

/** Poll until style/canvas ready when gk-map-ready never fires. */
export function scheduleMapReadyWatchdog(
  element: GkMapElement,
  options: MapReadyWatchdogOptions
): () => void {
  const maxMs = options.maxMs ?? 12000;
  const canvasReadyMs = options.canvasReadyMs ?? 2500;
  const pollMs = options.pollMs ?? 400;
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const tick = (): void => {
    if (cancelled || options.isCancelled?.()) return;
    if (options.isAlreadyHandled?.()) return;
    if (!element.isConnected) return;

    const map = getGkMapInstance(element);
    const elapsed = performance.now() - started;
    const { styleLoaded, hasCanvas } = isGkMapRenderable(element, map);
    const canvasReady = Boolean(map && hasCanvas && elapsed >= canvasReadyMs);

    if ((styleLoaded || canvasReady) && map) {
      options.onForceReady?.({ element, map, styleLoaded, hasCanvas, elapsedMs: elapsed });
      void options.onReady({ element, map });
      return;
    }

    if (elapsed >= maxMs) {
      options.onTimeout?.({ element, map });
      if (map && !options.isAlreadyHandled?.()) {
        void options.onReady({ element, map });
      }
      return;
    }

    timer = setTimeout(tick, pollMs);
  };

  timer = setTimeout(tick, pollMs);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/** Force ready when gk-map-stuck fires but canvas/style are already loaded. */
export function tryForceGkMapReady(
  element: GkMapElement,
  onReady: (detail: { element: GkMapElement; map: unknown }) => void | Promise<void>
): boolean {
  const map = getGkMapInstance(element);
  const { ready } = isGkMapRenderable(element, map);
  if (!map || !ready) return false;
  void onReady({ element, map });
  return true;
}
