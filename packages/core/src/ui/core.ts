/**
 * UI Core (tree-shakeable, minimal)
 *
 * Exports only the elements and controls needed at startup:
 * MapElement, NavigationControl, providers, and utilities.
 *
 * Heavy / interaction-only elements are excluded to keep the initial
 * bundle lean.  Import them from their dedicated entry points:
 *
 *   import { PopupElement }         from '@geokit/core/ui/elements/popup';
 *   import { MapCollectionElement } from '@geokit/core/ui/elements/map-collection';
 *   await import('@geokit/core/ui/elements/isochrone');
 */

// Polyfill requestIdleCallback for Safari (unsupported natively).
// Must run before MapTiler SDK is evaluated — it calls requestIdleCallback unconditionally.
if (typeof globalThis.requestIdleCallback === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).requestIdleCallback = (
    cb: IdleRequestCallback,
    opts?: IdleRequestOptions
  ): number => {
    const start = Date.now();
    return setTimeout(
      () => {
        cb({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
        });
      },
      opts?.timeout ? 1 : 1
    ) as unknown as number;
  };
  (globalThis as unknown as Record<string, unknown>).cancelIdleCallback = (id: number): void => {
    clearTimeout(id);
  };
}

// Re-export UI providers (types, registry, implementations)
export * from './providers';

// Re-export only the navigation control (the only one geoview creates)
export { NavigationControlElement } from './components/controls/navigation-control';

// Re-export element classes needed at startup (map only)
export { MapElement } from './components/elements/map/map';
export { parseUrlHashState } from './components/elements/map/map-url-sync';

// Re-export only the lightweight utilities needed at startup.
// Heavy modules (layer-styles ~312 KB, feature-state-hover) are excluded;
// import them from their dedicated entry points:
//   import { ... } from '@geokit/core/ui/layer-styles';
export * from './utils/map-utils';
export * from './utils/map-terrain-disable';
export * from './utils/layer-stack';
export * from './utils/geojson-source-options';
export * from './utils/fill-antialias';
export * from './utils/theme';
export * from './utils/logger';
export { getFeatureId } from '../utils/geojson/get-feature-id';
