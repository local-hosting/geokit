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
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: string;
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
  abstract createMap(container: HTMLElement, options: MapOptions): Promise<any>;

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
