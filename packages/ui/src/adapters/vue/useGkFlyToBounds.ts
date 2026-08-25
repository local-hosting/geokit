import { onUnmounted, watch, type Ref } from 'vue';
import { bindGkFlyToBounds, type GkFlyToBoundsDetail } from '../shared/fly-to-bounds-events';

export function useGkFlyToBounds(
  sourceId: Ref<string>,
  onFly: (detail: GkFlyToBoundsDetail) => void
): void {
  let unbind: (() => void) | null = null;

  watch(
    sourceId,
    id => {
      unbind?.();
      unbind = bindGkFlyToBounds(id, onFly);
    },
    { immediate: true }
  );

  onUnmounted(() => {
    unbind?.();
    unbind = null;
  });
}

export { dispatchGkFlyToBounds } from '../shared/fly-to-bounds-events';
