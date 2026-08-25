# Import migration

Breaking import changes for the Geokit monorepo refactor.

## `@geokit/env` (was `@geokit/core/config/env`)

| Old | New |
|-----|-----|
| `@geokit/core/config/env` | `@geokit/env` |
| `@geokit/core/config/env/service-keys` | `@geokit/env/service-keys` |
| `@geokit/core/config/env/map-credentials` | `@geokit/env/map-credentials` |
| `@geokit/core/types/env` | `@geokit/env` |

Core shims re-export from `@geokit/env` for one release cycle.

## `@geokit/h3` (was `@geokit/core/h3`)

| Old | New |
|-----|-----|
| `@geokit/core/h3` | `@geokit/h3` |
| `@geokit/core/h3/lite` | `@geokit/h3/lite` |
| `@geokit/core/h3/cell-to-region-index` | `@geokit/h3/cell-to-region-index` |

Install `h3-js` as a peer when importing the full `@geokit/h3` entry (not required for `@geokit/h3/lite`).

## UI naming

| Old | New |
|-----|-----|
| `ServiceConfig` (UI providers) | `UIProviderConfig` |
| `@geokit/ui` `core.ts` / elements barrel | `@geokit/ui/elements-lite` |

## Service naming

| Old | New |
|-----|-----|
| `CapabilityProviderChain` | `CapabilityServiceChain` |

## Core UI re-exports

Import map components from `@geokit/ui` or `@geokit/ui/*` subpaths. `@geokit/core/ui/*` aliases were removed; use `@geokit/ui` only.

## Tile CDN config

| Old | New |
|-----|-----|
| `@geokit/core/config/tile-cdn` | `@geokit/ui/config/tile-cdn` |

## `@geokit/h3` package layout

Source is grouped under `packages/h3/src/`:

- `cell/` — cell ids, crosswalk, fade, polygon join, region index
- `viewport/` — viewport bounds, coverage, map viewport helpers
- `geometry/` — core projection, boundaries, polygons, metrics, type-safe API
- `adjacency/` — neighbor helpers
- `session/` — cursor dwell and session-loaded tracking

Public entry points are unchanged: `@geokit/h3`, `@geokit/h3/lite`, `@geokit/h3/cell-to-region-index`.


## Core spatial decode

| Old (root `@geokit/core`) | New |
|---------------------------|-----|
| `decodePointToCoordinates`, `geohashPointToH3Point`, … from root | `@geokit/core/spatial/decode` |
| `@geokit/core/spatial` (full barrel) | `@geokit/core/spatial` (type guards + constructors only) |

## Service builtins

| Old | New |
|-----|-----|
| `ensureCapabilityRoutersReady` from `@geokit/service` root | `@geokit/service/builtins` |


## Storage and offline

| Old | New |
|-----|-----|
| `@geokit/core/storage` | `@geokit/ui/storage` |
| `@geokit/core/contract/bootstrap` | `@geokit/ui/bootstrap/ensure-map-ready` |
| `@geokit/core/contract/lifecycle` | `@geokit/ui/lifecycle` |

## Vendor service files

| Old | New |
|-----|-----|
| `services/*/src/*-provider.ts` | `services/*/src/*-service.ts` |
