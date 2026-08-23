import type { CapabilityRouterEnvOverrides } from './types/api-composite.js';
import { getCapabilityRouter } from './providers/registry.js';
import { rebuildCapabilityRouters, resetCapabilityRouterReady } from './providers/capability-router-rebuild.js';
import { registerFoursquarePlugin } from '@geokit/plugin-foursquare';
import { registerGooglePlacesPlugin } from '@geokit/plugin-google';
import { registerMapTilerPlugin } from '@geokit/plugin-maptiler';
import { registerMapboxPlugin } from '@geokit/plugin-mapbox';

let capabilityRoutersReady: Promise<void> | null = null;
let lastOverrides: CapabilityRouterEnvOverrides | undefined;

/** Register built-in provider plugins when env keys are present. */
export async function registerDefaultPlugins(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  await registerMapTilerPlugin(overrides);
  await registerMapboxPlugin(overrides);
  await registerFoursquarePlugin(overrides);
  await registerGooglePlacesPlugin(overrides);
}

async function bootstrapCapabilityRouters(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  await registerDefaultPlugins(overrides);
  await rebuildCapabilityRouters();
}

function scheduleBootstrap(overrides?: CapabilityRouterEnvOverrides): Promise<void> {
  lastOverrides = overrides;
  capabilityRoutersReady = bootstrapCapabilityRouters(overrides).catch((error) => {
    capabilityRoutersReady = null;
    throw error;
  });
  return capabilityRoutersReady;
}

/** Bootstrap default plugins and composite routers from env keys. */
export function ensureCapabilityRoutersReady(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  if (overrides) {
    return scheduleBootstrap(overrides);
  }
  if (!capabilityRoutersReady) {
    return scheduleBootstrap();
  }
  return capabilityRoutersReady;
}

async function requireCapabilityRouter(
  capability: 'geocoding' | 'placeSearch' | 'isochrone',
  overrides: CapabilityRouterEnvOverrides | undefined,
  message: string
): Promise<void> {
  await ensureCapabilityRoutersReady(overrides);
  if (!getCapabilityRouter(capability)) {
    throw new Error(message);
  }
}

export function ensureGeocodingRouterReady(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  return requireCapabilityRouter(
    'geocoding',
    overrides,
    'Geocoding is not configured. Set GEOKIT_MAP_API_KEY or a routing token.'
  );
}

export function ensurePlaceSearchRouterReady(
  overrides?: CapabilityRouterEnvOverrides
): Promise<void> {
  return requireCapabilityRouter(
    'placeSearch',
    overrides,
    'Place search is not configured. Set FOURSQUARE_SERVICE_API_KEY, GOOGLE_PLACES_API_KEY, or register a placeSearch plugin.'
  );
}

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
export function resetGeocodingRouterReady(): void {
  resetCapabilityRouterReady();
}
