/**
 * Mapbox UI Provider
 * 
 * Implements BaseUIProvider for Mapbox GL JS
 * Handles map rendering, controls, markers, and popups
 */

import { BaseUIProvider } from './types';
import type {
  MapProviderConfig,
  MapOptions,
  ControlOptions,
  MarkerOptions,
  PopupOptions,
} from './types';

export class MapboxUIProvider extends BaseUIProvider {
  protected sdk: any = null;
  private sdkLoadPromise: Promise<any> | null = null;
  protected config: MapProviderConfig | null = null;

  getName(): string {
    return 'mapbox';
  }

  getCssUrl(): string | null {
    // Mapbox GL JS includes CSS in the package
    return null;
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;

    // Return existing promise if already loading
    if (this.sdkLoadPromise) {
      return this.sdkLoadPromise;
    }

    // Return resolved promise if already loaded
    if (this.sdk) {
      return Promise.resolve(this.sdk);
    }

    // Check if SDK is already loaded globally
    if (typeof window !== 'undefined' && (window as any).mapboxgl) {
      this.sdk = (window as any).mapboxgl;
      if (config?.accessToken) {
        this.sdk.accessToken = config.accessToken;
      }
      return Promise.resolve(this.sdk);
    }

    // Load SDK dynamically
    this.sdkLoadPromise = (async () => {
      try {
        // Dynamic import of Mapbox GL JS
        const mapboxModule = await import('mapbox-gl');

        // Set access token if provided
        if (config?.accessToken) {
          (mapboxModule as any).accessToken = config.accessToken;
        }

        // Expose to window for backward compatibility
        if (typeof window !== 'undefined') {
          (window as any).mapboxgl = mapboxModule;
        }

        this.sdk = mapboxModule;
        return this.sdk;
      } catch (error) {
        console.error('Failed to load Mapbox GL JS:', error);
        throw error;
      }
    })();

    return this.sdkLoadPromise;
  }

  async createMap(container: HTMLElement, options: MapOptions): Promise<any> {
    if (!this.sdk) {
      await this.initialize(this.config || {});
    }

    // Ensure access token is set
    if (this.config?.accessToken) {
      (this.sdk as any).accessToken = this.config.accessToken;
    }

    // Build style
    let style = options.style;
    if (!style || (typeof style === 'string' && !style.startsWith('mapbox://'))) {
      // Default to streets style
      style = 'mapbox://styles/mapbox/streets-v12';
    }

    const mapOptions = {
      container,
      style,
      center: [options.lng || 0, options.lat || 0] as [number, number],
      zoom: options.zoom || 2,
      pitch: options.pitch || 0,
      bearing: options.bearing || 0,
      // Interactive by default
      interactive: options.interactive !== false,
      // Spread any extra options
      ...(options.extra || {}),
    };

    return new this.sdk.Map(mapOptions);
  }

  createControl(type: string, options: ControlOptions): any {
    if (!this.sdk) {
      throw new Error('Mapbox GL JS not initialized. Call initialize() first.');
    }

    switch (type) {
      case 'navigation':
        return new this.sdk.NavigationControl({
          showCompass: options.showCompass !== false,
          showZoom: options.showZoom !== false,
          visualizePitch: true,
        });

      case 'scale':
        return new this.sdk.ScaleControl({
          maxWidth: 100,
          unit: options.unit || 'metric',
        });

      case 'fullscreen':
        return new this.sdk.FullscreenControl({
          container: options.container ? document.querySelector(options.container) : undefined,
        });

      case 'geolocate':
        return new this.sdk.GeolocateControl({
          trackUserLocation: options.trackUserLocation || false,
          showAccuracyCircle: options.showAccuracyCircle !== false,
          showUserHeading: options.showUserHeading || false,
        });

      default:
        throw new Error(`Unknown control type: ${type}`);
    }
  }

  createMarker(options: MarkerOptions): any {
    if (!this.sdk) {
      throw new Error('Mapbox GL JS not initialized. Call initialize() first.');
    }

    return new this.sdk.Marker(options);
  }

  createPopup(options: PopupOptions): any {
    if (!this.sdk) {
      throw new Error('Mapbox GL JS not initialized. Call initialize() first.');
    }

    return new this.sdk.Popup(options);
  }

  getSDK(): any {
    return this.sdk;
  }

  getHelpers(): any {
    // Mapbox GL JS doesn't have helpers like MapTiler
    return null;
  }
}

