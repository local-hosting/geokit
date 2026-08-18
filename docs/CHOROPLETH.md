# Choropleth fill paint (MapLibre)

Complex GeoJSON polygons (admin boundaries, dissolved regions) are triangulated at render time (earcut). Semi-transparent fills without antialiasing can show diagonal fold lines inside the shape — not bad geometry.

## Contract

Use `buildChoroplethFillPaint` from `geokit/ui/choropleth-fill-paint` for fill layers:

```ts
import { buildChoroplethFillPaint } from 'geokit/ui/choropleth-fill-paint';

map.addLayer({
  id: 'region-fill',
  type: 'fill',
  source: 'regions',
  paint: buildChoroplethFillPaint(map, {
    'fill-color': ['get', 'color'],
    'fill-opacity': 0.35,
  }),
});
```

Default options use `preferAntialiasedWhenFlat: true` (product maps). Pass `{}` as the third argument when flat maps should stay non-antialiased (e.g. isochrone overlays).

## Related

- `fillAntialiasForMap` — lower-level pitch/terrain heuristic
- `BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS` — geojson-vt tuning for outline sources (`tolerance: 0`, `buffer: 256`, `maxzoom: 14`)
- `CHOROPLETH_BOUNDARY_GEOJSON_SOURCE_OPTIONS` — choropleth polygon sources (`tolerance: 0` keeps shared borders aligned)
- Pass terrain-aware options from the host when the map uses 3D terrain
