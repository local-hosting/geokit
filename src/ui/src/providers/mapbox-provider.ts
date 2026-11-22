/**
 * Mapbox UI Provider
 *
 * Implements BaseUIProvider for Mapbox GL JS
 * Handles map rendering, controls, markers, and popups
 */

import { mapGpuCreateOptions } from '../utils/map-surface/map-gpu-budget';
import { ensureMapboxGlCss } from '../utils/map-provider-css';
import { wrapMapResize } from '../utils/map-utils';
import { getProviderConfig } from './registry';
import { resolveMapboxGlRuntime, type MapboxGlRuntime } from './mapbox-gl-runtime';
import { BaseUIProvider } from './types';
import type {
  UIProviderConfig,
  MapOptions,
  ControlOptions,
  MarkerOptions,
  PopupOptions,
} from './types';

/** Vite/Rollup ESM often exports mapbox-gl with a read-only namespace `accessToken`. */
function trySetMapboxAccessToken(sdk: unknown, token: string | undefined): void {
  if (!token || sdk == null || typeof sdk !== 'object') return;
  try {
    (sdk as { accessToken?: string }).accessToken = token;
  } catch {
    // Per-Map `accessToken` in createMap() handles bundled builds.
  }
}

export class MapboxUIProvider extends BaseUIProvider {
  protected sdk: MapboxGlRuntime | null = null;
  private sdkLoadPromise: Promise<any> | null = null;
  protected config: UIProviderConfig | null = null;

  getName(): string {
    return 'mapbox';
  }

  getCssUrl(): string | null {
    // Mapbox GL JS includes CSS in the package
    return null;
  }

  async initialize(config: UIProviderConfig): Promise<void> {
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
    const globalSdk =
      typeof window !== 'undefined' ? (window as Window & { mapboxgl?: unknown }).mapboxgl : undefined;
    if (globalSdk) {
      try {
        this.sdk = resolveMapboxGlRuntime(globalSdk);
        trySetMapboxAccessToken(this.sdk, config?.accessToken);
        return Promise.resolve(this.sdk);
      } catch {
        // Stale or partial global from a prior failed load — import again.
      }
    }

    // Load SDK dynamically
    this.sdkLoadPromise = (async () => {
      try {
        let mapboxgl: MapboxGlRuntime;
        try {
          mapboxgl = resolveMapboxGlRuntime(await import('mapbox-gl'));
        } catch {
          mapboxgl = resolveMapboxGlRuntime(await import('mapbox-gl/esm'));
        }

        trySetMapboxAccessToken(mapboxgl, config?.accessToken);

        if (typeof window !== 'undefined') {
          (window as Window & { mapboxgl?: MapboxGlRuntime }).mapboxgl = mapboxgl;
        }

        this.sdk = mapboxgl;
        return this.sdk;
      } catch (error) {
        console.error('[gk-mapbox] Failed to load Mapbox GL JS:', error);
        throw error;
      }
    })();

    return this.sdkLoadPromise;
  }

