/**
 * Base Element Component
 * 
 * Shared base class for all UI components
 * Handles provider integration, lifecycle management, and common utilities
 */

import { getBounds, boundsToObject } from '../../utils/bounds';
import { getUIProvider } from '../providers/registry';
import { getProviderForCapability } from '../../api/providers/registry';
import type { BaseUIProvider } from '../providers/types';
import type { APICapability } from '../../api/providers/types';

/**
 * Base class for all map UI components
 * Provides common functionality and lifecycle management
 */
export class BaseElement extends HTMLElement {
  protected control: any = null;
  protected map: any = null;
  protected mapElement: HTMLElement | null = null;
  protected isInitialized: boolean = false;
  
  // Event handler references for cleanup
  private _mapReadyHandler: (() => void) | null = null;
  private _mapUnloadHandler: (() => void) | null = null;
  private _contextLostHandler: (() => void) | null = null;
  private _mapReadyParent: HTMLElement | null = null;

  /**
   * Override this method in subclasses to create the specific control
   * Should return the SDK control instance
   */
  protected async createControl(): Promise<any> {
    // Default: no control (for elements like markers, polygons)
    return null;
  }

  /**
   * Override this method to get default position for the control
   */
  protected getDefaultPosition(): string {
    return 'top-right';
  }

  /**
   * Override this method to handle control-specific attribute changes
   */
  protected handleAttributeChange(name: string, oldValue: string | null, newValue: string | null): void {
    // Base implementation handles position changes
    if (name === 'position' && this.control && this.map) {
      this.updateControlPosition(newValue || this.getDefaultPosition());
    }
  }

  /**
   * Override this method to set up control-specific event forwarding
   */
  protected setupEventForwarding(): void {
    // Default implementation does nothing
    // Subclasses can override to forward events
  }

  /**
   * Get the current UI provider
   */
  protected getUIProvider(): BaseUIProvider {
    return getUIProvider();
  }

  /**
   * Get a provider that supports a specific API capability
   */
  protected getAPIProvider(capability: APICapability): any {
    return getProviderForCapability(capability);
  }

