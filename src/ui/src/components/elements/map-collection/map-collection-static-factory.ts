/**
 * Map Collection Component
 *
 * Manages a pool of map instances. Only keeps poolSize maps active at a time.
 * LAZY freezing - only freezes maps when we need room for a new visible map.
 */

import { getLiveMapCount } from '../map/lifecycle/map-freeze';
import { registerGkMapViteHmrHandlers } from '../../../bootstrap/vite-gk-map-hmr';
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


registerGkMapViteHmrHandlers();

