/**
 * Map Child Element
 *
 * Base class for elements that are children of a gk-map element
 * (points, polygons, markers, polylines, popups, isochrones, h3)
 *
 * Handles finding parent map and listening for map ready events
 */

import { BaseElement } from './base-element';
import { getUIProvider as getGlobalUIProvider, getUIProviderByName } from '../providers/registry';
import { debug } from '../utils/logger';
import type { MapInstance } from '../providers/types';

/**
 * Base class for elements that need a parent gk-map
 */
export class MapChildElement extends BaseElement {
  /**
   * Find the gk-map element from a map instance (static utility)
   * Traverses up from the map's container to find the parent gk-map element
   * Useful for static methods that need to find the map element from a map instance
   */
  public static findMapElementFromInstance(map: any): HTMLElement | null {
    if (!map) return null;

    // Try to get container from map instance
    const container = map.getContainer?.();
    if (!container) return null;

    // Traverse up the DOM tree to find gk-map element
    let element: HTMLElement | null = container as HTMLElement;
    while (element) {
      if (element.tagName?.toLowerCase() === 'gk-map') {
        return element;
      }
      element = element.parentElement;
    }

    return null;
  }

  /**
   * Get UI provider from map element or fall back to global (static utility)
   * Useful for static methods that need to get the provider from a map instance
   */
  public static getProviderFromMapInstance(map: any): any {
    // Find the gk-map element from the map instance
    const mapElement = MapChildElement.findMapElementFromInstance(map);

    if (mapElement) {
      // Get provider name from map element attribute
      const providerName = mapElement.getAttribute('provider');
      if (providerName) {
        const provider = getUIProviderByName(providerName);
        if (provider) {
          return provider;
        }
      }

      // Try to get provider from the map element itself (if it's a MapElement instance)
      const mapElementInstance = mapElement as any;
      if (mapElementInstance.getUIProvider) {
        try {
          return mapElementInstance.getUIProvider();
        } catch {
          // Silently fall through to global provider
        }
      }
    }

    // Fall back to global provider
    try {
      return getGlobalUIProvider();
    } catch (error) {
      console.error('[MapChildElement] Failed to get global provider:', error);
      return null;
    }
  }
  // Event handler references for cleanup
  private _mapReadyHandler: (() => void) | null = null;
  private _mapUnloadHandler: (() => void) | null = null;
  private _contextLostHandler: (() => void) | null = null;
  private _mapReadyParent: HTMLElement | null = null;
  private _processedMapInstances: WeakSet<MapInstance> = new WeakSet();

  async connectedCallback(): Promise<void> {
    // Find parent map first
    this.addToParentMap();
    // Then call base class
    await super.connectedCallback();
  }

  /**
   * Override onMapReady to add guard against duplicate calls
   */
  protected async onMapReady(): Promise<void> {
    // Prevent duplicate calls for the same map instance
    if (this.map && this._processedMapInstances.has(this.map)) {
      return;
    }

    if (this.map) {
      this._processedMapInstances.add(this.map);
    }

    await super.onMapReady();
  }

  /**
   * Find parent gk-map element and initialize component
   * Handles map reinitialization by re-listening for gk-map-ready events
   */
  protected addToParentMap(): void {
    // Clean up any existing event listeners
    this._cleanupMapListeners();

    let parent = this.parentElement;

    while (parent) {
      if (parent.tagName.toLowerCase() === 'gk-map') {
        this.mapElement = parent;
        // Type guard: check if parent has getMap method
        const mapElement = parent as HTMLElement & { getMap?: () => MapInstance | null };
        const map = mapElement.getMap?.();

        // Always set up event listener for gk-map-ready to handle freeze/unfreeze
        // This ensures child elements re-initialize when map unfreezes
        const handleMapReady = () => {
          const currentMap = mapElement.getMap?.();
          if (currentMap) {
            this.map = currentMap;
            void this.onMapReady();
          }
        };

        this._mapReadyHandler = handleMapReady;
        this._mapReadyParent = parent;
        parent.addEventListener('gk-map-ready', handleMapReady);

        // If map already exists, initialize immediately
        // The event listener above will handle re-initialization on unfreeze
        // Note: onMapReady() will guard against duplicates, so it's safe to call both here and in the event handler
        if (map) {
          this.map = map;
          void this.onMapReady();
        }

        // Listen for map unload to clean up resources
        const handleMapUnload = () => {
          this.onMapUnload();
        };

        this._mapUnloadHandler = handleMapUnload;
        parent.addEventListener('gk-map-unload', handleMapUnload);

        // Listen for WebGL context loss
        const handleContextLost = () => {
          this.onContextLost();
        };

        this._contextLostHandler = handleContextLost;
        parent.addEventListener('gk-map-context-lost', handleContextLost);

        return;
      }

      parent = parent.parentElement;
    }

    debug.warn(`[MapChildElement] No parent gk-map element found for ${this.constructor.name}`);
  }

  /**
   * Clean up map event listeners
   */
  private _cleanupMapListeners(): void {
    if (this._mapReadyHandler && this._mapReadyParent) {
      this._mapReadyParent.removeEventListener('gk-map-ready', this._mapReadyHandler);
      this._mapReadyHandler = null;
    }

    if (this._mapUnloadHandler && this._mapReadyParent) {
      this._mapReadyParent.removeEventListener('gk-map-unload', this._mapUnloadHandler);
      this._mapUnloadHandler = null;
    }

    if (this._contextLostHandler && this._mapReadyParent) {
      this._mapReadyParent.removeEventListener('gk-map-context-lost', this._contextLostHandler);
      this._contextLostHandler = null;
    }

    this._mapReadyParent = null;
    // Note: We don't clear _processedMapInstances here because WeakSet will automatically
    // clean up when map instances are garbage collected. This prevents re-processing
    // the same map instance if the element is reconnected.
  }

  disconnectedCallback(): void {
    // Clean up stored event listeners to prevent memory leaks
    this._cleanupMapListeners();
    super.disconnectedCallback();
  }

  /**
   * Override onMapUnload to clear processed map instances
   * This allows the element to be re-initialized if the map is recreated
   */
  protected onMapUnload(): void {
    // Clear processed instances so we can process the map again if it's recreated
    if (this.map) {
      this._processedMapInstances.delete(this.map);
    }
    super.onMapUnload();
  }
}
