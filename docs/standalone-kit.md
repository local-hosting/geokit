# Standalone map UI kit

Geokit is a standalone map UI kit. Any app can install `geokit`, configure map providers, register dataset mounts, and compose maps from `gk-*` elements.

## Minimal boot

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <link rel="stylesheet" href="/node_modules/geokit/dist/ui/theme.css" />
  </head>
  <body>
    <gk-map id="map" provider="maptiler" lat="39.8" lng="-98.5" zoom="4"></gk-map>
    <gk-layer layer-dataset="territory" fill-opacity="0.35"></gk-layer>
    <script type="module" src="./boot.js"></script>
  </body>
</html>
```

```typescript
import { configure } from 'geokit/ui/core';
import { registerLayerDatasetMount } from 'geokit/geojson-loader';
import 'geokit/ui';

configure({
  maptiler: { apiKey: import.meta.env.MAPTILER_KEY },
});

registerLayerDatasetMount('territory', async ({ map, options }) => {
  const geojson = await fetch('/fixtures/territory-sample.geojson').then((r) => r.json());
  const sourceId = 'gk-dataset-territory';
  const layerId = 'gk-dataset-territory-fill';
  map.addSource?.(sourceId, { type: 'geojson', data: geojson });
  map.addLayer?.({
    id: layerId,
    type: 'fill',
    source: sourceId,
    paint: {
      'fill-color': options.fillColor ?? '#3b82f6',
      'fill-opacity': options.fillOpacity ?? 0.35,
    },
  });
  return {
    sourceId,
    layerId,
    hitLayerIds: [layerId],
    cleanup: () => {
      map.removeLayer?.(layerId);
      map.removeSource?.(sourceId);
    },
  };
});
```

## Adapter rules

| Geokit owns | App / platform owns |
|-------------|---------------------|
| `gk-map`, `gk-layer`, `gk-point-layer`, shared-points | Dataset ids (`territory`, `dma`, …) |
| `registerLayerDatasetMount` registry | Mount implementations + CDN URLs |
| Layer stack ordering, events, theme tokens | Product colors, entitlements, auth |

Dataset ids are opaque strings. Geokit never imports host-app packages — mounts and CDN URLs are registered by the consumer.

## Demos

Run the geokit repo demo harness:

```bash
yarn demo
```

Open **Standalone kit** (`/maps/standalone-kit.html`) for mock dataset registration + shared point halos without any monorepo checkout.

## Events

See [EVENTS.md](./EVENTS.md) for the `gk-map-ready`, `gk-layer-ready`, and interaction contract.

## Choropleth recipes

See [CHOROPLETH.md](./CHOROPLETH.md) for fill/outline paint patterns on registered datasets.
