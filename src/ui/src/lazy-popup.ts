/**
 * Lazy Popup Utilities
 *
 * Defers loading of geokit's popup module (246 KB) from the critical path.
 * PopupElement is only needed for user interactions (click, close, hover),
 * never during initial page render.
 *
 * The module loads on first use (hover or click that opens a popup).
 * Sync wrappers fall back gracefully if the module hasn't loaded yet
 * (e.g. remove popup without fade).
 */

// ---------------------------------------------------------------------------
// Cached lazy loader
// ---------------------------------------------------------------------------

import type * as PopupModuleTypes from './components/elements/popup/popup';

type PopupModule = typeof PopupModuleTypes;

let _cached: PopupModule | null = null;
let _loading: Promise<PopupModule> | null = null;

/** Trigger background fetch of the popup module. */
export function preloadPopupModule(): void {
  if (_cached || _loading) return;
  _loading = import('./components/elements/popup/popup').then(m => {
    _cached = m;
    return m;
  });
}

/** Async access — resolves immediately if already cached. */
export async function getPopupModule(): Promise<PopupModule> {
  if (_cached) return _cached;
  if (!_loading) preloadPopupModule();
  return _loading!;
}

/** Sync access — returns null if not yet loaded. */
export function getPopupModuleSync(): PopupModule | null {
  return _cached;
}

// ---------------------------------------------------------------------------
// PopupElement wrappers (sync-safe)
// ---------------------------------------------------------------------------

/**
 * Fade out a popup with animation.
 * Falls back to instant remove() if the popup module isn't loaded yet.
 */
export function fadeOutPopup(popup: any, callback: () => void): void {
  if (!popup) {
    callback();
    return;
  }
  const mod = _cached;
  if (mod) {
    mod.PopupElement.fadeOutPopup(popup, callback);
  } else {
    // Module not loaded yet (extremely rare — pre-warmed during idle).
    // Remove without animation as a safe fallback.
    try {
      popup.remove();
    } catch {
      /* ignore */
    }
    callback();
  }
}

/**
 * Close all popups on a map instance.
 * No-ops if the popup module isn't loaded yet (no popups exist anyway).
 */
export function closeAllPopups(map: any): void {
  _cached?.PopupElement.closeAllPopups(map);
}

// ---------------------------------------------------------------------------
// Clear-popup event utilities (inlined to avoid importing popup module)
//
// These are simple CustomEvent dispatchers that don't depend on PopupElement.
// Matches geokit's gk-clear-all-popups event contract.
// ---------------------------------------------------------------------------

const CLEAR_POPUPS_EVENT = 'gk-clear-all-popups';

/**
 * Dispatch event to close popups in other map instances.
 * @param sourceId — identifier for the source map (e.g. market slug)
 */
export function dispatchClearPopupsEvent(sourceId?: string): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent(CLEAR_POPUPS_EVENT, { detail: { sourceId } })
  );
}

/**
 * Listen for clear-popup events from other maps.
 * @param sourceId — this map's identifier (won't trigger for own events)
 * @param onClear — callback when another map requests popup clearing
 * @returns unsubscribe function
 */
export function onClearPopupsEvent(
  sourceId: string,
  onClear: () => void
): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    const eventSourceId = customEvent.detail?.sourceId;
    // Don't trigger for our own events
    if (eventSourceId === sourceId) return;
    onClear();
  };

  document.addEventListener(CLEAR_POPUPS_EVENT, handler);
  return () => document.removeEventListener(CLEAR_POPUPS_EVENT, handler);
}

const POPUP_CLOSED_EVENT = 'gk-popup-closed';

import type { PopupCloseReason } from './utils/popup-close-reason';

export type { PopupCloseReason } from './utils/popup-close-reason';
export { setPopupCloseReason, takePopupCloseReason, peekPopupCloseReason } from './utils/popup-close-reason';

export type PopupClosedDetail = {
  popup?: unknown;
  map?: unknown;
  reason?: PopupCloseReason;
};

/**
 * Listen for gk-popup-closed (dispatched by geokit popup-api on close).
 */
export function onPopupClosedEvent(
  handler: (detail: PopupClosedDetail) => void,
  target: EventTarget = document
): () => void {
  if (typeof document === 'undefined') return () => {};

  const listener = (event: Event): void => {
    const detail = ((event as CustomEvent).detail ?? {}) as PopupClosedDetail;
    handler(detail);
  };

  target.addEventListener(POPUP_CLOSED_EVENT, listener as EventListener);
  return () => target.removeEventListener(POPUP_CLOSED_EVENT, listener as EventListener);
}
