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
  /** When we first saw placeholder with no map instance (avoid resetting during createMap()) */
  firstSeenNoMapInstanceAt: number;
  /** When we first saw "Restoring..." with map instance but !isInitialized (reset after 5s) */
  firstSeenRestoringAt: number;
}

// Debounce delay - wait for scrolling to stop before activating
// 100ms is responsive while still debouncing rapid scroll
const SCROLL_DEBOUNCE_MS = 100;

// Extended debounce when user is actively scrolling (detected via rapid intersection changes)
const SCROLL_ACTIVE_DEBOUNCE_MS = 150;

// Activate this many maps in parallel (higher = faster first load; stay under WebGL context limits, typically 8–16)
// Reduced from 4 to 2 to be more conservative with WebGL context creation
const CONCURRENT_ACTIVATION_BATCH = 2;

// Retry configuration for failed map loads
const MAX_FAIL_COUNT = 3; // Max retries before giving up
const RETRY_BACKOFF_MS = 2000; // Wait 2s between retries

function mapCollectionDebug(msg: string, data?: Record<string, unknown>): void {
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __GEOKIT_DEBUG__?: boolean }).__GEOKIT_DEBUG__
  ) {
    if (data !== undefined) {
      console.warn('[map-collection]', msg, data);
    } else {
      console.warn('[map-collection]', msg);
    }
  }
}

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
  private handleNewMapsRafId: number | null = null;
  private isProcessing: boolean = false; // Lock to prevent concurrent processing
  private pendingReprocess: boolean = false; // Track if reprocess needed after current run
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private wasHidden: boolean = false; // Track if collection was previously hidden
  private _unfreezeHandler: ((e: Event) => void) | null = null;
  private lastIntersectionTime: number = 0; // Track time of last intersection change
  private intersectionChangeCount: number = 0; // Count rapid intersection changes (scroll detection)
  private isScrolling: boolean = false; // True when user is actively scrolling

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

    // Build slots array FIRST - no placeholders during initial setup (they'll show when we actually load)
    // This prevents "Loading..." flash during scroll
    this.slots = mapElements.map((mapElement) => {
      mapElement.setPoolManaged(true);
      // Don't show placeholder here - wait until processVisibilityChanges decides to load
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
        firstSeenNoMapInstanceAt: 0,
        firstSeenRestoringAt: 0,
      };
    });

    // NOW setup IntersectionObserver - slots array is populated
    this.setupIntersectionObserver();

    // Start health check for stuck maps
    this.startHealthCheck();

    // When a map in the collection finishes loading, reprocess so other visible slots get maps
    this._unfreezeHandler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && this.slots.some((s) => s.mapElement === target)) {
        setTimeout(() => this.processVisibilityChanges(), 0);
      }
    };
    this.addEventListener('gk-map-unfreeze', this._unfreezeHandler);

    this.initialized = true;
    this.dispatchEvent(new CustomEvent('map-collection-ready', { bubbles: true }));
  }

  /**
   * IntersectionObserver ONLY updates visibility state
   * Activation is DEBOUNCED - waits for scrolling to stop
   * Uses scroll velocity detection to extend debounce during rapid scrolling
   */
  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const now = Date.now();

        // Detect rapid scrolling: if we're getting intersection changes faster than 100ms apart,
        // user is actively scrolling - use longer debounce
        if (now - this.lastIntersectionTime < 100) {
          this.intersectionChangeCount++;
          // After 3+ rapid changes, mark as actively scrolling
          if (this.intersectionChangeCount >= 3) {
            this.isScrolling = true;
          }
        } else {
          // Reset counter if intersection changes are spaced out
          this.intersectionChangeCount = 0;
        }
        this.lastIntersectionTime = now;

        for (const entry of entries) {
          const slotInfo = this.slots.find((s) => s.slotElement === entry.target);
          if (slotInfo) {
            slotInfo.isVisible = entry.isIntersecting;
          }
        }

        // Debounce activation - wait for scrolling to stop
        // Use longer debounce when actively scrolling to avoid WebGL context exhaustion
        if (this.scrollDebounceTimer) {
          clearTimeout(this.scrollDebounceTimer);
        }

        const debounceMs = this.isScrolling ? SCROLL_ACTIVE_DEBOUNCE_MS : SCROLL_DEBOUNCE_MS;

        this.scrollDebounceTimer = setTimeout(() => {
          // Scrolling has stopped - reset scroll state
          this.isScrolling = false;
          this.intersectionChangeCount = 0;
          this.processVisibilityChanges();
        }, debounceMs);
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
    // Note: display:contents has no box so getBoundingClientRect() is 0; don't treat as hidden
    const collectionRect = this.getBoundingClientRect();
    const collectionStyle = window.getComputedStyle(this);
    const isDisplayContents = collectionStyle.display === 'contents';
    const isCollectionHidden =
      collectionStyle.visibility === 'hidden' ||
      collectionStyle.display === 'none' ||
      (!isDisplayContents && (collectionRect.width === 0 || collectionRect.height === 0));

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

      // Show placeholders immediately for all visible maps that will load
      // This gives instant feedback that maps are about to load
      for (const slot of visibleInactive) {
        if (!slot.mapElement.hasPlaceholder() && !(slot.mapElement as any).isInitialized) {
          slot.mapElement.showPlaceholder();
        }
      }

      // Prefer slots closest to viewport center so the map the user is looking at loads first
      const viewportCenterY = window.innerHeight / 2;
      const sortedVisibleInactive = [...visibleInactive].sort((a, b) => {
        const rectA = a.slotElement.getBoundingClientRect();
        const rectB = b.slotElement.getBoundingClientRect();
        const centerA = rectA.top + rectA.height / 2;
        const centerB = rectB.top + rectB.height / 2;
        const distA = Math.abs(centerA - viewportCenterY);
        const distB = Math.abs(centerB - viewportCenterY);
        return distA - distB;
      });

      // Calculate how many we can activate (up to pool size)
      const availableSlots = this.poolSize - this.activeCount;
      const toActivate = sortedVisibleInactive.slice(0, Math.max(availableSlots, 0));

      // If we need more room, freeze invisible maps first
      if (visibleInactive.length > availableSlots) {
        const needed = Math.min(visibleInactive.length - availableSlots, this.activeCount);
        for (let i = 0; i < needed; i++) {
          await this.deactivateOneInvisible();
          // Small delay to ensure WebGL context is fully released
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Activate maps in small parallel batches to speed load (batch size limits WebGL pressure)
      for (let i = 0; i < toActivate.length; i += CONCURRENT_ACTIVATION_BATCH) {
        const batch = toActivate.slice(i, i + CONCURRENT_ACTIVATION_BATCH);
        // Re-check pool before batch
        while (this.activeCount >= this.poolSize && batch.length > 0) {
          const frozen = await this.deactivateOneInvisible();
          if (!frozen) break;
          // Wait for WebGL context to be fully released
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        await Promise.all(batch.map((slot) => this.activateSlot(slot)));
        // Small delay between batches to let browser release WebGL contexts
        if (i + CONCURRENT_ACTIVATION_BATCH < toActivate.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
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
          mapCollectionDebug('activateSlot: pool full, cannot make room', {
            activeCount: this.activeCount,
            poolSize: this.poolSize,
            visibleCount: this.slots.filter((s) => s.isVisible).length,
          });
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
      const slotIndex = this.slots.indexOf(slotInfo);
      const placeholderBefore = slotInfo.mapElement.querySelector('[data-map-placeholder="true"]');
      mapCollectionDebug('activateSlot: calling unfreeze', {
        slotIndex,
        activeCount: this.activeCount,
        poolSize: this.poolSize,
        placeholderText: placeholderBefore?.textContent?.slice(0, 30) ?? null,
      });
      slotInfo.mapElement.ensureAttributes({
        apiKey: this.apiKey,
        provider: 'maptiler',
        mapStyle: this.mapStyle,
      });
      const success = await slotInfo.mapElement.unfreeze(this.activeCount - 1);
      mapCollectionDebug('activateSlot: unfreeze returned', {
        slotIndex,
        success,
        hasMap: !!(slotInfo.mapElement as any).getMap?.(),
        isInitialized: (slotInfo.mapElement as any).isInitialized,
      });
      if (!success) {
        // Rollback on failure
        slotInfo.isActive = false;
        this.activeCount--;
        slotInfo.failCount++;
        slotInfo.lastFailTime = Date.now();
        mapCollectionDebug('activateSlot: rollback (unfreeze failed)', {
          slotIndex,
          failCount: slotInfo.failCount,
        });

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
    // display:contents has no box so rect is 0; don't treat as hidden
    const collectionRect = this.getBoundingClientRect();
    const collectionStyle = window.getComputedStyle(this);
    const isDisplayContents = collectionStyle.display === 'contents';
    const isCollectionHidden =
      collectionStyle.visibility === 'hidden' ||
      collectionStyle.display === 'none' ||
      (!isDisplayContents && (collectionRect.width === 0 || collectionRect.height === 0));

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
        // Coalesce Vue's per-card gk-map appends: run after next frame so all are in DOM
        if (this.handleNewMapsRafId !== null) cancelAnimationFrame(this.handleNewMapsRafId);
        this.handleNewMapsRafId = requestAnimationFrame(() => {
          this.handleNewMapsRafId = null;
          if (typeof window !== 'undefined' && (window as any).__GEOVIEW_DEBUG__) {
            const count = this.querySelectorAll('gk-map').length;
            console.log('[map-collection] rAF handleNewMaps, gk-map count in DOM:', count);
          }
          this.handleNewMaps();
        });
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
    let hasNewMaps = false;

    for (const mapElement of mapElements) {
      if (!existingElements.has(mapElement)) {
        mapElement.setPoolManaged(true);
        // Don't show placeholder here - wait until processVisibilityChanges decides to load
        // This prevents "Loading..." flash during scroll

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
        this.slots.push(slotInfo);
        this.intersectionObserver?.observe(mapElement);
        hasNewMaps = true;
      }
    }

    // If we added new maps, let IntersectionObserver handle visibility detection
    // Don't call processVisibilityChanges() immediately - the observer callback will do it
    // after proper layout, which prevents WebGL context exhaustion from premature activation
    if (hasNewMaps) {
      if (typeof window !== 'undefined' && (window as any).__GEOVIEW_DEBUG__) {
        console.log(
          '[map-collection] handleNewMaps done, slots:',
          this.slots.length,
          '(waiting for IntersectionObserver)'
        );
      }
      // Note: IntersectionObserver will fire async after layout and call processVisibilityChanges
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

    // Check every 2 seconds for stuck maps (faster recovery from "Preparing map...")
    this.healthCheckInterval = setInterval(() => {
      this.checkStuckMaps();
    }, 2000);
  }

  /**
   * Check for maps stuck in loading state and reset them
   * Also detects when the collection transitions from hidden to visible
   */
  private checkStuckMaps(): void {
    const now = Date.now();

    // Check if collection visibility changed (hidden -> visible)
    // display:contents has no box so rect is 0; don't treat as hidden
    const collectionRect = this.getBoundingClientRect();
    const collectionStyle = window.getComputedStyle(this);
    const isDisplayContents = collectionStyle.display === 'contents';
    const isCurrentlyHidden =
      collectionStyle.visibility === 'hidden' ||
      collectionStyle.display === 'none' ||
      (!isDisplayContents && (collectionRect.width === 0 || collectionRect.height === 0));

    if (this.wasHidden && !isCurrentlyHidden) {
      // Collection just became visible - trigger immediate reprocessing
      this.wasHidden = false;
      // Reset health check timestamps to allow immediate activation
      for (const slot of this.slots) {
        slot.lastHealthCheckAttempt = 0;
      }
      setTimeout(() => this.processVisibilityChanges(), 0);
      return;
    }

    this.wasHidden = isCurrentlyHidden;

    // Skip health check if collection is hidden
    if (isCurrentlyHidden) {
      return;
    }
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
          const isInitialized = (slot.mapElement as any).isInitialized;
          if (!mapInstance) {
            // Map instance missing - may still be in createMap(); only reset after grace period
            const firstSeen = slot.firstSeenNoMapInstanceAt ?? now;
            if (!slot.firstSeenNoMapInstanceAt) slot.firstSeenNoMapInstanceAt = firstSeen;
            const stuckMs = now - firstSeen;
            mapCollectionDebug('healthCheck: active slot with placeholder, no mapInstance', {
              placeholderText: placeholder.textContent?.slice(0, 30),
              stuckMs,
              firstSeenNoMapInstanceAt: slot.firstSeenNoMapInstanceAt,
            });
            if (stuckMs > 10000) {
              mapCollectionDebug('healthCheck: resetting slot (no mapInstance after 10s)', {
                slotIndex: this.slots.indexOf(slot),
              });
              slot.firstSeenNoMapInstanceAt = 0;
              slot.firstSeenRestoringAt = 0;
              slot.isActive = false;
              this.activeCount--;
              slot.failCount = 0;
              slot.lastFailTime = 0;
              setTimeout(() => this.activateSlot(slot), 1000);
            }
          } else {
            slot.firstSeenNoMapInstanceAt = 0;
          }
          if (mapInstance) {
            if (isInitialized) {
              slot.firstSeenRestoringAt = 0;
              slot.mapElement.hidePlaceholder();
            } else {
              const placeholderText = placeholder.textContent || '';
              if (placeholderText.includes('Restoring')) {
                // Stuck on "Restoring..." - style may never load; reset slot after 5s so we can retry
                const firstRestoring = slot.firstSeenRestoringAt ?? now;
                if (!slot.firstSeenRestoringAt) slot.firstSeenRestoringAt = firstRestoring;
                const restoringStuckMs = now - firstRestoring;
                mapCollectionDebug(
                  'healthCheck: active slot Restoring, mapInstance but !isInitialized',
                  {
                    slotIndex: this.slots.indexOf(slot),
                    restoringStuckMs,
                    firstSeenRestoringAt: slot.firstSeenRestoringAt,
                  }
                );
                if (restoringStuckMs > 5000) {
                  mapCollectionDebug('healthCheck: resetting slot (Restoring stuck >5s)', {
                    slotIndex: this.slots.indexOf(slot),
                  });
                  // Reset slot so collection can retry
                  slot.firstSeenNoMapInstanceAt = 0;
                  slot.firstSeenRestoringAt = 0;
                  slot.isActive = false;
                  this.activeCount--;
                  slot.failCount = 0;
                  slot.lastFailTime = 0;
                  slot.mapElement.showPlaceholder('Loading...');
                  setTimeout(() => this.activateSlot(slot), 1500);
                }
              } else {
                // Map instance exists but isInitialized is false - 'load' may never have fired
                const styleLoaded =
                  typeof (mapInstance as { isStyleLoaded?: () => boolean }).isStyleLoaded ===
                    'function' && (mapInstance as { isStyleLoaded: () => boolean }).isStyleLoaded();
                if (styleLoaded) {
                  slot.firstSeenRestoringAt = 0;
                  (slot.mapElement as unknown as { isInitialized: boolean }).isInitialized = true;
                  slot.mapElement.hidePlaceholder();
                }
              }
            }
          }
        }
      }

      // Check if map is visible but frozen (showing "Restoring..." or "Loading...")
      if (!slot.isActive && slot.isVisible && !slot.isActivating) {
        const placeholder = slot.mapElement.querySelector('[data-map-placeholder="true"]');
        if (placeholder) {
          const placeholderText = placeholder.textContent || '';
          // If showing "Restoring..." or "Loading..." for too long, try to activate
          if (placeholderText.includes('Restoring') || placeholderText.includes('Loading')) {
            // Check if this slot has been stuck for a while
            const mapInstance = (slot.mapElement as any).getMap?.();
            if (!mapInstance) {
              // Only attempt activation if we haven't tried recently (cooldown: 3 seconds)
              const timeSinceLastAttempt = now - (slot.lastHealthCheckAttempt || 0);
              if (timeSinceLastAttempt > 3000) {
                // Check if there's room in the pool OR if there are invisible active maps we can freeze
                const hasRoomInPool = this.activeCount < this.poolSize;
                const hasInvisibleActiveToFreeze = this.slots.some(
                  (s) => s.isActive && !s.isVisible
                );

                // Only attempt activation if we can actually make progress
                if (hasRoomInPool || hasInvisibleActiveToFreeze) {
                  mapCollectionDebug(
                    'healthCheck: retrying activation (visible slot with placeholder)',
                    {
                      slotIndex: this.slots.indexOf(slot),
                      placeholderText: placeholderText.slice(0, 30),
                      hasRoomInPool,
                      hasInvisibleActiveToFreeze,
                    }
                  );
                  // Map is frozen but should be active - try to activate it
                  slot.lastHealthCheckAttempt = now;
                  slot.failCount = 0;
                  slot.lastFailTime = 0;
                  setTimeout(() => this.activateSlot(slot), 500);
                } else {
                  mapCollectionDebug('healthCheck: pool full, slot waiting for room', {
                    slotIndex: this.slots.indexOf(slot),
                    placeholderText: placeholderText.slice(0, 30),
                    activeCount: this.activeCount,
                    poolSize: this.poolSize,
                  });
                  // Pool is full and all active maps are visible - this slot is waiting for room.
                  // Keep showing "Preparing map..." - no need to change the message
                }
              }
            }
          }
        }
      }
    }
  }

  private cleanup(): void {
    if (this._unfreezeHandler) {
      this.removeEventListener('gk-map-unfreeze', this._unfreezeHandler);
      this._unfreezeHandler = null;
    }
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
    if (this.handleNewMapsRafId !== null) {
      cancelAnimationFrame(this.handleNewMapsRafId);
      this.handleNewMapsRafId = null;
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
    // Reset scroll detection state
    this.isScrolling = false;
    this.intersectionChangeCount = 0;
    this.lastIntersectionTime = 0;
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
   * Refresh the collection - reprocess visibility and activate visible maps
   * Call this after the collection becomes visible again (e.g., view switch)
   */
  public refresh(): void {
    // Reset health check timestamps to allow immediate activation
    for (const slot of this.slots) {
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
