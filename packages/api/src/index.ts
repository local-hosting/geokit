/**
 * @geokit/api — registry, composite routing, plugin hooks, shared HTTP utils.
 * Vendor API provider classes live in @geokit/plugin-* packages.
 */

// Re-export API providers (types, registry, implementations)
export * from './providers/index.js';
export * from './place-taxonomy.js';
export * from './plugin.js';
export * from './place-search-cache.js';
export * from './builtins.js';
export * from './setup-capability-routers.js';
