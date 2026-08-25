import { useEffect } from 'react';
import {
  onClearPopupsEvent,
  onPopupClosedEvent,
  type PopupClosedDetail,
} from '../../lazy-popup';

export type UseGkPopupEventsOptions = {
  sourceId: string;
  onClearFromOtherMap: () => void;
  onPopupClosed?: (detail: PopupClosedDetail) => void;
};

/** Wire geokit popup coordination events with automatic cleanup. */
export function useGkPopupEvents(options: UseGkPopupEventsOptions): void {
  const { sourceId, onClearFromOtherMap, onPopupClosed } = options;

  useEffect(() => onClearPopupsEvent(sourceId, onClearFromOtherMap), [sourceId, onClearFromOtherMap]);

  useEffect(() => {
    if (!onPopupClosed) return;
    return onPopupClosedEvent(onPopupClosed);
  }, [onPopupClosed]);
}
