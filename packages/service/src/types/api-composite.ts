import type { ServiceCapability } from '../services/types.js';
import type { Service } from '../services/service.js';

/** Ordered provider list per capability for fallback routing. */
export type CapabilityProviderChain = Partial<Record<ServiceCapability, Service[]>>;

export interface CompositeServiceOptions {
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
  hereApiKey?: string;
  esriApiKey?: string;
}
