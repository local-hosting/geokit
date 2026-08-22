/**
 * Lazy geokit map bootstrap — UI providers, MapTiler SDK, optional Mapbox API.
 */

import type * as MapTilerSdkNamespace from '@maptiler/sdk';
import type { MapTilerTransformRequest } from '../dev-proxy/maptiler-dev-proxy';

export type MapReadyPhaseHandler = (phase: string, elapsedMs?: number) => void;

export type EnsureMapReadyOptions = {
  maptiler?: {
    apiKey?: string;
    transformRequest?: MapTilerTransformRequest | null;
    initTimeoutMs?: number;
  };
  mapbox?: {
    accessToken?: string;
    defer?: boolean;
    idleTimeoutMs?: number;
  };
  /** Geocoding/isochrone API routers — false for map-only embeds (skips node-only env in browser). */
  apiRouters?: boolean | 'defer';
  importThemeCss?: boolean;
  onPhase?: MapReadyPhaseHandler;
};

type MapTilerSdkModule = typeof MapTilerSdkNamespace;

let readyPromise: Promise<void> | null = null;
let mapboxReadyPromise: Promise<void> | null = null;
let mapTilerSdkPromise: Promise<MapTilerSdkModule> | null = null;
let mapTilerSdkApiKey: string | undefined;

function phase(onPhase: MapReadyPhaseHandler | undefined, name: string, start?: number): void {
  if (!onPhase) return;
  onPhase(name, start !== undefined ? performance.now() - start : undefined);
}

/** Apply SPA-safe MapTiler SDK config (telemetry/caching off, window global). */
export function applyMapTilerSdkConfig(maptilerModule: MapTilerSdkModule, apiKey?: string): void {
  if (apiKey && maptilerModule.config) {
    maptilerModule.config.apiKey = apiKey;
  }
  const config = maptilerModule.config as
    | (typeof maptilerModule.config & { cacheApiRequests?: boolean })
    | undefined;
  if (config) {
    config.telemetry = false;
    config.caching = false;
    config.session = false;
    config.cacheApiRequests = false;
  }
  if (typeof window !== 'undefined') {
    (window as Window & { maptilersdk?: MapTilerSdkModule }).maptilersdk = maptilerModule;
  }
}

/** Start MapTiler SDK download/parse (separate chunk from geokit core). */
export function prefetchMapTilerSdk(apiKey?: string): Promise<MapTilerSdkModule> {
  if (apiKey) mapTilerSdkApiKey = apiKey;
  if (!mapTilerSdkPromise) {
    const key = apiKey ?? mapTilerSdkApiKey;
    mapTilerSdkPromise = import('@maptiler/sdk').then((module) => {
      applyMapTilerSdkConfig(module, key);
      return module;
    });
  }
  return mapTilerSdkPromise;
}

async function initMapboxProvider(accessToken?: string, maptilerApiKey?: string): Promise<void> {
  try {
    const { ensureCapabilityRoutersReady } = await import(
      '../../api/providers/setup-capability-routers'
    );
    await ensureCapabilityRoutersReady({
      mapboxAccessToken: accessToken,
      maptilerApiKey,
    });
  } catch (err) {
    console.warn('[gk-bootstrap] Failed to initialize API capability routers:', err);
  }
}

/** Ensure Mapbox API provider is ready (needed for live isochrones). */
export function ensureMapboxApiReady(accessToken?: string, maptilerApiKey?: string): Promise<void> {
  if (!mapboxReadyPromise) {
    mapboxReadyPromise = initMapboxProvider(accessToken, maptilerApiKey);
  }
  return mapboxReadyPromise;
}

async function initMapProvider(options: EnsureMapReadyOptions): Promise<void> {
  const totalStart = performance.now();
  phase(options.onPhase, 'init start');

  const maptiler = options.maptiler;
  const apiKey = maptiler?.apiKey;
  const maptilerConfig = apiKey
    ? {
        apiKey,
        ...(maptiler?.transformRequest ? { transformRequest: maptiler.transformRequest } : {}),
      }
    : null;

  const geokitStep = performance.now();
  await import('../core');
  const { configure, registerUIProvider, setUIProvider, getUIProviderByName } = await import(
    '../providers/registry'
  );
  const { MapTilerUIProvider } = await import('../providers/maptiler-provider');
  phase(options.onPhase, 'geokit core', geokitStep);

  if (maptilerConfig) {
    configure({ maptiler: maptilerConfig });
  }

  const maptilerStep = performance.now();
  const cssStep = performance.now();

  const cssImports: Promise<unknown>[] = [];
  if (options.importThemeCss !== false) {
    cssImports.push(import('../theme.css'));
    cssImports.push(import('@maptiler/sdk/dist/maptiler-sdk.css'));
  }

  await Promise.all([
    prefetchMapTilerSdk(apiKey).then(() => phase(options.onPhase, 'maptiler sdk', maptilerStep)),
    cssImports.length
      ? Promise.all(cssImports).then(() => phase(options.onPhase, 'css', cssStep))
      : Promise.resolve(),
  ]);

  const providerStep = performance.now();
  if (apiKey && maptilerConfig) {
    let maptilerProvider = getUIProviderByName('maptiler');
    if (!maptilerProvider) {
      maptilerProvider = new MapTilerUIProvider();
      registerUIProvider('maptiler', maptilerProvider);
    }
    const timeoutMs = maptiler?.initTimeoutMs ?? 8000;
    await Promise.race([
      setUIProvider('maptiler', maptilerConfig).catch((err) => {
        console.warn('[gk-bootstrap] Failed to initialize MapTiler UI provider:', err);
      }),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } else if (!apiKey) {
    console.warn('[gk-bootstrap] MapTiler apiKey not set — MapTiler features disabled.');
  }
  phase(options.onPhase, 'maptiler provider', providerStep);

  const apiRouters = options.apiRouters ?? 'defer';
  if (apiRouters !== false) {
    const mapbox = options.mapbox;
    if (apiRouters === 'defer' && mapbox?.defer !== false) {
      const idleTimeout = mapbox?.idleTimeoutMs ?? 5000;
      const runMapbox = () => {
        void ensureMapboxApiReady(mapbox?.accessToken, apiKey ?? undefined);
      };
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(runMapbox, { timeout: idleTimeout });
      } else {
        setTimeout(runMapbox, 0);
      }
    } else {
      await initMapboxProvider(mapbox?.accessToken, apiKey ?? undefined);
    }
  }

  phase(options.onPhase, 'init done', totalStart);
}

/**
 * Ensure geokit custom elements are registered and MapTiler is initialised.
 * Cached — resolves immediately on subsequent calls with the same options shape.
 */
export function ensureMapReady(options: EnsureMapReadyOptions = {}): Promise<void> {
  if (!readyPromise) {
    readyPromise = initMapProvider(options);
  }
  return readyPromise;
}

/** Reset cached bootstrap (tests only). */
export function resetMapReadyForTests(): void {
  readyPromise = null;
  mapboxReadyPromise = null;
  mapTilerSdkPromise = null;
  mapTilerSdkApiKey = undefined;
}
