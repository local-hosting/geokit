/**
 * Map Collection Component
 *
 * Manages a pool of map instances that are reused as the user scrolls through a grid of maps.
 * Only keeps a limited number of active maps at a time to optimize GPU memory usage.
 *
 * Usage:
 * <gk-map-collection pool-size="6" api-key="your-key">
 *   <div class="map-card" data-map-id="nyc">
 *     <gk-map lat="40.7128" lng="-74.0060" zoom="12"></gk-map>
 *   </div>
 *   <div class="map-card" data-map-id="la">
 *     <gk-map lat="34.0522" lng="-118.2437" zoom="12"></gk-map>
 *   </div>
 * </gk-map-collection>
 *
 * Note: gk-map elements should be direct children or within map-card containers.
 * The collection will manage map initialization and WebGL context lifecycle.
 */

import { BaseElement } from '../base-element';
import { MapElement } from './map';
import { getProviderConfig } from '../../providers/registry';

interface PoolItem {
  mapElement: MapElement;
  inUse: boolean;
  currentSlot: HTMLElement | null;
  poolIndex: number;
}

interface SlotInfo {
  slotElement: HTMLElement;
  mapElement: MapElement | null;
  isActive: boolean;
}

export class MapCollectionElement extends BaseElement {
  static observedAttributes = ['pool-size', 'api-key', 'map-style', 'viewport-padding'];

  private pool: PoolItem[] = [];
  private slots: SlotInfo[] = [];
  private poolSize: number = 6;
  private initialized: boolean = false;
  private isInitializing: boolean = false;
  private intersectionObserver: IntersectionObserver | null = null;
  private viewportPadding: number = 300;
  private isScrollingFast: boolean = false;
  private scrollTimeout: number | null = null;
  private lastScrollTime: number = 0;
  private _apiKey: string | null = null;
  private _mapStyle: string | null = null;
  private readonly SCROLL_THROTTLE_MS = 150;
  private readonly SCROLL_STOP_DELAY = 300;

  constructor() {
    super();
    this.setupScrollThrottling();
  }

