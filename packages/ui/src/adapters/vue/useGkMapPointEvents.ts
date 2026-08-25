import { onUnmounted, watch, type Ref } from 'vue';
import type { GkPointEventHandlers } from '../../utils/map-events';
import { bindGkMapPointEventsLifecycle } from '../shared/point-events-lifecycle';

/** Lifecycle-aware gk-point-* binding for maps inside a container (pool-safe). */
export function useGkMapPointEvents(
  containerRef: Ref<HTMLElement | null>,
  handlers: GkPointEventHandlers
): void {
  let unbind: (() => void) | null = null;

  function cleanup(): void {
    unbind?.();
    unbind = null;
  }

  watch(
    containerRef,
    container => {
      cleanup();
      unbind = bindGkMapPointEventsLifecycle(container, handlers);
    },
    { immediate: true }
  );

  onUnmounted(cleanup);
}
