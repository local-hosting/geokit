#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SWIFT_ROOT="$(cd "$ROOT/../../geokit-swift" && pwd)"

cd "$ROOT"
yarn build
yarn check:parity-fixtures

cd "$SWIFT_ROOT"
swift test --filter GeoKitCoreTests
