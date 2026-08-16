# Offline maps contract

Shared types for **geokit** (web) and **geokit-swift** (`GeoKitContract`). Geokit stores **map runtime state** only — camera, tile cache, snapshots. Domain data (venues, markers, sync) stays in the host app (e.g. Loro pack lockers).

Swift mirror: [`geokit-swift/docs/offline.md`](../../geokit-swift/docs/offline.md)

## Goals

- **Behavioral parity** between web and native for a defined working area
- **Not** identical SDK behavior (Mapbox iOS has `TileStore`; Mapbox GL JS does not)

## Contract surface

| Type / API | Purpose |
|------------|---------|
| `MapLocalState` | Per-`mapId` camera + `selectedPinId` + persist scope |
| `MapLocalPersistScope` | `memory` \| `session` \| `durable` |
| `MapOfflinePrefetchRequest` | Download/cache tiles for bounds + zoom range |
| `MapOfflineCoverage` | Tile coverage + live vs snapshot recommendation |
| `MapOfflinePolicy` | `onlineOnly` \| `cacheFirst` \| `snapshotFallback` |
| `MapOfflineStorageBudget` | `maxBytes`, `maxPrefetchZoom`, optional `maxTileCount` |
| `validateOfflinePrefetchRequest` / `MapOfflinePolicyResolver.validate` | Pure policy (no I/O) |

### Per-map local state

Always keyed by **`mapId`**. Default persist scope: **`durable`**.

| Scope | Web | Native |
|-------|-----|--------|
| `memory` | RAM | RAM |
| `session` | `sessionStorage` | scene session |
| `durable` | IndexedDB / `localStorage` | `UserDefaults` + files |

Geokit stores **`selectedPinId` only** (opaque string / UUID). Pin records live in the host.

## Platform implementation matrix

| Capability | Web | iOS Mapbox | iOS MapKit |
|------------|-----|------------|------------|
| Camera + pin persist | IndexedDB ✅ | `MapLocalStore` ✅ | same |
| Snapshot fallback | IndexedDB blob ✅ | disk store ✅ | MapKit snapshot |
| Region prefetch | Cache API + LRU budget ✅ | Mapbox `TileStore` ✅ | implicit cache only |
| Max prefetch zoom (default) | z15 | z17 | n/a |
| Storage budget (default) | 200 MB | 500 MB | best-effort |
| Coverage API | tile manifest % ✅ | Mapbox region status ✅ | unknown / best-effort |

## Defaults

```ts
MapOfflineDefaults.webStorageBudget       // 200 MB, z≤15, ≤8000 tiles
MapOfflineDefaults.nativeMapboxStorageBudget // 500 MB, z≤17
MapOfflineDefaults.liveMapCoverageThreshold  // 0.8 → prefer live map
MapOfflineDefaults.snapshotFallbackCoverageThreshold // 0.5 → show snapshot
```

## Phased rollout

| Tier | Deliverable |
|------|-------------|
| **A** | Contract types + policy (this doc) ✅ |
| **B** | Durable `MapLocalState` + snapshot blob per `mapId` ✅ |
| **C** | Web: Cache API prefetch + coverage; iOS: Mapbox offline region ✅ |
| **D** | Host hook: `prefetchRegion(bounds)` on context load ✅ |

## What geokit does **not** store

- Venue/marker documents, packages, sync cursors
- Auth tokens, CDN JWT, account entitlements
- Demographics / catalog payloads

## Tier D context load hook

- **Web:** `MapOfflineContextLoader.configure({ urlTemplate, resolveContext })` + optional `map-id` on `<gk-map>`
- **Swift:** set `offlineContext` on `MapContentRequest`; override via `GeoKitRuntime.prefetchOfflineRegionOnContextLoad`
- **Host API:** `prefetchRegion({ mapId, bounds, ... })` on both platforms

## Tier C tile prefetch

- **Web:** `MapOfflineTileCache` — Cache API (`geokit-tiles-v1`) + IndexedDB region manifest
- **iOS Mapbox:** `GeoKitMapboxOfflineRegionStore` — `TileStore.loadTileRegion(forId:)` keyed by `mapId`

## Tier B storage

- **Web:** `MapLocalStore` (`@twinfile/geokit/storage`) — IndexedDB for durable scope, `sessionStorage` for session scope
- **Swift:** `MapLocalStore` + `GeoKitMapSnapshotDiskStore` under Application Support; snapshot capture persists automatically

## Import

```ts
import {
  MapOfflineDefaults,
  validateOfflinePrefetchRequest,
  resolveOfflineCoverage,
} from '@twinfile/geokit/contract';

import { MapLocalStore, MapOfflineTileCache, MapOfflineContextLoader } from '@twinfile/geokit/storage';
```

```swift
import GeoKitContract

let request = try MapOfflinePolicyResolver.validate(request: prefetch, platform: .web)
let coverage = MapOfflinePolicyResolver.coverage(tilesCached: 80, tilesRequired: 100, policy: .cacheFirst)
```

See also: [`providers.md`](providers.md), [`parity.md`](parity.md).
