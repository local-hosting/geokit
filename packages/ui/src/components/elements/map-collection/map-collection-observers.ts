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

import { MapCollectionPool } from './map-collection-pool';

import { mapCollectionEl } from './map-collection-el';
export class MapCollectionObservers extends MapCollectionPool {
  protected handleNewMaps(): void {
    const mapElements = Array.from(mapCollectionEl(this).querySelectorAll('gk-map')) as MapElement[];
    const existingElements = new Set(mapCollectionEl(this).getAllSlots().map((s: SlotInfo) => s.mapElement));
    let hasNewMaps = false;

    for (const mapElement of mapElements) {
      if (!existingElements.has(mapElement)) {
        if (typeof mapElement.setPoolManaged === 'function') {
          mapElement.setPoolManaged(true);
        }
        // Don't show placeholder here - wait until processVisibilityChanges decides to load
        // This prevents "Loading map..." flash during scroll

        // IMPORTANT: Do NOT manually check visibility here with getBoundingClientRect()
        // During Vue's batch render, elements may report incorrect positions before layout.
        // Let IntersectionObserver handle visibility detection (it's debounced and accurate).
        const slotInfo: SlotInfo = {
          slotElement: mapElement,
          mapElement,
          isActive: false,
          isVisible: false, // Let IntersectionObserver set this after layout
          isActivating: false,
          failCount: 0,
          lastFailTime: 0,
          activationStartTime: 0,
          lastHealthCheckAttempt: 0,
          firstSeenNoMapInstanceAt: 0,
          firstSeenRestoringAt: 0,
        };
        mapCollectionEl(this).slots.push(slotInfo);
        mapCollectionEl(this).intersectionObserver?.observe(mapElement);
        hasNewMaps = true;
      }
    }

    // If we added new maps, let IntersectionObserver handle visibility detection.
    // Also schedule a delayed run so slots that didn't get isVisible on first pass
    // (e.g. bottom row in 2x3 grid) get a second chance and don't stay black.
    if (hasNewMaps) {
      if (mapCollectionEl(this).handleNewMapsDelayId) {
        clearTimeout(mapCollectionEl(this).handleNewMapsDelayId);
        mapCollectionEl(this).handleNewMapsDelayId = null;
      }
      mapCollectionEl(this).handleNewMapsDelayId = setTimeout(() => {
        mapCollectionEl(this).handleNewMapsDelayId = null;
        // Force visibility for slots in viewport that IntersectionObserver missed (e.g. bottom row)
        const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
        const margin = ACTIVATION_VIEWPORT_MARGIN_PX;
        for (const slot of mapCollectionEl(this).getAllSlots()) {
          if (!slot.isVisible && !slot.isActive) {
            const rect = slot.slotElement.getBoundingClientRect();
            if (rect.bottom > -margin && rect.top < vh + margin) slot.isVisible = true;
          }
        }
        mapCollectionEl(this).processVisibilityChanges();
      }, 250);
      debug.log('[gk-map-collection] handleNewMaps done', {
        slots: mapCollectionEl(this).slots.length,
        note: 'IntersectionObserver + 250ms fallback',
      });
    }
  }

  /**
   * Clean up slots for maps that have been removed from the DOM
   */
  protected handleRemovedMaps(): void {
    const currentMapElements = new Set(Array.from(mapCollectionEl(this).querySelectorAll('gk-map')) as MapElement[]);

    // Find slots whose map elements are no longer in the DOM
    const removedSlots = mapCollectionEl(this).getManySlots((s: SlotInfo) => !currentMapElements.has(s.mapElement));

    for (const slot of removedSlots) {
      // Stop observing the removed element
      mapCollectionEl(this).intersectionObserver?.unobserve(slot.slotElement);

      // Release WebGL context for removed maps
      slot.mapElement.freeze().catch(() => {});

      // Decrement active count if this slot was active
      if (slot.isActive) {
        mapCollectionEl(this).activeCount--;
      }
    }

    // Remove the slots from the array
    mapCollectionEl(this).slots = mapCollectionEl(this).slots.filter((s: SlotInfo) => currentMapElements.has(s.mapElement));
  }

  /**
   * Start periodic health check for stuck maps
   * Detects maps that have been loading for too long and resets them
   */
  protected startHealthCheck(): void {
    if (mapCollectionEl(this).healthCheckInterval) {
      clearInterval(mapCollectionEl(this).healthCheckInterval);
    }

    // Check every 3 seconds for stuck maps (balances recovery speed vs CPU usage)
    mapCollectionEl(this).healthCheckInterval = setInterval(() => {
      mapCollectionEl(this).checkStuckMaps();
    }, 3000);
  }

  /**
   * Check for maps stuck in loading state and reset them.
   * Uses isCollectionHidden(). Stuck placeholder detection is handled by each map (gk-map-stuck / gk-map-failed).
   * Here we only handle "stuck activating" (collection started activation but map never responded).
   */
  protected checkStuckMaps(): void {
    const now = Date.now();
    const isCurrentlyHidden = mapCollectionEl(this).isCollectionHidden();

    if (mapCollectionEl(this).wasHidden && !isCurrentlyHidden) {
      mapCollectionEl(this).wasHidden = false;
      for (const slot of mapCollectionEl(this).getAllSlots()) {
        slot.lastHealthCheckAttempt = 0;
      }
      setTimeout(() => mapCollectionEl(this).processVisibilityChanges(), 0);
      return;
    }

    mapCollectionEl(this).wasHidden = isCurrentlyHidden;
    if (isCurrentlyHidden) return;

    for (const slot of mapCollectionEl(this).getAllSlots()) {
      mapCollectionEl(this).checkStuckActivating(slot, now);
    }
  }

