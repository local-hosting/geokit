import type { APICapability, BaseAPIProvider } from '../providers/types.js';

/** Ordered provider list per capability for fallback routing. */
export type CapabilityProviderChain = Partial<Record<APICapability, BaseAPIProvider[]>>;

export interface CompositeAPIProviderOptions {
  /** Registry name, e.g. composite:geocoding */
  name: string;
  chains: CapabilityProviderChain;
}

/** Optional env overrides for capability router bootstrap (browser init). */
export interface CapabilityRouterEnvOverrides {
  maptilerApiKey?: string;
  mapboxAccessToken?: string;
  foursquareApiKey?: string;
  googlePlacesApiKey?: string;
}
