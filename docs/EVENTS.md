# Geokit UI Events

All custom events use the `gk-*` prefix where they are part of the public API. This document lists every event fired or listened to by geokit so apps can integrate without reaching into internals.

---

## gk-map (element)

| Event                          | When                                                                     | Detail                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `gk-map-ready`                 | Map is initialized and ready to use                                      | `{ map, element }`                                                                                                    |
| `gk-map-style-load`            | Map style has finished loading (e.g. after theme switch)                 | `{ map, element }`                                                                                                    |
| `gk-map-freeze`                | Map was frozen (e.g. moved off-screen in a collection)                   | `{ map, element }`                                                                                                    |
| `gk-map-unfreeze`              | Map was unfrozen and reactivated                                         | `{ map, element }`                                                                                                    |
| `gk-map-unload`                | Map is being torn down                                                   | `{ map, element }`                                                                                                    |
| `gk-theme-change`              | Theme attribute or class changed                                         | `{ theme, themeName }`                                                                                                |
| `gk-feature-selection-changed` | Selection on a GeoJSON source was updated via `updateFeatureSelection()` | `{ sourceId, selectedId, previousSelectedId }` — `selectedId` is the newly selected feature id (or `null` if cleared) |
| `controls-visibility-change`   | Controls visibility toggled                                              | `{ visible }`                                                                                                         |
| `child-added`                  | A child element was added (internal)                                     | `{ element, tagName }` — does not bubble                                                                              |
| `child-removed`                | A child element was removed (internal)                                   | `{ element, tagName }` — does not bubble                                                                              |

---

## gk-point (element)

| Event            | When                                                           | Detail                                                                  |
| ---------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `point-created`  | Point layers were added to the map                             | `{ lat, lng, element }`                                                 |
| `gk-point-focus` | Point was selected (click or `focus()` / `selected` attribute) | `{ pointId, pointName, title, lngLat, map, pointElement }` — cancelable |
| `gk-point-blur`  | Point was deselected (click away or `blur()`)                  | `{ map }` — cancelable                                                  |

---

## gk-isochrone (element)

| Event                | When                                            | Detail                                     |
| -------------------- | ----------------------------------------------- | ------------------------------------------ |
| `isochrone-loaded`   | Isochrone data loaded and rendered              | `{ lat, lng, time, mode, data, element }`  |
| `isochrone-error`    | Isochrone request or render failed              | `{ error, lat, lng, time, mode, element }` |
| `isochrone-upgraded` | Isochrone was upgraded (e.g. resolution change) | `{ lat, lng, ... }`                        |

---

## Popups (created via PopupElement.showPointPopup)

| Event             | Target                                         | When                                       | Detail                                                                    |
| ----------------- | ---------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `gk-popup-closed` | `gk-map` (or `document` if no gk-map ancestor) | Popup was closed (close button or removed) | `{ popup, map }` — use to sync selection/UI when user dismisses the popup |

---

## gk-popup (element, declarative)

| Event          | When                       | Detail                           |
| -------------- | -------------------------- | -------------------------------- |
| `popup-opened` | Popup was shown on the map | `{ lat, lng, content, element }` |

---

## gk-map-collection (element)

| Event                  | When                                      | Detail      |
| ---------------------- | ----------------------------------------- | ----------- |
| `map-collection-ready` | Collection has initialized its pool/slots | (no detail) |

---

## Document (dispatched by geokit)

| Event                 | When                                                                       | Detail                                                         |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `gk-clear-all-popups` | App calls `PopupElement.closeAllPopupsForSource(map, sourceId)` or similar | `{ sourceId }` — used to coordinate closing popups across maps |

---

## Document (listened by geokit)

Apps can dispatch these to drive geokit behavior:

| Event                 | Effect                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `gk-clear-all-focus`  | All `gk-point` elements clear their selected state (blur). Detail can include `{ pointElement, pointId }` to exclude a specific point. |
| `gk-clear-all-popups` | All `gk-point` elements close their popup (if any). Detail can include `{ pointElement, pointId }` to exclude a specific point.        |

---

## Usage examples

**Sync app state when feature selection changes (e.g. venue layer):**

```js
mapElement.addEventListener('gk-feature-selection-changed', (e) => {
  const { sourceId, selectedId, previousSelectedId } = e.detail;
  if (sourceId === 'venues-hero') {
    store.setSelectedVenue(selectedId);
  }
});
```

**Clear selection when user closes the popup:**

```js
document.addEventListener('gk-popup-closed', () => {
  clearSelection();
});
```

**Clear all point selection from outside:**

```js
document.dispatchEvent(new CustomEvent('gk-clear-all-focus', { bubbles: true }));
```
