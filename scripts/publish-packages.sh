#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${NODE_AUTH_TOKEN:-}" ]]; then
  echo "publish-packages: set NODE_AUTH_TOKEN" >&2
  exit 1
fi
cd "${root}"
yarn generate:tsconfig-paths
node scripts/publish-consumer-build.mjs
yarn normalize:exports
yarn validate:exports
node scripts/check-publish-pack.mjs
node scripts/prepare-publish-package-json.mjs
echo "publish-packages: @local-hosting/geokit@$(node -p "require('./package.json').version")"
npm publish --registry=https://npm.pkg.github.com --ignore-scripts
echo "publish-packages OK"
