# Geokit monorepo

`@local-hosting/geokit` — core geo utils, map UI, and provider plugins (subpath exports below).

## Packages

| Package | Path | Description |
|---------|------|-------------|
| `@local-hosting/geokit/env` | `src/env/` | Service keys and map credential bootstrap |
| `@local-hosting/geokit/h3` | `src/h3/` | H3 hex grid geometry (peer: `h3-js`) |
| `@local-hosting/geokit/core` | `src/core/` | Core geo utilities (slim; no map UI) |
| `@local-hosting/geokit/ui` | `src/ui/` | Map Web Components, storage, adapters |
| `@local-hosting/geokit/service` | `src/service/` | API registry, composite routing, plugin hooks |
| `@local-hosting/geokit/crosswalk` | `src/crosswalk/` | Geo identity crosswalk (H3, ZIP, DMA, …) |
| `@local-hosting/geokit/foursquare` | `src/providers/foursquare/` | Foursquare Places search |
| `@local-hosting/geokit/google` | `src/providers/google/` | Google Places search |
| `@local-hosting/geokit/mapbox` | `src/providers/mapbox/` | Mapbox geocoding, isochrone, directions |
| `@local-hosting/geokit/maptiler` | `src/providers/maptiler/` | MapTiler geocoding |
| `@local-hosting/geokit/here` | `src/providers/here/` | HERE Places discover search |
| `@local-hosting/geokit/osm` | `src/providers/osm/` | OpenStreetMap Overpass place search |
| `@local-hosting/geokit/esri` | `src/providers/esri/` | Esri ArcGIS Places near-point search |

## Docs

See [docs/README.md](docs/README.md). Start with [docs/architecture.md](docs/architecture.md) (three-layer model and [Install](docs/architecture.md#install) for subpath imports). Registry auth: [.npmrc.example](.npmrc.example).

## Commands

```bash
yarn install
yarn build          # full monorepo dist (run-geokit-build full)
yarn build:publish  # npm slices only (skips UI tsc)
yarn test
yarn typecheck
yarn demo           # interactive map demos (demo/)
```

Package API reference: [docs/core-package.md](docs/core-package.md).
