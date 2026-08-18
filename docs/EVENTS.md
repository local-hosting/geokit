# Geokit UI events

Custom events use the `gk-*` prefix where they are part of the public API. This document lists events fired or listened to by geokit so apps can integrate without reaching into internals.

---

## Shared point layers (`geokit/ui/shared-points`)

Many map points (venues, POIs, fleet sites) share one **source + glow + point + hover + selection** layer set. Geokit owns **how** points render and update; apps own **what** each feature carries (`_color`, `brand`, ratings, etc.).

| Concern                                                  | Owner                               |
| -------------------------------------------------------- | ----------------------------------- |
| Feature GeoJSON, `_color`, brand, ratings                | Host app (e.g. `buildVenueGeoJSON`) |
| Layer ids, glow/point paint, source sync, selection ring | Geokit `shared-points`              |

**Import:**

```ts
import {
  CachedPointFeatureBuilder,
  createSharedPointLayersFromPaint,
  syncExistingSharedPointLayers,
  preloadSharedPointLayerStyles,
} from 'geokit/ui/shared-points';
```

**First paint** — source exists, layers do not:

```ts
ensureSharedPointGeoJsonSource(map, sourceId, geojson, 'slug');
await createSharedPointLayersFromPaint({
  map,
  ids: { sourceId, glowLayerId, pointLayerId },
  geojson,
  paint: {
    ids: { sourceId, glowLayerId, pointLayerId },
    pointColorExpression,
    pointRadiusExpression,
    glowColorExpression,
    glowOpacity: SHARED_POINT_UNIFORM_GLOW_OPACITY,
    strokeWidthExpression,
    strokeColorExpression,
    primarySortProperty: 'brand',
    primarySortValue: primaryBrand,
  },
  glowHoverOpacity: prefersLight ? 0.34 : 0.24,
  selectionRingColor,
  promoteId: 'slug',
  mapProvider: mapElement.getAttribute('provider'),
});
layerCleanup = attachSharedPointHoverGlowRadiusSync(map, glowLayerId);
```

**Updates** — source and layers already exist:

```ts
await syncExistingSharedPointLayers({ map, ids, geojson, paint });
```

**Selection** — listen on `gk-map`, drive with `setSelectedPoint()` / `clearSelectedPoint()` (see below).

**Preload** — warm the lazy `layer-styles` chunk during idle or before map route:

```ts
preloadSharedPointLayerStyles();
```

---

## gk-map

| Event                          | When                                                                                                                                                | Detail                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `gk-map-ready`                 | Map initialized and ready                                                                                                                           | `{ map, element }`                                                                                       |
| `gk-map-style-load`            | Style finished loading (e.g. after theme switch)                                                                                                    | `{ map, element }`                                                                                       |
| `gk-map-freeze`                | Map frozen (e.g. off-screen in a collection)                                                                                                        | `{ map, element }`                                                                                       |
| `gk-map-unfreeze`              | Map unfrozen and reactivated                                                                                                                        | `{ map, element }`                                                                                       |
| `gk-map-unload`                | Map torn down                                                                                                                                       | `{ map, element }`                                                                                       |
| `gk-map-failed`                | Map init or recovery failed                                                                                                                         | `{ element, error? }`                                                                                    |
| `gk-map-stuck`                 | Map stuck on placeholder past timeout                                                                                                               | `{ element }`                                                                                            |
| `gk-theme-change`              | Theme attribute or class changed                                                                                                                    | `{ theme, themeName }`                                                                                   |
| `gk-feature-selection-changed` | **Legacy** — selection via `updateFeatureSelection()` (`__selected` on source features). Prefer `gk-shared-point-selected` for shared point layers. | `{ sourceId, selectedId, previousSelectedId }` — `selectedId` is the new feature id or `null`            |
| `gk-shared-point-selected`     | Shared point ring moved via click or `setSelectedPoint()`                                                                                           | `{ sourceId, featureId, previousFeatureId, lngLat, map, element }` — `featureId` is the new id or `null` |
| `gk-point-click`               | Click on a shared point layer (from `createSharedPointLayers`). Geokit moves the selection ring before this fires.                                  | `{ lngLat, features, sourceId, featureId, map, element, originalEvent }` — cancelable                    |
| `controls-visibility-change`   | Controls visibility toggled                                                                                                                         | `{ visible }`                                                                                            |
| `child-added`                  | Child element added (internal)                                                                                                                      | `{ element, tagName }` — does not bubble                                                                 |
| `child-removed`                | Child element removed (internal)                                                                                                                    | `{ element, tagName }` — does not bubble                                                                 |
| `themechange`                  | Legacy theme event (prefer `gk-theme-change`)                                                                                                       | `{ theme, themeName }`                                                                                   |

---

## gk-point

| Event                   | When                                                                  | Detail                                                                  |
| ----------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `point-created`         | Point layers added to the map                                         | `{ lat, lng, element }`                                                 |
| `gk-point-focus`        | Point selected (click or `focus()` / `selected` attribute)            | `{ pointId, pointName, title, lngLat, map, pointElement }` — cancelable |
| `gk-point-blur`         | Point deselected                                                      | `{ map }` — cancelable                                                  |
| `gk-point-hover`        | Pointer entered point hover layer                                     | `{ pointId, pointName, lngLat, map, pointElement }` — cancelable        |
| `gk-point-hover-end`    | Pointer left point hover layer                                        | `{ map, pointElement }` — cancelable                                    |
| `gk-point-data-changed` | Point data or attributes changed (internal; `gk-point-layer` listens) | (no detail)                                                             |

