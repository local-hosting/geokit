/**
 * API Providers
 *
 * Exports all API providers for services
 */

// Re-export types and registry
export * from './types';
export * from './registry';
export { CompositeAPIProvider, createCompositeAPIProvider } from './composite-provider';
export {
  ensureCapabilityRoutersReady,
  ensureGeocodingRouterReady,
  ensurePlaceSearchRouterReady,
  ensureIsochroneRouterReady,
  resetCapabilityRouterReady,
  resetGeocodingRouterReady,
} from './setup-capability-routers';

// Export cache utilities for custom providers
export {
  ProviderCache,
  roundForCacheKey,
  coordinateCacheKey,
  type ProviderCacheOptions,
  type CacheStats,
} from './cache';

// Export shared provider utilities
export { RequestQueue, type RequestQueueOptions } from './request-queue';
export {
  requireAPIKey,
  assertResponseOk,
  retryOn429,
  fetchWithRetry,
  type RateLimitRetryOptions,
} from './api-utils';

// Export provider implementations
export { MapboxAPIProvider } from './mapbox-provider';
export { MapTilerAPIProvider } from './maptiler-provider';
export { GooglePlacesAPIProvider } from './google-places-provider';
export { FoursquareAPIProvider } from './foursquare-provider';
