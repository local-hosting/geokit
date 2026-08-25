/**
 * Map Collection Component
 *
 * Manages a pool of map instances. Only keeps poolSize maps active at a time.
 * LAZY freezing - only freezes maps when we need room for a new visible map.
 */

import { BaseElement } from '../../base-element';
import { type MapElement } from '../map/map';
import { getProviderConfig } from '../../../providers/registry';
import { debug } from '../../../utils/logger';
import {
  delayForWebGLRelease,
  getLiveMapCount,
  getMaxActiveMaps,
  getWebGLMapBudget,
} from '../map/lifecycle/map-freeze';

interface SlotInfo {
  slotElement: HTMLElement;
  mapElement: MapElement;
  isActive: boolean;
  isVisible: boolean; // Track visibility separately
  isActivating: boolean; // Prevent concurrent activation attempts
  failCount: number; // Track consecutive failures for retry backoff
  lastFailTime: number; // Timestamp of last failure
  activationStartTime: number; // Timestamp when activation started
  lastHealthCheckAttempt: number; // Timestamp of last health check activation attempt
  /** When we first saw placeholder with no map instance (avoid resetting during createMap()) */
  firstSeenNoMapInstanceAt: number;
  /** When we first saw "Restoring..." with map instance but !isInitialized (reset after 5s) */
  firstSeenRestoringAt: number;
}

// Debounce delay - wait for scrolling to stop before activating.
// Only decide which maps are "on screen" after scroll has settled to avoid loading maps for cards that scroll through.
const SCROLL_DEBOUNCE_MS = 300;

// Extended debounce when user is actively scrolling (detected via rapid intersection changes)
const SCROLL_ACTIVE_DEBOUNCE_MS = 500;

// Serialize activations — MapTiler allocates ~2 WebGL contexts per map; parallel createMap races teardown.
const CONCURRENT_ACTIVATION_BATCH = 1;

// Retry configuration for failed map loads
const MAX_FAIL_COUNT = 3; // Max retries before giving up
const RETRY_BACKOFF_MS = 2000; // Wait 2s between retries

// Health check: only "stuck activating" (map handles placeholder stuck via gk-map-stuck)
const STUCK_ACTIVATING_MS = 15000;

// Only activate slots that actually intersect the visible viewport (small margin).
// IntersectionObserver uses a large rootMargin so we filter here to avoid activating maps above/below the fold.
const ACTIVATION_VIEWPORT_MARGIN_PX = 50;

function mapCollectionDebug(msg: string, data?: Record<string, unknown>): void {
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __GEOKIT_DEBUG__?: boolean }).__GEOKIT_DEBUG__
  ) {
    if (data !== undefined) {
      console.warn('[gk-map-collection]', msg, data);
    } else {
      console.warn('[gk-map-collection]', msg);
    }
  }
}

import { mapCollectionEl } from './map-collection-el';
import { MapCollectionBase } from './map-collection-base';

export class MapCollectionPool extends MapCollectionBase {
  protected async processVisibilityChanges(): Promise<void> {
    if (mapCollectionEl(this).isProcessing) {
      mapCollectionEl(this).pendingReprocess = true;
      return;
    }
    mapCollectionEl(this).isProcessing = true;
    mapCollectionEl(this).pendingReprocess = false;

    if (Date.now() < mapCollectionEl(this).suppressActivationUntil) {
      mapCollectionEl(this).isProcessing = false;
      const remaining = mapCollectionEl(this).suppressActivationUntil - Date.now();
      setTimeout(() => mapCollectionEl(this).processVisibilityChanges(), remaining);
      return;
    }
    if (mapCollectionEl(this).isCollectionHidden()) {
      mapCollectionEl(this).isProcessing = false;
      return;
    }

    mapCollectionEl(this).syncActiveCount();
    const now = Date.now();
    const { vh, margin } = mapCollectionEl(this).getViewportConstants();
    mapCollectionEl(this).clampAllSlotVisibility(vh, margin);
    const sorted = mapCollectionEl(this).getVisibleInactiveSlotsSorted(now, vh, margin);

    try {
      mapCollectionEl(this).showPlaceholdersForVisibleWaiting();

      if (sorted.length === 0) return;

      let availableSlots = mapCollectionEl(this).effectivePoolSize - mapCollectionEl(this).activeCount;
      const needed = sorted.length - availableSlots;
      if (needed > 0) {
        await mapCollectionEl(this).makeRoomFor(Math.min(needed, mapCollectionEl(this).activeCount));
        availableSlots = mapCollectionEl(this).effectivePoolSize - mapCollectionEl(this).activeCount;
      }

      const toActivate = sorted.slice(0, Math.max(availableSlots, 0));

      for (let i = 0; i < toActivate.length; i += CONCURRENT_ACTIVATION_BATCH) {
        const batch = toActivate.slice(i, i + CONCURRENT_ACTIVATION_BATCH);
        while (mapCollectionEl(this).activeCount >= mapCollectionEl(this).effectivePoolSize && batch.length > 0) {
          const frozen = await mapCollectionEl(this).deactivateOneForPool();
          if (!frozen) break;
          await delayForWebGLRelease();
        }
        await Promise.all(batch.map((slot: SlotInfo) => mapCollectionEl(this).activateSlot(slot)));
        if (i + CONCURRENT_ACTIVATION_BATCH < toActivate.length) {
          await delayForWebGLRelease();
        }
      }

      const stillInactive = mapCollectionEl(this).getManySlots((s: SlotInfo) => s.isVisible && !s.isActive && !s.isActivating);
      if (stillInactive.length > 0 && mapCollectionEl(this).activeCount < mapCollectionEl(this).effectivePoolSize) {
        setTimeout(() => mapCollectionEl(this).processVisibilityChanges(), 0);
      }
    } finally {
      mapCollectionEl(this).isProcessing = false;
      if (mapCollectionEl(this).pendingReprocess) {
        mapCollectionEl(this).pendingReprocess = false;
        setTimeout(() => mapCollectionEl(this).processVisibilityChanges(), 0);
      }
    }
  }

