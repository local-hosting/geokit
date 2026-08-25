import { bindGkMapContainerLifecycle } from '../shared/container-lifecycle';
import type { GkMapContainerHandlers } from '../shared/container-lifecycle';

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
