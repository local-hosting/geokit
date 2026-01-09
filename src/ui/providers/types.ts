/**
 * UI Provider Types
 *
 * Types and base class for UI providers (map rendering)
 */

/**
 * Base provider configuration
 */
export interface MapProviderConfig {
  apiKey?: string;
  accessToken?: string;
  [key: string]: unknown;
}

/**
 * Map creation options
 */
export interface MapOptions {
  container?: HTMLElement;
  lat?: number;
  lng?: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  style?: string;
  interactive?: boolean;
  extra?: Record<string, unknown>;
}

/**
 * Control options for various map controls
 */
export interface ControlOptions {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showCompass?: boolean;
  showZoom?: boolean;
  unit?: 'metric' | 'imperial' | 'nautical';
  container?: string;
  trackUserLocation?: boolean;
  showAccuracyCircle?: boolean;
  showUserHeading?: boolean;
}

/**
 * Marker options
 */
export interface MarkerOptions {
  color?: string;
  draggable?: boolean;
  element?: HTMLElement;
  offset?: [number, number];
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Popup options
 */
export interface PopupOptions {
  offset?: number | [number, number];
  closeButton?: boolean;
  closeOnClick?: boolean;
  closeOnMove?: boolean;
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: string;
  className?: string;
}

/**
 * Map event handler type
 */
export type MapEventHandler = (event: MapEvent) => void;

/**
 * Map event object (common properties across providers)
 */
export interface MapEvent {
  point?: { x: number; y: number };
  lngLat?: { lng: number; lat: number };
  features?: Array<{
    geometry?: { type: string; coordinates?: unknown };
    properties?: Record<string, unknown>;
  }>;
  originalEvent?: Event;
  [key: string]: unknown;
}

/**
 * Map layer paint properties
 */
export interface MapLayerPaint {
  [key: string]: unknown;
}

/**
 * Map layer definition
 */
export interface MapLayer {
  id: string;
  type: string;
  source: string | { type: string; data: unknown };
  paint?: MapLayerPaint;
  layout?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Map source definition
 */
export interface MapSource {
  type: string;
  data?: unknown;
  [key: string]: unknown;
}

/**
 * Map instance interface - common methods across map providers
 * This provides type safety for map operations without requiring
 * provider-specific types. Uses index signature to allow provider-specific methods.
 */
export interface MapInstance {
  // Event handling - flexible signatures to match different providers
  on(event: string, handler?: MapEventHandler): void;
  on(event: string, layerId: string, handler: MapEventHandler): void;
  off(event: string, handler?: MapEventHandler): void;
  off(event: string, layerId: string, handler?: MapEventHandler): void;
  once(event: string, handler: MapEventHandler): void;

  // Source management
  addSource(id: string, source: MapSource): void;
  removeSource(id: string): void;
  getSource?(id: string): MapSource | undefined;

  // Layer management
  addLayer(layer: MapLayer, beforeId?: string): void;
  removeLayer(id: string): void;
  getLayer?(id: string): MapLayer | undefined;

  // Style properties
  setPaintProperty?(layerId: string, property: string, value: unknown): void;
  setLayoutProperty?(layerId: string, property: string, value: unknown): void;

  // Map controls
  setCenter?(center: [number, number]): void;
  getCenter?(): { lng: number; lat: number };
  setZoom?(zoom: number): void;
  getZoom?(): number;

  // Querying
  queryRenderedFeatures?(
    point: { x: number; y: number },
    options?: { layers?: string[] }
  ): Array<{
    geometry?: { type: string; coordinates?: unknown };
    properties?: Record<string, unknown>;
  }>;

  // Canvas access (for cursor control)
  getCanvas?(): { style: { cursor: string } };

  // Lifecycle
  loaded?(): boolean;
  remove?(): void;

  // Provider-specific extensions - allow any additional properties/methods
  [key: string]: unknown;
}

/**
 * Base UI Provider - handles map rendering and UI controls
 * Only one UI provider is active at a time
 */
export abstract class BaseUIProvider {
  protected config: MapProviderConfig | null = null;
  protected sdk: any = null;

  /**
   * Get the provider name
   */
  abstract getName(): string;

  /**
   * Initialize the provider (load SDK, set config, etc.)
   */
  abstract initialize(config: MapProviderConfig): Promise<void>;

  /**
   * Create a map instance
   */
  abstract createMap(container: HTMLElement, options: MapOptions): Promise<MapInstance>;

  /**
   * Create a control by type
   */
  abstract createControl(type: string, options: ControlOptions): any;

  /**
   * Create a marker
   */
  abstract createMarker(options: MarkerOptions): any;

  /**
   * Create a popup
   */
  abstract createPopup(options: PopupOptions): any;

  /**
   * Get the raw SDK instance
   */
  abstract getSDK(): any;

  /**
   * Get CSS URL for the provider (if needed)
   */
  abstract getCssUrl(): string | null;

  /**
   * Get helper methods (optional)
   */
  getHelpers(): any {
    return null;
  }
}
