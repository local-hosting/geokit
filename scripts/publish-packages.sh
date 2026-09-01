#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${NODE_AUTH_TOKEN:-}" ]]; then
  echo "publish-packages: set NODE_AUTH_TOKEN" >&2
  exit 1
fi

cd "${root}"

for pkg in core crosswalk env h3 service ui; do
  dir="${root}/packages/${pkg}"
  name="$(node -p "require('${dir}/package.json').name")"
  version="$(node -p "require('${dir}/package.json').version")"
  echo "publish-packages: ${name}@${version}"
  (cd "${dir}" && npm publish --registry=https://npm.pkg.github.com --ignore-scripts)
done

echo "publish-packages OK"
