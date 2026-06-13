import type { BaseAPIProvider } from './types.js';
import type { CapabilityRouterEnvOverrides } from '../../types/api-composite.js';
import {
  resolveFoursquareApiKey,
  resolveGeocodingApiKey,
  resolveGooglePlacesApiKey,
  resolveRoutingAccessToken,
} from '../../config/env/index.js';
import { createCompositeAPIProvider } from './composite-provider.js';
import { FoursquareAPIProvider } from './foursquare-provider.js';
import { GooglePlacesAPIProvider } from './google-places-provider.js';
import { MapboxAPIProvider } from './mapbox-provider.js';
import { MapTilerAPIProvider } from './maptiler-provider.js';
import {
  getAPIProvider,
  getCapabilityRouter,
  initAPIProvider,
  registerAPIProvider,
  registerCapabilityRouter,
} from './registry.js';

let capabilityRoutersReady: Promise<void> | null = null;

async function ensureMapboxProvider(accessToken?: string): Promise<BaseAPIProvider | null> {
  const token = accessToken ?? resolveRoutingAccessToken();
  if (!token) {
    return null;
  }

  if (!getAPIProvider('mapbox')) {
    registerAPIProvider('mapbox', new MapboxAPIProvider());
  }

  const mapbox = getAPIProvider('mapbox');
  if (!mapbox) {
    return null;
  }

  await initAPIProvider('mapbox', { accessToken: token });
  return mapbox;
}

async function registerCapabilityRouters(overrides?: CapabilityRouterEnvOverrides): Promise<void> {
  const geocodingChain: BaseAPIProvider[] = [];
  const placeSearchChain: BaseAPIProvider[] = [];
  const isochroneChain: BaseAPIProvider[] = [];

  const maptilerKey = overrides?.maptilerApiKey ?? resolveGeocodingApiKey();
  if (maptilerKey) {
    if (!getAPIProvider('maptiler')) {
      registerAPIProvider('maptiler', new MapTilerAPIProvider());
    }
    const maptiler = getAPIProvider('maptiler');
    if (maptiler) {
      await initAPIProvider('maptiler', { apiKey: maptilerKey });
      geocodingChain.push(maptiler);
    }
  }

  const mapbox = await ensureMapboxProvider(overrides?.mapboxAccessToken);
  if (mapbox?.geocode) {
    geocodingChain.push(mapbox);
  }
  if (mapbox?.fetchIsochrone) {
    isochroneChain.push(mapbox);
  }

  const foursquareKey = overrides?.foursquareApiKey ?? resolveFoursquareApiKey();
  if (foursquareKey) {
    if (!getAPIProvider('foursquare')) {
      registerAPIProvider('foursquare', new FoursquareAPIProvider());
    }
    const foursquare = getAPIProvider('foursquare');
    if (foursquare) {
      await initAPIProvider('foursquare', { apiKey: foursquareKey });
      placeSearchChain.push(foursquare);
    }
  }

  const googleKey = overrides?.googlePlacesApiKey ?? resolveGooglePlacesApiKey();
  if (googleKey) {
    if (!getAPIProvider('google-places')) {
      registerAPIProvider('google-places', new GooglePlacesAPIProvider());
    }
    const google = getAPIProvider('google-places');
    if (google) {
      await initAPIProvider('google-places', { apiKey: googleKey });
      placeSearchChain.push(google);
    }
  }

  if (geocodingChain.length > 0) {
    registerCapabilityRouter(
      'geocoding',
      createCompositeAPIProvider({
        name: 'composite:geocoding',
        chains: { geocoding: geocodingChain },
      })
    );
  }

  if (placeSearchChain.length > 0) {
    registerCapabilityRouter(
      'placeSearch',
      createCompositeAPIProvider({
        name: 'composite:placeSearch',
        chains: { placeSearch: placeSearchChain },
      })
    );
  }

  if (isochroneChain.length > 0) {
    registerCapabilityRouter(
      'isochrone',
      createCompositeAPIProvider({
        name: 'composite:isochrone',
        chains: { isochrone: isochroneChain },
      })
    );
  }
}

function runCapabilityBootstrap(overrides?: CapabilityRouterEnvOverrides): Promise<void> {
  if (overrides) {
    capabilityRoutersReady = registerCapabilityRouters(overrides).catch((error) => {
      capabilityRoutersReady = null;
      throw error;
    });
    return capabilityRoutersReady;
  }

  if (!capabilityRoutersReady) {
    capabilityRoutersReady = registerCapabilityRouters().catch((error) => {
      capabilityRoutersReady = null;
      throw error;
    });
  }

  return capabilityRoutersReady;
}

/** Bootstrap all capability routers that env keys allow. Re-runs when overrides are passed. */
export function ensureCapabilityRoutersReady(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  return runCapabilityBootstrap(overrides);
}

async function requireCapabilityRouter(
  capability: 'geocoding' | 'placeSearch' | 'isochrone',
  overrides: CapabilityRouterEnvOverrides | undefined,
  message: string
): Promise<void> {
  await runCapabilityBootstrap(overrides);
  if (!getCapabilityRouter(capability)) {
    throw new Error(message);
  }
}

/** Register geocoding fallback chain (MapTiler → Mapbox). */
export function ensureGeocodingRouterReady(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  return requireCapabilityRouter(
    'geocoding',
    overrides,
    'Geocoding is not configured. Set GEOKIT_MAP_API_KEY or a routing token.'
  );
}

/** Register place search fallback chain (Foursquare → Google). */
export function ensurePlaceSearchRouterReady(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  return requireCapabilityRouter(
    'placeSearch',
    overrides,
    'Place search is not configured. Set FOURSQUARE_SERVICE_API_KEY or GOOGLE_PLACES_API_KEY.'
  );
}

/** Register isochrone router (Mapbox). */
export function ensureIsochroneRouterReady(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  return requireCapabilityRouter(
    'isochrone',
    overrides,
    'Isochrone routing is not configured. Set GEOKIT_ROUTING_TOKEN or MAPBOX_TOKEN.'
  );
}

/** @internal test helper */
export function resetCapabilityRouterReady(): void {
  capabilityRoutersReady = null;
}

/** @internal test helper */
export function resetGeocodingRouterReady(): void {
  resetCapabilityRouterReady();
}