---

## gk-point-layer / gk-layer

| Event                 | When                                  | Detail                                                               |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `gk-layer-click`      | Feature clicked on layer              | `{ feature, lngLat, layerId, sourceId, originalEvent }` — cancelable |
| `gk-layer-mouseenter` | Pointer entered a rendered feature    | `{ feature, lngLat, layerId, sourceId }`                             |
| `gk-layer-mouseleave` | Pointer left the layer                | `{ layerId, sourceId }`                                              |
| `gk-layer-ready`      | Dataset geo drawn (`dataset="…"`) | `{ dataset, sourceId, layerId, featureCount? }`                      |

---

## gk-isochrone

| Event                    | When                                        | Detail                                            |
| ------------------------ | ------------------------------------------- | ------------------------------------------------- |
| `isochrone-loaded`       | Isochrone data loaded and rendered          | `{ lat, lng, time, mode, data, element }`         |
| `isochrone-error`        | Isochrone request or render failed          | `{ error, lat, lng, time, mode, element }`        |
| `isochrone-upgraded`     | Isochrone upgraded (e.g. resolution change) | `{ lat, lng, ... }`                               |
| `gk-isochrone-hover`     | Pointer entered isochrone fill              | `{ lngLat, features, map, element }` — cancelable |
| `gk-isochrone-hover-end` | Pointer left isochrone fill                 | `{ map, element }` — cancelable                   |

---

## gk-popup

| Event             | When                             | Detail                                                                   |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `popup-opened`    | Declarative popup shown          | `{ lat, lng, content, element }`                                         |
| `gk-popup-closed` | Popup closed (button or removed) | `{ popup, map }` — dispatched on nearest `gk-map` ancestor or `document` |

---

## gk-map-collection

| Event                  | When                                  | Detail      |
| ---------------------- | ------------------------------------- | ----------- |
| `map-collection-ready` | Collection initialized its pool/slots | (no detail) |

---

## Other elements

| Element        | Event                       | When                 | Detail                          |
| -------------- | --------------------------- | -------------------- | ------------------------------- |
| `gk-polygon`   | `polygon-created`           | Polygon layer added  | `{ element, ... }`              |
| `gk-marker`    | `marker-created`            | Marker added         | `{ lat, lng, element }`         |
| `gk-marker`    | `marker-click`              | Marker clicked       | `{ lat, lng, element }`         |
| `gk-marker`    | `marker-dragend`            | Marker drag ended    | `{ lat, lng, element }`         |
| `gk-polyline`  | `polyline-created`          | Polyline layer added | `{ element, ... }`              |
| `gk-polyline`  | `polyline-click`            | Polyline clicked     | `{ lngLat, features, element }` |
| `gk-h3`        | `h3-created`                | H3 hex layer added   | `{ element, ... }`              |
| `gk-geolocate` | `geolocate`                 | User location found  | `{ coords }`                    |
| `gk-geolocate` | `geolocate-error`           | Geolocation failed   | `{ error }`                     |
| `gk-geolocate` | `track-user-location-start` | Tracking started     | (no detail)                     |
| `gk-geolocate` | `track-user-location-end`   | Tracking ended       | (no detail)                     |

---

## Document (dispatched by geokit)

| Event                 | When                                                | Detail                                                   |
| --------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| `gk-clear-all-popups` | `PopupElement.closeAllPopupsForSource()` or similar | `{ sourceId? }` — coordinates closing popups across maps |

---

## Document (listened by geokit)

Apps can dispatch these to drive geokit behavior:

| Event                 | Effect                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `gk-clear-all-focus`  | All `gk-point` elements clear selected state. Detail can include `{ pointElement, pointId }` to exclude one point. |
| `gk-clear-all-popups` | All `gk-point` elements close their popup. Detail can include `{ pointElement, pointId }` to exclude one point.    |

---

## Usage examples

**Sync app state when a shared point layer selection changes:**

```js
mapElement.addEventListener('gk-shared-point-selected', (e) => {
  const { sourceId, featureId } = e.detail;
  if (sourceId === 'venues-louisville') {
    store.setSelectedVenue(featureId);
  }
});
```

**Programmatic selection (restore, deep link):**

```js
mapElement.setSelectedPoint('venues-louisville', venueSlug);
mapElement.clearSelectedPoint('venues-louisville');
```

**Clear selection when the user closes the popup:**

```js
document.addEventListener('gk-popup-closed', () => {
  clearSelection();
});
```

**Clear all point selection from outside:**

```js
document.dispatchEvent(new CustomEvent('gk-clear-all-focus', { bubbles: true }));
```

**Map ready only inside a container:**

```js
import { onMapReadyInContainer } from 'geokit/ui';

const unsub = onMapReadyInContainer(containerEl, (mapElement, map) => {
  // decorate map, add layers, etc.
});
```
