#!/usr/bin/env node
/**
 * Expand export-map aliases and rewrite runtime conditions to built dist/*.js paths.
 * Run after `yarn build` and before `npm publish`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ROOT_DIST_ROOTS = [
  { src: 'src/core/src/', dist: 'src/core/dist/esm/', cjs: 'src/core/dist/cjs/' },
  { src: 'src/ui/src/', dist: 'src/ui/dist/esm/', cjs: 'src/ui/dist/cjs/' },
  { src: 'src/env/src/', dist: 'src/env/dist/esm/', cjs: 'src/env/dist/cjs/' },
  { src: 'src/service/src/', dist: 'src/service/dist/esm/', cjs: 'src/service/dist/cjs/' },
  { src: 'src/h3/src/', dist: 'src/h3/dist/esm/', cjs: 'src/h3/dist/cjs/' },
  {
    src: 'src/providers/foursquare/src/',
    dist: 'src/providers/foursquare/dist/esm/',
    cjs: 'src/providers/foursquare/dist/cjs/',
  },
];

function existsAt(baseDir, relPath) {
  return existsSync(join(baseDir, relPath.replace(/^\.\//, '')));
}

function tsToDistPath(tsPath, condition, baseDir, isRootPackage) {
  if (!tsPath.endsWith('.ts')) return tsPath;

  if (isRootPackage) {
    for (const root of ROOT_DIST_ROOTS) {
      const prefix = `./${root.src}`;
      if (!tsPath.startsWith(prefix)) continue;
      const rel = tsPath.slice(prefix.length).replace(/\.ts$/, '');
      if (condition === 'types') {
        const typesPath = `./${root.dist}${rel}.d.ts`;
        if (existsAt(repoRoot, typesPath)) return typesPath;
        continue;
      }
      const ext = condition === 'require' ? '.cjs' : '.js';
      const distRoot = condition === 'require' ? root.cjs : root.dist;
      const distPath = `./${distRoot}${rel}${ext}`;
      if (existsAt(repoRoot, distPath)) return distPath;
    }
    return tsPath;
  }

  if (!tsPath.startsWith('./src/')) return tsPath;
  const rel = tsPath.slice('./src/'.length).replace(/\.ts$/, '');
  if (condition === 'types') {
    const typesPath = `./dist/esm/${rel}.d.ts`;
    if (existsAt(baseDir, typesPath)) return typesPath;
    return tsPath;
  }
  const ext = condition === 'require' ? '.cjs' : '.js';
  const distRoot = condition === 'require' ? './dist/cjs/' : './dist/esm/';
  const distPath = `${distRoot}${rel}${ext}`;
  if (existsAt(baseDir, distPath)) return distPath;
  return tsPath;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveAliasExports(exportsMap) {
  let changed = true;
  const resolved = clone(exportsMap);

  while (changed) {
    changed = false;
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value !== 'string' || !value.startsWith('./')) continue;
      if (!(value in resolved)) continue;
      const target = resolved[value];
      if (typeof target === 'string') continue;
      resolved[key] = clone(target);
      changed = true;
    }
  }

  return resolved;
}

function normalizeRuntimePaths(exportsMap, packageDir, isRootPackage) {
  const normalized = clone(exportsMap);

  for (const value of Object.values(normalized)) {
    if (!value || typeof value !== 'object') continue;
    for (const [condition, path] of Object.entries(value)) {
      if (typeof path !== 'string' || !path.startsWith('./')) continue;
      if (condition === 'source') continue;
      value[condition] = tsToDistPath(path, condition, packageDir, isRootPackage);
    }
  }

  return normalized;
}

function normalizePackageJson(packageJsonPath) {
  const absPath = resolve(packageJsonPath);
  const pkgDir = dirname(absPath);
  const isRootPackage = absPath === join(repoRoot, 'package.json');
  const pkg = JSON.parse(readFileSync(absPath, 'utf8'));
  if (!pkg.exports) return false;

  const before = JSON.stringify(pkg.exports);
  pkg.exports = normalizeRuntimePaths(resolveAliasExports(pkg.exports), pkgDir, isRootPackage);
  const after = JSON.stringify(pkg.exports);

  if (before !== after) {
    writeFileSync(absPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`[normalize-package-exports] updated ${packageJsonPath.replace(`${repoRoot}/`, '')}`);
    return true;
  }

  return false;
}

const targets = [
  join(repoRoot, 'package.json'),
  join(repoRoot, 'src/env/package.json'),
  join(repoRoot, 'src/service/package.json'),
  join(repoRoot, 'src/h3/package.json'),
  join(repoRoot, 'src/providers/foursquare/package.json'),
];

let updated = 0;
for (const target of targets) {
  if (!existsSync(target)) continue;
  if (normalizePackageJson(target)) updated += 1;
}

console.log(`[normalize-package-exports] ${updated} package.json file(s) updated`);