  async createMap(container: HTMLElement, options: MapOptions): Promise<any> {
    if (!this.sdk || typeof this.sdk.Map !== 'function') {
      this.sdk = null;
      this.sdkLoadPromise = null;
      await this.initialize(this.config || {});
    }
    if (!this.sdk || typeof this.sdk.Map !== 'function') {
      throw new Error('Mapbox GL JS Map constructor not available after initialize()');
    }

    // Vite injects CSS as <style> (no href); Mapbox warns without the canary rule.
    await ensureMapboxGlCss();

    const accessToken = this.config?.accessToken?.trim();
    if (!accessToken) {
      throw new Error('Mapbox access token is required. Call initialize() with accessToken first.');
    }
    trySetMapboxAccessToken(this.sdk, accessToken);

    // Build style: theme-keyed / configured style URL wins over stock Mapbox theme names.
    let style = options.style;
    if (
      !style ||
      (typeof style === 'string' && !style.startsWith('mapbox://') && !style.startsWith('http'))
    ) {
      const fromTheme = this.resolveConfiguredStyleUrl(typeof style === 'string' ? style : 'streets');
      if (fromTheme) {
        style = fromTheme;
      } else {
        const key = (style || 'streets').toLowerCase();
        const styleMap: Record<string, string> = {
          light: 'mapbox://styles/mapbox/light-v11',
          dark: 'mapbox://styles/mapbox/dark-v11',
          dataviz: 'mapbox://styles/mapbox/light-v11',
          'dataviz-dark': 'mapbox://styles/mapbox/dark-v11',
          streets: 'mapbox://styles/mapbox/streets-v12',
          satellite: 'mapbox://styles/mapbox/satellite-v9',
          'satellite-streets': 'mapbox://styles/mapbox/satellite-streets-v12',
          outdoors: 'mapbox://styles/mapbox/outdoors-v12',
        };
        style = styleMap[key] ?? 'mapbox://styles/mapbox/streets-v12';
      }
    }

    const mapOptions = {
      accessToken,
      container,
      style,
      center: [options.lng || 0, options.lat || 0] as [number, number],
      zoom: options.zoom || 2,
      // Zoom limits (prevent zooming out/in too far)
      ...(options.minZoom !== undefined && { minZoom: options.minZoom }),
      ...(options.maxZoom !== undefined && { maxZoom: options.maxZoom }),
      pitch: options.pitch || 0,
      // Limit max pitch to prevent disorienting "upside down" tilting (SDK default is 85)
      maxPitch: options.maxPitch ?? 60,
      bearing: options.bearing || 0,
      // Interactive by default
      interactive: options.interactive !== false,
      // Disable all default controls - users must add them explicitly via child components
      attributionControl: false,
      ...mapGpuCreateOptions(),
      // Spread any extra options
      ...(options.extra || {}),
    };

    const suppressedWarnings = [
      'map container element should be empty',
      'sun direction is attached to a light with viewport anchor',
    ];
    const originalWarn = console.warn;
    const filteredWarn = (...args: unknown[]) => {
      const message = args.map(String).join(' ');
      if (suppressedWarnings.some((snippet) => message.includes(snippet))) {
        return;
      }
      originalWarn.apply(console, args);
    };
    console.warn = filteredWarn;

    const map = new this.sdk.Map(mapOptions);
    wrapMapResize(map);

    const mapWithRemove = map as { once?: (event: string, fn: () => void) => void };
    mapWithRemove.once?.('remove', () => {
      console.warn = originalWarn;
    });

    return map;
  }

  createControl(type: string, options: ControlOptions): any {
    if (!this.sdk) {
      throw new Error('Mapbox GL JS not initialized. Call initialize() first.');
    }

    switch (type) {
      case 'navigation': {
        const showCompass = options.showCompass !== false;
        return new this.sdk.NavigationControl({
          showCompass,
          showZoom: options.showZoom !== false,
          visualizePitch: showCompass,
        });
      }

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

  /** Prefer theme-keyed `styleUrls`, then single `styleUrl`, from instance or registry config. */
  protected resolveConfiguredStyleUrl(styleName: string): string | null {
    const merged = {
      ...(getProviderConfig('mapbox') || {}),
      ...(this.config || {}),
    } as UIProviderConfig;
    const urls = merged.styleUrls;
    if (urls) {
      const key = styleName.toLowerCase();
      const dark = key === 'dark' || key === 'dataviz-dark';
      const picked = (dark ? urls.dark : urls.light)?.trim() || urls.light?.trim() || urls.dark?.trim();
      if (picked) return picked;
    }
    const single = merged.styleUrl?.trim();
    return single || null;
  }

  getStyleForTheme(styleName: string): string | null {
    const configured = this.resolveConfiguredStyleUrl(styleName);
    if (configured) return configured;
    const key = styleName.toLowerCase();
    const themeToStyle: Record<string, string> = {
      light: 'mapbox://styles/mapbox/light-v11',
      dark: 'mapbox://styles/mapbox/dark-v11',
      dataviz: 'mapbox://styles/mapbox/light-v11',
      'dataviz-dark': 'mapbox://styles/mapbox/dark-v11',
    };
    return themeToStyle[key] ?? null;
  }
}
