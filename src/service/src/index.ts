/**
 * @local-hosting/geokit/service — registry, composite routing, plugin hooks, shared HTTP utils.
 * Vendor service classes live in @local-hosting/geokit/* service packages packages.
 */

// Re-export API providers (types, registry, implementations)
export * from './services/index';
export * from './plugin';
export * from './place-search-cache';
export * from './setup-capability-routers';
export * from './geocode-to-place-search';
export * from './search-places-with-geocode-fallback';
