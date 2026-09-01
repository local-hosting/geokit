#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${NODE_AUTH_TOKEN:-}" ]]; then
  echo "publish-packages: set NODE_AUTH_TOKEN" >&2
  exit 1
fi
cd "${root}"
yarn build
echo "publish-packages: @twinfile/geokit@$(node -p "require('./package.json').version")"
npm publish --registry=https://npm.pkg.github.com --ignore-scripts
echo "publish-packages OK"
