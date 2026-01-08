/**
 * UI Components and Providers
 *
 * Main entry point for UI system
 * Exports all components, providers, and utilities
 */

// Re-export UI providers (types, registry, implementations)
export * from './providers';

// Re-export base classes
export { BaseElement } from './components/base-element';
export { MapChildElement } from './components/map-child-element';
export { BaseControl } from './components/base-control';

// Re-export controls
export * from './components/controls';

// Re-export elements
export * from './components/elements';

// Auto-register all components (side-effects)
import './components/controls/navigation-control';
import './components/controls/scale-control';
import './components/controls/fullscreen-control';
import './components/controls/geolocate-control';
import './components/elements/map';
import './components/elements/marker';
import './components/elements/point';
import './components/elements/polygon';
import './components/elements/polyline';
import './components/elements/popup';
import './components/elements/h3';
import './components/elements/isochrone';
import './components/elements/map-collection';
