import {
  onClearPopupsEvent,
  onPopupClosedEvent,
  type PopupClosedDetail,
} from '../../ui/lazy-popup.js';

export type CreateGkPopupEventsOptions = {
  getSourceId: () => string;
  onClearFromOtherMap: () => void;
  onPopupClosed?: (detail: PopupClosedDetail) => void;
};

/** Wire geokit popup coordination events. */
export function createGkPopupEvents(options: CreateGkPopupEventsOptions) {
  let unbindClear: (() => void) | null = null;
  let unbindClosed: (() => void) | null = null;

  return {
    start() {
      this.stop();
      unbindClear = onClearPopupsEvent(options.getSourceId(), options.onClearFromOtherMap);
      if (options.onPopupClosed) {
        unbindClosed = onPopupClosedEvent(options.onPopupClosed);
      }
    },
    refreshSourceId() {
      unbindClear?.();
      unbindClear = onClearPopupsEvent(options.getSourceId(), options.onClearFromOtherMap);
    },
    stop() {
      unbindClear?.();
      unbindClear = null;
      unbindClosed?.();
      unbindClosed = null;
    },
    destroy() {
      this.stop();
    },
  };
}
