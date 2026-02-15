# Reusable logic: apps → geokit

When building apps (e.g. geoview) on top of geokit, some patterns are generic enough to live in geokit so future apps can reuse them.

## Now in geokit (use these from apps)

### 1. Scroll-idle (`createScrollIdle`)

**Package:** `@twinfile/geokit/ui` (or `geokit/src/ui/utils/scroll-idle`)

Framework-agnostic “scroll has stopped” observer. Use to defer work (e.g. activating map cards) until the user stops scrolling.

```ts
import { createScrollIdle } from '@twinfile/geokit/ui';

const scrollIdle = createScrollIdle({
  idleMs: 350,
  onStateChange: (isIdle) => {
    /* update your reactive state */
  },
});
scrollIdle.start(); // when scroll context is visible
// on unmount: scrollIdle.stop();
```

In Vue you can wrap this in `useScrollIdle()` and expose a `ref` that mirrors `getIsIdle()` / `onStateChange`.

### 2. Container-scoped map events (`onMapReadyInContainer`, `onMapUnloadInContainer`)

**Package:** `@twinfile/geokit/ui` (exported from `map-utils`)

Run a handler only when `gk-map-ready` or `gk-map-unload` fires for a map **inside** a given container (e.g. your grid or hero node). Useful when you have multiple maps and only care about ones in your subtree.

```ts
import { onMapReadyInContainer, onMapUnloadInContainer } from '@twinfile/geokit/ui';

const unsubReady = onMapReadyInContainer(containerEl, (mapElement, mapInstance) => {
  // decorate map, add layers, etc.
});
const unsubUnload = onMapUnloadInContainer(containerEl, (mapElement, mapInstance) => {
  // cleanup
});
// on unmount: unsubReady(); unsubUnload();
```

### 3. Programmatic map creation (`MapElement.create`, `MapElement.createWithControls`)

**Package:** `@twinfile/geokit/ui/core` (MapElement)

Creating a `gk-map` element with options and optional controls:

```ts
import { MapElement } from '@twinfile/geokit/ui/core';

const map = MapElement.create({
  id: 'hero-map',
  lat: 40.71,
  lng: -74.01,
  zoom: 12,
  mapStyle: 'dataviz-dark',
  provider: 'maptiler',
  apiKey: '…',
  interactive: true,
  autoHideControls: true,
  lazy: true,
  attributes: { 'viewport-padding': '200' },
});
// or with controls:
const mapWithControls = MapElement.createWithControls({ lat: 40.71, lng: -74.01, zoom: 12 }, [
  { type: 'navigation', position: 'top-right' },
]);
```

Use this instead of maintaining an app-specific `createGkMapElement` that duplicates the same options and the same createElement fallback. If your environment throws when calling `document.createElement('gk-map')`, `MapElement.create()` already uses an innerHTML fallback.

### 4. Feature ID from GeoJSON (`getFeatureId`)

**Package:** `@twinfile/geokit` or `@twinfile/geokit/ui`

Extract a stable ID from a GeoJSON feature’s properties (tries `id`, `slug`, or a custom list).

```ts
import { getFeatureId } from '@twinfile/geokit';

const id = getFeatureId(feature); // default: ['id', 'slug']
const id2 = getFeatureId(feature, ['slug', 'id:google-maps', 'id']);
```

Use this in click/hover handlers instead of defining a local `getFeatureId` with the same logic.

### 5. Retry utility

**Package:** `@twinfile/geokit`

`withRetry`, `delay`, `RetryOptions` — already used by geoview via re-export. Other apps can import from geokit directly.

---

## Stay in the app (domain-specific)

- **Map bounds / fitBounds** – Venue lists, “expand for small counts”, hero vs card mode → keep in app.
- **Click/hover handlers** – Opening popups, selection, prefetch, demographics → app-specific; use geokit’s `getFeatureId` and `onMapReadyInContainer` where useful.
- **Layer ordering** – “First custom layer” / “insert before isochrone” with app layer IDs → app-specific.
- **Theme / color scheme** – Map style name and DMA opacity from `prefers-color-scheme` → app or shared design system; geokit only provides map `theme` attribute and CSS variables.
- **Lazy popup module** – Defer loading `geokit/ui/elements/popup` until first use → pattern is app-specific; implementation can stay in app.
- **Map collection wrapper (Vue)** – Creating `gk-map-collection` via constructor, setting attributes, watching style, cleanup on unmount → Vue component in app; optionally use geokit’s `onMapReadyInContainer` / `onMapUnloadInContainer` for event handling.

---

## Summary

| Concept                                   | Location | Action for apps                                        |
| ----------------------------------------- | -------- | ------------------------------------------------------ |
| Scroll idle                               | geokit   | Use `createScrollIdle` from geokit                     |
| Map ready/unload in container             | geokit   | Use `onMapReadyInContainer` / `onMapUnloadInContainer` |
| Create gk-map                             | geokit   | Use `MapElement.create` / `createWithControls`         |
| getFeatureId                              | geokit   | Import from geokit in click/hover code                 |
| Retry                                     | geokit   | Import from geokit                                     |
| Bounds, popups, theme, collection wrapper | app      | Keep in app; use geokit primitives where they help     |

**Migration status:** Geoview has finished switching to these patterns: `createGkMapElement` and `useMapEvents` removed; map creation uses `MapElement.createWithControls`; scroll idle uses `createScrollIdle`; click/hover handlers use `getFeatureId` from geokit; map lifecycle uses `onMapReadyInContainer` / `onMapUnloadInContainer` / `onMapUnfreezeInContainer`.
