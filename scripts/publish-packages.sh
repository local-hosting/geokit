#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "${NODE_AUTH_TOKEN:-}" ]]; then
  echo "publish-packages: set NODE_AUTH_TOKEN" >&2
  exit 1
fi

publish_one() {
  local pkg="$1"
  local dir="${root}/packages/${pkg}"
  local pkg_json="${dir}/package.json"
  local version publish_name backup

  version="$(node -p "require('${pkg_json}').version")"
  publish_name="@twinfile/geokit-${pkg}"
  backup="$(mktemp)"

  cp "${pkg_json}" "${backup}"
  node --input-type=module - "${pkg_json}" "${publish_name}" <<'NODE'
import fs from 'node:fs';
const [pkgJson, publishName] = process.argv.slice(1);
const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
pkg.name = publishName;
fs.writeFileSync(pkgJson, `${JSON.stringify(pkg, null, 2)}\n`);
NODE

  echo "publish-packages: ${publish_name}@${version}"
  if (cd "${dir}" && npm publish --registry=https://npm.pkg.github.com --ignore-scripts); then
    :
  else
    cp "${backup}" "${pkg_json}"
    rm -f "${backup}"
    return 1
  fi

  cp "${backup}" "${pkg_json}"
  rm -f "${backup}"
}

cd "${root}"
for pkg in core crosswalk env h3 service ui; do
  publish_one "${pkg}"
done

echo "publish-packages OK"
