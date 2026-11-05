#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEOKIT_ROOT="$(cd "$ROOT/../.." && pwd)"
SWIFT_ROOT="$(cd "$GEOKIT_ROOT/../geokit-swift" && pwd)"

cd "$GEOKIT_ROOT"
node scripts/link-self-for-dev.mjs
yarn build:h3
yarn build:core:bundle

cd "$ROOT"
node scripts/export-parity-fixtures.mjs > "$SWIFT_ROOT/Tests/GeoKitCoreTests/Fixtures/parity-fixtures.json"
node scripts/check-parity-fixtures.mjs

cd "$SWIFT_ROOT"
swift test --filter GeoKitCoreTests
