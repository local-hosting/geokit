const POPUP_CLOSE_REASON = Symbol.for('geokit.popupCloseReason');

export type PopupCloseReason =
  | 'user'
  | 'freeze'
  | 'unload'
  | 'clear-popups'
  | 'restore-other-map'
  | 'dma-pill'
  | 'new-selection'
  | 'programmatic';

export function setPopupCloseReason(popup: unknown, reason: PopupCloseReason): void {
  if (!popup || typeof popup !== 'object') return;
  (popup as Record<symbol, PopupCloseReason>)[POPUP_CLOSE_REASON] = reason;
}

export function takePopupCloseReason(popup: unknown): PopupCloseReason | undefined {
  if (!popup || typeof popup !== 'object') return undefined;
  const reason = (popup as Record<symbol, PopupCloseReason | undefined>)[POPUP_CLOSE_REASON];
  delete (popup as Record<symbol, PopupCloseReason | undefined>)[POPUP_CLOSE_REASON];
  return reason;
}

export function peekPopupCloseReason(popup: unknown): PopupCloseReason | undefined {
  if (!popup || typeof popup !== 'object') return undefined;
  return (popup as Record<symbol, PopupCloseReason | undefined>)[POPUP_CLOSE_REASON];
}
