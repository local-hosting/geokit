import { onUnmounted, unref, watch, type ComputedRef, type Ref } from 'vue';
import {
  onClearPopupsEvent,
  onPopupClosedEvent,
  type PopupClosedDetail,
} from '../../lazy-popup.js';

export type UseGkPopupEventsOptions = {
  /** This map/card identifier (e.g. market slug). Ignores own clear events. */
  sourceId: Ref<string> | ComputedRef<string>;
  /** Called when another map dispatches gk-clear-all-popups. */
  onClearFromOtherMap: () => void;
  /** Called when any gk-popup-closed fires (filter in handler if needed). */
  onPopupClosed?: (detail: PopupClosedDetail) => void;
};

/** Wire geokit popup coordination events with automatic cleanup. */
export function useGkPopupEvents(options: UseGkPopupEventsOptions): void {
  let unbindClear: (() => void) | null = null;
  const unbindClosed = options.onPopupClosed
    ? onPopupClosedEvent(detail => options.onPopupClosed?.(detail))
    : null;

  watch(
    () => unref(options.sourceId),
    sourceId => {
      unbindClear?.();
      unbindClear = onClearPopupsEvent(sourceId, options.onClearFromOtherMap);
    },
    { immediate: true }
  );

  onUnmounted(() => {
    unbindClear?.();
    unbindClear = null;
    unbindClosed?.();
  });
}
