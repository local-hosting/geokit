/**
 * Protomaps UI provider.
 *
 * MapLibre GL JS with either the hosted basemap API
 * (https://api.protomaps.com/styles/v5/{flavor}/{lang}.json?key=…)
 * or a PMTiles archive via the `pmtiles://` protocol.
 */

import { mapGpuCreateOptions } from '../utils/map-surface/map-gpu-budget';
import { wrapMapResize } from '../utils/map-utils';
import { getProviderConfig } from './registry';
import { BaseUIProvider } from './types';
import type {
  ControlOptions,
  MapInstance,
  MapOptions,
  MarkerOptions,
  PopupOptions,
  UIProviderConfig,
} from './types';

export const PROTOMAPS_FLAVORS = ['light', 'dark', 'white', 'black', 'grayscale', 'contrast'] as const;

export type ProtomapsFlavor = (typeof PROTOMAPS_FLAVORS)[number];

const HOSTED_STYLE_BASE = 'https://api.protomaps.com/styles/v5';
const GLYPHS_URL = 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_BASE = 'https://protomaps.github.io/basemaps-assets/sprites/v4';
const PROTOMAPS_ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

const STYLE_FLAVORS: Record<string, ProtomapsFlavor> = {
  light: 'light',
  dark: 'dark',
  streets: 'light',
  'streets-dark': 'dark',
  basic: 'light',
  outdoor: 'light',
  dataviz: 'white',
  'dataviz-dark': 'black',
  white: 'white',
  black: 'black',
  grayscale: 'grayscale',
  grey: 'grayscale',
  gray: 'grayscale',
  contrast: 'contrast',
  satellite: 'light',
  hybrid: 'light',
};

type MapLibreModule = {
  Map: new (options: Record<string, unknown>) => { resize?: () => void };
  NavigationControl: new (options: Record<string, unknown>) => unknown;
  ScaleControl: new (options: Record<string, unknown>) => unknown;
  FullscreenControl: new (options: Record<string, unknown>) => unknown;
  GeolocateControl: new (options: Record<string, unknown>) => unknown;
  Marker: new (options: MarkerOptions) => unknown;
  Popup: new (options: PopupOptions) => unknown;
  addProtocol?: (scheme: string, handler: ProtocolTile) => void;
  default?: MapLibreModule;
};

type ProtocolTile = (params: unknown, abortController: AbortController) => Promise<unknown>;

type BasemapsApi = {
  layers: (source: string, flavor: unknown, options: { lang: string }) => unknown[];
  namedFlavor: (name: string) => unknown;
};

let pmtilesProtocolReady: Promise<void> | null = null;
let basemapsModule: BasemapsApi | null = null;

export function protomapsFlavorForStyle(styleName: string | undefined): ProtomapsFlavor {
  const key = (styleName ?? '').trim().toLowerCase();
  if (!key) return 'light';
  const mapped = STYLE_FLAVORS[key];
  if (mapped) return mapped;
  if ((PROTOMAPS_FLAVORS as readonly string[]).includes(key)) return key as ProtomapsFlavor;
  return 'light';
}

export function protomapsLabelLanguage(lang: string | undefined): string {
  const value = lang?.trim().toLowerCase();
  if (value && /^[a-z]{2}$/.test(value)) return value;
  return 'en';
}

export function buildProtomapsHostedStyleUrl(
  flavor: ProtomapsFlavor,
  lang: string,
  apiKey: string
): string {
  const language = protomapsLabelLanguage(lang);
  return `${HOSTED_STYLE_BASE}/${flavor}/${language}.json?key=${encodeURIComponent(apiKey)}`;
}

function pmtilesSourceUrl(archiveUrl: string): string {
  const trimmed = archiveUrl.trim();
  if (trimmed.startsWith('pmtiles://')) return trimmed;
  return `pmtiles://${trimmed}`;
}

function explicitStyle(optionStyle: string | undefined, styleUrl: string | undefined): string | null {
  const candidate = optionStyle?.trim();
  if (
    candidate &&
    (candidate.startsWith('http://') ||
      candidate.startsWith('https://') ||
      candidate.startsWith('pmtiles://'))
  ) {
    return candidate;
  }
  const configured = styleUrl?.trim();
  return configured || null;
}

