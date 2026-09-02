import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Dual ESM/CJS build via tsup; declarations via tsc (tsup dts OOMs at ~290 entries). */

const geokitRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const ASSET_EXTENSIONS = ['.js', '.json', '.css', '.cjs'];

function hasAssetExtension(importPath) {
  return ASSET_EXTENSIONS.some((ext) => importPath.endsWith(ext));
}

/** @param {Set<string>} ignore relative paths under src/ */
function srcEntries(ignore = new Set()) {
  /** @param {string} dir @returns {string[]} */
  function walk(dir) {
    /** @type {string[]} */
    const entries = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(geokitRoot, full).replace(/\\/g, '/');
      if (ignore.has(rel)) continue;
      if (statSync(full).isDirectory()) {
        entries.push(...walk(full));
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
        entries.push(rel);
      }
    }
    return entries;
  }
  return walk(join(geokitRoot, 'src'));
}

const cjsIgnore = new Set(['src/utils/performance/worker-pool.ts']);

async function copyThemeCss() {
  const src = join(geokitRoot, '../ui/src/theme.css');
  for (const dest of [
    join(geokitRoot, 'dist/ui/theme.css'),
    join(geokitRoot, 'dist/esm/ui/theme.css'),
  ]) {
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    console.log(`[geokit build] copied theme.css → ${dest.replace(`${geokitRoot}/`, '')}`);
  }
}

async function fixEsmImports(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await fixEsmImports(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

    let content = await readFile(fullPath, 'utf8');
    const fileDir = dirname(fullPath);

    content = content.replace(
      /from\s+['"](\.\.?\/[^'"]+)(?<!\.js)(?<!\/index)['"]/g,
      (match, importPath) => {
        if (hasAssetExtension(importPath)) return match;

        const resolvedPath = join(fileDir, importPath);
        if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
          return `from '${importPath}/index.js'`;
        }

        return `from '${importPath}.js'`;
      }
    );

    content = content.replace(
      /import\s*\(\s*['"](\.\.?\/[^'"]+)\.ts['"]\s*\)/g,
      (_match, importPath) => {
        const resolvedPath = join(fileDir, importPath);
        if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
          return `import('${importPath}/index.js')`;
        }
        return `import('${importPath}.js')`;
      }
    );

    content = content.replace(
      /import\s*\(\s*['"](\.\.?\/[^'"]+)(?<!\.js)(?<!\.json)(?<!\/index)['"]\s*\)/g,
      (match, importPath) => {
        if (hasAssetExtension(importPath)) return match;

        const resolvedPath = join(fileDir, importPath);
        if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
          return `import('${importPath}/index.js')`;
        }

        return `import('${importPath}.js')`;
      }
    );

    await writeFile(fullPath, content, 'utf8');
  }
}

async function fixCjsRequires(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await fixCjsRequires(fullPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.cjs')) continue;

    let content = await readFile(fullPath, 'utf8');
    const fileDir = dirname(fullPath);

    content = content.replace(
      /require\(['"](\.\.?\/[^'"]+)\.js['"]\)/g,
      (_match, requirePath) => `require('${requirePath}.cjs')`
    );

    content = content.replace(
      /require\(['"](\.\.?\/[^'"]+)(?<!\.cjs)(?<!\.js)['"]\)/g,
      (match, requirePath) => {
        if (requirePath.endsWith('.cjs') || requirePath.endsWith('.json')) return match;

        const resolvedPathCjs = join(fileDir, `${requirePath}.cjs`);
        const resolvedPath = join(fileDir, requirePath);

        if (existsSync(resolvedPathCjs)) {
          return `require('${requirePath}.cjs')`;
        }
        if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
          return `require('${requirePath}/index.cjs')`;
        }

        return `require('${requirePath}.cjs')`;
      }
    );

    await writeFile(fullPath, content, 'utf8');
  }
}

async function finalizeBuild() {
  await copyThemeCss();
  await fixEsmImports(join(geokitRoot, 'dist/esm'));
  await fixCjsRequires(join(geokitRoot, 'dist/cjs'));
  console.log('[geokit build] fixed ESM import and CJS require extensions');
}

/** @type {import('tsup').Options[]} */
export default [
  {
    name: 'esm',
    entry: srcEntries(),
    format: ['esm'],
    outDir: 'dist/esm',
    dts: false,
    bundle: false,
    splitting: false,
    sourcemap: true,
    clean: true,
    platform: 'node',
    tsconfig: 'config/tsconfig.build.json',
  },
  {
    name: 'cjs',
    entry: srcEntries(cjsIgnore),
    format: ['cjs'],
    outDir: 'dist/cjs',
    outExtension: () => ({ js: '.cjs' }),
    bundle: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    platform: 'node',
    tsconfig: 'config/tsconfig.build.json',
    onSuccess: finalizeBuild,
  },
];
