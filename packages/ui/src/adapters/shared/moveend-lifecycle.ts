import type { GkMapMoveEndDetail } from '../../utils/map-semantic-events';
import { bindGkMapContainerLifecycle } from './container-lifecycle';

/** Attach gk-map-moveend listener when map inside container is ready/unfrozen. */
export function bindGkMapMoveendLifecycle(
  container: HTMLElement | null,
  handler: (detail: GkMapMoveEndDetail) => void
): () => void {
  let unbindMoveend: (() => void) | null = null;

  function wire(element: HTMLElement): void {
    unbindMoveend?.();
    const listener = (event: Event): void => {
      const detail = (event as CustomEvent<GkMapMoveEndDetail>).detail;
      if (!detail || detail.element !== element) return;
      handler(detail);
    };
    element.addEventListener('gk-map-moveend', listener);
    unbindMoveend = () => element.removeEventListener('gk-map-moveend', listener);
  }

  function unwire(): void {
    unbindMoveend?.();
    unbindMoveend = null;
  }

  const unbindContainer = bindGkMapContainerLifecycle(container, {
    onReady: ({ element }) => wire(element as HTMLElement),
    onUnfreeze: ({ element }) => wire(element as HTMLElement),
    onUnload: unwire,
  });

  return () => {
    unwire();
    unbindContainer();
  };
}

/** Document-level fly-to listener scoped by sourceId. */
export { bindGkFlyToBounds, dispatchGkFlyToBounds, GK_FLY_TO_BOUNDS_EVENT } from './fly-to-bounds-events';
export type { GkFlyToBoundsDetail } from './fly-to-bounds-events';
