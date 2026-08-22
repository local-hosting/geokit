import { bindGkMapContainerLifecycle } from '../shared/container-lifecycle.js';
import type { GkMapContainerHandlers } from '../shared/container-lifecycle.js';

/** Container-scoped gk-map ready / unload / unfreeze (map pool). */
export function createGkMapContainer(handlers: GkMapContainerHandlers) {
  let unbind: (() => void) | null = null;

  return {
    start(container: HTMLElement | null) {
      unbind?.();
      unbind = bindGkMapContainerLifecycle(container, handlers);
    },
    stop() {
      unbind?.();
      unbind = null;
    },
    destroy() {
      this.stop();
    },
  };
}
