import type { GkMapElement } from './types';

type MapStyleLike = {
  isStyleLoaded?: () => boolean;
};

export function getGkMapInstance(element: GkMapElement | null | undefined): unknown {
  try {
    return element?.getMap?.() ?? null;
  } catch {
    return null;
  }
}

/** True when map style loaded or canvas is present (ready watchdog / stuck recovery). */
export function isGkMapRenderable(
  element: GkMapElement,
  map: unknown
): { styleLoaded: boolean; hasCanvas: boolean; ready: boolean } {
  const hasCanvas = Boolean(element.querySelector('canvas'));
  const styleLoaded = Boolean(
    map &&
      typeof (map as MapStyleLike).isStyleLoaded === 'function' &&
      (map as MapStyleLike).isStyleLoaded?.()
  );
  return { styleLoaded, hasCanvas, ready: Boolean(map && (styleLoaded || hasCanvas)) };
}
