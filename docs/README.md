# Geokit docs

| Doc | Contents |
|-----|----------|
| [architecture.md](architecture.md) | Three-layer model, package graph, import tiers |
| [providers.md](providers.md) | Map UI backends (MapTiler / Mapbox) |
| [events.md](events.md) | `gk-*` custom events |
| [parity.md](parity.md) | TypeScript ↔ Swift layout and fixture parity |
| [offline.md](offline.md) | Offline map contract (`@doppler-group/geokit/core/contract`, `@doppler-group/geokit/ui/storage`) |

## Package READMEs

| Package | README |
|---------|--------|
| `@doppler-group/geokit/core` | [src/core/README.md](../src/core/README.md) — geo utilities |
| `@doppler-group/geokit/ui` | Map Web Components (see architecture + events) |
| `@doppler-group/geokit/env` | `src/env/` — service keys and map credentials |
| `@doppler-group/geokit/h3` | `src/h3/` — H3 geometry (`h3-js` peer) |
| `@doppler-group/geokit/service` | `src/service/` — registry and routing |
| `@doppler-group/geokit/crosswalk` | `src/crosswalk/` — ZIP / DMA / H3 identity (`@doppler-group/geokit/crosswalk/us`, etc.) |

Start with [architecture.md](architecture.md) for the three-layer model (services, plugins, UI providers).
