# UI events

Custom events use the `gk-*` prefix. Listed here so apps can integrate without reaching into internals.

## gk-map

| Event | When | Detail |
|-------|------|--------|
| `gk-map-ready` | Map initialized | `{ map, element }` |
| `gk-map-style-load` | Style finished loading | `{ map, element }` |
| `gk-map-freeze` | Map frozen (e.g. off-screen) | `{ map, element }` |
| `gk-map-unfreeze` | Map reactivated | `{ map, element }` |
| `gk-map-unload` | Map torn down | `{ map, element }` |
| `gk-map-failed` | Init or recovery failed | `{ element, error? }` |
| `gk-map-stuck` | Stuck on placeholder past timeout | `{ element }` |
| `gk-theme-change` | Theme changed | `{ theme, themeName }` |
| `gk-map-moveend` | Camera finished moving | `{ map, element, bounds? }` |
| `gk-map-click` | Background click | `{ lngLat?, map, element, originalEvent? }` — cancelable |
| `gk-shared-point-selected` | Shared point selection changed | `{ sourceId, featureId, previousFeatureId, lngLat, map, element }` |
| `gk-feature-selection-changed` | Legacy selection via `__selected` on source | `{ sourceId, selectedId, previousSelectedId }` |
| `gk-point-click` | Click on shared point layer | `{ lngLat, features, sourceId, featureId, map, element, originalEvent }` — cancelable |
| `controls-visibility-change` | Controls visibility toggled | `{ visible }` |

Use `gkMap.on('moveend', handler)` / `gkMap.off(...)` or `addEventListener('gk-map-moveend', …)` — do not call `getMap().on` directly.

**Selection API:** `setSelectedPoint(sourceId, featureId)`, `clearSelectedPoint(sourceId)`.

**Popup close** (`gk-popup-closed` detail `reason`): `user` | `freeze` | `unload` | `clear-popups` | `restore-other-map` | `dma-pill` | `new-selection` | `programmatic`.

## gk-point

| Event | When | Detail |
|-------|------|--------|
| `point-created` | Layers added | `{ lat, lng, element }` |
| `gk-point-focus` | Selected | `{ pointId, pointName, title, lngLat, map, pointElement }` — cancelable |
| `gk-point-blur` | Deselected | `{ map }` — cancelable |
| `gk-point-hover` | Pointer entered | `{ pointId, pointName, lngLat, map, pointElement }` — cancelable |
| `gk-point-hover-end` | Pointer left | `{ map, pointElement }` — cancelable |

## gk-layer / gk-point-layer

| Event | When | Detail |
|-------|------|--------|
| `gk-layer-click` | Feature clicked | `{ feature, lngLat, layerId, sourceId, originalEvent }` — cancelable |
| `gk-layer-mouseenter` | Pointer entered feature | `{ feature, lngLat, layerId, sourceId }` |
| `gk-layer-mouseleave` | Pointer left layer | `{ layerId, sourceId }` |
| `gk-layer-ready` | Dataset drawn | `{ dataset, sourceId, layerId, featureCount? }` |

## gk-isochrone

| Event | When | Detail |
|-------|------|--------|
| `isochrone-loaded` | Rendered | `{ lat, lng, time, mode, data, element }` |
| `isochrone-error` | Failed | `{ error, lat, lng, time, mode, element }` |
| `gk-isochrone-hover` | Pointer entered fill | `{ lngLat, features, map, element }` — cancelable |
| `gk-isochrone-hover-end` | Pointer left fill | `{ map, element }` — cancelable |

## gk-popup

| Event | When | Detail |
|-------|------|--------|
| `popup-opened` | Shown | `{ lat, lng, content, element }` |
| `gk-popup-closed` | Closed | `{ popup, map }` |

## Other elements

| Element | Event | Detail |
|---------|-------|--------|
| `gk-map-collection` | `map-collection-ready` | (no detail) |
| `gk-polygon` | `polygon-created` | `{ element, … }` |
| `gk-polyline` | `polyline-created`, `polyline-click` | |
| `gk-marker` | `marker-created`, `marker-click`, `marker-dragend` | |
| `gk-h3` | `h3-created` | |
| `gk-geolocate` | `geolocate`, `geolocate-error`, `track-user-location-start/end` | |

## Document events

| Event | Direction | Effect |
|-------|-----------|--------|
| `gk-clear-all-focus` | app → geokit | Clear all `gk-point` selection |
| `gk-clear-all-popups` | both | Close popups across maps |

## Shared point layers

Import from `@geokit/ui/shared-points`:

- `createSharedPointLayersFromPaint` — first paint
- `syncExistingSharedPointLayers` — updates after source/layers exist
- `preloadSharedPointLayerStyles` — warm lazy chunk
