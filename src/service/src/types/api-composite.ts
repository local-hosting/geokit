import type { ServiceCapability } from '../services/types';
import type { Service } from '../services/service';

/** Ordered provider list per capability for fallback routing. */
export type CapabilityServiceChain = Partial<Record<ServiceCapability, Service[]>>;

export interface CompositeServiceOptions {
  /** Registry name, e.g. composite:geocoding */
  name: string;
  chains: CapabilityServiceChain;
}

/** Optional env overrides for capability router bootstrap (browser init). */
export interface CapabilityRouterEnvOverrides {
  maptilerApiKey?: string;
  mapboxAccessToken?: string;
  foursquareApiKey?: string;
  /** Same-origin proxy prefix or absolute Places API base (browser CORS bypass). */
  foursquarePlacesApiBase?: string;
  googlePlacesApiKey?: string;
  hereApiKey?: string;
  esriApiKey?: string;
}