  async connectedCallback(): Promise<void> {
    // MapCollectionElement is a container, not a child of a map
    // Skip the parent map lookup that BaseElement does
    this.isInitialized = false; // Reset to allow initialization
    await super.connectedCallback();
    this.poolSize = parseInt(this.getAttribute('pool-size') || '6', 10);
    this.viewportPadding = parseInt(this.getAttribute('viewport-padding') || '300', 10);
    
    // Initialize api-key and map-style from attribute
    // Always check attribute in connectedCallback in case it was set before connection
    const attrApiKey = this.getAttribute('api-key');
    if (attrApiKey) {
      this._apiKey = attrApiKey;
    }
    const attrMapStyle = this.getAttribute('map-style');
    if (attrMapStyle) {
      this._mapStyle = attrMapStyle;
    }
    
    // Wait for DOM to be ready and all children to be parsed
    // Use multiple requestAnimationFrame calls to ensure DOM is fully ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.initialize();
      });
    });
  }

  /**
   * Override to prevent looking for parent map (MapCollectionElement is a container)
   */
  protected addToParentMap(): void {
    // Do nothing - MapCollectionElement is a container, not a child of a map
  }

  disconnectedCallback(): void {
    this.cleanup();
    super.disconnectedCallback();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'pool-size' && newValue) {
      this.poolSize = parseInt(newValue, 10);
      if (this.initialized) {
        this.reinitialize();
      }
    } else if (name === 'viewport-padding' && newValue) {
      this.viewportPadding = parseInt(newValue, 10);
    } else if (name === 'api-key' && newValue) {
      this._apiKey = newValue;
    } else if (name === 'map-style' && newValue) {
      this._mapStyle = newValue;
    }
  }

  /**
   * Set api-key programmatically
   */
  set apiKey(value: string | null) {
    this._apiKey = value;
    if (value) {
      this.setAttribute('api-key', value);
    } else {
      this.removeAttribute('api-key');
    }
  }

  /**
   * Get api-key (from attribute, programmatically set, global config, or env)
   */
  get apiKey(): string | null {
    // Priority order:
    // 1. Private property (set via JS: collection.apiKey = "...")
    // 2. Attribute (set via HTML: api-key="...")
    // 3. Global config (set via configure())
    // 4. Environment variable
    if (this._apiKey) {
      return this._apiKey;
    }
    
    const attrKey = this.getAttribute('api-key');
    if (attrKey) {
      return attrKey;
    }
    
    // Check global config
    const maptilerConfig = getProviderConfig('maptiler');
    if (maptilerConfig?.apiKey) {
      return maptilerConfig.apiKey;
    }
    
    // Check environment variable (Vite will replace this at build time)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - import.meta is available in ESNext modules
    if (typeof import.meta !== 'undefined' && import.meta.env?.MAPTILER_API_KEY) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return import.meta.env.MAPTILER_API_KEY;
    }
    
    return null;
  }

  /**
   * Set map-style programmatically
   */
  set mapStyle(value: string | null) {
    this._mapStyle = value;
    if (value) {
      this.setAttribute('map-style', value);
    } else {
      this.removeAttribute('map-style');
    }
  }

  /**
   * Get map-style (from attribute or programmatically set)
   */
  get mapStyle(): string | null {
    return this._mapStyle || this.getAttribute('map-style');
  }

  /**
   * Initialize the map collection
   * All gk-map elements stay in place, but only poolSize maps have active map instances
   */
  private async initialize(): Promise<void> {
    if (this.initialized || this.isInitializing) return;
    
    this.isInitializing = true;

    const slotElements = this.getMapSlots();
    
    if (slotElements.length === 0) {
      console.warn('[MapCollection] No map slots found');
      // Retry after a delay - DOM might not be ready yet
      setTimeout(() => {
        this.isInitializing = false;
        this.initialize();
      }, 1000);
      return;
    }

    // Build slot info - find or ensure each slot has a gk-map element
    this.slots = slotElements.map(slotElement => {
      let mapElement = this.findMapInSlot(slotElement);
      
      if (mapElement) {
        this.markAsPoolManaged(mapElement);
      } else {
        // If no gk-map exists, create one (but don't initialize it yet)
        mapElement = this.createMapElementInSlot(slotElement);
      }
      
      return {
        slotElement,
        mapElement,
        isActive: false
      };
    });

    // FIRST: Show placeholders for ALL slots (so DOM has proper heights)
    this.slots.forEach(slotInfo => {
      if (slotInfo.mapElement) {
        this.showPlaceholder(slotInfo.mapElement);
      }
    });

    // Wait for DOM to settle and placeholders to render with their actual heights
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve(undefined);
        });
      });
    });

    // NOW: Activate only maps that are ACTUALLY in the viewport
    // Use the actual rendered placeholder heights to determine visibility
    const viewportCenter = window.innerHeight / 2;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const visibleSlots = this.slots
      .map(slotInfo => {
        if (!slotInfo.mapElement) return null;
        
        // Use the actual rendered element (with placeholder) to get accurate dimensions
        const rect = slotInfo.slotElement.getBoundingClientRect();
        
        // Simple, strict check: element must be at least partially in viewport
        // Top must be above bottom of viewport, bottom must be below top of viewport
        // Left must be to left of right edge, right must be to right of left edge
        const isInViewport = rect.bottom > 0 && rect.top < viewportHeight &&
                            rect.right > 0 && rect.left < viewportWidth;
        
        // Only activate if actually in viewport
        if (isInViewport) {
          const slotCenter = rect.top + rect.height / 2;
          const distanceFromCenter = Math.abs(slotCenter - viewportCenter);
          // Calculate visibility ratio for sorting
          const visibilityRatio = this.getElementVisibilityRatio(slotInfo.slotElement, 0);
          return { slotInfo, distanceFromCenter, visibilityRatio };
        }
        return null;
      })
      .filter(item => item !== null)
      .sort((a, b) => {
        // Sort by distance from center (closer = better)
        return a!.distanceFromCenter - b!.distanceFromCenter;
      })
      .slice(0, this.poolSize);

    // Activate visible maps (this will remove placeholders for active maps)
    // Only activate up to poolSize maps
    for (let i = 0; i < visibleSlots.length && this.pool.length < this.poolSize; i++) {
      const item = visibleSlots[i];
      if (item && item.slotInfo.mapElement) {
        const poolIndex = this.pool.length;
        await this.activateMap(item.slotInfo.mapElement, item.slotInfo.slotElement, poolIndex);
        item.slotInfo.isActive = true;
      }
    }

    this.initialized = true;
    this.isInitializing = false;
    
    // Set up IntersectionObserver after a short delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.setupIntersectionObserver();
      });
    });
    
    // Dispatch ready event
    this.dispatchEvent(new CustomEvent('map-collection-ready', { bubbles: true }));
  }

  /**
   * Reinitialize the pool (e.g., when pool-size changes)
   */
  private reinitialize(): void {
    this.cleanup();
    this.initialize();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }

    // Clear all maps
    this.pool.forEach(item => {
      if (item.mapElement && item.mapElement.parentNode) {
        item.mapElement.remove();
      }
    });
    this.pool = [];
    this.initialized = false;
  }

  /**
   * Get all map slots (gk-map elements or containers with gk-map)
   * Priority: gk-map elements directly, then .map-slot containers, then legacy patterns
   */
  private getMapSlots(): HTMLElement[] {
    const slots: HTMLElement[] = [];
    
    // First, try to find gk-map elements directly (unified approach)
    const mapElements = this.querySelectorAll('gk-map:not([data-pool-map="true"])');
    mapElements.forEach((element) => {
      if (element instanceof HTMLElement && !slots.includes(element)) {
        slots.push(element);
      }
    });

    // If no gk-map elements found, fall back to .map-slot containers
    if (slots.length === 0) {
      const mapSlots = this.querySelectorAll('.map-slot');
      mapSlots.forEach((element) => {
        if (element instanceof HTMLElement && !slots.includes(element)) {
          slots.push(element);
        }
      });
    }

    // Also check direct children (in case display: contents affects querySelector)
    Array.from(this.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      
      if (this.isMapElement(child) && !slots.includes(child)) {
        slots.push(child);
      } else {
        const nestedSlot = child.querySelector('.map-slot, gk-map:not([data-pool-map="true"])');
        if (nestedSlot instanceof HTMLElement && !slots.includes(nestedSlot)) {
          slots.push(nestedSlot);
        }
      }
    });

    return slots;
  }

  /**
   * Get slots that are currently visible in viewport
   */
  private getVisibleSlots(slots: HTMLElement[]): HTMLElement[] {
    return slots.filter(slot => this.isElementVisible(slot, this.viewportPadding));
  }

  /**
   * Check if element is visible in viewport
   * Returns true if element has meaningful visibility (at least minVisibleRatio of the element is visible)
   */
  private isElementVisible(element: HTMLElement, padding: number = 0, minVisibleRatio: number = 0.1): boolean {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Calculate the intersection area
    const visibleTop = Math.max(rect.top, -padding);
    const visibleBottom = Math.min(rect.bottom, viewportHeight + padding);
    const visibleLeft = Math.max(rect.left, -padding);
    const visibleRight = Math.min(rect.right, viewportWidth + padding);
    
    // Check if there's any intersection
    if (visibleBottom <= visibleTop || visibleRight <= visibleLeft) {
      return false;
    }
    
    // Calculate visible area
    const visibleArea = (visibleBottom - visibleTop) * (visibleRight - visibleLeft);
    const totalArea = rect.width * rect.height;
    
    // If element has no area, check if it's at least partially in viewport
    if (totalArea === 0) {
      return (
        rect.bottom >= -padding &&
        rect.top <= viewportHeight + padding &&
        rect.right >= -padding &&
        rect.left <= viewportWidth + padding
      );
    }
    
    // Return true if at least minVisibleRatio of the element is visible
    const visibleRatio = visibleArea / totalArea;
    return visibleRatio >= minVisibleRatio;
  }

  /**
   * Get the intersection ratio of an element with the viewport
   * Returns a value between 0 (not visible) and 1 (fully visible)
   */
  private getElementVisibilityRatio(element: HTMLElement, padding: number = 0): number {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Calculate the intersection area
    const visibleTop = Math.max(rect.top, -padding);
    const visibleBottom = Math.min(rect.bottom, viewportHeight + padding);
    const visibleLeft = Math.max(rect.left, -padding);
    const visibleRight = Math.min(rect.right, viewportWidth + padding);
    
    // Check if there's any intersection
    if (visibleBottom <= visibleTop || visibleRight <= visibleLeft) {
      return 0;
    }
    
    // Calculate visible area
    const visibleArea = (visibleBottom - visibleTop) * (visibleRight - visibleLeft);
    const totalArea = rect.width * rect.height;
    
    if (totalArea === 0) {
      // Element has no area, return 1 if it's in viewport, 0 otherwise
      return (
        rect.bottom >= -padding &&
        rect.top <= viewportHeight + padding &&
        rect.right >= -padding &&
        rect.left <= viewportWidth + padding
      ) ? 1 : 0;
    }
    
    return Math.min(1, visibleArea / totalArea);
  }

  /**
   * Ensure map element has required attributes (delegates to MapElement)
   */
  private ensureMapAttributes(mapElement: MapElement): void {
    mapElement.ensureAttributes({
      apiKey: this.apiKey,
      provider: 'maptiler',
      mapStyle: this.mapStyle
    });
  }

  /**
   * Mark map element as pool-managed (delegates to MapElement)
   */
  private markAsPoolManaged(mapElement: MapElement): void {
    mapElement.setPoolManaged(true);
  }

  /**
   * Create a gk-map element in a slot (but don't initialize it)
   */
  private createMapElementInSlot(slotElement: HTMLElement): MapElement | null {
    // Check if slot is already a gk-map element
    if (this.isMapElement(slotElement)) {
      const mapElement = slotElement as MapElement;
      this.markAsPoolManaged(mapElement);
      return mapElement;
    }

    // Check if slot contains a map
    const existingMap = this.findMapInSlot(slotElement);
    if (existingMap) {
      this.markAsPoolManaged(existingMap);
      return existingMap;
    }

    // Create new map element (but don't initialize it)
    const apiKey = this.apiKey;
    if (!apiKey) {
      return null;
    }

    const mapStyle = this.mapStyle;
    const coords = this.getSlotCoordinates(slotElement);
    
    const attrs: string[] = [
      `api-key="${apiKey}"`,
      'provider="maptiler"',
      'data-pool-managed="true"',
      'style="width: 100%; height: 100%; display: block;"'
    ];
    if (mapStyle) attrs.push(`map-style="${mapStyle}"`);
    if (coords.lat) attrs.push(`lat="${coords.lat}"`);
    if (coords.lng) attrs.push(`lng="${coords.lng}"`);
    if (coords.zoom) attrs.push(`zoom="${coords.zoom}"`);
    
    slotElement.innerHTML = `<gk-map ${attrs.join(' ')}></gk-map>`;
    const mapElement = this.findMapInSlot(slotElement);
    
    if (mapElement) {
      this.ensureMapAttributes(mapElement);
      this.markAsPoolManaged(mapElement);
    }
    
    return mapElement;
  }


  /**
   * Safely remove map instance
   */
  private safelyRemoveMap(map: any, mapElement: MapElement, slotId: string): void {
    if (!mapElement.isConnected) {
      return;
    }

    // Clear any children/layers before removing
    if (mapElement.clearChildren) {
      mapElement.clearChildren();
    }

    if (map.getContainer && typeof map.getContainer === 'function') {
      const container = map.getContainer();
      if (!container || !container.parentNode) {
        return;
      }
    }

    // Note: The SDK's remove() internally calls setStyle() with deprecated "Streets Default v2"
    // This is a MapTiler SDK bug - we cannot prevent it from our code
    // Suppress these harmless warnings during map removal
    const originalWarn = console.warn;
    const suppressedMessages = [
      'Style "Streets Default v2" is deprecated',
      '[Map.setStyle]: Invalid style',
      'Keeping the curent style instead',
      'WebGL context lost after map removal'
    ];
    
    console.warn = (...args: unknown[]) => {
      const message = typeof args[0] === 'string' ? args[0] : String(args[0]);
      // Only suppress specific MapTiler SDK cleanup warnings
      if (!suppressedMessages.some(msg => message.includes(msg))) {
        originalWarn.apply(console, args);
      }
    };

    try {
      map.remove();
    } finally {
      // Restore original console.warn
      console.warn = originalWarn;
    }
  }

  /**
   * Activate a map (initialize it and add to pool)
   */
  private async activateMap(mapElement: MapElement, slotElement: HTMLElement, poolIndex: number): Promise<void> {
    if (!this.apiKey) {
      console.error('[MapCollection] Cannot activate map: api-key is required');
      return;
    }

    const slotId = this.getSlotId(slotElement);
    const isNewMap = !mapElement.getMap?.();

    this.ensureMapAttributes(mapElement);
    this.hidePlaceholder(mapElement);

    // Mark as pool map
    mapElement.setPoolState(true, poolIndex);

    // Check if map exists and is rendering
    const existingMapInstance = mapElement.getMap?.();
    const isMapValid = existingMapInstance && this.isMapRendering(mapElement);
    
    if (!isMapValid) {
      // No valid map - need to initialize or reinitialize
      // If map exists but isn't rendering, remove it first
      if (existingMapInstance && typeof existingMapInstance.remove === 'function') {
        try {
          this.safelyRemoveMap(existingMapInstance, mapElement, slotId);
          // Wait a bit for cleanup
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      
      try {
        await mapElement.initializeMap();
        // Verify map was actually initialized and rendering
        const verifyMap = mapElement.getMap?.();
        if (!verifyMap) {
          throw new Error('Map initialization returned no map instance');
        }
        
        // Wait a bit for canvas to render
        await new Promise(resolve => setTimeout(resolve, 150));
        
        if (!this.isMapRendering(mapElement)) {
          throw new Error('Map initialized but canvas not rendering');
        }
      } catch (error) {
        // Initialization failed - show placeholder and mark as pool-managed
        this.showPlaceholder(mapElement);
        mapElement.setPoolState(false);
        console.warn(`[MapCollection] Failed to initialize map for slot ${slotId}:`, error);
        return;
      }
    }

    // Check if this map is already in the pool
    const existingPoolItem = this.pool.find(item => item.mapElement === mapElement);
    if (existingPoolItem) {
      // Map is already in pool - just update its state
      existingPoolItem.inUse = true;
      existingPoolItem.currentSlot = slotElement;
      existingPoolItem.poolIndex = poolIndex;
      mapElement.setPoolState(true, poolIndex);
      return;
    }
    
    // Add to pool - but only if we haven't exceeded pool size
    if (this.pool.length >= this.poolSize) {
      console.warn(`[MapCollection] Pool size limit (${this.poolSize}) reached, cannot activate map for slot: ${slotId}`);
      this.showPlaceholder(mapElement);
      mapElement.setPoolState(false);
      return;
    }
    
    // Add to pool
    this.pool.push({
      mapElement,
      inUse: true,
      currentSlot: slotElement,
      poolIndex
    });

    // Only log when a new map is loaded
    if (isNewMap) {
      console.log(`[MapCollection] Map loaded: ${slotId}`);
    }
  }

  /**
   * Check if a map is still loading (delegates to MapElement)
   */
  private isMapLoading(mapElement: MapElement): boolean {
    return mapElement.isLoading();
  }

  /**
   * Check if a map instance is actually rendering (delegates to MapElement)
   */
  private isMapRendering(mapElement: MapElement): boolean {
    return mapElement.isRendering();
  }

  /**
   * Restore a map's WebGL view by reinitializing it
   */
  private async restoreMapView(mapElement: MapElement, slotElement: HTMLElement, slotId: string): Promise<void> {
    const mapInstance = mapElement.getMap?.();
    
    // If map instance exists but not rendering, remove it first
    if (mapInstance && typeof mapInstance.remove === 'function') {
      try {
        this.safelyRemoveMap(mapInstance, mapElement, slotId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    // Ensure attributes are set
    this.ensureMapAttributes(mapElement);
    this.hidePlaceholder(mapElement);
    
    // Reinitialize the map
    await mapElement.initializeMap();
    
    // Verify map was initialized and is rendering
    const newMap = mapElement.getMap?.();
    if (!newMap) {
      throw new Error('Map initialization returned no map instance');
    }
    
    // Wait a bit for canvas to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!this.isMapRendering(mapElement)) {
      throw new Error('Map initialized but canvas not rendering');
    }
    
    // Update map viewport to match slot coordinates
    this.updateMapViewport(newMap, slotElement, mapElement);
    
    // Ensure it's still marked as pool map
    const poolIndex = mapElement.getPoolIndex();
    const existingPoolItem = this.pool.find(item => item.mapElement === mapElement);
    const finalPoolIndex = poolIndex ?? existingPoolItem?.poolIndex ?? this.pool.length;
    mapElement.setPoolState(true, finalPoolIndex);
    
    // Mark slot as active
    const slotInfo = this.slots.find(s => s.mapElement === mapElement);
    if (slotInfo) {
      slotInfo.isActive = true;
    }
    
    console.log(`[MapCollection] WebGL view restored for slot: ${slotId}`);
  }

  /**
   * Deactivate a map (destroy instance and release WebGL context)
   * Returns false if map is still loading and shouldn't be deactivated yet, or if already deactivated
   */
  private deactivateMap(mapElement: MapElement): boolean {
    const slotId = this.getSlotIdFromMapElement(mapElement);
    
    // Check if already deactivated (no pool map attribute, has placeholder, not in pool)
    const hasPoolMapAttr = mapElement.isInPool();
    const hasPlaceholder = mapElement.hasPlaceholder();
    const inPool = this.pool.some(item => item.mapElement === mapElement);
    
    // If already deactivated, skip
    if (!hasPoolMapAttr && hasPlaceholder && !inPool) {
      return false;
    }
    
    // Don't remove maps that are still loading - causes abort errors
    if (this.isMapLoading(mapElement)) {
      return false;
    }
    
    const map = mapElement.getMap?.();
    
    if (map && typeof map.remove === 'function') {
      try {
        this.safelyRemoveMap(map, mapElement, slotId);
      } catch (error) {
        console.warn(`[MapCollection] Error removing map for slot ${slotId} (may already be removed):`, error);
      }
    }

    this.showPlaceholder(mapElement);
    this.removeFromPool(mapElement);
    this.markAsPoolManaged(mapElement);
    
    // Log when a map is hidden
    console.log(`[MapCollection] Map hidden: ${slotId}`);
    
    return true;
  }

  /**
   * Remove map from pool and clean up attributes (delegates to MapElement)
   */
  private removeFromPool(mapElement: MapElement): void {
    const poolIndex = this.pool.findIndex(item => item.mapElement === mapElement);
    if (poolIndex >= 0) {
      this.pool.splice(poolIndex, 1);
    }
    mapElement.setPoolState(false);
  }

  /**
   * Show placeholder on a map element (delegates to MapElement)
   */
  private showPlaceholder(mapElement: MapElement): void {
    mapElement.showPlaceholder();
  }

  /**
   * Hide placeholder on a map element (delegates to MapElement)
   */
  private hidePlaceholder(mapElement: MapElement): void {
    mapElement.hidePlaceholder();
  }

  /**
   * Create a map element in a slot (legacy method - keeping for compatibility)
   */
  private async createMapInSlot(slotElement: HTMLElement, index: number): Promise<MapElement | null> {
    // Get api-key from collection (required) - check both property and attribute
    const apiKey = this.apiKey;
    if (!apiKey) {
      console.error('[MapCollection] api-key is required. Set it via attribute (api-key="...") or property (collection.apiKey = "...")');
      return null;
    }
    
    const mapStyle = this.mapStyle;

    // Check if slot is already a gk-map element
    if (this.isMapElement(slotElement)) {
      const mapElement = slotElement as MapElement;
      this.ensureMapAttributes(mapElement);
      this.hidePlaceholder(mapElement);
      mapElement.setAttribute('data-pool-map', 'true');
      mapElement.setAttribute('data-pool-index', index.toString());
      return mapElement;
    }

    // Check if slot contains a map
    const existingMap = this.findMapInSlot(slotElement);
    if (existingMap) {
      this.ensureMapAttributes(existingMap);
      this.hidePlaceholder(existingMap);
      existingMap.setAttribute('data-pool-map', 'true');
      existingMap.setAttribute('data-pool-index', index.toString());
      return existingMap;
    }

    // Create new map element using innerHTML to avoid attribute issues
    const poolId = `pool-map-${index}`;
    const coords = this.getSlotCoordinates(slotElement);
    
    // Build attribute string - api-key is required and already validated above
    const attrs: string[] = [
      `id="${poolId}"`,
      `data-pool-id="${poolId}"`,
      'data-pool-map="true"',
      `data-pool-index="${index}"`,
      `api-key="${apiKey}"`,
      'provider="maptiler"',
      'style="width: 100%; height: 100%; display: block;"'
    ];
    if (mapStyle) attrs.push(`map-style="${mapStyle}"`);
    if (coords.lat) attrs.push(`lat="${coords.lat}"`);
    if (coords.lng) attrs.push(`lng="${coords.lng}"`);
    if (coords.zoom) attrs.push(`zoom="${coords.zoom}"`);
    
    // Remove placeholders first
    const placeholders = slotElement.querySelectorAll('.map-placeholder, [data-map-placeholder="true"]');
    placeholders.forEach(placeholder => placeholder.remove());
    
    // Create element using innerHTML to avoid the attribute error
    // This creates the element with all attributes at once, which avoids browser restrictions
    slotElement.innerHTML = `<gk-map ${attrs.join(' ')}></gk-map>`;
    const mapElement = slotElement.querySelector('gk-map') as MapElement;
    
    if (!mapElement) {
      console.error('[MapCollection] Failed to create map element');
      return null;
    }
    
    // CRITICAL: Set attributes immediately after creation, before connectedCallback runs
    // Use setAttribute to ensure they're properly set (innerHTML might not always work)
    // Set these synchronously before any async operations
    mapElement.setAttribute('provider', 'maptiler');
    if (apiKey) {
      mapElement.setAttribute('api-key', apiKey);
    }
    if (mapStyle) {
      mapElement.setAttribute('map-style', mapStyle);
    }
    
    // Verify api-key is set
    const verifyApiKey = mapElement.getAttribute('api-key');
    if (!verifyApiKey) {
      console.error('[MapCollection] api-key is missing on map element. Available sources:', {
        fromGetter: this.apiKey,
        fromAttribute: this.getAttribute('api-key'),
        fromConfig: getProviderConfig('maptiler')?.apiKey,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        fromEnv: typeof import.meta !== 'undefined' ? import.meta.env?.MAPTILER_API_KEY : undefined
      });
      return null;
    }
    
    // Wait for element to be connected before proceeding
    await new Promise(resolve => {
      if (mapElement.isConnected) {
        resolve(undefined);
      } else {
        const observer = new MutationObserver(() => {
          if (mapElement.isConnected) {
            observer.disconnect();
            resolve(undefined);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Fallback timeout
        setTimeout(() => {
          observer.disconnect();
          resolve(undefined);
        }, 100);
      }
    });

    // Wait for map to be ready
    await this.waitForMapReady(mapElement);

    return mapElement;
  }

  /**
   * Wait for map to be ready and remove placeholder
   */
  private async waitForMapReady(mapElement: MapElement, timeout: number = 5000): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const removePlaceholder = () => {
        // Remove placeholder from inside the map element
        const placeholders = mapElement.querySelectorAll('.map-placeholder, [data-map-placeholder="true"]');
        placeholders.forEach(placeholder => placeholder.remove());
      };

      const checkReady = () => {
        const map = mapElement.getMap?.();
        const isLoaded = map && (
          (typeof map.loaded === 'function' && map.loaded()) ||
          (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded())
        );
        if (isLoaded) {
          removePlaceholder();
          resolve();
          return;
        }

        if (Date.now() - startTime > timeout) {
          console.warn(`[MapCollection] Map ${mapElement.id} did not initialize within ${timeout}ms`);
          removePlaceholder(); // Remove placeholder even on timeout
          resolve();
          return;
        }

        requestAnimationFrame(checkReady);
      };

      // Listen for ready event
      const handleReady = () => {
        const map = mapElement.getMap?.();
        if (map) {
          removePlaceholder();
          resolve();
        }
      };
      mapElement.addEventListener('mapi-ready', handleReady, { once: true });

      checkReady();
    });
  }

  /**
   * Setup IntersectionObserver to manage map activation/deactivation
   */
  private setupIntersectionObserver(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        // Don't process during initialization or fast scrolling
        // During fast scrolling, we'll process after scroll stops
        if (this.isInitializing || this.isScrollingFast) {
          return;
        }

        // Process immediately if not scrolling (scroll has stopped)
        this.processVisibilityChanges(entries);
      },
      {
        root: null,
        rootMargin: `${this.viewportPadding}px`,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0] // Multiple thresholds for better visibility tracking
      }
    );

    // Observe all slots
    this.slots.forEach(slotInfo => {
      this.intersectionObserver?.observe(slotInfo.slotElement);
    });

    // Don't fix stuck maps immediately - wait a bit to avoid activating maps during initialization
    // The intersection observer will handle activation as maps scroll into view
    setTimeout(() => {
      if (this.initialized) {
        this.fixStuckMaps();
      }
    }, 500);
  }

  /**
   * Fix maps that are in a stuck state (marked as pool maps but no map instance or not rendering)
   * Also activates visible maps that have placeholders but aren't active
   */
  private fixStuckMaps(): void {
    this.slots.forEach(slotInfo => {
      if (!slotInfo.mapElement) return;

      const hasPoolMapAttr = slotInfo.mapElement.isInPool();
      const mapInstance = slotInfo.mapElement.getMap?.();
      const hasMapInstance = !!mapInstance;
      const hasPlaceholder = slotInfo.mapElement.hasPlaceholder();
      const isVisible = this.isElementVisible(slotInfo.slotElement, 100);
      
      // Check if map has a visible canvas/container
      const hasVisibleMap = mapInstance ? slotInfo.mapElement.isRendering() : false;

      // Case 1: Map has placeholder, is visible, but not active - should be activated
      // Use strict visibility check - must be actually in viewport (no padding)
      const rect = slotInfo.slotElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const isActuallyInViewport = rect.bottom > 0 && rect.top < viewportHeight &&
                                   rect.right > 0 && rect.left < viewportWidth;
      const visibilityRatio = this.getElementVisibilityRatio(slotInfo.slotElement, 0);
      const isMeaningfullyVisible = isActuallyInViewport && visibilityRatio >= 0.3;
      
      if (hasPlaceholder && isMeaningfullyVisible && !slotInfo.isActive) {
        // Try to activate this map
        this.activateMapForSlot(slotInfo);
        return;
      }

      // Case 2: If marked as pool map but:
      // 1. No map instance, OR
      // 2. Map instance exists but not rendering (no visible canvas), OR
      // 3. No placeholder showing
      // Then it's stuck - restore the WebGL view
      if (hasPoolMapAttr && (!hasMapInstance || !hasVisibleMap) && !hasPlaceholder) {
        const slotId = this.getSlotId(slotInfo.slotElement);
        console.warn(`[MapCollection] Found stuck map for slot: ${slotId}, restoring WebGL view...`);
        
        // Restore the map by reinitializing it
        if (slotInfo.mapElement) {
          this.restoreMapView(slotInfo.mapElement, slotInfo.slotElement, slotId).catch(error => {
            // If restoration fails, show placeholder as fallback
            console.warn(`[MapCollection] Failed to restore map for slot ${slotId}:`, error);
            if (slotInfo.mapElement) {
              this.showPlaceholder(slotInfo.mapElement);
              slotInfo.mapElement.removeAttribute('data-pool-map');
              slotInfo.mapElement.removeAttribute('data-pool-index');
              slotInfo.mapElement.setAttribute('data-pool-managed', 'true');
            }
            slotInfo.isActive = false;
            
            // Remove from pool if it's there
            if (slotInfo.mapElement) {
              const poolIndex = this.pool.findIndex(item => item.mapElement === slotInfo.mapElement);
              if (poolIndex >= 0) {
                this.pool.splice(poolIndex, 1);
              }
            }
          });
        }
      }
    });
  }

  /**
   * Update map viewport to match slot coordinates
   */
  private updateMapViewport(map: any, slotElement: HTMLElement, mapElement: MapElement): void {
    const coords = this.getSlotCoordinates(slotElement);
    // Fallback to map element attributes if slot doesn't have them
    const lat = coords.lat || mapElement.getAttribute('lat') || '';
    const lng = coords.lng || mapElement.getAttribute('lng') || '';
    const zoom = coords.zoom || mapElement.getAttribute('zoom') || '';

    if (lat && lng && typeof map.setCenter === 'function') {
      map.setCenter([parseFloat(lng), parseFloat(lat)]);
    }
    if (zoom && typeof map.setZoom === 'function') {
      map.setZoom(parseFloat(zoom));
    }

    requestAnimationFrame(() => {
      if (map && typeof map.resize === 'function') {
        map.resize();
      }
    });
  }

  /**
   * Make space in pool by deactivating furthest off-screen map
   */
  private makePoolSpace(): boolean {
    if (this.pool.length < this.poolSize) {
      return true; // Pool has space
    }

    const furthest = this.findFurthestOffScreenMap();
    if (furthest) {
      const furthestSlotInfo = this.slots.find(s => s.mapElement === furthest.mapElement);
      if (furthestSlotInfo) {
        this.deactivateMapForSlot(furthestSlotInfo);
        return true;
      }
    }
    return false;
  }

  /**
   * Activate a map for a slot (if pool has space)
   */
  private async activateMapForSlot(slotInfo: SlotInfo): Promise<void> {
    if (!slotInfo.mapElement) return;

    // Check if map has a placeholder - if so, we should try harder to activate it
    const hasPlaceholder = slotInfo.mapElement.hasPlaceholder();
    const isVisible = this.isElementVisible(slotInfo.slotElement, 100);
    
    if (!this.makePoolSpace()) {
      // Pool is full - if this map is visible and has a placeholder, force make space
      if (hasPlaceholder && isVisible) {
        // Force return the furthest map, even if it's slightly visible
        const furthest = this.findFurthestOffScreenMap();
        if (furthest) {
          const furthestSlotInfo = this.slots.find(s => s.mapElement === furthest.mapElement);
          if (furthestSlotInfo) {
            this.deactivateMapForSlot(furthestSlotInfo);
          }
        } else {
          // No off-screen maps - force return the furthest visible map
          const allInUse = this.pool.filter(item => item.inUse && item.currentSlot && item.currentSlot !== slotInfo.slotElement);
          if (allInUse.length > 0) {
            const sorted = allInUse
              .map(item => ({
                item,
                distance: this.getDistanceFromViewportCenter(item.currentSlot!)
              }))
              .sort((a, b) => b.distance - a.distance);
            
            if (sorted.length > 0) {
              const furthest = sorted[0].item;
              if (furthest.currentSlot) {
                const furthestSlotInfo = this.slots.find(s => s.slotElement === furthest.currentSlot);
                if (furthestSlotInfo) {
                  this.deactivateMapForSlot(furthestSlotInfo);
                }
              }
            }
          }
        }
        
        // Wait a bit for deactivation to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try again after forcing space
        if (this.pool.length < this.poolSize) {
          const poolIndex = this.pool.length;
          await this.activateMap(slotInfo.mapElement, slotInfo.slotElement, poolIndex);
          slotInfo.isActive = true;
          
          // Update map viewport to match slot location
          const map = slotInfo.mapElement.getMap?.();
          if (map) {
            this.updateMapViewport(map, slotInfo.slotElement, slotInfo.mapElement);
          }
          return;
        }
      }
      
      // Still can't make space - show placeholder
      this.showPlaceholder(slotInfo.mapElement);
      return;
    }

    const poolIndex = this.pool.length;
    await this.activateMap(slotInfo.mapElement, slotInfo.slotElement, poolIndex);
    slotInfo.isActive = true;

    // Update map viewport to match slot location
    const map = slotInfo.mapElement.getMap?.();
    if (map) {
      this.updateMapViewport(map, slotInfo.slotElement, slotInfo.mapElement);
    }
  }

  /**
   * Check if element is a gk-map element
   */
  private isMapElement(element: HTMLElement): boolean {
    return element.tagName.toLowerCase() === 'gk-map';
  }

  /**
   * Find map element in a slot (could be the slot itself or a child)
   */
  private findMapInSlot(slotElement: HTMLElement): MapElement | null {
    if (this.isMapElement(slotElement)) {
      return slotElement as MapElement;
    }
    return slotElement.querySelector('gk-map') as MapElement | null;
  }

  /**
   * Extract slot coordinates and zoom from attributes
   */
  private getSlotCoordinates(slotElement: HTMLElement): { lat: string; lng: string; zoom: string } {
    return {
      lat: slotElement.getAttribute('data-lat') || slotElement.getAttribute('lat') || '',
      lng: slotElement.getAttribute('data-lng') || slotElement.getAttribute('lng') || '',
      zoom: slotElement.getAttribute('data-zoom') || slotElement.getAttribute('zoom') || ''
    };
  }

  /**
   * Get a human-readable ID for a slot element
   * Checks: slot's data-map-id/id, parent .map-card's data-map-id, or gk-map's id
   */
  private getSlotId(slotElement: HTMLElement): string {
    // First check the slot element itself
    let id: string | null = slotElement.getAttribute('data-map-id') || slotElement.id;
    if (id) return id;
    
    // Check parent .map-card for data-map-id
    const parentCard = slotElement.closest('.map-card');
    if (parentCard) {
      id = parentCard.getAttribute('data-map-id');
      if (id) return id;
    }
    
    // Check for gk-map child's id
    const mapElement = this.findMapInSlot(slotElement);
    if (mapElement?.id) {
      return mapElement.id;
    }
    
    return 'unknown';
  }

  /**
   * Get slot ID from a map element (used when we only have the map element)
   */
  private getSlotIdFromMapElement(mapElement: MapElement): string {
    // Check if map element has an ID
    let id: string | null = mapElement.id;
    if (id) return id;
    
    // Check parent .map-card for data-map-id
    const parentCard = mapElement.closest('.map-card');
    if (parentCard) {
      id = parentCard.getAttribute('data-map-id');
      if (id) return id;
    }
    
    // Check pool for the slot element
    const poolItem = this.pool.find(item => item.mapElement === mapElement);
    if (poolItem?.currentSlot) {
      return this.getSlotId(poolItem.currentSlot);
    }
    
    return 'unknown';
  }

  /**
   * Calculate distance from viewport center
   */
  private getDistanceFromViewportCenter(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const viewportCenterY = window.innerHeight / 2;
    const viewportCenterX = window.innerWidth / 2;
    const centerY = rect.top + rect.height / 2;
    const centerX = rect.left + rect.width / 2;
    return Math.sqrt(
      Math.pow(centerX - viewportCenterX, 2) + 
      Math.pow(centerY - viewportCenterY, 2)
    );
  }

  /**
   * Deactivate a map for a slot (release WebGL context)
   * Returns false if map couldn't be deactivated (e.g., still loading)
   */
  private deactivateMapForSlot(slotInfo: SlotInfo): boolean {
    if (!slotInfo.mapElement || !slotInfo.isActive) return false;
    
    // Double-check: if map element doesn't have pool map attribute, it's already deactivated
    if (!slotInfo.mapElement.isInPool()) {
      slotInfo.isActive = false;
      return false;
    }

    const deactivated = this.deactivateMap(slotInfo.mapElement);
    if (deactivated) {
      slotInfo.isActive = false;
    }
    return deactivated;
  }

  /**
   * Proactively deactivate maps from slots that are far off-screen
   * Skip during initialization to avoid deactivating maps we just activated
   */
  private deactivateOffScreenMaps(): void {
    // Don't deactivate during initialization - maps are being set up
    if (this.isInitializing) {
      return;
    }
    
    const visibleSlots = this.getVisibleSlots(this.slots.map(s => s.slotElement));
    
    this.slots.forEach(slotInfo => {
      if (slotInfo.isActive && !visibleSlots.includes(slotInfo.slotElement)) {
        if (!this.isElementVisible(slotInfo.slotElement, this.viewportPadding)) {
          this.deactivateMapForSlot(slotInfo);
        }
      }
    });
  }

  /**
   * Find the furthest off-screen map in the pool
   */
  private findFurthestOffScreenMap(): PoolItem | undefined {
    const offScreenMaps = this.pool
      .filter(item => item.currentSlot && !this.isElementVisible(item.currentSlot, this.viewportPadding))
      .sort((a, b) => {
        const aDistance = this.getDistanceFromViewportCenter(a.currentSlot!);
        const bDistance = this.getDistanceFromViewportCenter(b.currentSlot!);
        return bDistance - aDistance; // Furthest first
      });

    return offScreenMaps[0];
  }

  /**
   * Assign a map to a slot (legacy method - keeping for compatibility)
   */
  private assignMapToSlot(slotElement: HTMLElement): void {
    // Check if slot is already a gk-map with pool map
    if (this.isMapElement(slotElement) && slotElement.hasAttribute('data-pool-map')) {
      const mapElement = slotElement as MapElement;
      const poolItem = this.pool.find(item => item.mapElement === mapElement);
      if (poolItem) {
        poolItem.inUse = true;
        poolItem.currentSlot = slotElement;
      }
      return;
    }

    // Check if slot contains a pool map
    const existingMap = this.findMapInSlot(slotElement);
    if (existingMap && existingMap.isInPool()) {
      // Update pool tracking
      const poolItem = this.pool.find(item => item.mapElement === existingMap);
      if (poolItem) {
        poolItem.inUse = true;
        poolItem.currentSlot = slotElement;
      }
      return;
    }

    // Find available map
    let available = this.pool.find(item => !item.inUse);

    if (!available) {
      // All maps in use - proactively return maps from off-screen slots before stealing
      this.returnOffScreenMaps();
      
      // Try again after cleanup
      available = this.pool.find(item => !item.inUse);
      
      if (!available) {
        // Still no available maps - try to steal from an off-screen slot
        available = this.findStealableMap(slotElement);
        if (!available) {
          // Last resort: force return the furthest off-screen map
          available = this.forceReturnFurthestMap(slotElement);
          if (!available) {
            console.warn('[MapCollection] Map pool exhausted - cannot assign map to slot');
            // Show placeholder for container slots (gk-map elements handle their own placeholders)
            if (slotElement.tagName.toLowerCase() !== 'gk-map') {
              this.ensureSlotHasPlaceholder(slotElement);
            }
            return;
          }
        }
      }
    }

    // Move map to slot
    this.moveMapToSlot(available, slotElement);
  }

  /**
   * Ensure a container slot has a placeholder (but NOT a gk-map element)
   * We don't want to create gk-map elements that will initialize and create WebGL contexts
   * Only pool maps should create WebGL contexts
   */
  private ensureSlotHasPlaceholder(slotElement: HTMLElement): void {
    // Only for container slots, not gk-map elements themselves
    if (this.isMapElement(slotElement)) {
      return;
    }

    // Check if slot already has a placeholder or a pool map
    const mapElement = this.findMapInSlot(slotElement);
    if (mapElement && (mapElement.hasPlaceholder() || mapElement.isInPool())) {
      return;
    }

    // Create a simple placeholder div (NOT a gk-map element)
    const placeholder = document.createElement('div');
    placeholder.className = 'map-placeholder';
    placeholder.setAttribute('data-map-placeholder', 'true');
    placeholder.style.cssText = 'width: 100%; height: 100%; background: #161b22; display: flex; align-items: center; justify-content: center; color: #8b949e; font-size: 0.9rem;';
    placeholder.textContent = 'Loading map...';
    slotElement.appendChild(placeholder);
  }

  /**
   * Return map from slot to pool
   * The map element stays in place, but we mark it as available for reuse
   * The map component itself will handle showing/hiding placeholders
   */
  private returnMapFromSlot(slotElement: HTMLElement): void {
    // Check if slot is the map element itself
    let mapElement: MapElement | null = null;
    if (this.isMapElement(slotElement) && (slotElement as MapElement).isInPool()) {
      mapElement = slotElement as MapElement;
    } else {
      const found = this.findMapInSlot(slotElement);
      if (found && found.isInPool()) {
        mapElement = found;
      }
    }
    
    if (!mapElement) return;

    const poolItem = this.pool.find(item => item.mapElement === mapElement);
    if (!poolItem) return;

    // Clear map data (but keep the map element in place)
    if (mapElement.clearChildren) {
      mapElement.clearChildren();
    }

    // The map component will automatically show placeholder when not initialized
    // We just need to ensure the map element is in a state where it will show placeholder
    // The map component's showPlaceholderIfNeeded() will handle this

    // Update pool tracking
    poolItem.inUse = false;
    poolItem.currentSlot = null;
  }

  /**
   * Proactively return maps from slots that are far off-screen
   * This prevents pool exhaustion by freeing up maps before we need them
   */
  private returnOffScreenMaps(): void {
    const slots = this.getMapSlots();
    const visibleSlots = this.getVisibleSlots(slots);
    
    // Return maps from slots that are not in the visible set
    slots.forEach(slot => {
      if (!visibleSlots.includes(slot)) {
        const hasPoolMap = (this.isMapElement(slot) && slot.hasAttribute('data-pool-map')) ||
                          slot.querySelector('gk-map[data-pool-map="true"]');
        
        if (hasPoolMap && !this.isElementVisible(slot, this.viewportPadding)) {
          this.returnMapFromSlot(slot);
        }
      }
    });
  }

  /**
   * Check if slot is off-screen with padding
   */
  private isOffScreen(slot: HTMLElement | null): boolean {
    if (!slot) return false;
    const rect = slot.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    return (
      rect.bottom < -this.viewportPadding ||
      rect.top > viewportHeight + this.viewportPadding ||
      rect.right < -this.viewportPadding ||
      rect.left > viewportWidth + this.viewportPadding
    );
  }

  /**
   * Find a map that can be stolen from an off-screen slot
   */
  private findStealableMap(requestingSlot: HTMLElement): PoolItem | undefined {
    const offScreenMaps = this.pool
      .filter(item => {
        if (!item.currentSlot || item.currentSlot === requestingSlot || !item.inUse) return false;
        return this.isOffScreen(item.currentSlot);
      })
      .sort((a, b) => {
        const aDistance = this.getDistanceFromViewportCenter(a.currentSlot!);
        const bDistance = this.getDistanceFromViewportCenter(b.currentSlot!);
        return bDistance - aDistance; // Furthest first
      });

    return offScreenMaps[0];
  }

  /**
   * Force return the furthest off-screen map as a last resort
   */
  private forceReturnFurthestMap(requestingSlot: HTMLElement): PoolItem | undefined {
    const allInUse = this.pool.filter(item => item.inUse && item.currentSlot && item.currentSlot !== requestingSlot);
    
    if (allInUse.length === 0) return undefined;
    
    // Sort by distance from viewport and return the furthest
    const sorted = allInUse
      .map(item => ({
        item,
        distance: this.getDistanceFromViewportCenter(item.currentSlot!)
      }))
      .sort((a, b) => b.distance - a.distance);
    
    if (sorted.length > 0) {
      const furthest = sorted[0].item;
      if (furthest.currentSlot) {
        this.returnMapFromSlot(furthest.currentSlot);
      }
      return furthest;
    }
    
    return undefined;
  }

  /**
   * Move a map from one slot to another
   * Physically move the pool map element to the target slot
   */
  private moveMapToSlot(poolItem: PoolItem, slotElement: HTMLElement): void {
    if (poolItem.currentSlot === slotElement) {
      return;
    }

    // Handle case where slot is already a gk-map element
    if (this.isMapElement(slotElement)) {
      // If slot is the map itself, just update attributes
      if (slotElement === poolItem.mapElement) {
        return; // Already in the right place
      }
      // Otherwise, we need to replace the slot's map with our pool map
      const slotMap = slotElement as MapElement;
      const parent = slotMap.parentElement;
      if (parent) {
        parent.replaceChild(poolItem.mapElement, slotMap);
      }
      poolItem.currentSlot = parent || slotElement;
      // Update map attributes from slot
      const slotLat = slotElement.getAttribute('data-lat') || slotElement.getAttribute('lat');
      const slotLng = slotElement.getAttribute('data-lng') || slotElement.getAttribute('lng');
      const slotZoom = slotElement.getAttribute('data-zoom') || slotElement.getAttribute('zoom');
      if (slotLat) poolItem.mapElement.setAttribute('lat', slotLat);
      if (slotLng) poolItem.mapElement.setAttribute('lng', slotLng);
      if (slotZoom) poolItem.mapElement.setAttribute('zoom', slotZoom);
      return;
    }

    // Old slot will show placeholder automatically via the map component if it's a gk-map
    // If old slot is a container, add a simple placeholder (NOT a gk-map element)
    if (poolItem.currentSlot && !this.isMapElement(poolItem.currentSlot)) {
      this.ensureSlotHasPlaceholder(poolItem.currentSlot);
    }

    // Clear map data
    if (poolItem.mapElement.clearChildren) {
      poolItem.mapElement.clearChildren();
    }

    // Placeholder will be removed automatically by the map component when map is ready

    // Move map to new slot (slot is a container)
    slotElement.appendChild(poolItem.mapElement);

    // Reset map view
    const map = poolItem.mapElement.getMap?.();
    if (map) {
      try {
        this.updateMapViewport(map, slotElement, poolItem.mapElement);
      } catch (error) {
        console.warn('[MapCollection] Error resetting map view:', error);
      }
    }

    // Update pool tracking
    poolItem.inUse = true;
    poolItem.currentSlot = slotElement;

    // Dispatch event
    const event = new CustomEvent('map-moved-to-slot', {
      detail: {
        mapElement: poolItem.mapElement,
        slotElement: slotElement,
        slotId: slotElement.getAttribute('data-map-id')
      },
      bubbles: true
    });
    slotElement.dispatchEvent(event);
  }

  /**
   * Setup scroll throttling
   * After scroll stops, process all visibility changes (like geoview controller)
   */
  private setupScrollThrottling(): void {
    const handleScroll = () => {
      const now = Date.now();
      const timeSinceLastScroll = now - this.lastScrollTime;

      if (timeSinceLastScroll < this.SCROLL_THROTTLE_MS) {
        this.isScrollingFast = true;
      }

      this.lastScrollTime = now;

      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }

      // After scroll stops, process all visibility changes
      this.scrollTimeout = setTimeout(() => {
        this.isScrollingFast = false;
        // Process all slots after scroll stops (like geoview controller)
        this.processAllSlotsAfterScrollStop();
      }, this.SCROLL_STOP_DELAY) as unknown as number;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleScroll, { passive: true });
  }

  /**
   * Process visibility changes from IntersectionObserver entries
   * Uses intersection ratio for smarter visibility detection
   */
  private processVisibilityChanges(entries: IntersectionObserverEntry[]): void {
    // Fix any stuck maps first
    this.fixStuckMaps();
    
    // First, proactively deactivate maps from slots that are far off-screen
    this.deactivateOffScreenMaps();

    entries.forEach(entry => {
      const slotElement = entry.target as HTMLElement;
      const slotInfo = this.slots.find(s => s.slotElement === slotElement);
      
      if (!slotInfo || !slotInfo.mapElement) {
        return;
      }

      // Use intersection ratio for smarter visibility detection
      // Require at least 10% visibility to consider it "visible"
      const minVisibleRatio = 0.1;
      const isMeaningfullyVisible = entry.intersectionRatio >= minVisibleRatio;

      if (isMeaningfullyVisible) {
        // Slot scrolled into view with meaningful visibility - activate map if not already active
        // Also check if map has placeholder (might be stuck in inactive state)
        const hasPlaceholder = slotInfo.mapElement?.hasPlaceholder();
        if (!slotInfo.isActive || hasPlaceholder) {
          this.activateMapForSlot(slotInfo);
        }
      } else {
        // Slot scrolled out of view or has very low visibility - deactivate if truly off-screen
        // Use stricter check (no padding) to ensure it's really off-screen before deactivating
        if (slotInfo.isActive && !this.isElementVisible(slotElement, 0, 0.05)) {
          this.deactivateMapForSlot(slotInfo);
        }
      }
    });
  }

  /**
   * Process all slots after scroll stops (like geoview controller)
   * Two-phase approach: first return off-screen maps, then assign to visible slots
   */
  private async processAllSlotsAfterScrollStop(): Promise<void> {
    // Phase 1: Return maps from slots that are truly off-screen (negative buffer)
    // Use stricter check (-100px) so slots must be COMPLETELY off-screen
    this.slots.forEach(slotInfo => {
      if (slotInfo.isActive) {
        const isStrictlyVisible = this.isElementVisible(slotInfo.slotElement, -100);
        if (!isStrictlyVisible) {
          this.deactivateMapForSlot(slotInfo);
        }
      }
    });

    // Phase 2: Assign maps to visible slots, prioritized by distance from viewport center
    const viewportCenter = window.innerHeight / 2;
    const visibleSlots = this.slots
      .map(slotInfo => {
        const isVisible = this.isElementVisible(slotInfo.slotElement, 100);
        const hasPlaceholder = slotInfo.mapElement?.hasPlaceholder();
        // Activate if not active OR if it has a placeholder (stuck in inactive state)
        if (isVisible && (!slotInfo.isActive || hasPlaceholder)) {
          const rect = slotInfo.slotElement.getBoundingClientRect();
          const slotCenter = rect.top + rect.height / 2;
          const distanceFromCenter = Math.abs(slotCenter - viewportCenter);
          return { slotInfo, distanceFromCenter };
        }
        return null;
      })
      .filter(item => item !== null)
      .sort((a, b) => a!.distanceFromCenter - b!.distanceFromCenter);

    // Only activate the closest slots (limited by pool size)
    const slotsToActivate = visibleSlots.slice(0, this.poolSize - this.pool.length);
    for (const item of slotsToActivate) {
      if (item && (!item.slotInfo.isActive || item.slotInfo.mapElement?.hasPlaceholder())) {
        await this.activateMapForSlot(item.slotInfo);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { totalMaps: number; inUse: number; available: number } {
    const inUse = this.pool.filter(item => item.inUse).length;
    return {
      totalMaps: this.pool.length,
      inUse: inUse,
      available: Math.max(0, this.poolSize - this.pool.length)
    };
  }

  /**
   * Get names/IDs of currently active maps
   */
  getActiveMapNames(): string[] {
    // Get unique map IDs from active pool items
    const activeIds = new Set<string>();
    this.pool
      .filter(item => item.inUse && item.currentSlot)
      .forEach(item => {
        const slotId = this.getSlotId(item.currentSlot!);
        if (slotId !== 'unknown') {
          activeIds.add(slotId);
        }
      });
    
    // Return as array, limited to poolSize
    return Array.from(activeIds).slice(0, this.poolSize);
  }
}

// Register the element
if (!customElements.get('gk-map-collection')) {
  customElements.define('gk-map-collection', MapCollectionElement);
}

