/**
 * Base Element Component
 *
 * Shared base class for all UI components
 * Handles provider integration, lifecycle management, and common utilities
 */

import { getBounds, boundsToObject } from '../../utils/bounds';
import { getUIProvider, getUIProviderByName } from '../providers/registry';
import { getProviderForCapability } from '../../api/providers/registry';
import type { BaseUIProvider, MapInstance, MapEvent } from '../providers/types';
import type { APICapability } from '../../api/providers/types';

/**
 * Base class for all map UI components
 * Provides common functionality and lifecycle management
 */
export class BaseElement extends HTMLElement {
  protected control: any = null;
  protected map: MapInstance | null = null;
  protected mapElement: HTMLElement | null = null;
  protected isInitialized: boolean = false;

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
  protected handleAttributeChange(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
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
   * First checks parent map element's provider attribute, then falls back to global default
   */
  protected getUIProvider(): BaseUIProvider {
    // Check parent map element for provider attribute
    if (this.mapElement) {
      const providerName = this.mapElement.getAttribute('provider');
      if (providerName) {
        const provider = getUIProviderByName(providerName);
        if (provider) {
          return provider;
        }
      }
    }

    // Fall back to global default provider
    return getUIProvider();
  }

  /**
   * Get a provider that supports a specific API capability
   */
  protected getAPIProvider(capability: APICapability): any {
    return getProviderForCapability(capability);
  }

  /**
   * Wait for map style to be loaded before executing callback
   * Prevents "Style is not done loading" errors
   * Handles race conditions when multiple elements wait simultaneously
   */
  protected waitForStyleLoaded(callback: () => void): void {
    if (!this.map) {
      console.warn(`[${this.constructor.name}] waitForStyleLoaded: no map`);
      return;
    }

    // Check if style is already loaded
    const isStyleLoaded = (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;
    if (isStyleLoaded && isStyleLoaded.call(this.map)) {
      // Style already loaded - execute immediately using microtask to ensure all callbacks run
      Promise.resolve().then(() => {
        callback();
      });
      return;
    }

    // Style not loaded yet - wait for it
    // Use 'on' instead of 'once' and manually remove listener to ensure all callbacks fire
    // This is important when multiple elements register listeners simultaneously
    const loadHandler = () => {
      // Double-check style is loaded (defensive)
      const isStyleLoaded =
        this.map && (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;
      if (this.map && isStyleLoaded && isStyleLoaded.call(this.map)) {
        // Remove listener to prevent multiple calls
        if (this.map.off) {
          this.map.off('load', loadHandler);
        }
        callback();
      }
    };

    // Register listener - 'on' ensures all registered listeners fire
    if (this.map.on) {
      this.map.on('load', loadHandler);
    } else {
      // Fallback if 'on' method doesn't exist
      this.map.once('load', callback);
    }
  }

  async connectedCallback(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // For non-control elements (markers, etc), create immediately if needed
      if (!this.shouldWaitForMap()) {
        this.control = await this.createControl();
        if (this.control) {
          this.setupEventForwarding();
        }
      }

      this.isInitialized = true;
    } catch (error) {
      console.error(`${this.constructor.name}: Failed to initialize:`, error);
    }
  }

  /**
   * Override in subclasses to indicate if component should wait for map
   * Controls should wait, geometry elements might not need to
   */
  protected shouldWaitForMap(): boolean {
    // Default: wait for map if this is a control (has a control-specific position)
    return this.hasAttribute('position') || this.constructor.name.includes('Control');
  }

  disconnectedCallback(): void {
    // Remove control from map
    if (this.map && this.control) {
      try {
        const removeControl = (this.map as { removeControl?: (control: unknown) => void })
          .removeControl;
        if (removeControl) {
          removeControl(this.control);
        }
      } catch {
        // Silently handle removal errors
      }
    }

    // DON'T reset state when element is moved - preserve for reuse in map pool
    // This matches the behavior of map.ts which preserves map instance
    // this.isInitialized = false;
    // this.map = null;
    // this.mapElement = null;
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null): void {
    if (_oldValue !== _newValue && this.isInitialized) {
      this.handleAttributeChange(name, _oldValue, _newValue);
    }
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
  protected async onMapReady(): Promise<void> {
    // Create control now that map is ready and provider is initialized
    if (this.shouldWaitForMap() && !this.control) {
      try {
        this.control = await this.createControl();
        if (this.control) {
          this.setupEventForwarding();
          // For controls, wait for map to be fully loaded before adding
          await this.waitForMapLoad();
          this.addControlToMap();
        }
      } catch (error) {
        console.error(
          `${this.constructor.name}: Failed to create control:`,
          error,
          '\nThis may indicate a provider SDK version mismatch or initialization issue.'
        );
      }
    } else if (this.control) {
      // Control already created, wait for map load then add to map
      await this.waitForMapLoad();
      this.addControlToMap();
    }
  }

  /**
   * Wait for map load event to ensure all internal APIs are ready
   * This is especially important for MapTiler SDK controls which need
   * the map to be fully initialized with all internal properties
   */
  private waitForMapLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.map) {
        resolve();
        return;
      }

      const mapLoaded = (this.map as { loaded?: () => boolean }).loaded;
      const isStyleLoaded = (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;

      // If map and style are already loaded, resolve immediately
      // Don't wait for 'idle' - it may have already fired and won't fire again
      if (mapLoaded && mapLoaded.call(this.map) && isStyleLoaded && isStyleLoaded.call(this.map)) {
        resolve();
        return;
      }

      // Wait for load event
      const mapOnce = (this.map as { once?: (event: string, handler: () => void) => void }).once;
      if (mapOnce) {
        mapOnce.call(this.map, 'load', resolve);
      } else {
        // No event system available, resolve immediately
        resolve();
      }
    });
  }

