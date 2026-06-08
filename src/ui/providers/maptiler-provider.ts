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

/** Max number of style URLs to cache (one per theme/map name). */
const MAX_STYLE_CACHE = 8;
/** Cache: MapTiler style URL -> promise of parsed style object. Shared across all maps to avoid N duplicate fetches. */
const styleCache = new Map<string, Promise<Record<string, unknown>>>();

function isMapTilerStyleUrl(url: string): boolean {
  return (
    typeof url === 'string' &&
    (url.startsWith('https://api.maptiler.com/') || url.startsWith('http://api.maptiler.com/')) &&
    url.includes('/style.json')
  );
}

/**
 * Fetch a MapTiler style URL once and cache the parsed object. Reused by every map using that URL
 * so Safari (and all browsers) don't issue N identical style.json requests for the pool.
 */
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

/**
 * Suppress MapTiler SDK version banner ("❖❖❖ MapTiler SDK JS vX.X.X ❖❖❖") from console.
 * Call once per session; idempotent.
 */
function suppressMaptilerBanner(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__geokitMaptilerBannerSuppressed) return;
  (window as any).__geokitMaptilerBannerSuppressed = true;

  const bannerPattern = /maptiler\s+sdk\s+js|v\d+\.\d+\.\d+/i;
  const wrap = (original: typeof console.log, _method: 'log' | 'warn') => {
    return function (this: typeof console, ...args: unknown[]) {
      try {
        const msg = Array.isArray(args)
          ? args.map((x) => String(x)).join(' ')
          : String(args?.[0] ?? '');
        if (typeof msg === 'string' && bannerPattern.test(msg)) return;
      } catch {
        /* ignore */
      }
      original.apply(this, args);
    };
  };
  console.log = wrap(console.log.bind(console), 'log');
  console.warn = wrap(console.warn.bind(console), 'warn');
}

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
    this.config = { ...(this.config ?? {}), ...config };

    // Suppress banner early - before any SDK method might log it
    suppressMaptilerBanner();

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
        console.error('Failed to load MapTiler SDK:', error);
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

    const transformRequest = this.config?.transformRequest;

    const styleBase = (name: string) =>
      `https://api.maptiler.com/maps/${name}/style.json?key=${apiKey}`;

    // Style: full URL, or resolve known names to URLs (SDK accepts both; URLs avoid deprecated enum values)
    let style: string = options.style ?? '';
    if (!style) {
      style = styleBase('dataviz-dark');
    } else if (typeof style === 'string' && !style.startsWith('http')) {
      const styleMap: Record<string, string> = {
        light: styleBase('dataviz'),
        dark: styleBase('dataviz-dark'),
        'dataviz-dark': styleBase('dataviz-dark'),
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
    // set (Fieldwise dev proxy), pass a proxied URL — cached objects embed absolute api.maptiler.com
    // tile URLs that workers fetch without Referer, so isStyleLoaded() never completes.
    let styleOption: string | Record<string, unknown> = style;
    if (typeof style === 'string' && isMapTilerStyleUrl(style)) {
      const styleFetchUrl =
        typeof transformRequest === 'function' ? transformRequest(style, 'Style').url : style;
      if (typeof transformRequest === 'function') {
        styleOption = styleFetchUrl;
      } else {
        try {
          styleOption = await getStyleObject(styleFetchUrl);
        } catch (e) {
          console.warn('[MapTiler] Style cache fetch failed, using URL:', e);
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
