# Elements refactor: SOLID & DRY

Target: keep each class file **≤ ~500 lines** and separate by **Single Responsibility** while avoiding duplication.

## Principles

- **S**ingle Responsibility: one reason to change per module (e.g. “popup styles” vs “popup content” vs “popup API”).
- **O**pen/Closed: extend via new modules or options, not by editing big monoliths.
- **D**ependency Inversion: elements depend on small modules (popup-styles, popup-content, popup-api) and shared types in `src/types/`.

---

## Popup (done)

| File                     | Responsibility                                                                | ~Lines |
| ------------------------ | ----------------------------------------------------------------------------- | ------ |
| `popup/popup.ts`         | Component: lifecycle, instance API (open/close/setContent), static delegation | ~287   |
| `popup/popup-styles.ts`  | Inject and provide popup CSS (single source of truth for styles)              | ~305   |
| `popup/popup-content.ts` | Build DOM: `buildPopupContent`, `buildPopupContentGeneric`, `addTagsToPopup`  | ~256   |
| `popup/popup-api.ts`     | Static API: create, show, close, anchor, `showPointPopup`, `showPopupGeneric` | ~299   |

Types: `src/types/popup.ts` (PopupOptions, StyledPopupOptions, PointPopupProperties, PopupTag, PopupAction, PopupContentOptions).

---

## Map (in progress)

| Module                         | Responsibility                                                                               | Status      |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ----------- |
| `map/map-placeholder.ts`       | createPlaceholderContent, STUCK_MS, selector, placeholder style                              | ✅ Done     |
| `map/map-controls-styles.ts`   | injectHideAttributionStyles, injectAutoHideStyles                                            | ✅ Done     |
| `map/map-url-sync.ts`          | parseUrlHashState, buildHashFromState, applyStateToMap                                       | ✅ Done     |
| `map/map-terrain-buildings.ts` | createTerrainZoomHandler, cleanupTerrain, createBuildingsZoomHandler, cleanup3DBuildings     | ✅ Done     |
| `map/map-style.ts`             | ensureValidMapStyleAfterLoad, checkAndUpdateStyle, createStyleImageMissingHandler            | ✅ Done     |
| `map/map-children.ts`          | filterPoints, filterPolygons, filterIsochrones (used by getPoints/getPolygons/getIsochrones) | ✅ Done     |
| `map/map-freeze.ts`            | whenStyleReady, waitForReady, resizeAndRepaintMap, delayForWebGLRelease (wired in map.ts)    | ✅ Done     |
| `map/map.ts`                   | Core (still large; further extractions optional)                                             | In progress |

---

## Point (in progress)

| Module                     | Responsibility                                                                                                                       | Status      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `point/point-style.ts`     | getZoomRadiusExpression, getShadowRadiusExpression, getGlowRadiusExpression, getHoverGlowRadiusExpression, applyPointPaintProperties | ✅ Done     |
| `point/point-layers.ts`    | createPointLayers (source + glow, shadow, hover, main circle layers)                                                                 | ✅ Done     |
| `point/point-selection.ts` | applySelectedVisual, clearSelectedVisual (ring + shadow selection state)                                                             | ✅ Done     |
| `point/point.ts`           | Component (~1150 lines; further extractions optional)                                                                                | In progress |

---

## Isochrone (in progress)

| Module                         | Responsibility                            | Status      |
| ------------------------------ | ----------------------------------------- | ----------- |
| `isochrone/isochrone-h3.ts`    | convertToH3 (pure: polygon → H3 hexagons) | ✅ Done     |
| `isochrone/isochrone-fetch.ts` | getIsochroneCacheKey                      | ✅ Done     |
| `isochrone/isochrone.ts`       | Component                                 | In progress |

---

## Map-collection (planned)

| Module                             | Responsibility                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `map-collection/slot-utils.ts`     | getAllSlots, getManySlots, getOneSlot, ensureSlotAttributes, getSlotId                    |
| `map-collection/visibility.ts`     | Intersection observer, processVisibilityChanges, getVisibleInactiveSlotsSorted            |
| `map-collection/map-collection.ts` | Component: init, activate/deactivate, health check, refresh; uses slot-utils + visibility |

---

## Layer (in progress)

| Module                        | Responsibility                                 | Status      |
| ----------------------------- | ---------------------------------------------- | ----------- |
| `layer/layer-order.ts`        | findBeforeLayerId, findFirstCircleLayer        | ✅ Done     |
| `layer/layer-interactions.ts` | setupLayerInteractions (click/hover, teardown) | ✅ Done     |
| `layer/layer.ts`              | Component (~607 lines)                         | In progress |

---

## Polygon / Point-layer (minor)

- **polygon.ts** (563) and **point-layer.ts** (542): trim ~60–100 lines via small helpers or move shared style logic to a shared util if duplicated.
