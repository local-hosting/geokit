/**
 * Map Collection Component
 *
 * Manages a pool of map instances. Only keeps poolSize maps active at a time.
 * LAZY deactivation - only deactivates when we need room for a new visible map.
 */

import { BaseElement } from '../base-element';
import { type MapElement } from './map';
import { getProviderConfig } from '../../providers/registry';

interface SlotInfo {
  slotElement: HTMLElement;
  mapElement: MapElement;
  isActive: boolean;
  isVisible: boolean; // Track visibility separately
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

  protected addToParentMap(): void {}

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
   * Process visibility changes - activate visible slots, lazy deactivate
   */
  private processVisibilityChanges(): void {
    // Find visible slots that need activation
    const visibleInactive = this.slots.filter((s) => s.isVisible && !s.isActive);

    for (const slotInfo of visibleInactive) {
      this.activateSlot(slotInfo);
    }
  }

  /**
   * Activate a slot - will make room if needed
   */
  private async activateSlot(slotInfo: SlotInfo): Promise<void> {
    // Already active or being activated - skip
    if (slotInfo.isActive) return;

    // Skip if no longer visible (user scrolled away)
    if (!slotInfo.isVisible) return;

    // Make room if needed
    while (this.activeCount >= this.poolSize) {
      const deactivated = this.deactivateOneInvisible();
      if (!deactivated) {
        // Pool full with all visible maps - don't log warning, this is normal
        return;
      }
    }

    // Mark active SYNCHRONOUSLY to prevent race conditions
    slotInfo.isActive = true;
    this.activeCount++;

    // Activate
    slotInfo.mapElement.ensureAttributes({
      apiKey: this.apiKey,
      provider: 'maptiler',
      mapStyle: this.mapStyle,
    });

    const success = await slotInfo.mapElement.activate(this.activeCount - 1);
    if (!success) {
      // Rollback on failure
      slotInfo.isActive = false;
      this.activeCount--;
      // Only log if still visible - don't spam logs for scrolled-away maps
      if (slotInfo.isVisible) {
        console.warn(
          `[MapCollection] ✗ Failed to activate: ${this.getSlotId(slotInfo.slotElement)}`
        );
      }
    } else {
      console.log(
        `[MapCollection] ✓ Activated: ${this.getSlotId(slotInfo.slotElement)} (${this.activeCount}/${this.poolSize})`
      );
    }
  }

  /**
   * Deactivate ONE invisible slot - returns true if successful
   * Picks the furthest from viewport center
   */
  private deactivateOneInvisible(): boolean {
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
      const toDeactivate = candidates[0].slotInfo;
      toDeactivate.mapElement.deactivate();
      toDeactivate.isActive = false;
      this.activeCount--;
      console.warn(
        `[MapCollection] ✗ Deactivated: ${this.getSlotId(toDeactivate.slotElement)} (${this.activeCount}/${this.poolSize})`
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
