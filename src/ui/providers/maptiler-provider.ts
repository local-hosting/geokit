/**
 * MapTiler UI Provider
 *
 * Implements BaseUIProvider for MapTiler SDK
 * Handles map rendering, controls, markers, and popups.
 * Supports loading the SDK from a script URL (e.g. CDN UMD) via config.sdkScriptUrl;
 * the script must set window.maptilersdk.
 */

import { buildMaptilerStyleUrl } from '../../config/tile-cdn.js';
import {
  inlineMapTilerTileJsonSources,
  rewriteMapTilerStyleResourceUrls,
} from '../dev-proxy/maptiler-dev-proxy';
import { BaseUIProvider } from './types';
import { getProviderConfig } from './registry';
import { wrapMapResize } from '../utils/map-utils';

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

/** Max number of style URLs to cache (one per theme/map name). */
const MAX_STYLE_CACHE = 8;
/** Cache: MapTiler style URL -> promise of parsed style object. Shared across all maps to avoid N duplicate fetches. */
const styleCache = new Map<string, Promise<Record<string, unknown>>>();

function isMapTilerStyleUrl(url: string): boolean {
  return (
    typeof url === 'string' &&
    url.includes('/style.json') &&
    (url.startsWith('https://') ||
      url.startsWith('http://') ||
      url.startsWith('/__maptiler-api/') ||
      url.includes('/maps/'))
  );
}

/**
 * Fetch a MapTiler style URL once and cache the parsed object. Reused by every map using that URL
 * so Safari (and all browsers) don't issue N identical style.json requests for the pool.
 */
type MapTilerRequestTransform = (url: string, resourceType?: string) => { url: string };

async function getStyleObject(url: string): Promise<Record<string, unknown>> {
  let promise = styleCache.get(url);
  if (!promise) {
    promise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Style fetch failed: ${r.status}`);
        return r.json() as Promise<Record<string, unknown>>;
      })
      .then((obj) => {
        if (obj && typeof obj === 'object' && 'version' in obj) return obj;
        throw new Error('Invalid style JSON');
      });
    styleCache.set(url, promise);
    if (styleCache.size > MAX_STYLE_CACHE) {
      const firstKey = styleCache.keys().next().value;
      if (firstKey !== undefined) styleCache.delete(firstKey);
    }
  }
  return promise;
}

/** Fetch style via dev proxy and rewrite embedded MapTiler URLs for worker tile loads. */
async function getProxiedStyleObject(
  url: string,
  transformRequest: MapTilerRequestTransform
): Promise<Record<string, unknown>> {
  const cacheKey = `proxied:${url}`;
  let promise = styleCache.get(cacheKey);
  if (!promise) {
    promise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Style fetch failed: ${r.status}`);
        return r.json() as Promise<Record<string, unknown>>;
      })
      .then(async (obj) => {
        if (!obj || typeof obj !== 'object' || !('version' in obj)) {
          throw new Error('Invalid style JSON');
        }
        rewriteMapTilerStyleResourceUrls(obj, transformRequest);
        await inlineMapTilerTileJsonSources(obj, transformRequest);
        return obj;
      });
    styleCache.set(cacheKey, promise);
    if (styleCache.size > MAX_STYLE_CACHE) {
      const firstKey = styleCache.keys().next().value;
      if (firstKey !== undefined) styleCache.delete(firstKey);
    }
  }
  return promise;
}

/**
 * True if the value is valid for MapTiler/MapLibre setStyle (URL, StyleSpec object, or JSON string).
 * Used to no-op setStyle when the SDK passes an invalid value (e.g. style name during remove()).
 */
function isValidStyleForSetStyle(style: unknown): boolean {
  if (style == null) return false;
  if (typeof style === 'string') {
    if (style.trim() === '') return false;
    if (style.startsWith('http://') || style.startsWith('https://')) return true;
    if (style.trimStart().startsWith('{')) return true; // JSON StyleSpec string
    return false; // style name (e.g. "Streets Default v2") is invalid for setStyle
  }
  if (typeof style === 'object' && 'version' in style) return true; // StyleSpec object
  return false;
}

