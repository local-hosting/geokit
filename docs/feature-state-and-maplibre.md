# Feature state and the MapLibre coalesceChanges bug

## Root cause

MapLibre GL JS (used by MapTiler SDK) has an internal bug in `source_state.ts`: `coalesceChanges()` assumes `this.deletedStates[sourceLayer][feature]` is either `null` (delete whole feature state) or an object (delete specific keys). When it is `undefined`, `Object.keys(undefined)` throws: **"Cannot convert undefined or null to object"**.

That can happen when:

- Feature state is removed or layers/sources change in ways that leave stale or inconsistent entries in MapLibre’s internal bookkeeping.
- Style changes (e.g. theme toggle) remove and re-add sources/layers while feature state is still in use.
- Our code calls `setFeatureState` / `removeFeatureState` and MapLibre’s internal state ends up with `undefined` in some code paths we don’t control.

So the bug is **inside MapLibre**; we can only reduce the chance of triggering it or avoid the path entirely.

---

## Holistic options

### 1. Avoid feature state for hover (no patch needed)

**Idea:** Don’t use `setFeatureState` / `removeFeatureState` for hover. Use a separate “highlight” layer instead.

- **Hover layer:** One GeoJSON source + one layer that holds a single point/circle at the hovered feature’s position. On `mousemove`: `queryRenderedFeatures`, get the top feature’s position, `setData` on the highlight source. No feature state.
- **Pros:** The coalesceChanges path is never used for our hover; no patch required.
- **Cons:** Extra source/layer; hover highlight is a separate layer (usually fine). Need to sync position with main data (e.g. `queryRenderedFeatures` or track IDs/coordinates).

**Implemented:** The **gk-point** component uses this approach: a highlight source + circle layer sits above glow/shadow and below the dot. Hover and focus drive the highlight via `setData` only; the main point source never uses feature state.

**Variant:** HTML/CSS overlay for hover (e.g. tooltip or cursor-following div). No feature state. Doesn’t give a “glow” on the same layer as the feature.

### 2. Harden our usage (defense in depth)

**Idea:** Keep using feature state but reduce the chance of leaving MapLibre in a bad state.

- **Clear before remove:** Before we call `removeSource(sourceId)` (or remove a layer that used feature state), clear feature state for that source:
  - For **point:** call `removeFeatureState({ source: sourceId, id: pointId })` before `cleanupMapLayers`.
  - For **layer:** call `removeFeatureState({ source: sourceId, id: _hoveredFeatureId })` (if `_hoveredFeatureId` is set) before `removeSource`.
- **Single-frame delay:** After clearing, run `removeSource` / `removeLayer` on the next frame (`requestAnimationFrame`) so MapLibre isn’t mid-coalesce when we remove.
- **Already in place:** Guards (source exists before `removeFeatureState`), deferring add/remove to after style load, no `undefined` in addLayer specs.

**Pros:** Fewer “remove source while it still has feature state” situations; works with the patch.  
**Cons:** Does not guarantee the bug never happens (MapLibre can still create `undefined` internally).

### 3. Patch MapLibre (current approach)

**Idea:** Patch `maplibre-gl` so `coalesceChanges` treats `deletedStates[sourceLayer][feature] === undefined` like `null` and never calls `Object.keys()` on a non-object.

- **Pros:** Fixes the crash regardless of how we use feature state. Persists with `patch-package`.
- **Cons:** Depends on a patched dependency; need to re-patch when upgrading maplibre-gl.

---

## Recommendation

- **Keep the patch** so the app doesn’t crash even when MapLibre’s internal state is inconsistent.
- **Add hardening (2):** clear feature state for a source before we remove that source (point/layer teardown), and optionally defer `removeSource` by one frame. That reduces how often we put MapLibre in a risky state.
- **Long term:** Open an issue/PR on [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) with the same defensive check; once merged and released, you can drop the patch.

If you want to **avoid the patch entirely**, the only robust option is **(1)** – implement hover via a separate highlight layer (or overlay) and stop using feature state for hover.
