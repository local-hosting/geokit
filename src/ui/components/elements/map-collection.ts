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
}

// Debounce delay - wait for scrolling to stop before activating
const SCROLL_DEBOUNCE_MS = 150;

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

  constructor() {
    super();
  }

  async connectedCallback(): Promise<void> {
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

    // Always setup observers first
    this.setupIntersectionObserver();
    this.setupMutationObserver();

    const mapElements = Array.from(this.querySelectorAll('gk-map')) as MapElement[];

    if (mapElements.length === 0) {
      console.log('[MapCollection] No gk-map elements found - watching for dynamic additions');
      this.initialized = true;
      return;
    }

    // Build slots array - all start with placeholders
    this.slots = mapElements.map((mapElement) => {
      mapElement.setPoolManaged(true);
      mapElement.showPlaceholder();
      return {
        slotElement: mapElement,
        mapElement,
        isActive: false,
        isVisible: false,
        isActivating: false,
      };
    });

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

    try {
      // Keep processing until no more visible inactive slots
      let iterations = 0;
      const maxIterations = this.poolSize * 2; // Safety limit

      while (iterations < maxIterations) {
        iterations++;

        // Find visible slots that need activation (not already active or being activated)
        const visibleInactive = this.slots.filter(
          (s) => s.isVisible && !s.isActive && !s.isActivating
        );

        if (visibleInactive.length === 0) break;

        // Process sequentially to properly manage WebGL contexts
        for (const slotInfo of visibleInactive) {
          // Re-check visibility - user might have scrolled away during previous activation
          if (!slotInfo.isVisible) continue;
          if (slotInfo.isActive || slotInfo.isActivating) continue;
          await this.activateSlot(slotInfo);
        }
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
    if (slotInfo.isActive || slotInfo.isActivating) return;

    // Skip if no longer visible (user scrolled away)
    if (!slotInfo.isVisible) return;

    // Mark as activating to prevent concurrent attempts
    slotInfo.isActivating = true;

    try {
      // Make room if needed - await freeze to ensure WebGL context is released
      while (this.activeCount >= this.poolSize) {
        // Re-check visibility before expensive freeze operation
        if (!slotInfo.isVisible) {
          return; // User scrolled away, abort
        }

        const frozen = await this.deactivateOneInvisible();
        if (!frozen) {
          // Pool full with all visible maps - don't log warning, this is normal
          return;
        }
      }

      // Final visibility check after freeze
      if (!slotInfo.isVisible) {
        return; // User scrolled away during freeze, abort
      }

      // Mark active
      slotInfo.isActive = true;
      this.activeCount++;

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
        // Only log if still visible - don't spam logs for scrolled-away maps
        if (slotInfo.isVisible) {
          console.warn(
            `[MapCollection] ✗ Failed to unfreeze: ${this.getSlotId(slotInfo.slotElement)}`
          );
        }
      } else {
        console.log(
          `[MapCollection] ✓ Unfrozen: ${this.getSlotId(slotInfo.slotElement)} (${this.activeCount}/${this.poolSize})`
        );
      }
    } finally {
      slotInfo.isActivating = false;
    }
  }

  /**
   * Freeze ONE invisible slot - returns true if successful
   * Picks the furthest from viewport center
   * Now async to properly wait for WebGL context release
   */
  private async deactivateOneInvisible(): Promise<boolean> {
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
      console.log(
        `[MapCollection] ✗ Frozen: ${this.getSlotId(toFreeze.slotElement)} (${this.activeCount}/${this.poolSize})`
      );
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

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (node.tagName.toLowerCase() === 'gk-map' || node.querySelector('gk-map')) {
                hasNewMaps = true;
                break;
              }
            }
          }
        }
        if (hasNewMaps) break;
      }

      if (hasNewMaps) {
        setTimeout(() => this.handleNewMaps(), 100);
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
        };
        this.slots.push(slotInfo);
        this.intersectionObserver?.observe(mapElement);
      }
    }
  }

  private cleanup(): void {
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
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
      totalMaps: this.activeCount,
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
}

if (!customElements.get('gk-map-collection')) {
  customElements.define('gk-map-collection', MapCollectionElement);
}
