/**
 * @geokit/service — registry, composite routing, plugin hooks, shared HTTP utils.
 * Vendor service classes live in @geokit/* service packages packages.
 */

// Re-export API providers (types, registry, implementations)
export * from './services/index.js';
export * from './place-taxonomy.js';
export * from './plugin.js';
export * from './place-search-cache.js';
export * from './builtins.js';
export * from './setup-capability-routers.js';
