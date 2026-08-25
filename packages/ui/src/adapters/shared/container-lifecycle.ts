import {
  onMapReadyInContainer,
  onMapUnloadInContainer,
  onMapUnfreezeInContainer,
} from '../../utils/map-utils';
import type { GkMapLifecycleDetail } from './types';

export type GkMapContainerHandlers = {
  onReady?: (detail: GkMapLifecycleDetail) => void | Promise<void>;
  onUnload?: (detail: GkMapLifecycleDetail) => void;
  onUnfreeze?: (detail: GkMapLifecycleDetail) => void | Promise<void>;
};

function toDetail(mapElement: HTMLElement, mapInstance: unknown): GkMapLifecycleDetail {
  return { element: mapElement as GkMapLifecycleDetail['element'], map: mapInstance };
}

/** Subscribe to gk-map lifecycle for maps inside a container (map pool). */
export function bindGkMapContainerLifecycle(
  container: HTMLElement | null,
  handlers: GkMapContainerHandlers
): () => void {
  if (!container) return () => {};

  const unsubs = [
    handlers.onReady
      ? onMapReadyInContainer(container, (el, map) =>
          handlers.onReady?.(toDetail(el, map))
        )
      : undefined,
    handlers.onUnload
      ? onMapUnloadInContainer(container, (el, map) =>
          handlers.onUnload?.(toDetail(el, map))
        )
      : undefined,
    handlers.onUnfreeze
      ? onMapUnfreezeInContainer(container, (el, map) =>
          handlers.onUnfreeze?.(toDetail(el, map))
        )
      : undefined,
  ].filter((fn): fn is () => void => Boolean(fn));

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
