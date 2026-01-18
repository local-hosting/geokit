/**
 * Map Collection Component
 *
 * Manages a pool of map instances. Only keeps poolSize maps active at a time.
 * LAZY freezing - only freezes maps when we need room for a new visible map.
 */

import { BaseElement } from '../base-element';
import { type MapElement } from './map';
import { getProviderConfig } from '../../providers/registry';

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
}

// Debounce delay - wait for scrolling to stop before activating
// Reduced to 50ms for faster initial loading while still debouncing rapid scrolls
const SCROLL_DEBOUNCE_MS = 50;

// Retry configuration for failed map loads
const MAX_FAIL_COUNT = 3; // Max retries before giving up
const RETRY_BACKOFF_MS = 2000; // Wait 2s between retries

export class MapCollectionElement extends BaseElement {
  static observedAttributes = ['pool-size', 'api-key', 'map-style', 'viewport-padding'];

  private slots: SlotInfo[] = [];
  private poolSize: number = 6;
  private activeCount: number = 0;
  private initialized: boolean = false;
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private viewportPadding: number = 300;
  private _apiKey: string | null = null;
  private _mapStyle: string | null = null;
  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing: boolean = false; // Lock to prevent concurrent processing
  private pendingReprocess: boolean = false; // Track if reprocess needed after current run
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
  }

  async connectedCallback(): Promise<void> {
    // HMR check: If already initialized, clean up first
    if (this.initialized) {
      this.cleanup();
    }

    this.isInitialized = false;
    await super.connectedCallback();
    this.poolSize = parseInt(this.getAttribute('pool-size') || '6', 10);
    this.viewportPadding = parseInt(this.getAttribute('viewport-padding') || '300', 10);

    const attrApiKey = this.getAttribute('api-key');
    if (attrApiKey) this._apiKey = attrApiKey;

    const attrMapStyle = this.getAttribute('map-style');
    if (attrMapStyle) this._mapStyle = attrMapStyle;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.initialize();
      });
    });
  }

  disconnectedCallback(): void {
    this.cleanup();
    super.disconnectedCallback();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'pool-size' && newValue) {
      this.poolSize = parseInt(newValue, 10);
    } else if (name === 'viewport-padding' && newValue) {
      this.viewportPadding = parseInt(newValue, 10);
    } else if (name === 'api-key' && newValue) {
      this._apiKey = newValue;
    } else if (name === 'map-style' && newValue) {
      this._mapStyle = newValue;
    }
  }

  get apiKey(): string | null {
    if (this._apiKey) return this._apiKey;
    const attrKey = this.getAttribute('api-key');
    if (attrKey) return attrKey;
    const maptilerConfig = getProviderConfig('maptiler');
    if (maptilerConfig?.apiKey) return maptilerConfig.apiKey;
    return null;
  }

  get mapStyle(): string | null {
    return this._mapStyle || this.getAttribute('map-style');
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Setup MutationObserver first to catch any dynamic additions
    this.setupMutationObserver();

    const mapElements = Array.from(this.querySelectorAll('gk-map')) as MapElement[];

    if (mapElements.length === 0) {
      // Setup IntersectionObserver even with no slots (MutationObserver will add them)
      this.setupIntersectionObserver();
      this.initialized = true;
      return;
    }

    // Build slots array FIRST - all start with placeholders
    this.slots = mapElements.map((mapElement) => {
      mapElement.setPoolManaged(true);
      mapElement.showPlaceholder();
      return {
        slotElement: mapElement,
        mapElement,
        isActive: false,
        isVisible: false,
        isActivating: false,
        failCount: 0,
        lastFailTime: 0,
        activationStartTime: 0,
        lastHealthCheckAttempt: 0,
      };
    });

    // NOW setup IntersectionObserver - slots array is populated
    this.setupIntersectionObserver();

    // Start health check for stuck maps
    this.startHealthCheck();

    this.initialized = true;
    this.dispatchEvent(new CustomEvent('map-collection-ready', { bubbles: true }));
  }

  /**
   * IntersectionObserver ONLY updates visibility state
   * Activation is DEBOUNCED - waits for scrolling to stop
   */
  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        // Update visibility state immediately
        for (const entry of entries) {
          const slotInfo = this.slots.find((s) => s.slotElement === entry.target);
          if (slotInfo) {
            slotInfo.isVisible = entry.isIntersecting;
          }
        }

        // Debounce activation - wait for scrolling to stop
        if (this.scrollDebounceTimer) {
          clearTimeout(this.scrollDebounceTimer);
        }
        this.scrollDebounceTimer = setTimeout(() => {
          this.processVisibilityChanges();
        }, SCROLL_DEBOUNCE_MS);
      },
      {
        root: null,
        rootMargin: `${this.viewportPadding}px`,
        threshold: 0,
      }
    );

    this.slots.forEach((slotInfo) => {
      this.intersectionObserver?.observe(slotInfo.slotElement);
    });
  }

  /**
   * Process visibility changes - unfreeze visible slots, lazy freeze
   * Uses a lock to prevent concurrent processing during fast scrolling
   */
  private async processVisibilityChanges(): Promise<void> {
    // If already processing, mark that we need to reprocess when done
    if (this.isProcessing) {
      this.pendingReprocess = true;
      return;
    }
    this.isProcessing = true;
    this.pendingReprocess = false;

    // Check if the collection itself is hidden (e.g., parent view is hidden)
    // If so, skip processing - maps should stay in their current state
    const collectionRect = this.getBoundingClientRect();
    const collectionStyle = window.getComputedStyle(this);
    const isCollectionHidden =
      collectionStyle.visibility === 'hidden' ||
      collectionStyle.display === 'none' ||
      collectionRect.width === 0 ||
      collectionRect.height === 0;

    if (isCollectionHidden) {
      // Collection is hidden (likely view switch), don't process visibility changes
      this.isProcessing = false;
      return;
    }

    // Sync activeCount with actual map states before processing
    // This catches any drift from external freeze operations
    this.syncActiveCount();

    const now = Date.now();

    try {
      // Find visible slots that need activation (not already active or being activated)
      // Skip slots that failed recently (backoff) or exceeded max retries
      const visibleInactive = this.slots.filter((s) => {
        if (!s.isVisible || s.isActive || s.isActivating) return false;
        // Skip if exceeded max retries
        if (s.failCount >= MAX_FAIL_COUNT) return false;
        // Skip if in retry backoff period
        if (s.failCount > 0 && now - s.lastFailTime < RETRY_BACKOFF_MS * s.failCount) return false;
        return true;
      });

      if (visibleInactive.length === 0) return;

      // Calculate how many we can activate (up to pool size)
      const availableSlots = this.poolSize - this.activeCount;
      const toActivate = visibleInactive.slice(0, Math.max(availableSlots, 0));

      // If we need more room, freeze invisible maps first
      if (visibleInactive.length > availableSlots) {
        const needed = Math.min(visibleInactive.length - availableSlots, this.activeCount);
        for (let i = 0; i < needed; i++) {
          await this.deactivateOneInvisible();
          // Small delay to ensure WebGL context is fully released
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Activate maps SEQUENTIALLY to prevent WebGL context exhaustion
      // Each activation waits for the previous one to complete
      for (const slot of toActivate) {
        // Re-check pool before each activation
        if (this.activeCount >= this.poolSize) {
          // Need to freeze more maps
          const frozen = await this.deactivateOneInvisible();
          if (!frozen) break; // Can't make room, stop activating
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        await this.activateSlot(slot);
        // Small delay between activations to ensure WebGL contexts are stable
        if (toActivate.indexOf(slot) < toActivate.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Check if there are more to activate after parallel batch
      const stillInactive = this.slots.filter((s) => s.isVisible && !s.isActive && !s.isActivating);
      if (stillInactive.length > 0 && this.activeCount < this.poolSize) {
        // Schedule another run for remaining slots
        setTimeout(() => this.processVisibilityChanges(), 0);
      }
    } finally {
      this.isProcessing = false;

      // If visibility changed while processing, schedule another run
      if (this.pendingReprocess) {
        this.pendingReprocess = false;
        // Use setTimeout to avoid stack overflow and allow browser to update
        setTimeout(() => this.processVisibilityChanges(), 0);
      }
    }
  }

  /**
   * Unfreeze a slot - will make room if needed
   * Protected against concurrent activation and fast scrolling
   */
  private async activateSlot(slotInfo: SlotInfo): Promise<void> {
    // Already active or being activated - skip
    if (slotInfo.isActive || slotInfo.isActivating) {
      return;
    }

    // Skip if no longer visible (user scrolled away)
    if (!slotInfo.isVisible) {
      return;
    }
    // Mark as activating to prevent concurrent attempts
    slotInfo.isActivating = true;
    slotInfo.activationStartTime = Date.now();

    try {
      // Make room if needed - await freeze to ensure WebGL context is released
      while (this.activeCount >= this.poolSize) {
        // Re-check visibility before expensive freeze operation
        if (!slotInfo.isVisible) {
          return; // User scrolled away, abort
        }

        const frozen = await this.deactivateOneInvisible();
        if (!frozen) {
          // Pool full with all visible maps - this is normal
          return;
        }
      }

      // Final visibility check after freeze
      if (!slotInfo.isVisible) {
        return; // User scrolled away during freeze, abort
      }

      // Mark active BEFORE unfreezing to prevent race conditions
      slotInfo.isActive = true;
      this.activeCount++;

      // HMR safety check: enforce pool size limit
      if (this.activeCount > this.poolSize) {
        // Emergency cleanup: freeze the oldest active map (not the one we're activating)
        const oldestActive = this.slots.find((s) => s.isActive && s !== slotInfo);
        if (oldestActive) {
          oldestActive.mapElement.freeze().catch(() => {});
          oldestActive.isActive = false;
          this.activeCount--;
        }
      }

      // Unfreeze
      slotInfo.mapElement.ensureAttributes({
        apiKey: this.apiKey,
        provider: 'maptiler',
        mapStyle: this.mapStyle,
      });
      const success = await slotInfo.mapElement.unfreeze(this.activeCount - 1);
      if (!success) {
        // Rollback on failure
        slotInfo.isActive = false;
        this.activeCount--;
        slotInfo.failCount++;
        slotInfo.lastFailTime = Date.now();

        // Schedule retry if still visible and under max retries
        if (slotInfo.isVisible && slotInfo.failCount < MAX_FAIL_COUNT) {
          setTimeout(() => this.processVisibilityChanges(), RETRY_BACKOFF_MS * slotInfo.failCount);
        }
      } else {
        // Success - reset fail count and health check attempt timestamp
        slotInfo.failCount = 0;
        slotInfo.lastFailTime = 0;
        slotInfo.lastHealthCheckAttempt = 0;
      }
    } finally {
      slotInfo.isActivating = false;
      slotInfo.activationStartTime = 0;
    }
  }

  /**
   * Freeze ONE invisible slot - returns true if successful
   * Picks the furthest from viewport center
   * Now async to properly wait for WebGL context release
   *
   * IMPORTANT: Only freezes maps that have scrolled off the page.
   * Does NOT freeze maps when the collection itself is hidden (e.g., view switch).
   */
  private async deactivateOneInvisible(): Promise<boolean> {
    // Check if the collection itself is hidden (e.g., parent view is hidden)
    // If so, don't freeze maps - they should stay active for when view returns
    const collectionRect = this.getBoundingClientRect();
    const collectionStyle = window.getComputedStyle(this);
    const isCollectionHidden =
      collectionStyle.visibility === 'hidden' ||
      collectionStyle.display === 'none' ||
      collectionRect.width === 0 ||
      collectionRect.height === 0;

    if (isCollectionHidden) {
      // Collection is hidden (likely view switch), don't freeze maps
      return false;
    }

    const viewportCenter = window.innerHeight / 2;

    // Find active but NOT visible slots
    const candidates = this.slots
      .filter((s) => s.isActive && !s.isVisible)
      .map((s) => {
        const rect = s.slotElement.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        return { slotInfo: s, distance };
      })
      .sort((a, b) => b.distance - a.distance);

    if (candidates.length > 0) {
      const toFreeze = candidates[0].slotInfo;

      // Await freeze to ensure WebGL context is released before creating new maps
      await toFreeze.mapElement.freeze();
      toFreeze.isActive = false;
      this.activeCount--;
      return true;
    }

    return false;
  }

  private getSlotId(element: HTMLElement): string {
    const parentCard = element.closest('.map-card');
    if (parentCard) {
      const id = parentCard.getAttribute('data-map-id');
      if (id) return id;
    }
    return element.id || element.getAttribute('data-dma-slug') || 'unknown';
  }

  private setupMutationObserver(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    this.mutationObserver = new MutationObserver((mutations) => {
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
        setTimeout(() => this.handleNewMaps(), 100);
      }
      if (hasRemovedMaps) {
        setTimeout(() => this.handleRemovedMaps(), 100);
      }
    });

    this.mutationObserver.observe(this, { childList: true, subtree: true });
  }

  private handleNewMaps(): void {
    const mapElements = Array.from(this.querySelectorAll('gk-map')) as MapElement[];
    const existingElements = new Set(this.slots.map((s) => s.mapElement));

    for (const mapElement of mapElements) {
      if (!existingElements.has(mapElement)) {
        mapElement.setPoolManaged(true);
        mapElement.showPlaceholder();

        const slotInfo: SlotInfo = {
          slotElement: mapElement,
          mapElement,
          isActive: false,
          isVisible: false,
          isActivating: false,
          failCount: 0,
          lastFailTime: 0,
          activationStartTime: 0,
          lastHealthCheckAttempt: 0,
        };
        this.slots.push(slotInfo);
        this.intersectionObserver?.observe(mapElement);
      }
    }
  }

  /**
   * Clean up slots for maps that have been removed from the DOM
   */
  private handleRemovedMaps(): void {
    const currentMapElements = new Set(Array.from(this.querySelectorAll('gk-map')) as MapElement[]);

    // Find slots whose map elements are no longer in the DOM
    const removedSlots = this.slots.filter((s) => !currentMapElements.has(s.mapElement));

    for (const slot of removedSlots) {
      // Stop observing the removed element
      this.intersectionObserver?.unobserve(slot.slotElement);

      // Decrement active count if this slot was active
      if (slot.isActive) {
        this.activeCount--;
      }
    }

    // Remove the slots from the array
    this.slots = this.slots.filter((s) => currentMapElements.has(s.mapElement));
  }

  /**
   * Start periodic health check for stuck maps
   * Detects maps that have been loading for too long and resets them
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check every 5 seconds for stuck maps
    this.healthCheckInterval = setInterval(() => {
      this.checkStuckMaps();
    }, 5000);
  }

  /**
   * Check for maps stuck in loading state and reset them
   */
  private checkStuckMaps(): void {
    const now = Date.now();
    const STUCK_THRESHOLD_MS = 15000; // 15 seconds - map should load by then

    for (const slot of this.slots) {
      // Check if map is stuck activating (been activating for too long)
      if (slot.isActivating && slot.activationStartTime > 0) {
        // If it's been activating for more than threshold, reset it
        const activatingTime = now - slot.activationStartTime;
        if (activatingTime > STUCK_THRESHOLD_MS) {
          slot.isActivating = false;
          slot.activationStartTime = 0;
          slot.failCount = Math.min(slot.failCount + 1, MAX_FAIL_COUNT);
          slot.lastFailTime = now;
          // Retry activation after backoff
          if (slot.isVisible && !slot.isActive && slot.failCount < MAX_FAIL_COUNT) {
            setTimeout(() => this.activateSlot(slot), RETRY_BACKOFF_MS * slot.failCount);
          }
        }
      }

      // Check if map has placeholder but should be active
      if (slot.isActive && slot.isVisible) {
        const placeholder = slot.mapElement.querySelector('[data-map-placeholder="true"]');
        if (placeholder) {
          // Map is active but still showing placeholder - might be stuck
          // Check if map instance exists
          const mapInstance = (slot.mapElement as any).getMap?.();
          if (!mapInstance) {
            // Map instance missing but marked active - reset
            slot.isActive = false;
            this.activeCount--;
            slot.failCount = 0;
            slot.lastFailTime = 0;
            setTimeout(() => this.activateSlot(slot), 1000);
          }
        }
      }

      // Check if map is visible but frozen (showing "Restoring map...")
      if (!slot.isActive && slot.isVisible && !slot.isActivating) {
        const placeholder = slot.mapElement.querySelector('[data-map-placeholder="true"]');
        if (placeholder) {
          const placeholderText = placeholder.textContent || '';
          // If showing "Restoring map..." or "Loading map..." for too long, try to activate
          if (placeholderText.includes('Restoring') || placeholderText.includes('Loading')) {
            // Check if this slot has been stuck for a while
            const mapInstance = (slot.mapElement as any).getMap?.();
            if (!mapInstance) {
              // Only attempt activation if we haven't tried recently (cooldown: 10 seconds)
              const timeSinceLastAttempt = now - (slot.lastHealthCheckAttempt || 0);
              if (timeSinceLastAttempt > 10000) {
                // Check if there's room in the pool OR if there are invisible active maps we can freeze
                const hasRoomInPool = this.activeCount < this.poolSize;
                const hasInvisibleActiveToFreeze = this.slots.some(
                  (s) => s.isActive && !s.isVisible
                );

                // Only attempt activation if we can actually make progress
                if (hasRoomInPool || hasInvisibleActiveToFreeze) {
                  // Map is frozen but should be active - try to activate it
                  // Mark that we attempted activation from health check
                  slot.lastHealthCheckAttempt = now;
                  // Reset fail count to give it a fresh chance
                  slot.failCount = 0;
                  slot.lastFailTime = 0;
                  setTimeout(() => this.activateSlot(slot), 500);
                }
                // If pool is full and all active maps are visible, this is expected behavior - don't warn
              }
            }
          }
        }
      }
    }
  }

  private cleanup(): void {
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.slots = [];
    this.activeCount = 0;
    this.initialized = false;
  }

  getStats(): { totalMaps: number; inUse: number; available: number } {
    return {
      totalMaps: this.slots.length,
      inUse: this.activeCount,
      available: Math.max(0, this.poolSize - this.activeCount),
    };
  }

  getActiveMapNames(): string[] {
    return this.slots
      .filter((s) => s.isActive)
      .map((s) => this.getSlotId(s.slotElement))
      .slice(0, this.poolSize);
  }

  /**
   * Sync activeCount with actual map states
   * Call this after external operations that may have frozen maps directly
   * (e.g., when switching views and freezing all maps)
   */
  public syncActiveCount(): void {
    let actualActive = 0;
    for (const slot of this.slots) {
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

    if (actualActive !== this.activeCount) {
      this.activeCount = actualActive;
    }
  }

  /**
   * Freeze all active maps in the collection
   * Returns a promise that resolves when all maps are frozen
   */
  public async freezeAll(): Promise<void> {
    const freezePromises: Promise<void>[] = [];

    for (const slot of this.slots) {
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
