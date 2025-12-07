/**
 * MapTiler UI Provider
 * 
 * Implements BaseUIProvider for MapTiler SDK
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

export class MapTilerUIProvider extends BaseUIProvider {
  protected sdk: any = null;
  private sdkLoadPromise: Promise<any> | null = null;
  protected config: MapProviderConfig | null = null;

  getName(): string {
    return 'maptiler';
  }

  getCssUrl(): string | null {
    // MapTiler SDK includes CSS in the package
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
    if (typeof window !== 'undefined' && (window as any).maptilersdk) {
      this.sdk = (window as any).maptilersdk;
      if (config?.apiKey) {
        this.sdk.config.apiKey = config.apiKey;
      }
      return Promise.resolve(this.sdk);
    }

    // Load SDK dynamically
    this.sdkLoadPromise = (async () => {
      try {
        // Suppress API key warning if no key provided yet
        const originalWarn = console.warn;
        let warningSuppressed = false;

        if (!config?.apiKey) {
          console.warn = (...args: any[]) => {
            const message = args.join(' ');
            if (message.includes('MapTiler Cloud API key is not set')) {
              warningSuppressed = true;
              return;
            }
            originalWarn.apply(console, args);
          };
        }

        // Dynamic import of MapTiler SDK
        const maptilerModule = await import('@maptiler/sdk');

        // Restore console.warn
        if (warningSuppressed) {
          console.warn = originalWarn;
        }

        // Set API key if provided
        if (config?.apiKey && maptilerModule.config) {
          maptilerModule.config.apiKey = config.apiKey;
        }

        // Expose to window for backward compatibility
        if (typeof window !== 'undefined') {
          (window as any).maptilersdk = maptilerModule;
        }

        this.sdk = maptilerModule;
        return this.sdk;
      } catch (error) {
        console.error('Failed to load MapTiler SDK:', error);
        throw error;
      }
    })();

    return this.sdkLoadPromise;
  }

  async createMap(container: HTMLElement, options: MapOptions): Promise<any> {
    if (!this.sdk) {
      await this.initialize(this.config || {});
    }

    // Ensure API key is set
    if (this.config?.apiKey && this.sdk?.config) {
      this.sdk.config.apiKey = this.config.apiKey;
    }

    // Build style URL
    let style = options.style;
    if (!style || (typeof style === 'string' && !style.startsWith('http'))) {
      // Default to dataviz-dark style
      style = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${
        this.config?.apiKey || ''
      }`;
    }

    const mapOptions = {
      container,
      style,
      center: [options.lng || 0, options.lat || 0],
      zoom: options.zoom || 2,
      pitch: options.pitch || 0,
      bearing: options.bearing || 0,
      // Hide MapTiler logo for paid accounts
      maptilerLogo: false,
      // Interactive by default
      interactive: options.interactive !== false,
      // Spread any extra options
      ...(options.extra || {}),
    };

    return new this.sdk.Map(mapOptions);
  }

  createControl(type: string, options: ControlOptions): any {
    if (!this.sdk) {
      throw new Error('MapTiler SDK not initialized. Call initialize() first.');
    }

    switch (type) {
      case 'navigation':
        return new this.sdk.NavigationControl({
          showCompass: options.showCompass,
          showZoom: options.showZoom,
        });

      case 'scale':
        return new this.sdk.ScaleControl({
          unit: options.unit,
        });

      case 'fullscreen':
        return new this.sdk.FullscreenControl({
          container: options.container,
        });

      case 'geolocate':
        return new this.sdk.GeolocateControl({
          trackUserLocation: options.trackUserLocation,
          showAccuracyCircle: options.showAccuracyCircle,
          showUserHeading: options.showUserHeading,
        });

      default:
        throw new Error(`Unknown control type: ${type}`);
    }
  }

  createMarker(options: MarkerOptions): any {
    if (!this.sdk) {
      throw new Error('MapTiler SDK not initialized. Call initialize() first.');
    }

    return new this.sdk.Marker(options);
  }

  createPopup(options: PopupOptions): any {
    if (!this.sdk) {
      throw new Error('MapTiler SDK not initialized. Call initialize() first.');
    }

    return new this.sdk.Popup(options);
  }

  getSDK(): any {
    return this.sdk;
  }

  getHelpers(): any {
    return this.sdk?.helpers || null;
  }
}

