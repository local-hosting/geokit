import { onUnmounted, watch, type Ref } from 'vue';
import type { GkMapMoveEndDetail } from '../../utils/map-semantic-events.js';
import { bindGkMapMoveendLifecycle } from '../shared/moveend-lifecycle.js';

export function useGkMapMoveend(
  containerRef: Ref<HTMLElement | null>,
  handler: (detail: GkMapMoveEndDetail) => void
): void {
  let unbind: (() => void) | null = null;

  watch(
    containerRef,
    container => {
      unbind?.();
      unbind = bindGkMapMoveendLifecycle(container, handler);
    },
    { immediate: true }
  );

  onUnmounted(() => {
    unbind?.();
    unbind = null;
  });
}
