import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

/** @param {string} dir @returns {string[]} */
function findDeclarationArtifacts(dir) {
  /** @type {string[]} */
  const hits = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      hits.push(...findDeclarationArtifacts(full));
      continue;
    }
    if (name.endsWith('.d.ts') || name.endsWith('.d.ts.map')) {
      hits.push(full);
    }
  }
  return hits;
}

const stray = findDeclarationArtifacts(srcRoot);
if (stray.length > 0) {
  console.error(
    '[@geokit/h3] source-first package: do not emit .d.ts under src/. Remove artifacts and fix the build that created them.'
  );
  for (const file of stray) {
    console.error(`  ${file}`);
  }
  process.exit(1);
}