  /** Set api key and style on the slot's map element before unfreeze. */
  protected ensureSlotAttributes(slotInfo: SlotInfo): void {
    const el = slotInfo.mapElement;
    if (typeof el.ensureAttributes !== 'function') return;
    el.ensureAttributes({
      apiKey: mapCollectionEl(this).apiKey,
      provider: 'maptiler',
      mapStyle: mapCollectionEl(this).mapStyle,
      minZoom: mapCollectionEl(this).minZoom,
      maxZoom: mapCollectionEl(this).maxZoom,
    });
  }

  /** Unfreeze the slot's map; returns true on success. Logs and handles missing unfreeze. */
  protected async unfreezeSlot(slotInfo: SlotInfo): Promise<boolean> {
    const el = slotInfo.mapElement;
    const slotIndex = mapCollectionEl(this).slots.indexOf(slotInfo);
    if (typeof el.unfreeze !== 'function') {
      mapCollectionDebug('activateSlot: mapElement.unfreeze not available', { slotIndex });
      return false;
    }
    mapCollectionDebug('activateSlot: calling unfreeze', {
      slotIndex,
      activeCount: mapCollectionEl(this).activeCount,
      poolSize: mapCollectionEl(this).poolSize,
    });
    const success = await el.unfreeze(mapCollectionEl(this).activeCount - 1);
    mapCollectionDebug('activateSlot: unfreeze returned', {
      slotIndex,
      success,
      hasMap: !!(el as any).getMap?.(),
      isInitialized: (el as any).isInitialized,
    });
    return success;
  }

  /**
   * Unfreeze a slot - will make room if needed.
   * Protected against concurrent activation and fast scrolling.
   */
  protected async activateSlot(slotInfo: SlotInfo): Promise<void> {
    if (slotInfo.isActive || slotInfo.isActivating || !slotInfo.isVisible) return;

    slotInfo.isActivating = true;
    slotInfo.activationStartTime = Date.now();

    try {
      let reserved = false;
      await mapCollectionEl(this).runPoolExclusive(async () => {
        while (
          mapCollectionEl(this).activeCount >= mapCollectionEl(this).effectivePoolSize ||
          getLiveMapCount() >= getWebGLMapBudget()
        ) {
          if (!slotInfo.isVisible) return;
          const frozen = await mapCollectionEl(this).deactivateOneForPool();
          if (!frozen) {
            mapCollectionDebug('activateSlot: pool full, cannot make room', {
              activeCount: mapCollectionEl(this).activeCount,
              liveMaps: getLiveMapCount(),
              poolSize: mapCollectionEl(this).effectivePoolSize,
              visibleCount: mapCollectionEl(this).getManySlots((s: SlotInfo) => s.isVisible).length,
            });
            return;
          }
          await delayForWebGLRelease();
        }

        if (!slotInfo.isVisible) return;

        slotInfo.isActive = true;
        mapCollectionEl(this).activeCount++;
        reserved = true;
      });

      if (!reserved) return;

      mapCollectionEl(this).ensureSlotAttributes(slotInfo);
      const success = await mapCollectionEl(this).unfreezeSlot(slotInfo);

      if (success) {
        debug.log('[gk-map-collection] active', {
          slotId: mapCollectionEl(this).getSlotId(slotInfo.slotElement),
          activeCount: mapCollectionEl(this).activeCount,
        });
        slotInfo.failCount = 0;
        slotInfo.lastFailTime = 0;
        slotInfo.lastHealthCheckAttempt = 0;
      } else {
        await mapCollectionEl(this).runPoolExclusive(async () => {
          slotInfo.isActive = false;
          mapCollectionEl(this).activeCount--;
        });
        await slotInfo.mapElement.freeze().catch(() => {});
        slotInfo.failCount++;
        slotInfo.lastFailTime = Date.now();
        mapCollectionDebug('activateSlot: rollback (unfreeze failed)', {
          slotIndex: mapCollectionEl(this).slots.indexOf(slotInfo),
          failCount: slotInfo.failCount,
        });
        if (slotInfo.isVisible && slotInfo.failCount < MAX_FAIL_COUNT) {
          setTimeout(() => mapCollectionEl(this).processVisibilityChanges(), RETRY_BACKOFF_MS * slotInfo.failCount);
        }
      }
    } finally {
      slotInfo.isActivating = false;
      slotInfo.activationStartTime = 0;
    }
  }

