# Geokit docs

| Doc | Contents |
|-----|----------|
| [architecture.md](architecture.md) | Three-layer model, package graph, import tiers |
| [providers.md](providers.md) | Map UI backends (MapTiler / Mapbox) |
| [events.md](events.md) | `gk-*` custom events |
| [parity.md](parity.md) | TypeScript ↔ Swift layout and fixture parity |
| [offline.md](offline.md) | Offline map contract (`@local-hosting/geokit/core/contract`, `@local-hosting/geokit/ui/storage`) |

## Package READMEs

| Package | README |
|---------|--------|
| `@local-hosting/geokit/core` | [src/core/README.md](../src/core/README.md) — geo utilities |
| `@local-hosting/geokit/ui` | Map Web Components (see architecture + events) |
| `@local-hosting/geokit/env` | `src/env/` — service keys and map credentials |
| `@local-hosting/geokit/h3` | `src/h3/` — H3 geometry (`h3-js` peer) |
| `@local-hosting/geokit/service` | `src/service/` — registry and routing |
| `@local-hosting/geokit/crosswalk` | `src/crosswalk/` — ZIP / DMA / H3 identity (`@local-hosting/geokit/crosswalk/us`, etc.) |

Start with [architecture.md](architecture.md) for the three-layer model (services, plugins, UI providers).
