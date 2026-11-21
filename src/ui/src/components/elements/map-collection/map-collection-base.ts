/**
 * Map Collection Component
 *
 * Manages a pool of map instances. Only keeps poolSize maps active at a time.
 * LAZY freezing - only freezes maps when we need room for a new visible map.
 */

import { BaseElement } from '../../base-element';
import { type MapElement } from '../map/map';
import { getProviderConfig } from '../../../providers/registry';
import {
  delayForWebGLRelease,
  getMaxActiveMaps,
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

// Retry configuration for failed map loads
const MAX_FAIL_COUNT = 3; // Max retries before giving up
const RETRY_BACKOFF_MS = 2000; // Wait 2s between retries

// Only activate slots that actually intersect the visible viewport (small margin).
// IntersectionObserver uses a large rootMargin so we filter here to avoid activating maps above/below the fold.
const ACTIVATION_VIEWPORT_MARGIN_PX = 50;

import { mapCollectionEl } from './map-collection-el';
export class MapCollectionBase extends BaseElement {
  static observedAttributes = [
    'pool-size',
    'api-key',
    'map-style',
    'viewport-padding',
    'min-zoom',
    'max-zoom',
  ];

  protected slots: SlotInfo[] = [];
  protected poolSize: number = 6;
  protected activeCount: number = 0;
  protected initialized: boolean = false;
  protected intersectionObserver: IntersectionObserver | null = null;
  protected mutationObserver: MutationObserver | null = null;
  protected viewportPadding: number = 300;
  protected _apiKey: string | null = null;
  protected _mapStyle: string | null = null;
  protected _minZoom: number | null = null;
  protected _maxZoom: number | null = null;
  protected scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  protected handleNewMapsRafId: number | null = null;
  protected handleNewMapsDelayId: ReturnType<typeof setTimeout> | null = null;
  protected isProcessing: boolean = false; // Lock to prevent concurrent processing
  protected pendingReprocess: boolean = false; // Track if reprocess needed after current run
  protected healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  protected wasHidden: boolean = false; // Track if collection was previously hidden
  protected _unfreezeHandler: ((e: Event) => void) | null = null;
  protected _stuckOrFailedHandler: ((e: Event) => void) | null = null;
  protected lastIntersectionTime: number = 0; // Track time of last intersection change
  protected intersectionChangeCount: number = 0; // Count rapid intersection changes (scroll detection)
  protected isScrolling: boolean = false; // True when user is actively scrolling
  protected suppressActivationUntil: number = 0; // Skip activation until this timestamp (e.g. during programmatic scroll)
  /** Serialize pool slot reservation to avoid exceeding WebGL context budget under parallel activation. */
  protected _poolLock: Promise<void> = Promise.resolve();

  constructor() {
    super();
  }

  async connectedCallback(): Promise<void> {
    // HMR check: If already initialized, clean up first
    if (mapCollectionEl(this).initialized) {
      await mapCollectionEl(this).cleanupAsync();
    }

    mapCollectionEl(this).isInitialized = false;
    await super.connectedCallback();
    mapCollectionEl(this).poolSize = parseInt(mapCollectionEl(this).getAttribute('pool-size') || '6', 10);
    mapCollectionEl(this).viewportPadding = parseInt(mapCollectionEl(this).getAttribute('viewport-padding') || '300', 10);

    const attrApiKey = mapCollectionEl(this).getAttribute('api-key');
    if (attrApiKey) mapCollectionEl(this)._apiKey = attrApiKey;

    const attrMapStyle = mapCollectionEl(this).getAttribute('map-style');
    if (attrMapStyle) mapCollectionEl(this)._mapStyle = attrMapStyle;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mapCollectionEl(this).initialize();
      });
    });
  }

  disconnectedCallback(): void {
    void mapCollectionEl(this).cleanupAsync();
    super.disconnectedCallback();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'pool-size' && newValue) {
      mapCollectionEl(this).poolSize = parseInt(newValue, 10);
    } else if (name === 'viewport-padding' && newValue) {
      mapCollectionEl(this).viewportPadding = parseInt(newValue, 10);
    } else if (name === 'api-key' && newValue) {
      mapCollectionEl(this)._apiKey = newValue;
    } else if (name === 'map-style' && newValue) {
      mapCollectionEl(this)._mapStyle = newValue;
    } else if (name === 'min-zoom' && newValue) {
      mapCollectionEl(this)._minZoom = parseFloat(newValue);
    } else if (name === 'max-zoom' && newValue) {
      mapCollectionEl(this)._maxZoom = parseFloat(newValue);
    }
  }

  get apiKey(): string | null {
    if (mapCollectionEl(this)._apiKey) return mapCollectionEl(this)._apiKey;
    const attrKey = mapCollectionEl(this).getAttribute('api-key');
    if (attrKey) return attrKey;
    const maptilerConfig = getProviderConfig('maptiler');
    if (maptilerConfig?.apiKey) return maptilerConfig.apiKey;
    return null;
  }

  get mapStyle(): string | null {
    return mapCollectionEl(this)._mapStyle || mapCollectionEl(this).getAttribute('map-style');
  }

  get minZoom(): number | null {
    if (mapCollectionEl(this)._minZoom !== null) return mapCollectionEl(this)._minZoom;
    const attr = mapCollectionEl(this).getAttribute('min-zoom');
    return attr ? parseFloat(attr) : null;
  }

  get maxZoom(): number | null {
    if (mapCollectionEl(this)._maxZoom !== null) return mapCollectionEl(this)._maxZoom;
    const attr = mapCollectionEl(this).getAttribute('max-zoom');
    return attr ? parseFloat(attr) : null;
  }

  /** Effective pool cap based on browser WebGL context budget (MapTiler uses ~2 contexts per map). */
  protected get effectivePoolSize(): number {
    return getMaxActiveMaps(mapCollectionEl(this).poolSize);
  }

  /** Run fn exclusively — prevents parallel activateSlot from oversubscribing the pool. */
  protected runPoolExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = mapCollectionEl(this)._poolLock.then(fn);
    mapCollectionEl(this)._poolLock = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  protected async initialize(): Promise<void> {
    if (mapCollectionEl(this).initialized) return;

    // Setup MutationObserver first to catch any dynamic additions
    mapCollectionEl(this).setupMutationObserver();

    const mapElements = Array.from(mapCollectionEl(this).querySelectorAll('gk-map')) as MapElement[];

    if (mapElements.length === 0) {
      // Setup IntersectionObserver even with no slots (MutationObserver will add them)
      mapCollectionEl(this).setupIntersectionObserver();
      mapCollectionEl(this).initialized = true;
      return;
    }

    // Build slots array FIRST - no placeholders during initial setup (they'll show when we actually load)
    // This prevents "Loading map..." flash during scroll
    mapCollectionEl(this).slots = mapElements.map((mapElement) => {
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
    mapCollectionEl(this).setupIntersectionObserver();

    // Start health check for stuck maps
    mapCollectionEl(this).startHealthCheck();

    // When a map in the collection finishes loading, reprocess so other visible slots get maps
    mapCollectionEl(this)._unfreezeHandler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && mapCollectionEl(this).getOneSlot((s: SlotInfo) => s.mapElement === target)) {
        setTimeout(() => mapCollectionEl(this).processVisibilityChanges(), 0);
      }
    };
    mapCollectionEl(this).addEventListener('gk-map-unfreeze', mapCollectionEl(this)._unfreezeHandler);

    mapCollectionEl(this)._stuckOrFailedHandler = (e: Event) => {
      const mapEl = e.target as HTMLElement | null;
      if (!mapEl) return;
      const slot = mapCollectionEl(this).getOneSlot((s: SlotInfo) => s.mapElement === mapEl);
      if (slot) mapCollectionEl(this).resetSlotAndRetry(slot, 1500);
    };
    mapCollectionEl(this).addEventListener('gk-map-stuck', mapCollectionEl(this)._stuckOrFailedHandler);
    mapCollectionEl(this).addEventListener('gk-map-failed', mapCollectionEl(this)._stuckOrFailedHandler);

    mapCollectionEl(this).initialized = true;
    mapCollectionEl(this).dispatchEvent(new CustomEvent('map-collection-ready', { bubbles: true }));
  }

  /**
   * IntersectionObserver ONLY updates visibility state
   * Activation is DEBOUNCED - waits for scrolling to stop
   * Uses scroll velocity detection to extend debounce during rapid scrolling
   */
  protected setupIntersectionObserver(): void {
    mapCollectionEl(this).intersectionObserver = new IntersectionObserver(
      (entries) => {
        const now = Date.now();

        // Detect rapid scrolling: if we're getting intersection changes faster than 100ms apart,
        // user is actively scrolling - use longer debounce
        if (now - mapCollectionEl(this).lastIntersectionTime < 100) {
          mapCollectionEl(this).intersectionChangeCount++;
          // After 3+ rapid changes, mark as actively scrolling
          if (mapCollectionEl(this).intersectionChangeCount >= 3) {
            mapCollectionEl(this).isScrolling = true;
          }
        } else {
          // Reset counter if intersection changes are spaced out
          mapCollectionEl(this).intersectionChangeCount = 0;
        }
        mapCollectionEl(this).lastIntersectionTime = now;

        for (const entry of entries) {
          const slotInfo = mapCollectionEl(this).getOneSlot((s: SlotInfo) => s.slotElement === entry.target);
          if (slotInfo) slotInfo.isVisible = entry.isIntersecting;
        }

        // Debounce activation - wait for scrolling to stop
        // Use longer debounce when actively scrolling to avoid WebGL context exhaustion
        if (mapCollectionEl(this).scrollDebounceTimer) {
          clearTimeout(mapCollectionEl(this).scrollDebounceTimer);
        }

        const debounceMs = mapCollectionEl(this).isScrolling ? SCROLL_ACTIVE_DEBOUNCE_MS : SCROLL_DEBOUNCE_MS;

        mapCollectionEl(this).scrollDebounceTimer = setTimeout(() => {
          // Scrolling has stopped - reset scroll state
          mapCollectionEl(this).isScrolling = false;
          mapCollectionEl(this).intersectionChangeCount = 0;
          mapCollectionEl(this).processVisibilityChanges();
        }, debounceMs);
      },
      {
        root: null,
        rootMargin: `${mapCollectionEl(this).viewportPadding}px`,
        threshold: 0,
      }
    );

    for (const slotInfo of mapCollectionEl(this).getAllSlots()) {
      mapCollectionEl(this).intersectionObserver?.observe(slotInfo.slotElement);
    }
  }

  /** True when the collection is not on screen (e.g. view switch). Don't freeze or activate. */
  protected isCollectionHidden(): boolean {
    const rect = mapCollectionEl(this).getBoundingClientRect();
    const style = window.getComputedStyle(this);
    const isContents = style.display === 'contents';
    return (
      style.visibility === 'hidden' ||
      style.display === 'none' ||
      (!isContents && (rect.width === 0 || rect.height === 0))
    );
  }

  protected getAllSlots(): SlotInfo[] {
    return mapCollectionEl(this).slots;
  }

  protected getManySlots(predicate: (s: SlotInfo) => boolean): SlotInfo[] {
    return mapCollectionEl(this).slots.filter(predicate);
  }

  protected getOneSlot(predicate: (s: SlotInfo) => boolean): SlotInfo | undefined {
    return mapCollectionEl(this).slots.find(predicate);
  }

  /** Deactivate slot and schedule retry after delayMs. Use for stuck/failed maps. */
  protected resetSlotAndRetry(slot: SlotInfo, delayMs: number): void {
    slot.firstSeenNoMapInstanceAt = 0;
    slot.firstSeenRestoringAt = 0;
    slot.isActive = false;
    mapCollectionEl(this).activeCount--;
    slot.failCount = 0;
    slot.lastFailTime = 0;
    slot.isActivating = false;
    slot.activationStartTime = 0;
    slot.mapElement.freeze().catch(() => {});
    setTimeout(() => mapCollectionEl(this).activateSlot(slot), delayMs);
  }

  /** Single read for viewport; reuse in one processVisibilityChanges run. */
  protected getViewportConstants(): { vh: number; margin: number } {
    return {
      vh: typeof window !== 'undefined' ? window.innerHeight : 0,
      margin: ACTIVATION_VIEWPORT_MARGIN_PX,
    };
  }

  /**
   * One pass: clamp visibility from rect, collect visible-inactive slots with distance from center.
   * Returns slots sorted by distance (closest first) so we only call getBoundingClientRect once per slot.
   */
  protected getVisibleInactiveSlotsSorted(now: number, vh: number, margin: number): SlotInfo[] {
    const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
    const withDistance: { slot: SlotInfo; dist: number }[] = [];
    for (const s of mapCollectionEl(this).getAllSlots()) {
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
  protected showPlaceholdersForVisibleWaiting(): void {
    for (const s of mapCollectionEl(this).getAllSlots()) {
      if (!s.isVisible || s.isActive || s.isActivating) continue;
      const el = s.mapElement;
      const hasPlaceholder = typeof el.hasPlaceholder === 'function' ? el.hasPlaceholder() : false;
      const isInit = (el as unknown as { isInitialized?: boolean }).isInitialized;
      if (!hasPlaceholder && !isInit && typeof el.showPlaceholder === 'function') {
        el.showPlaceholder();
      }
    }
  }

  /** Freeze up to `count` maps to free WebGL slots; short delay between each. */
  protected async makeRoomFor(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const frozen = await mapCollectionEl(this).deactivateOneForPool();
      if (!frozen) break;
      await delayForWebGLRelease();
    }
  }

  /**
   * IntersectionObserver uses a large rootMargin; clamp slots outside the strict activation band
   * so pool eviction can freeze maps that scrolled off-screen but remain IO-"visible".
   */
  protected clampAllSlotVisibility(vh: number, margin: number): void {
    for (const s of mapCollectionEl(this).getAllSlots()) {
      const rect = s.slotElement.getBoundingClientRect();
      const inStrictViewport = rect.bottom > -margin && rect.top < vh + margin;
      if (!inStrictViewport) {
        s.isVisible = false;
      }
    }
  }

  /**
   * Suppress map activation for a period (e.g. during programmatic scroll to a selected item).
   * Call before triggering smooth scroll so cards that pass through the viewport don't activate maps.
   */
  suppressActivation(durationMs: number): void {
    mapCollectionEl(this).suppressActivationUntil = Date.now() + durationMs;
  }

  /**
   * Process visibility changes - unfreeze visible slots, lazy freeze.
   * Uses a lock to prevent concurrent processing during fast scrolling.
   */
}
