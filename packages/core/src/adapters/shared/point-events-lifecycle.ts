import { bindGkPointLayerEvents, type GkPointEventHandlers } from '../../ui/utils/map-events.js';
import { bindGkMapContainerLifecycle } from './container-lifecycle.js';
import type { GkMapLifecycleDetail } from './types.js';

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
