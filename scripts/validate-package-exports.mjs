#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function resolveAliasExports(exportsMap) {
  const resolved = structuredClone(exportsMap);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value !== 'string' || !value.startsWith('./')) continue;
      if (!(value in resolved)) continue;
      const target = resolved[value];
      if (typeof target === 'string') continue;
      resolved[key] = structuredClone(target);
      changed = true;
    }
  }
  return resolved;
}

function pickRuntimePath(conditions) {
  return conditions.import ?? conditions.default ?? conditions.require ?? null;
}

function validatePackage(packageJsonPath) {
  const pkgDir = dirname(packageJsonPath);
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (!pkg.exports) return [];

  const failures = [];
  const exportsMap = resolveAliasExports(pkg.exports);

  for (const [subpath, conditions] of Object.entries(exportsMap)) {
    if (typeof conditions === 'string') {
      failures.push(`${subpath}: unresolved alias ${conditions}`);
      continue;
    }
    const runtime = pickRuntimePath(conditions);
    if (!runtime || !runtime.startsWith('./')) continue;
    const abs = join(pkgDir, runtime);
    if (!existsSync(abs)) {
      failures.push(`${subpath}: missing ${runtime}`);
    }
  }

  return failures;
}

const targets = [
  join(repoRoot, 'package.json'),
  join(repoRoot, 'src/env/package.json'),
  join(repoRoot, 'src/service/package.json'),
  join(repoRoot, 'src/h3/package.json'),
  join(repoRoot, 'src/providers/foursquare/package.json'),
];

let failures = [];
for (const target of targets) {
  if (!existsSync(target)) continue;
  failures.push(...validatePackage(target).map((msg) => `${target.replace(`${repoRoot}/`, '')}: ${msg}`));
}

if (failures.length > 0) {
  console.error('[validate-package-exports] failures:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log('[validate-package-exports] OK');
