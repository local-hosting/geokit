import { bindGkPointLayerEvents, type GkPointEventHandlers } from '../../utils/map-events';
import { bindGkMapContainerLifecycle } from './container-lifecycle';
import type { GkMapLifecycleDetail } from './types';

/**
 * Bind gk-point-* handlers for every gk-map inside a container.
 * Rewires on ready + unfreeze; unbinds on unload.
 */
export function bindGkMapPointEventsLifecycle(
  container: HTMLElement | null,
  handlers: GkPointEventHandlers
): () => void {
  let unbindPoint: (() => void) | null = null;

  function wire(detail: GkMapLifecycleDetail): void {
    unbindPoint?.();
    const gkMap = detail.element as HTMLElement;
    unbindPoint = bindGkPointLayerEvents(gkMap, handlers, { targetGkMap: gkMap });
  }

  function unwire(): void {
    unbindPoint?.();
    unbindPoint = null;
  }

  const unbindContainer = bindGkMapContainerLifecycle(container, {
    onReady: wire,
    onUnfreeze: wire,
    onUnload: unwire,
  });

  return () => {
    unwire();
    unbindContainer();
  };
}