  /**
   * Freeze one active slot to free a WebGL context.
   * Prefers maps outside the strict activation viewport, then furthest from center.
   */
  protected async deactivateOneForPool(): Promise<boolean> {
    if (mapCollectionEl(this).isCollectionHidden()) return false;

    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
    const margin = ACTIVATION_VIEWPORT_MARGIN_PX;
    const viewportCenter = vh / 2;

    const candidates = mapCollectionEl(this).getManySlots((s: SlotInfo) => s.isActive)
      .map((s: SlotInfo) => {
        const rect = s.slotElement.getBoundingClientRect();
        const inStrictViewport = rect.bottom > -margin && rect.top < vh + margin;
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        return { slotInfo: s, distance, inStrictViewport };
      })
      .sort((a: { slotInfo: SlotInfo; distance: number; inStrictViewport: boolean }, b: { slotInfo: SlotInfo; distance: number; inStrictViewport: boolean }) => {
        if (a.inStrictViewport !== b.inStrictViewport) {
          return a.inStrictViewport ? 1 : -1;
        }
        return b.distance - a.distance;
      });

    if (candidates.length === 0) return false;

    const toFreeze = candidates[0].slotInfo;
    const slotId = mapCollectionEl(this).getSlotId(toFreeze.slotElement);

    await toFreeze.mapElement.freeze();
    toFreeze.isActive = false;
    mapCollectionEl(this).activeCount = Math.max(0, mapCollectionEl(this).activeCount - 1);
    debug.log('[gk-map-collection] frozen', { slotId, activeCount: mapCollectionEl(this).activeCount });
    return true;
  }

  protected getSlotId(element: HTMLElement): string {
    const withId = element.closest?.('[data-map-id]');
    if (withId) {
      const id = withId.getAttribute('data-map-id');
      if (id) return id;
    }
    const parentCard = element.closest('.map-card');
    if (parentCard) {
      const id = parentCard.getAttribute('data-map-id');
      if (id) return id;
    }
    return element.id || element.getAttribute('data-layer-key') || 'unknown';
  }

  protected setupMutationObserver(): void {
    if (mapCollectionEl(this).mutationObserver) {
      mapCollectionEl(this).mutationObserver.disconnect();
    }

    mapCollectionEl(this).mutationObserver = new MutationObserver((mutations) => {
      let hasNewMaps = false;
      let hasRemovedMaps = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check for added maps
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (node.tagName.toLowerCase() === 'gk-map' || node.querySelector('gk-map')) {
                hasNewMaps = true;
              }
            }
          }
          // Check for removed maps
          for (const node of mutation.removedNodes) {
            if (node instanceof Element) {
              if (node.tagName.toLowerCase() === 'gk-map' || node.querySelector('gk-map')) {
                hasRemovedMaps = true;
              }
            }
          }
        }
      }

      if (hasNewMaps) {
        // Coalesce Vue's per-card gk-map appends: run after next frame so all are in DOM
        if (mapCollectionEl(this).handleNewMapsRafId !== null) cancelAnimationFrame(mapCollectionEl(this).handleNewMapsRafId);
        mapCollectionEl(this).handleNewMapsRafId = requestAnimationFrame(() => {
          mapCollectionEl(this).handleNewMapsRafId = null;
          const count = mapCollectionEl(this).querySelectorAll('gk-map').length;
          debug.log('[gk-map-collection] rAF handleNewMaps', { gkMapCountInDom: count });
          mapCollectionEl(this).handleNewMaps();
        });
      }
      if (hasRemovedMaps) {
        setTimeout(() => mapCollectionEl(this).handleRemovedMaps(), 100);
      }
    });

    mapCollectionEl(this).mutationObserver.observe(this, { childList: true, subtree: true });
  }

}
