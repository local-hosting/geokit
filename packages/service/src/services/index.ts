/**
 * API Providers
 *
 * Exports all API providers for services
 */

// Re-export types and registry
export * from './types';
export { Service, CachedService, type CachedServiceOptions } from './service.js';
export * from './registry';
export { CompositeService, createCompositeService } from './composite-service';
export { rebuildCapabilityRouters, resetCapabilityRouterReady } from './capability-router-rebuild.js';

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

