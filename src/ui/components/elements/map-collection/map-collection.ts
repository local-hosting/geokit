/**
 * Map Collection Component
 *
 * Manages a pool of map instances. Only keeps poolSize maps active at a time.
 * LAZY freezing - only freezes maps when we need room for a new visible map.
 */

import { BaseElement } from '../../base-element';
import { type MapElement } from '../map/map';
import { getProviderConfig } from '../../../providers/registry';

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

// Activate this many maps in parallel. First visible maps (e.g. 4) all start loading together for faster first paint.
// Stay under typical WebGL context limits (8–16); pool-size on scrolling demo is 10.
const CONCURRENT_ACTIVATION_BATCH = 4;

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
      console.warn('[map-collection]', msg, data);
    } else {
      console.warn('[map-collection]', msg);
    }
  }
}

export class MapCollectionElement extends BaseElement {
  static observedAttributes = [
    'pool-size',
    'api-key',
    'map-style',
    'viewport-padding',
    'min-zoom',
    'max-zoom',
  ];

  private slots: SlotInfo[] = [];
  private poolSize: number = 6;
  private activeCount: number = 0;
  private initialized: boolean = false;
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private viewportPadding: number = 300;
  private _apiKey: string | null = null;
  private _mapStyle: string | null = null;
  private _minZoom: number | null = null;
  private _maxZoom: number | null = null;
  private scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private handleNewMapsRafId: number | null = null;
  private handleNewMapsDelayId: ReturnType<typeof setTimeout> | null = null;
  private isProcessing: boolean = false; // Lock to prevent concurrent processing
  private pendingReprocess: boolean = false; // Track if reprocess needed after current run
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private wasHidden: boolean = false; // Track if collection was previously hidden
  private _unfreezeHandler: ((e: Event) => void) | null = null;
  private _stuckOrFailedHandler: ((e: Event) => void) | null = null;
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
    } else if (name === 'min-zoom' && newValue) {
      this._minZoom = parseFloat(newValue);
    } else if (name === 'max-zoom' && newValue) {
      this._maxZoom = parseFloat(newValue);
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

  get minZoom(): number | null {
    if (this._minZoom !== null) return this._minZoom;
    const attr = this.getAttribute('min-zoom');
    return attr ? parseFloat(attr) : null;
  }

  get maxZoom(): number | null {
    if (this._maxZoom !== null) return this._maxZoom;
    const attr = this.getAttribute('max-zoom');
    return attr ? parseFloat(attr) : null;
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
    // This prevents "Loading map..." flash during scroll
    this.slots = mapElements.map((mapElement) => {
      if (typeof mapElement.setPoolManaged === 'function') {
        mapElement.setPoolManaged(true);
      }
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
      if (target && this.getOneSlot((s) => s.mapElement === target)) {
        setTimeout(() => this.processVisibilityChanges(), 0);
      }
    };
    this.addEventListener('gk-map-unfreeze', this._unfreezeHandler);

    this._stuckOrFailedHandler = (e: Event) => {
      const mapEl = e.target as HTMLElement | null;
      if (!mapEl) return;
      const slot = this.getOneSlot((s) => s.mapElement === mapEl);
      if (slot) this.resetSlotAndRetry(slot, 1500);
    };
    this.addEventListener('gk-map-stuck', this._stuckOrFailedHandler);
    this.addEventListener('gk-map-failed', this._stuckOrFailedHandler);

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
          const slotInfo = this.getOneSlot((s) => s.slotElement === entry.target);
          if (slotInfo) slotInfo.isVisible = entry.isIntersecting;
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

    for (const slotInfo of this.getAllSlots()) {
      this.intersectionObserver?.observe(slotInfo.slotElement);
    }
  }

  /** True when the collection is not on screen (e.g. view switch). Don't freeze or activate. */
  private isCollectionHidden(): boolean {
    const rect = this.getBoundingClientRect();
    const style = window.getComputedStyle(this);
    const isContents = style.display === 'contents';
    return (
      style.visibility === 'hidden' ||
      style.display === 'none' ||
      (!isContents && (rect.width === 0 || rect.height === 0))
    );
  }

  private getAllSlots(): SlotInfo[] {
    return this.slots;
  }

  private getManySlots(predicate: (s: SlotInfo) => boolean): SlotInfo[] {
    return this.slots.filter(predicate);
  }

  private getOneSlot(predicate: (s: SlotInfo) => boolean): SlotInfo | undefined {
    return this.slots.find(predicate);
  }

  /** Deactivate slot and schedule retry after delayMs. Use for stuck/failed maps. */
  private resetSlotAndRetry(slot: SlotInfo, delayMs: number): void {
    slot.firstSeenNoMapInstanceAt = 0;
    slot.firstSeenRestoringAt = 0;
    slot.isActive = false;
    this.activeCount--;
    slot.failCount = 0;
    slot.lastFailTime = 0;
    slot.isActivating = false;
    slot.activationStartTime = 0;
    setTimeout(() => this.activateSlot(slot), delayMs);
  }

  /** Single read for viewport; reuse in one processVisibilityChanges run. */
  private getViewportConstants(): { vh: number; margin: number } {
    return {
      vh: typeof window !== 'undefined' ? window.innerHeight : 0,
      margin: ACTIVATION_VIEWPORT_MARGIN_PX,
    };
  }

  /**
   * One pass: clamp visibility from rect, collect visible-inactive slots with distance from center.
   * Returns slots sorted by distance (closest first) so we only call getBoundingClientRect once per slot.
   */
  private getVisibleInactiveSlotsSorted(now: number, vh: number, margin: number): SlotInfo[] {
    const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
    const withDistance: { slot: SlotInfo; dist: number }[] = [];
    for (const s of this.getAllSlots()) {
      const rect = s.slotElement.getBoundingClientRect();
      const inViewport = rect.bottom > -margin && rect.top < vh + margin;
      if (!inViewport) {
        s.isVisible = false;
        continue;
      }
      s.isVisible = true;
      if (s.isActive || s.isActivating) continue;
      if (s.failCount >= MAX_FAIL_COUNT) continue;
      if (s.failCount > 0 && now - s.lastFailTime < RETRY_BACKOFF_MS * s.failCount) continue;
      const dist = Math.abs(rect.top + rect.height / 2 - centerY);
      withDistance.push({ slot: s, dist });
    }
    withDistance.sort((a, b) => a.dist - b.dist);
    return withDistance.map((x) => x.slot);
  }

  /** Show placeholder on every visible non-active slot (no array alloc). */
  private showPlaceholdersForVisibleWaiting(): void {
    for (const s of this.getAllSlots()) {
      if (!s.isVisible || s.isActive || s.isActivating) continue;
      const el = s.mapElement;
      const hasPlaceholder = typeof el.hasPlaceholder === 'function' ? el.hasPlaceholder() : false;
      const isInit = (el as unknown as { isInitialized?: boolean }).isInitialized;
      if (!hasPlaceholder && !isInit && typeof el.showPlaceholder === 'function') {
        el.showPlaceholder();
      }
    }
  }

  /** Freeze up to `count` invisible maps to free WebGL slots; short delay between each. */
  private async makeRoomFor(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.deactivateOneInvisible();
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /**
   * Process visibility changes - unfreeze visible slots, lazy freeze.
   * Uses a lock to prevent concurrent processing during fast scrolling.
   */
  private async processVisibilityChanges(): Promise<void> {
    if (this.isProcessing) {
      this.pendingReprocess = true;
      return;
    }
    this.isProcessing = true;
    this.pendingReprocess = false;

    if (this.isCollectionHidden()) {
      this.isProcessing = false;
      return;
    }

    this.syncActiveCount();
    const now = Date.now();
    const { vh, margin } = this.getViewportConstants();
    const sorted = this.getVisibleInactiveSlotsSorted(now, vh, margin);

    try {
      this.showPlaceholdersForVisibleWaiting();

      if (sorted.length === 0) return;

      let availableSlots = this.poolSize - this.activeCount;
      const needed = sorted.length - availableSlots;
      if (needed > 0) {
        await this.makeRoomFor(Math.min(needed, this.activeCount));
        availableSlots = this.poolSize - this.activeCount;
      }

      const toActivate = sorted.slice(0, Math.max(availableSlots, 0));

      for (let i = 0; i < toActivate.length; i += CONCURRENT_ACTIVATION_BATCH) {
        const batch = toActivate.slice(i, i + CONCURRENT_ACTIVATION_BATCH);
        while (this.activeCount >= this.poolSize && batch.length > 0) {
          const frozen = await this.deactivateOneInvisible();
          if (!frozen) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        await Promise.all(batch.map((slot) => this.activateSlot(slot)));
        if (i + CONCURRENT_ACTIVATION_BATCH < toActivate.length) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      const stillInactive = this.getManySlots((s) => s.isVisible && !s.isActive && !s.isActivating);
      if (stillInactive.length > 0 && this.activeCount < this.poolSize) {
        setTimeout(() => this.processVisibilityChanges(), 0);
      }
    } finally {
      this.isProcessing = false;
      if (this.pendingReprocess) {
        this.pendingReprocess = false;
        setTimeout(() => this.processVisibilityChanges(), 0);
      }
    }
  }

  /** Set api key and style on the slot's map element before unfreeze. */
  private ensureSlotAttributes(slotInfo: SlotInfo): void {
    const el = slotInfo.mapElement;
    if (typeof el.ensureAttributes !== 'function') return;
    el.ensureAttributes({
      apiKey: this.apiKey,
      provider: 'maptiler',
      mapStyle: this.mapStyle,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
    });
  }

  /** Unfreeze the slot's map; returns true on success. Logs and handles missing unfreeze. */
  private async unfreezeSlot(slotInfo: SlotInfo): Promise<boolean> {
    const el = slotInfo.mapElement;
    const slotIndex = this.slots.indexOf(slotInfo);
    if (typeof el.unfreeze !== 'function') {
      mapCollectionDebug('activateSlot: mapElement.unfreeze not available', { slotIndex });
      return false;
    }
    mapCollectionDebug('activateSlot: calling unfreeze', {
      slotIndex,
      activeCount: this.activeCount,
      poolSize: this.poolSize,
    });
    const success = await el.unfreeze(this.activeCount - 1);
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
  private async activateSlot(slotInfo: SlotInfo): Promise<void> {
    if (slotInfo.isActive || slotInfo.isActivating || !slotInfo.isVisible) return;

    slotInfo.isActivating = true;
    slotInfo.activationStartTime = Date.now();

    try {
      while (this.activeCount >= this.poolSize) {
        if (!slotInfo.isVisible) return;
        const frozen = await this.deactivateOneInvisible();
        if (!frozen) {
          mapCollectionDebug('activateSlot: pool full, cannot make room', {
            activeCount: this.activeCount,
            poolSize: this.poolSize,
            visibleCount: this.getManySlots((s) => s.isVisible).length,
          });
          return;
        }
      }

      if (!slotInfo.isVisible) return;

      slotInfo.isActive = true;
      this.activeCount++;

      if (this.activeCount > this.poolSize) {
        const oldestActive = this.getOneSlot((s) => s.isActive && s !== slotInfo);
        if (oldestActive) {
          await oldestActive.mapElement.freeze().catch(() => {});
          oldestActive.isActive = false;
          this.activeCount--;
        }
      }

      this.ensureSlotAttributes(slotInfo);
      const success = await this.unfreezeSlot(slotInfo);

      if (success) {
        console.log(
          '[map-collection] active',
          this.getSlotId(slotInfo.slotElement),
          'activeCount',
          this.activeCount
        );
        slotInfo.failCount = 0;
        slotInfo.lastFailTime = 0;
        slotInfo.lastHealthCheckAttempt = 0;
      } else {
        slotInfo.isActive = false;
        this.activeCount--;
        slotInfo.failCount++;
        slotInfo.lastFailTime = Date.now();
        mapCollectionDebug('activateSlot: rollback (unfreeze failed)', {
          slotIndex: this.slots.indexOf(slotInfo),
          failCount: slotInfo.failCount,
        });
        if (slotInfo.isVisible && slotInfo.failCount < MAX_FAIL_COUNT) {
          setTimeout(() => this.processVisibilityChanges(), RETRY_BACKOFF_MS * slotInfo.failCount);
        }
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
    if (this.isCollectionHidden()) return false;

    const viewportCenter = window.innerHeight / 2;
    const candidates = this.getManySlots((s) => s.isActive && !s.isVisible)
      .map((s) => {
        const rect = s.slotElement.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        return { slotInfo: s, distance };
      })
      .sort((a, b) => b.distance - a.distance);

    if (candidates.length > 0) {
      const toFreeze = candidates[0].slotInfo;
      const slotId = this.getSlotId(toFreeze.slotElement);

      // Await freeze to ensure WebGL context is released before creating new maps
      await toFreeze.mapElement.freeze();
      toFreeze.isActive = false;
      this.activeCount--;
      console.log('[map-collection] frozen', slotId, 'activeCount', this.activeCount);
      return true;
    }

    return false;
  }

  private getSlotId(element: HTMLElement): string {
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
    const existingElements = new Set(this.getAllSlots().map((s) => s.mapElement));
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
        this.slots.push(slotInfo);
        this.intersectionObserver?.observe(mapElement);
        hasNewMaps = true;
      }
    }

    // If we added new maps, let IntersectionObserver handle visibility detection.
    // Also schedule a delayed run so slots that didn't get isVisible on first pass
    // (e.g. bottom row in 2x3 grid) get a second chance and don't stay black.
    if (hasNewMaps) {
      if (this.handleNewMapsDelayId) {
        clearTimeout(this.handleNewMapsDelayId);
        this.handleNewMapsDelayId = null;
      }
      this.handleNewMapsDelayId = setTimeout(() => {
        this.handleNewMapsDelayId = null;
        // Force visibility for slots in viewport that IntersectionObserver missed (e.g. bottom row)
        const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
        const margin = ACTIVATION_VIEWPORT_MARGIN_PX;
        for (const slot of this.getAllSlots()) {
          if (!slot.isVisible && !slot.isActive) {
            const rect = slot.slotElement.getBoundingClientRect();
            if (rect.bottom > -margin && rect.top < vh + margin) slot.isVisible = true;
          }
        }
        this.processVisibilityChanges();
      }, 250);
      if (typeof window !== 'undefined' && (window as any).__GEOVIEW_DEBUG__) {
        console.log(
          '[map-collection] handleNewMaps done, slots:',
          this.slots.length,
          '(IntersectionObserver + 250ms fallback)'
        );
      }
    }
  }

  /**
   * Clean up slots for maps that have been removed from the DOM
   */
  private handleRemovedMaps(): void {
    const currentMapElements = new Set(Array.from(this.querySelectorAll('gk-map')) as MapElement[]);

    // Find slots whose map elements are no longer in the DOM
    const removedSlots = this.getManySlots((s) => !currentMapElements.has(s.mapElement));

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

    // Check every 3 seconds for stuck maps (balances recovery speed vs CPU usage)
    this.healthCheckInterval = setInterval(() => {
      this.checkStuckMaps();
    }, 3000);
  }

  /**
   * Check for maps stuck in loading state and reset them.
   * Uses isCollectionHidden(). Stuck placeholder detection is handled by each map (gk-map-stuck / gk-map-failed).
   * Here we only handle "stuck activating" (collection started activation but map never responded).
   */
  private checkStuckMaps(): void {
    const now = Date.now();
    const isCurrentlyHidden = this.isCollectionHidden();

    if (this.wasHidden && !isCurrentlyHidden) {
      this.wasHidden = false;
      for (const slot of this.getAllSlots()) {
        slot.lastHealthCheckAttempt = 0;
      }
      setTimeout(() => this.processVisibilityChanges(), 0);
      return;
    }

    this.wasHidden = isCurrentlyHidden;
    if (isCurrentlyHidden) return;

    for (const slot of this.getAllSlots()) {
      this.checkStuckActivating(slot, now);
    }
  }

  /** If slot has been activating longer than STUCK_ACTIVATING_MS, reset and schedule retry with backoff. */
  private checkStuckActivating(slot: SlotInfo, now: number): void {
    if (!slot.isActivating || slot.activationStartTime <= 0) return;
    const activatingTime = now - slot.activationStartTime;
    if (activatingTime <= STUCK_ACTIVATING_MS) return;

    slot.isActivating = false;
    slot.activationStartTime = 0;
    slot.failCount = Math.min(slot.failCount + 1, MAX_FAIL_COUNT);
    slot.lastFailTime = now;
    if (slot.isVisible && !slot.isActive && slot.failCount < MAX_FAIL_COUNT) {
      setTimeout(() => this.activateSlot(slot), RETRY_BACKOFF_MS * slot.failCount);
    }
  }

  private cleanup(): void {
    if (this._unfreezeHandler) {
      this.removeEventListener('gk-map-unfreeze', this._unfreezeHandler);
      this._unfreezeHandler = null;
    }
    if (this._stuckOrFailedHandler) {
      this.removeEventListener('gk-map-stuck', this._stuckOrFailedHandler);
      this.removeEventListener('gk-map-failed', this._stuckOrFailedHandler);
      this._stuckOrFailedHandler = null;
    }
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
    if (this.handleNewMapsRafId !== null) {
      cancelAnimationFrame(this.handleNewMapsRafId);
      this.handleNewMapsRafId = null;
    }
    if (this.handleNewMapsDelayId !== null) {
      clearTimeout(this.handleNewMapsDelayId);
      this.handleNewMapsDelayId = null;
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
    return this.getManySlots((s) => s.isActive)
      .map((s) => this.getSlotId(s.slotElement))
      .slice(0, this.poolSize);
  }

  /** Active slots with status for UI (e.g. demo list). Status: ready = tiles painted (idle), loading = init or waiting for paint, error = failed. */
  getActiveMapEntries(): { id: string; status: 'ready' | 'loading' | 'error' }[] {
    return this.getManySlots((s) => s.isActive)
      .map((s) => {
        const id = this.getSlotId(s.slotElement);
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
      .slice(0, this.poolSize);
  }

  /**
   * Refresh the collection - reprocess visibility and activate visible maps
   * Call this after the collection becomes visible again (e.g., view switch)
   */
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