function archiveFlavor(basemaps: BasemapsApi, flavor: ProtomapsFlavor): { name: string; flavor: unknown } {
  try {
    const direct = basemaps.namedFlavor(flavor);
    if (direct) return { name: flavor, flavor: direct };
  } catch {
    // Flavor is hosted-only; fall through to light.
  }
  return { name: 'light', flavor: basemaps.namedFlavor('light') };
}

export function buildPmtilesStyle(
  basemaps: BasemapsApi,
  archiveUrl: string,
  flavor: ProtomapsFlavor,
  lang: string
): Record<string, unknown> {
  const resolved = archiveFlavor(basemaps, flavor);
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: `${SPRITE_BASE}/${resolved.name}`,
    sources: {
      protomaps: {
        type: 'vector',
        url: pmtilesSourceUrl(archiveUrl),
        attribution: PROTOMAPS_ATTRIBUTION,
      },
    },
    layers: basemaps.layers('protomaps', resolved.flavor, { lang: protomapsLabelLanguage(lang) }),
  };
}

function mapLibreFromModule(mod: unknown): MapLibreModule {
  const candidate = mod as MapLibreModule;
  if (typeof candidate.Map === 'function') return candidate;
  if (candidate.default && typeof candidate.default.Map === 'function') return candidate.default;
  throw new Error('maplibre-gl did not export Map');
}

async function loadBasemaps(): Promise<BasemapsApi> {
  if (basemapsModule) return basemapsModule;
  const mod = (await import('@protomaps/basemaps')) as BasemapsApi & { default?: BasemapsApi };
  const api = typeof mod.layers === 'function' ? mod : mod.default;
  if (!api || typeof api.layers !== 'function' || typeof api.namedFlavor !== 'function') {
    throw new Error('@protomaps/basemaps did not export layers and namedFlavor');
  }
  basemapsModule = api;
  return api;
}

async function ensurePmtilesProtocol(sdk: MapLibreModule): Promise<void> {
  if (!pmtilesProtocolReady) {
    pmtilesProtocolReady = (async () => {
      const { Protocol } = await import('pmtiles');
      const protocol = new Protocol();
      if (typeof sdk.addProtocol !== 'function') {
        throw new Error('maplibre-gl addProtocol is unavailable');
      }
      sdk.addProtocol('pmtiles', protocol.tile as ProtocolTile);
    })().catch((error) => {
      pmtilesProtocolReady = null;
      throw error;
    });
  }
  await pmtilesProtocolReady;
}

function withSuppressedEmptyContainerWarning<T>(create: () => T): T {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = args.map((part) => String(part)).join(' ');
    if (message.includes('map container element should be empty')) return;
    originalWarn.apply(console, args);
  };
  try {
    return create();
  } finally {
    console.warn = originalWarn;
  }
}

export class ProtomapsUIProvider extends BaseUIProvider {
  private sdkLoadPromise: Promise<MapLibreModule> | null = null;
  private maplibre: MapLibreModule | null = null;

  getName(): string {
    return 'protomaps';
  }

  getCssUrl(): string | null {
    return null;
  }

  private resolvedConfig(): UIProviderConfig {
    return { ...getProviderConfig('protomaps'), ...this.config };
  }

  async initialize(config: UIProviderConfig): Promise<void> {
    this.config = { ...(this.config ?? {}), ...config };
    if (this.sdkLoadPromise) {
      await this.sdkLoadPromise;
    } else if (!this.maplibre) {
      this.sdkLoadPromise = import('maplibre-gl').then((mod) => {
        const sdk = mapLibreFromModule(mod);
        if (typeof window !== 'undefined') {
          (window as unknown as { maplibregl?: MapLibreModule }).maplibregl = sdk;
        }
        this.maplibre = sdk;
        this.sdk = sdk;
        return sdk;
      });
      await this.sdkLoadPromise;
    }

    const pmtilesUrl = this.resolvedConfig().pmtilesUrl;
    if (typeof pmtilesUrl === 'string' && pmtilesUrl.trim() && this.maplibre) {
      await ensurePmtilesProtocol(this.maplibre);
      await loadBasemaps();
    }
  }

