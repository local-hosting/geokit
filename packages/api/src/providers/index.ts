/**
 * API Providers
 *
 * Exports all API providers for services
 */

// Re-export types and registry
export * from './types';
export * from './registry';
export { CompositeAPIProvider, createCompositeAPIProvider } from './composite-provider';
export { rebuildCapabilityRouters, resetCapabilityRouterReady } from './capability-router-rebuild.js';
export {
  ensureCapabilityRoutersReady,
  ensureGeocodingRouterReady,
  ensurePlaceSearchRouterReady,
  ensureIsochroneRouterReady,
  resetGeocodingRouterReady,
  registerDefaultPlugins,
} from '../builtins.js';

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

