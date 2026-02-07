/**
 * UI Core (tree-shakeable, minimal)
 *
 * Exports only the elements and controls needed at startup:
 * MapElement, NavigationControl, providers, and utilities.
 *
 * Heavy / interaction-only elements are excluded to keep the initial
 * bundle lean.  Import them from their dedicated entry points:
 *
 *   import { PopupElement }         from '@twinfile/geokit/ui/elements/popup';
 *   import { MapCollectionElement } from '@twinfile/geokit/ui/elements/map-collection';
 *   await import('@twinfile/geokit/ui/elements/isochrone');
 */

// Re-export UI providers (types, registry, implementations)
export * from './providers';

// Re-export only the navigation control (the only one geoview creates)
export { NavigationControlElement } from './components/controls/navigation-control';

// Re-export element classes needed at startup (map only)
export { MapElement } from './components/elements/map';

// Re-export only the lightweight utilities needed at startup.
// Heavy modules (layer-styles ~312 KB, feature-state-hover) are excluded;
// import them from their dedicated entry points:
//   import { ... } from '@twinfile/geokit/ui/layer-styles';
export * from './utils/map-utils';
export * from './utils/theme';
export * from './utils/logger';
export { getFeatureId } from '../utils/geojson/get-feature-id';
