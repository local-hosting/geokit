/**
 * MapTiler UI Provider
 *
 * Implements BaseUIProvider for MapTiler SDK
 * Handles map rendering, controls, markers, and popups.
 * Supports loading the SDK from a script URL (e.g. CDN UMD) via config.sdkScriptUrl;
 * the script must set window.maptilersdk.
 */

import { BaseUIProvider } from './types';

function loadScriptAndGetGlobal(url: string, globalName: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (typeof (window as any)[globalName] !== 'undefined') {
      resolve((window as any)[globalName]);
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = false;
    script.onload = () => {
      const g = (window as any)[globalName];
      if (g) resolve(g);
      else reject(new Error(`Script loaded but window.${globalName} was not set`));
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(script);
  });
}
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

    // Check if SDK is already loaded globally (e.g. from CDN script tag)
    if (typeof window !== 'undefined' && (window as any).maptilersdk) {
      this.sdk = (window as any).maptilersdk;
      if (config?.apiKey) {
        this.sdk.config.apiKey = config.apiKey;
      }
      return Promise.resolve(this.sdk);
    }

    // Load SDK dynamically: optional script URL (CDN) or dynamic import
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

        let maptilerModule: any;

        if (typeof window !== 'undefined' && config?.sdkScriptUrl) {
          // Load from CDN/script URL (script must set window.maptilersdk)
          maptilerModule = await loadScriptAndGetGlobal(config.sdkScriptUrl, 'maptilersdk');
        } else {
          // Dynamic import of MapTiler SDK from bundle
          maptilerModule = await import('@maptiler/sdk');
        }

        // Restore console.warn
        if (warningSuppressed) {
          console.warn = originalWarn;
        }

        // Set API key if provided
        if (config?.apiKey && maptilerModule.config) {
          maptilerModule.config.apiKey = config.apiKey;
        }

        // Disable telemetry - we don't need MapTiler usage analytics
        if (maptilerModule.config) {
          maptilerModule.config.telemetry = false;
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

    // Build style - use SDK's MapStyle enum when possible
    // Using the enum instead of raw URLs may help avoid deprecated style warnings
    let style: any = options.style;
    if (!style) {
      // Default to DATAVIZ_DARK style using SDK enum if available
      style =
        this.sdk?.MapStyle?.DATAVIZ?.DARK ||
        `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${this.config?.apiKey || ''}`;
    } else if (typeof style === 'string' && !style.startsWith('http')) {
      // Convert style name to SDK enum or URL (light/dark theme + named styles)
      const styleMap: Record<string, any> = {
        light: this.sdk?.MapStyle?.DATAVIZ?.DEFAULT,
        dark: this.sdk?.MapStyle?.DATAVIZ?.DARK,
        'dataviz-dark': this.sdk?.MapStyle?.DATAVIZ?.DARK,
        dataviz: this.sdk?.MapStyle?.DATAVIZ?.DEFAULT,
        streets: this.sdk?.MapStyle?.STREETS?.DEFAULT,
        'streets-dark': this.sdk?.MapStyle?.STREETS?.DARK,
        satellite: this.sdk?.MapStyle?.SATELLITE?.DEFAULT,
        hybrid: this.sdk?.MapStyle?.HYBRID?.DEFAULT,
        outdoor: this.sdk?.MapStyle?.OUTDOOR?.DEFAULT,
        basic: this.sdk?.MapStyle?.BASIC?.DEFAULT,
      };
      style =
        styleMap[style.toLowerCase()] ||
        `https://api.maptiler.com/maps/${style}/style.json?key=${this.config?.apiKey || ''}`;
    }

    const mapOptions = {
      container,
      style,
      center: [options.lng || 0, options.lat || 0],
      zoom: options.zoom || 2,
      pitch: options.pitch || 0,
      // Limit max pitch to prevent disorienting "upside down" tilting (SDK default is 85)
      maxPitch: options.maxPitch ?? 60,
      bearing: options.bearing || 0,
      // Hide MapTiler logo for paid accounts
      maptilerLogo: false,
      // Interactive by default
      interactive: options.interactive !== false,
      // Disable all default controls - users must add them explicitly via child components
      navigationControl: false,
      geolocateControl: false,
      scaleControl: false,
      fullscreenControl: false,
      attributionControl: false,
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

  getStyleForTheme(styleName: string): string | null {
    if (!this.sdk || !this.config?.apiKey) return null;
    const key = styleName.toLowerCase();
    // Theme names and MapTiler style names
    const themeToStyle: Record<string, string> = {
      light: 'dataviz',
      dark: 'dataviz-dark',
      dataviz: 'dataviz',
      'dataviz-dark': 'dataviz-dark',
    };
    const mapName = themeToStyle[key] ?? key;
    const apiKey = this.config.apiKey;
    return `https://api.maptiler.com/maps/${mapName}/style.json?key=${apiKey}`;
  }
}
