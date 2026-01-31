/**
 * Base Element Component
 *
 * Shared base class for all UI components
 * Handles provider integration, lifecycle management, and common utilities
 */

import { getBounds, boundsToObject } from '../../utils/bounds';
import { getUIProvider, getUIProviderByName } from '../providers/registry';
import { getProviderForCapability } from '../../api/providers/registry';
import { debug } from '../utils/logger';
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
  private _controlAddedToMap: boolean = false;
  private _waitingForTransform: boolean = false;

  // Shared style-ready cache per map instance
  // This allows multiple elements to share the same style-ready promise
  private static _styleReadyCache = new WeakMap<
    MapInstance,
    {
      promise: Promise<void> | null;
      callbacks: Set<() => void>;
      listenersSetup: boolean;
    }
  >();

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
   * Optimized: Uses shared cache per map instance so multiple elements share the same promise
   */
  protected waitForStyleLoaded(callback: () => void): void {
    if (!this.map) {
      debug.warn(
        `[BaseElement] waitForStyleLoaded called but no map instance for ${this.constructor.name}`
      );
      return;
    }

    // Check if style is already loaded
    const isStyleLoaded = (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;
    const styleLoaded = isStyleLoaded && isStyleLoaded.call(this.map);

    if (styleLoaded) {
      // Style already loaded - execute immediately using microtask to ensure all callbacks run
      Promise.resolve().then(() => {
        if (this.map) {
          callback();
        }
      });
      return;
    }

    // Get or create shared cache for this map instance
    let cache = BaseElement._styleReadyCache.get(this.map);
    if (!cache) {
      cache = {
        promise: null,
        callbacks: new Set(),
        listenersSetup: false,
      };
      BaseElement._styleReadyCache.set(this.map, cache);
    }

    // Add callback to shared set
    cache.callbacks.add(callback);

    // If listeners aren't set up yet, create shared promise and set up listeners once
    if (!cache.listenersSetup) {
      cache.listenersSetup = true;

      cache.promise = new Promise<void>((resolve) => {
        const fireAllCallbacks = () => {
          // Double-check style is loaded
          const isStyleLoaded = (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;
          const styleLoaded = isStyleLoaded && isStyleLoaded.call(this.map);

          if (styleLoaded && cache) {
            // Store callbacks before clearing (they might be added during iteration)
            const callbacksToExecute = Array.from(cache.callbacks);
            cache.callbacks.clear();

            // Execute all queued callbacks
            callbacksToExecute.forEach((cb) => {
              try {
                cb();
              } catch (err) {
                debug.warn('[BaseElement] Error in style-ready callback:', err);
              }
            });
            resolve();
          }
        };

        const loadHandler = () => {
          fireAllCallbacks();
        };

        const styleLoadHandler = () => {
          fireAllCallbacks();
        };

        // Register listeners once for all elements
        if (this.map) {
          if (this.map.on) {
            this.map.on('load', loadHandler);
            this.map.on('style.load', styleLoadHandler);
          } else {
            // Fallback if 'on' method doesn't exist
            if (this.map.once) {
              this.map.once('load', () => {
                fireAllCallbacks();
              });
            }
          }
        }
      });

      // When promise resolves, execute callback (it's already been executed in fireAllCallbacks)
      // But keep this as a fallback in case the promise resolves before callback is added
      cache.promise.then(() => {
        // Callback should already be executed, but check if it wasn't
        if (cache && cache.callbacks.has(callback)) {
          try {
            callback();
            cache.callbacks.delete(callback);
          } catch (err) {
            debug.warn('[BaseElement] Error in style-ready callback (fallback):', err);
          }
        }
      });
    } else if (cache.promise) {
      // Listeners already set up, just wait for existing promise
      cache.promise.then(() => {
        // Callback should already be executed, but check if it wasn't
        if (cache && cache.callbacks.has(callback)) {
          try {
            callback();
            cache.callbacks.delete(callback);
          } catch (err) {
            debug.warn('[BaseElement] Error in style-ready callback (promise):', err);
          }
        }
      });
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

    // Reset control added flag when element is disconnected
    this._controlAddedToMap = false;

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
    // Clear control reference so onMapReady() recreates it for the new map instance
    // SDK controls are bound to specific map instances and can't be reused
    this.control = null;
    this.map = null;
    this._controlAddedToMap = false;
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
   * the map to be fully initialized with all internal properties including transform/projection
   */
  private waitForMapLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.map) {
        resolve();
        return;
      }

      const mapLoaded = (this.map as { loaded?: () => boolean }).loaded;
      const isStyleLoaded = (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;

      const loadedResult = mapLoaded ? mapLoaded.call(this.map) : false;
      const styleLoadedResult = isStyleLoaded ? isStyleLoaded.call(this.map) : false;

      const mapAny = this.map as any;

      // Check if map's transform/projection is ready (MapTiler SDK specific)
      // This prevents "Cannot read properties of null (reading 'getProjection')" errors
      const isTransformReady =
        mapAny._transform ||
        mapAny.transform ||
        (mapAny._map && (mapAny._map._transform || mapAny._map.transform));

      // If map and style are already loaded AND transform is ready, resolve immediately
      if (loadedResult && styleLoadedResult && isTransformReady) {
        resolve();
        return;
      }

      // Check for internal _loaded flag (MapLibre GL specific)
      // This handles the case where the 'load' event already fired
      if (mapAny._loaded || mapAny._styleDirty === false) {
        // Even if loaded, wait for idle to ensure transform is ready
        // This is critical for MapTiler SDK controls
        const mapOnce = (this.map as { once?: (event: string, handler: () => void) => void }).once;
        if (mapOnce) {
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          }, 500);

          mapOnce.call(this.map, 'idle', () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            }
          });
          return;
        }
        resolve();
        return;
      }

      // Wait for load event, then idle event to ensure transform is ready
      // The 'idle' event fires after the map has finished rendering and transform is initialized
      const mapOnce = (this.map as { once?: (event: string, handler: () => void) => void }).once;
      const mapOn = (this.map as { on?: (event: string, handler: () => void) => void }).on;

      if (mapOnce && mapOn) {
        let resolved = false;

        // Timeout fallback - if events don't fire in 2 seconds, assume map is ready
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 2000);

        // First wait for load event
        mapOnce.call(this.map, 'load', () => {
          // Then wait for idle event to ensure transform/projection is ready
          mapOnce.call(this.map, 'idle', () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      } else if (mapOnce) {
        // Fallback: just wait for load if on() is not available
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }, 100);

        mapOnce.call(this.map, 'load', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve();
          }
        });
      } else {
        // No event system available, resolve immediately
        resolve();
      }
    });
  }

  /**
   * Add control to map with position
   * Ensures map is loaded before adding controls to prevent initialization errors
   * Prevents duplicate additions by checking if control is already on the map
   */
  protected addControlToMap(): void {
    if (!this.map || !this.control) return;

    // Safety check: Verify map's transform/projection is ready (MapTiler SDK requirement)
    // This prevents "Cannot read properties of null (reading 'getProjection')" errors
    const mapAny = this.map as any;
    const isTransformReady =
      mapAny._transform ||
      mapAny.transform ||
      (mapAny._map && (mapAny._map._transform || mapAny._map.transform));

    // If transform is not ready, wait for idle event before adding control
    // Use flag to prevent multiple simultaneous waits
    if (!isTransformReady && !this._waitingForTransform) {
      const mapOnce = (this.map as { once?: (event: string, handler: () => void) => void }).once;
      if (mapOnce) {
        this._waitingForTransform = true;
        mapOnce.call(this.map, 'idle', () => {
          this._waitingForTransform = false;
          // Retry adding control after idle event
          this.addControlToMap();
        });
        return;
      }
    }

    // If we're still waiting for transform, don't proceed yet
    if (this._waitingForTransform) {
      return;
    }

    const position = this.getAttribute('position') || this.getDefaultPosition();
    const addControlMethod = (
      this.map as { addControl?: (control: unknown, position: string) => void }
    ).addControl;
    const removeControlMethod = (this.map as { removeControl?: (control: unknown) => void })
      .removeControl;

    if (!addControlMethod) return;

    try {
      // If control was already added, remove it first to prevent duplicates
      if (this._controlAddedToMap && removeControlMethod) {
        try {
          removeControlMethod.call(this.map, this.control);
        } catch {
          // Control might not be on map yet, ignore error
        }
      }

      // Add the control
      addControlMethod.call(this.map, this.control, position);
      this._controlAddedToMap = true;
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
      if (removeControl && this._controlAddedToMap) {
        removeControl(this.control);
        this._controlAddedToMap = false;
      }
      if (addControl) {
        addControl(this.control, newPosition || this.getDefaultPosition());
        this._controlAddedToMap = true;
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
   * Utility: Set up cursor pointer handling for a layer
   * This can be used independently of setupLayerInteractivity
   * @param layerId - Layer ID to attach cursor handlers to
   * @param cursor - Cursor style (default: 'pointer')
   * @returns Cleanup function to remove event listeners
   */
  protected setupLayerCursor(layerId: string, cursor: string = 'pointer'): (() => void) | null {
    if (!this.map || !layerId) return null;

    const mouseEnterHandler = () => {
      const canvas = this.map?.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = cursor;
      }
    };

    const mouseLeaveHandler = () => {
      const canvas = this.map?.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = '';
      }
    };

    this.map.on('mouseenter', layerId, mouseEnterHandler);
    this.map.on('mouseleave', layerId, mouseLeaveHandler);

    // Return cleanup function
    return () => {
      this.map?.off('mouseenter', layerId, mouseEnterHandler);
      this.map?.off('mouseleave', layerId, mouseLeaveHandler);
    };
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
        // Skip null/undefined values to prevent Mapbox validation errors
        if (value !== null && value !== undefined) {
          this.map?.setPaintProperty?.(layerId, property, value);
        }
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