  async createMap(container: HTMLElement, options: MapOptions): Promise<MapInstance> {
    if (!this.maplibre) await this.initialize(this.config || {});
    const sdk = this.maplibre;
    if (!sdk) throw new Error('MapLibre GL JS not initialized. Call initialize() first.');

    const config = this.resolvedConfig();
    const flavor = protomapsFlavorForStyle(options.style);
    const lang = protomapsLabelLanguage(config.labelLanguage);
    const pinned = explicitStyle(options.style, config.styleUrl);
    let style: string | Record<string, unknown>;

    if (pinned) {
      style = pinned;
      if (pinned.startsWith('pmtiles://') || (config.pmtilesUrl && config.pmtilesUrl.trim())) {
        await ensurePmtilesProtocol(sdk);
      }
    } else if (config.pmtilesUrl?.trim()) {
      await ensurePmtilesProtocol(sdk);
      style = buildPmtilesStyle(await loadBasemaps(), config.pmtilesUrl.trim(), flavor, lang);
    } else if (config.apiKey?.trim()) {
      style = buildProtomapsHostedStyleUrl(flavor, lang, config.apiKey.trim());
    } else {
      throw new Error(
        'Protomaps requires an API key, styleUrl, or pmtilesUrl. Set PROTOMAPS_KEY or provider="protomaps".'
      );
    }

    const mapOptions: Record<string, unknown> = {
      container,
      style,
      center: [options.lng || 0, options.lat || 0],
      zoom: options.zoom || 2,
      ...(options.minZoom !== undefined && { minZoom: options.minZoom }),
      ...(options.maxZoom !== undefined && { maxZoom: options.maxZoom }),
      pitch: options.pitch || 0,
      maxPitch: options.maxPitch ?? 60,
      bearing: options.bearing || 0,
      interactive: options.interactive !== false,
      attributionControl: false,
      ...mapGpuCreateOptions(),
      ...(options.extra || {}),
    };

    const map = withSuppressedEmptyContainerWarning(() => new sdk.Map(mapOptions));
    wrapMapResize(map);
    return map as MapInstance;
  }

  createControl(type: string, options: ControlOptions) {
    const sdk = this.maplibre;
    if (!sdk) throw new Error('MapLibre GL JS not initialized. Call initialize() first.');
    switch (type) {
      case 'navigation':
        return new sdk.NavigationControl({
          showCompass: options.showCompass !== false,
          showZoom: options.showZoom !== false,
          visualizePitch: true,
        });
      case 'scale':
        return new sdk.ScaleControl({
          maxWidth: 100,
          unit: options.unit || 'metric',
        });
      case 'fullscreen':
        return new sdk.FullscreenControl({
          container: options.container ? document.querySelector(options.container) : undefined,
        });
      case 'geolocate':
        return new sdk.GeolocateControl({
          trackUserLocation: options.trackUserLocation || false,
          showAccuracyCircle: options.showAccuracyCircle !== false,
          showUserHeading: options.showUserHeading || false,
        });
      default:
        throw new Error(`Unknown control type: ${type}`);
    }
  }

  createMarker(options: MarkerOptions) {
    if (!this.maplibre) throw new Error('MapLibre GL JS not initialized. Call initialize() first.');
    return new this.maplibre.Marker(options);
  }

  createPopup(options: PopupOptions) {
    if (!this.maplibre) throw new Error('MapLibre GL JS not initialized. Call initialize() first.');
    return new this.maplibre.Popup(options);
  }

  getSDK() {
    return this.sdk;
  }

  getStyleForTheme(styleName: string): string | Record<string, unknown> | null {
    const config = this.resolvedConfig();
    if (config.styleUrl?.trim()) return config.styleUrl.trim();
    const flavor = protomapsFlavorForStyle(styleName);
    const lang = protomapsLabelLanguage(config.labelLanguage);
    if (config.pmtilesUrl?.trim() && basemapsModule) {
      return buildPmtilesStyle(basemapsModule, config.pmtilesUrl.trim(), flavor, lang);
    }
    if (!config.apiKey?.trim()) return null;
    return buildProtomapsHostedStyleUrl(flavor, lang, config.apiKey.trim());
  }
}

/** Test hook — protocol registration is process-wide. */
export function resetProtomapsProviderForTests(): void {
  pmtilesProtocolReady = null;
  basemapsModule = null;
}