  /**
   * Add control to map with position
   * Ensures map is loaded before adding controls to prevent initialization errors
   */
  protected addControlToMap(): void {
    if (!this.map || !this.control) return;

    const position = this.getAttribute('position') || this.getDefaultPosition();
    const addControlMethod = (
      this.map as { addControl?: (control: unknown, position: string) => void }
    ).addControl;

    if (!addControlMethod) return;

    try {
      addControlMethod.call(this.map, this.control, position);
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
      const removeControl = (this.map as { removeControl?: (control: unknown) => void })
        .removeControl;
      const addControl = (this.map as { addControl?: (control: unknown, position: string) => void })
        .addControl;
      if (removeControl) {
        removeControl(this.control);
      }
      if (addControl) {
        addControl(this.control, newPosition || this.getDefaultPosition());
      }
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
      const removeControl = (this.map as { removeControl?: (control: unknown) => void })
        .removeControl;
      if (removeControl) {
        removeControl(this.control);
      }
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
        if (layerId && this.map?.getLayer?.(layerId)) {
          this.map?.removeLayer?.(layerId);
        }
      });

      // Then remove sources
      sourceIds.forEach((sourceId) => {
        if (sourceId && this.map?.getSource?.(sourceId)) {
          this.map?.removeSource?.(sourceId);
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
    this.map.on('click', layerId, (e: MapEvent) => {
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
    this.map.on('mouseenter', layerId, (e: MapEvent) => {
      const canvas = this.map?.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = 'pointer';
      }
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
    this.map.on('mouseleave', layerId, (e: MapEvent) => {
      const canvas = this.map?.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = '';
      }
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
      const hasLayer = layers.some((layerId) => this.map?.getLayer?.(layerId));

      if (!hasLayer && createMethod) {
        createMethod.call(this);
      } else {
        layers.forEach((layerId) => {
          if (this.map?.getLayer?.(layerId)) {
            this.map.setLayoutProperty?.(layerId, 'visibility', 'visible');
          }
        });
      }
    } else {
      layers.forEach((layerId) => {
        if (this.map?.getLayer?.(layerId)) {
          this.map.setLayoutProperty?.(layerId, 'visibility', 'none');
        }
      });
    }
  }

  /**
   * Utility: Update paint properties
   */
  protected updatePaintProperties(layerId: string, properties: Record<string, any>): void {
    if (!this.map || !this.map.getLayer?.(layerId)) return;

    try {
      Object.entries(properties).forEach(([property, value]) => {
        this.map?.setPaintProperty?.(layerId, property, value);
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

  /**
   * Safely set an attribute, handling JSDOM/Happy-DOM limitations
   * In test environments, setting attributes can throw NotSupportedError
   * Falls back to storing as a property if attribute setting fails
   * @param name - Attribute name
   * @param value - Attribute value
   */
  protected safeSetAttribute(name: string, value: string): void {
    try {
      this.setAttribute(name, value);
    } catch (error: any) {
      // In JSDOM/Happy-DOM, setting attributes can still throw NotSupportedError
      // This is a test environment limitation - attributes still work in real browsers
      // Store as properties as fallback and suppress the error
      if (error?.name === 'NotSupportedError' || error?.code === 9) {
        (this as any)[`_attr_${name}`] = value;
        // Error is handled, don't re-throw
      } else {
        throw error;
      }
    }
  }

  /**
   * Safely get an attribute, checking both the attribute and fallback properties
   * (for JSDOM/Happy-DOM compatibility when setAttribute fails)
   * @param name - Attribute name
   * @returns Attribute value or null
   */
  protected safeGetAttribute(name: string): string | null {
    try {
      const attr = this.getAttribute(name);
      if (attr !== null) return attr;
    } catch {
      // Ignore errors reading attributes
    }
    // Check fallback property if attribute read failed or returned null
    const fallback = (this as any)[`_attr_${name}`];
    return fallback !== undefined ? String(fallback) : null;
  }

  /**
   * Apply stored create options as attributes
   * Called from connectedCallback to set attributes from factory methods
   * Subclasses should override to apply their specific options
   * @param options - Options object from factory method
   */
  protected applyCreateOptions(_options: Record<string, any>): void {
    // Base implementation does nothing - subclasses should override
    // This allows each element type to handle its own attribute mapping
  }
}