  /** If slot has been activating longer than STUCK_ACTIVATING_MS, reset and schedule retry with backoff. */
  protected checkStuckActivating(slot: SlotInfo, now: number): void {
    if (!slot.isActivating || slot.activationStartTime <= 0) return;
    const activatingTime = now - slot.activationStartTime;
    if (activatingTime <= STUCK_ACTIVATING_MS) return;

    slot.isActivating = false;
    slot.activationStartTime = 0;
    slot.failCount = Math.min(slot.failCount + 1, MAX_FAIL_COUNT);
    slot.lastFailTime = now;
    if (slot.isVisible && !slot.isActive && slot.failCount < MAX_FAIL_COUNT) {
      setTimeout(() => mapCollectionEl(this).activateSlot(slot), RETRY_BACKOFF_MS * slot.failCount);
    }
  }

  protected async cleanupAsync(): Promise<void> {
    const mapsToFreeze = mapCollectionEl(this).getAllSlots().map((s: SlotInfo) => s.mapElement);
    await Promise.all(mapsToFreeze.map((el: MapElement) => el.freeze().catch(() => {})));
    mapCollectionEl(this).cleanupState();
  }

  protected cleanupState(): void {
    if (mapCollectionEl(this)._unfreezeHandler) {
      mapCollectionEl(this).removeEventListener('gk-map-unfreeze', mapCollectionEl(this)._unfreezeHandler);
      mapCollectionEl(this)._unfreezeHandler = null;
    }
    if (mapCollectionEl(this)._stuckOrFailedHandler) {
      mapCollectionEl(this).removeEventListener('gk-map-stuck', mapCollectionEl(this)._stuckOrFailedHandler);
      mapCollectionEl(this).removeEventListener('gk-map-failed', mapCollectionEl(this)._stuckOrFailedHandler);
      mapCollectionEl(this)._stuckOrFailedHandler = null;
    }
    if (mapCollectionEl(this).scrollDebounceTimer) {
      clearTimeout(mapCollectionEl(this).scrollDebounceTimer);
      mapCollectionEl(this).scrollDebounceTimer = null;
    }
    if (mapCollectionEl(this).handleNewMapsRafId !== null) {
      cancelAnimationFrame(mapCollectionEl(this).handleNewMapsRafId);
      mapCollectionEl(this).handleNewMapsRafId = null;
    }
    if (mapCollectionEl(this).handleNewMapsDelayId !== null) {
      clearTimeout(mapCollectionEl(this).handleNewMapsDelayId);
      mapCollectionEl(this).handleNewMapsDelayId = null;
    }
    if (mapCollectionEl(this).healthCheckInterval) {
      clearInterval(mapCollectionEl(this).healthCheckInterval);
      mapCollectionEl(this).healthCheckInterval = null;
    }
    mapCollectionEl(this).intersectionObserver?.disconnect();
    mapCollectionEl(this).intersectionObserver = null;
    mapCollectionEl(this).mutationObserver?.disconnect();
    mapCollectionEl(this).mutationObserver = null;
    mapCollectionEl(this).slots = [];
    mapCollectionEl(this).activeCount = 0;
    mapCollectionEl(this).initialized = false;
    // Reset scroll detection state
    mapCollectionEl(this).isScrolling = false;
    mapCollectionEl(this).intersectionChangeCount = 0;
    mapCollectionEl(this).lastIntersectionTime = 0;
  }

  getStats(): { totalMaps: number; inUse: number; available: number } {
    return {
      totalMaps: mapCollectionEl(this).slots.length,
      inUse: mapCollectionEl(this).activeCount,
      available: Math.max(0, mapCollectionEl(this).effectivePoolSize - mapCollectionEl(this).activeCount),
    };
  }

  getActiveMapNames(): string[] {
    return mapCollectionEl(this).getManySlots((s: SlotInfo) => s.isActive)
      .map((s: SlotInfo) => mapCollectionEl(this).getSlotId(s.slotElement))
      .slice(0, mapCollectionEl(this).poolSize);
  }

  /** Active slots with status for UI (e.g. demo list). Status: ready = tiles painted (idle), loading = init or waiting for paint, error = failed. */
  getActiveMapEntries(): { id: string; status: 'ready' | 'loading' | 'error' }[] {
    return mapCollectionEl(this).getManySlots((s: SlotInfo) => s.isActive)
      .map((s: SlotInfo) => {
        const id = mapCollectionEl(this).getSlotId(s.slotElement);
        const el = s.mapElement as unknown as {
          isInitialized?: boolean;
          hasPainted?: boolean;
          hasPlaceholder?: () => boolean;
          getPlaceholderMessage?: () => string;
        };
        const hasPlaceholder =
          typeof el?.hasPlaceholder === 'function' ? el.hasPlaceholder() : false;
        const msg = (
          typeof el?.getPlaceholderMessage === 'function' ? el.getPlaceholderMessage() : ''
        ).toLowerCase();
        let status: 'ready' | 'loading' | 'error' = 'loading';
        if (msg.includes('fail') || msg.includes('error')) {
          status = 'error';
        } else if (el?.hasPainted === true) {
          status = 'ready';
        } else if (el?.isInitialized && !hasPlaceholder) {
          status = 'ready';
        }
        return { id, status };
      })
      .slice(0, mapCollectionEl(this).poolSize);
  }

  /**
   * Refresh the collection - reprocess visibility and activate visible maps
   * Call this after the collection becomes visible again (e.g., view switch)
   */
}
