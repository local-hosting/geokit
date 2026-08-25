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

import { MapCollectionObservers } from './map-collection-observers';

export class MapCollectionElement extends MapCollectionObservers {
  public refresh(): void {
    for (const slot of this.getAllSlots()) {
      slot.lastHealthCheckAttempt = 0;
      slot.failCount = 0;
      slot.lastFailTime = 0;
    }
    // Trigger immediate reprocessing
    this.processVisibilityChanges();
  }

  /**
   * Sync activeCount with actual map states
   * Call this after external operations that may have frozen maps directly
   * (e.g., when switching views and freezing all maps)
   */
  public syncActiveCount(): void {
    let actualActive = 0;
    for (const slot of this.getAllSlots()) {
      // Check if map actually has an active instance
      const mapInstance = (slot.mapElement as any).getMap?.();
      const isFrozen = (slot.mapElement as any)._isFrozen;

      if (mapInstance && !isFrozen) {
        actualActive++;
        slot.isActive = true;
      } else {
        slot.isActive = false;
      }
    }

    const liveMaps = getLiveMapCount();
    const reconciled = Math.max(actualActive, liveMaps);
    if (reconciled !== this.activeCount) {
      this.activeCount = reconciled;
    }
  }

  /**
   * Freeze all active maps in the collection
   * Returns a promise that resolves when all maps are frozen
   */
  public async freezeAll(): Promise<void> {
    const freezePromises: Promise<void>[] = [];
    for (const slot of this.getAllSlots()) {
      if (slot.isActive) {
        slot.isActive = false;
        freezePromises.push(
          slot.mapElement.freeze().catch(() => {
            // Ignore freeze errors
          })
        );
      }
    }

    this.activeCount = 0;
    await Promise.all(freezePromises);
  }
}

if (!customElements.get('gk-map-collection')) {
  customElements.define('gk-map-collection', MapCollectionElement);
}

/** Vite HMR: release WebGL contexts before the module reloads. */
if (typeof import.meta !== 'undefined' && import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.querySelectorAll('gk-map-collection').forEach((el) => {
      const collection = el as MapCollectionElement;
      void collection.freezeAll?.();
    });
    document.querySelectorAll('gk-map').forEach((el) => {
      const map = el as MapElement;
      void map.freeze?.();
    });
  });
}