import { withSuppressedMaptilerConsole } from './maptiler-console-suppress.js';

export class MapTilerUIProvider extends BaseUIProvider {
  protected sdk: any = null;
  private sdkLoadPromise: Promise<any> | null = null;
  protected config: MapProviderConfig | null = null;

  getName(): string {
    return 'maptiler';
  }

  /** True when SDK module is loaded (instance or window.maptilersdk). */
  isInitialized(): boolean {
    return Boolean(this.sdk || (typeof window !== 'undefined' && (window as any).maptilersdk));
  }

  getCssUrl(): string | null {
    // MapTiler SDK includes CSS in the package
    return null;
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = { ...(this.config ?? {}), ...config };

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
        let maptilerModule: any;

        await withSuppressedMaptilerConsole(
          async () => {
            if (typeof window !== 'undefined' && config?.sdkScriptUrl) {
              // Load from CDN/script URL (script must set window.maptilersdk)
              maptilerModule = await loadScriptAndGetGlobal(config.sdkScriptUrl, 'maptilersdk');
            } else {
              // Dynamic import of MapTiler SDK from bundle
              maptilerModule = await import('@maptiler/sdk');
            }
          },
          { suppressApiKeyWarning: !config?.apiKey }
        );

        // Set API key if provided
        if (config?.apiKey && maptilerModule.config) {
          maptilerModule.config.apiKey = config.apiKey;
        }

        // Disable telemetry - we don't need MapTiler usage analytics
        if (maptilerModule.config) {
          maptilerModule.config.telemetry = false;
          // Disable local tile caching — the localcache_source:// protocol
          // breaks in SPA apps with path-based routing
          maptilerModule.config.caching = false;
          maptilerModule.config.session = false;
          maptilerModule.config.cacheApiRequests = false;
        }

        // Expose to window for backward compatibility
        if (typeof window !== 'undefined') {
          (window as any).maptilersdk = maptilerModule;
        }

        this.sdk = maptilerModule;
        return this.sdk;
      } catch (error) {
        console.error('[gk-maptiler] Failed to load MapTiler SDK:', error);
        throw error;
      }
    })();

    return this.sdkLoadPromise;
  }

  /**
   * Create a Map instance. Options follow MapTiler SDK MapOptions:
   * https://docs.maptiler.com/sdk-js/api/map/
   * - center as [lng, lat] (GeoJSON order)
   * - style as URL or style name (SDK resolves names when apiKey is set)
   * - apiKey in options is equivalent to config.apiKey
   */
  async createMap(container: HTMLElement, options: MapOptions): Promise<any> {
    if (!this.sdk) {
      await this.initialize(this.config || {});
    }

    const apiKey = this.config?.apiKey || '';
    if (apiKey && this.sdk?.config) {
      this.sdk.config.apiKey = apiKey;
    }

    const transformRequest =
      this.config?.transformRequest ?? getProviderConfig('maptiler')?.transformRequest;

    const styleBase = (name: string) => buildMaptilerStyleUrl(name, apiKey);

    const configuredStyleUrl = this.config?.styleUrl ?? getProviderConfig('maptiler')?.styleUrl;

    // Style: configured URL, full URL, or resolve known names to URLs
    let style: string = options.style ?? '';
    if (!style && configuredStyleUrl) {
      style = configuredStyleUrl;
    } else if (!style) {
      style = styleBase('dataviz-dark');
    } else if (typeof style === 'string' && !style.startsWith('http')) {
      const styleMap: Record<string, string> = {
        light: styleBase('dataviz'),
        dark: styleBase('dataviz-dark'),
        'dataviz-dark': styleBase('dataviz-dark'),
        'backdrop-dark': styleBase('backdrop-dark'),
        dataviz: styleBase('dataviz'),
        streets: styleBase('streets'),
        'streets-dark': styleBase('streets-dark'),
        satellite: styleBase('satellite'),
        hybrid: styleBase('hybrid'),
        outdoor: styleBase('outdoor'),
        basic: styleBase('basic'),
      };
      style = styleMap[style.toLowerCase()] ?? styleBase(style);
    }

    // Shared style object avoids N duplicate style.json fetches (Safari). When transformRequest is
    // set (host dev proxy), fetch once and rewrite embedded source URLs — workers otherwise
    // request api.maptiler.com TileJSON without Referer and referrer-locked keys return 403.
    let styleOption: string | Record<string, unknown> = style;
    if (typeof style === 'string' && isMapTilerStyleUrl(style)) {
      const styleFetchUrl =
        typeof transformRequest === 'function' ? transformRequest(style, 'Style').url : style;
      if (typeof transformRequest === 'function') {
        try {
          styleOption = await getProxiedStyleObject(styleFetchUrl, transformRequest);
        } catch (e) {
          console.warn('[gk-maptiler] Proxied style fetch failed, using URL:', e);
          styleOption = styleFetchUrl;
        }
      } else {
        try {
          styleOption = await getStyleObject(styleFetchUrl);
        } catch (e) {
          console.warn('[gk-maptiler] Style cache fetch failed, using URL:', e);
        }
      }
    }

    const mapOptions: Record<string, unknown> = {
      container,
      style: styleOption,
      center: [options.lng ?? 0, options.lat ?? 0],
      zoom: options.zoom ?? 2,
      ...(options.minZoom !== undefined && { minZoom: options.minZoom }),
      ...(options.maxZoom !== undefined && { maxZoom: options.maxZoom }),
      pitch: options.pitch ?? 0,
      maxPitch: options.maxPitch ?? 60,
      bearing: options.bearing ?? 0,
      maptilerLogo: false,
      interactive: options.interactive !== false,
      navigationControl: false,
      geolocateControl: false,
      scaleControl: false,
      fullscreenControl: false,
      attributionControl: false,
      ...(options.extra || {}),
      terrain: false,
      terrainControl: false,
    };
    if (apiKey) {
      mapOptions.apiKey = apiKey;
    }
    if (typeof transformRequest === 'function') {
      mapOptions.transformRequest = transformRequest;
    }

    // Ensure caching stays off right before map creation
    if (this.sdk?.config) {
      this.sdk.config.caching = false;
      this.sdk.config.session = false;
    }

    const map = new this.sdk.Map(mapOptions);

    wrapMapResize(map);

    if (typeof map.disableTerrain === 'function') {
      try {
        map.disableTerrain();
      } catch {
        /* ignore */
      }
    }
    if (typeof map.setTerrain === 'function') {
      try {
        map.setTerrain(null);
      } catch {
        /* ignore */
      }
    }

    // Disable caching again after construction (SDK constructor may re-enable)
    if (this.sdk?.config) {
      this.sdk.config.caching = false;
      this.sdk.config.session = false;
    }

    // Wrap setStyle so invalid values are no-oped. MapTiler SDK's remove() calls setStyle()
    // with its default variant ("Streets Default v2"), which is deprecated and invalid for
    // setStyle (expects URL or StyleSpec). No-oping avoids deprecation and "Invalid style" logs.
    const originalSetStyle = map.setStyle?.bind(map);
    if (typeof originalSetStyle === 'function') {
      map.setStyle = (s: unknown) => {
        if (isValidStyleForSetStyle(s)) {
          return originalSetStyle(s);
        }
      };
    }

    return map;
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
    const configuredStyleUrl = this.config?.styleUrl ?? getProviderConfig('maptiler')?.styleUrl;
    if (configuredStyleUrl) return configuredStyleUrl;

    if (!this.sdk || !this.config?.apiKey) return null;
    const key = styleName.toLowerCase();
    const themeToStyle: Record<string, string> = {
      light: 'dataviz',
      dark: 'dataviz-dark',
      dataviz: 'dataviz',
      'dataviz-dark': 'dataviz-dark',
    };
    const mapName = themeToStyle[key] ?? key;
    return buildMaptilerStyleUrl(mapName, this.config.apiKey);
  }
}
