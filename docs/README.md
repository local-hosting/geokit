# Geokit docs

| Doc | Contents |
|-----|----------|
| [architecture.md](architecture.md) | Three-layer model, package graph, import tiers |
| [providers.md](providers.md) | Map UI backends (MapTiler / Mapbox) |
| [events.md](events.md) | `gk-*` custom events |
| [parity.md](parity.md) | TypeScript ↔ Swift layout and fixture parity |
| [offline.md](offline.md) | Offline map contract (`@twinfile/geokit/core/contract`, `@twinfile/geokit/ui/storage`) |

## Package READMEs

| Package | README |
|---------|--------|
| `@twinfile/geokit/core` | [src/core/README.md](../src/core/README.md) — geo utilities |
| `@twinfile/geokit/ui` | Map Web Components (see architecture + events) |
| `@twinfile/geokit/env` | `src/env/` — service keys and map credentials |
| `@twinfile/geokit/h3` | `src/h3/` — H3 geometry (`h3-js` peer) |
| `@twinfile/geokit/service` | `src/service/` — registry and routing |
| `@twinfile/geokit/crosswalk` | `src/crosswalk/` — ZIP / DMA / H3 identity (`@twinfile/geokit/crosswalk/us`, etc.) |

Start with [architecture.md](architecture.md) for the three-layer model (services, plugins, UI providers).