  async connectedCallback(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create the control (implemented by subclass)
      this.control = await this.createControl();

      // Set up event forwarding if control exists
      if (this.control) {
        this.setupEventForwarding();
      }

      // Find parent map and add control/element
      this.addToParentMap();

      this.isInitialized = true;
    } catch (error) {
      console.error(`${this.constructor.name}: Failed to initialize:`, error);
    }
  }

  disconnectedCallback(): void {
    // Remove control from map
    if (this.map && this.control) {
      try {
        this.map.removeControl(this.control);
      } catch {
        // Silently handle removal errors
      }
    }

    // Clean up stored event listeners to prevent memory leaks
    this._cleanupMapListeners();

    this.isInitialized = false;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null): void {
    if (_oldValue !== _newValue && this.isInitialized) {
      this.handleAttributeChange(name, _oldValue, _newValue);
    }
  }

  /**
   * Find parent mapi-map element and initialize component
   * Handles map reinitialization by re-listening for mapi-ready events
   */
  protected addToParentMap(): void {
    // Clean up any existing event listeners
    this._cleanupMapListeners();

    let parent = this.parentElement;

    while (parent) {
      if (parent.tagName.toLowerCase() === 'mapi-map') {
        this.mapElement = parent;
        const map = (parent as any).getMap?.();

        if (map) {
          // Map is ready, initialize immediately
          this.map = map;
          this.onMapReady();
        } else {
          // Map not ready yet, wait for it
          const handleMapReady = () => {
            const currentMap = (parent as any).getMap?.();
            if (currentMap) {
              this.map = currentMap;
              this.onMapReady();
            }
          };

          this._mapReadyHandler = handleMapReady;
          this._mapReadyParent = parent;
          parent.addEventListener('mapi-ready', handleMapReady);
        }

        // Listen for map unload to clean up resources
        const handleMapUnload = () => {
          this.onMapUnload();
        };

        this._mapUnloadHandler = handleMapUnload;
        parent.addEventListener('mapi-unload', handleMapUnload);

        // Listen for WebGL context loss
        const handleContextLost = () => {
          this.onContextLost();
        };

        this._contextLostHandler = handleContextLost;
        parent.addEventListener('mapi-context-lost', handleContextLost);

        return;
      }

      parent = parent.parentElement;
    }

    console.warn(`${this.constructor.name}: No parent mapi-map element found`);
  }

  /**
   * Clean up map event listeners
   */
  private _cleanupMapListeners(): void {
    if (this._mapReadyHandler && this._mapReadyParent) {
      this._mapReadyParent.removeEventListener('mapi-ready', this._mapReadyHandler);
      this._mapReadyHandler = null;
    }

    if (this._mapUnloadHandler && this._mapReadyParent) {
      this._mapReadyParent.removeEventListener('mapi-unload', this._mapUnloadHandler);
      this._mapUnloadHandler = null;
    }

    if (this._contextLostHandler && this._mapReadyParent) {
      this._mapReadyParent.removeEventListener('mapi-context-lost', this._contextLostHandler);
      this._contextLostHandler = null;
    }

    this._mapReadyParent = null;
  }

  /**
   * Called when parent map is unloading
   * Override in subclasses to clean up
   */
  protected onMapUnload(): void {
    this.map = null;
  }

  /**
   * Called when WebGL context is lost
   * Override in subclasses to clean up
   */
  protected onContextLost(): void {
    // Default implementation does nothing
  }

  /**
   * Called when map is ready
   * Controls call addControlToMap(), other components can override
   */
  protected onMapReady(): void {
    if (this.control) {
      this.addControlToMap();
    }
  }

  /**
   * Add control to map with position
   */
  protected addControlToMap(): void {
    if (!this.map || !this.control) return;

    // Skip adding controls to hero map
    if (this.mapElement) {
      const mapId = this.mapElement.id;
      const isHeroMap =
        mapId === 'interactive-map' ||
        this.mapElement.classList.contains('hero-map-element') ||
        this.mapElement.closest('.hero-map');

      if (isHeroMap) {
        return;
      }
    }

    const position = this.getAttribute('position') || this.getDefaultPosition();

    try {
      this.map.addControl(this.control, position);
    } catch (error) {
      console.error(`${this.constructor.name}: Failed to add control:`, error);
    }
  }

  /**
   * Update control position on the map
   */
  protected updateControlPosition(newPosition: string): void {
    if (!this.map || !this.control) return;

    try {
      this.map.removeControl(this.control);
      this.map.addControl(this.control, newPosition || this.getDefaultPosition());
    } catch (error) {
      console.error(`${this.constructor.name}: Failed to update position:`, error);
    }
  }

  /**
   * Public API: Get the underlying control instance
   */
  public getControl(): any {
    return this.control;
  }

  /**
   * Public API: Get the map instance
   */
  public getMap(): any {
    return this.map;
  }

  /**
   * Utility: Recreate control when attributes change
   */
  protected async recreateControl(): Promise<void> {
    if (!this.map || !this.control) return;

    try {
      this.map.removeControl(this.control);
      this.control = await this.createControl();

      if (this.control) {
        this.setupEventForwarding();
        this.addControlToMap();
      }
    } catch (error) {
      console.error(`${this.constructor.name}: Failed to recreate control:`, error);
    }
  }

  /**
   * Utility: Clean up map layers and sources
   */
  protected cleanupMapLayers(layerIds: string[] = [], sourceIds: string[] = []): void {
    if (!this.map) return;

    try {
      // Remove layers first
      layerIds.forEach((layerId) => {
        if (layerId && this.map.getLayer?.(layerId)) {
          this.map.removeLayer(layerId);
        }
      });

      // Then remove sources
      sourceIds.forEach((sourceId) => {
        if (sourceId && this.map.getSource?.(sourceId)) {
          this.map.removeSource(sourceId);
        }
      });
    } catch {
      // Silently handle cleanup errors
    }
  }

  /**
   * Utility: Set up standard layer interactivity
   */
  protected setupLayerInteractivity(layerId: string, eventPrefix: string): void {
    if (!this.map || !layerId) return;

    // Click event
    this.map.on('click', layerId, (e: any) => {
      this.dispatchEvent(
        new CustomEvent(`${eventPrefix}-click`, {
          detail: {
            coordinates: e.lngLat,
            features: e.features,
            element: this,
            originalEvent: e,
          },
          bubbles: true,
        })
      );
    });

    // Mouse enter
    this.map.on('mouseenter', layerId, (e: any) => {
      this.map.getCanvas().style.cursor = 'pointer';
      this.dispatchEvent(
        new CustomEvent(`${eventPrefix}-mouseenter`, {
          detail: {
            coordinates: e.lngLat,
            features: e.features,
            element: this,
            originalEvent: e,
          },
          bubbles: true,
        })
      );
    });

    // Mouse leave
    this.map.on('mouseleave', layerId, (e: any) => {
      this.map.getCanvas().style.cursor = '';
      this.dispatchEvent(
        new CustomEvent(`${eventPrefix}-mouseleave`, {
          detail: {
            coordinates: e.lngLat,
            features: e.features,
            element: this,
            originalEvent: e,
          },
          bubbles: true,
        })
      );
    });
  }

  /**
   * Utility: Remove layer interactivity listeners
   */
  protected removeLayerInteractivity(layerId: string): void {
    if (!this.map || !layerId) return;

    try {
      this.map.off('click', layerId);
      this.map.off('mouseenter', layerId);
      this.map.off('mouseleave', layerId);
    } catch {
      // Silently handle removal errors
    }
  }

  /**
   * Utility: Toggle layer visibility
   */
  protected toggleLayerVisibility(
    layerIds: string | string[],
    createMethod: (() => void) | null = null
  ): void {
    if (!this.map) return;

    const layers = Array.isArray(layerIds) ? layerIds : [layerIds];
    const visible = this.getAttribute('visible');
    const isVisible = visible !== 'false';

    if (isVisible) {
      const hasLayer = layers.some((layerId) => this.map.getLayer(layerId));

      if (!hasLayer && createMethod) {
        createMethod.call(this);
      } else {
        layers.forEach((layerId) => {
          if (this.map.getLayer(layerId)) {
            this.map.setLayoutProperty(layerId, 'visibility', 'visible');
          }
        });
      }
    } else {
      layers.forEach((layerId) => {
        if (this.map.getLayer(layerId)) {
          this.map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });
    }
  }

  /**
   * Utility: Update paint properties
   */
  protected updatePaintProperties(layerId: string, properties: Record<string, any>): void {
    if (!this.map || !this.map.getLayer(layerId)) return;

    try {
      Object.entries(properties).forEach(([property, value]) => {
        this.map.setPaintProperty(layerId, property, value);
      });
    } catch (error) {
      console.warn(`Failed to update paint properties for ${layerId}:`, error);
    }
  }

  /**
   * Utility: Calculate bounds from coordinates using geokit
   */
  protected calculateBounds(coordinates: number[][]): any {
    if (!coordinates || coordinates.length === 0) {
      return null;
    }

    try {
      const bounds = getBounds(coordinates);
      if (!bounds) return null;
      return boundsToObject(bounds);
    } catch {
      return null;
    }
  }
}

