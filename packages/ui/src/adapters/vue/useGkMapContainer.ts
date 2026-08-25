import { onUnmounted, watch, type Ref } from 'vue';
import { bindGkMapContainerLifecycle } from '../shared/container-lifecycle';
import type { GkMapContainerHandlers } from '../shared/container-lifecycle';

/** Container-scoped gk-map ready / unload / unfreeze (map pool). */
export function useGkMapContainer(
  containerRef: Ref<HTMLElement | null>,
  handlers: GkMapContainerHandlers
): void {
  let unbind: (() => void) | null = null;

  watch(
    containerRef,
    container => {
      unbind?.();
      unbind = bindGkMapContainerLifecycle(container, handlers);
    },
    { immediate: true }
  );

  onUnmounted(() => {
    unbind?.();
    unbind = null;
  });
}
