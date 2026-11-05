#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEOKIT_ROOT="$(cd "$ROOT/../.." && pwd)"
SWIFT_ROOT="$(cd "$GEOKIT_ROOT/../geokit-swift" && pwd)"
LINK_DIR="$GEOKIT_ROOT/node_modules/@twinfile"
LINK_PATH="$LINK_DIR/geokit"

cd "$GEOKIT_ROOT"
mkdir -p "$LINK_DIR"
ln -sfn "$GEOKIT_ROOT" "$LINK_PATH"
yarn build:h3
yarn build:core:bundle

cd "$ROOT"
node scripts/export-parity-fixtures.mjs > "$SWIFT_ROOT/Tests/GeoKitCoreTests/Fixtures/parity-fixtures.json"
node scripts/check-parity-fixtures.mjs

cd "$SWIFT_ROOT"
swift test --filter GeoKitCoreTests
