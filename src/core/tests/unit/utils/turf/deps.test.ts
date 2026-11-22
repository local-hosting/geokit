import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TURF_BROWSER_FORBIDDEN } from '../../../../src/utils/turf/deps/browser-forbidden';

const depsDir = resolve(import.meta.dirname, '../../../../src/utils/turf/deps');

describe('turf/deps choke point', () => {
  const moduleSources = readdirSync(depsDir)
    .filter((name) => name.endsWith('.ts') && name !== 'browser-forbidden.ts')
    .map((name) => readFileSync(join(depsDir, name), 'utf8'));

  it.each(TURF_BROWSER_FORBIDDEN)(
    'does not statically import %s (legacy CJS/UMD transitive deps break Vite browsers)',
    (pkg) => {
      const pattern = new RegExp(`from\\s+['"]${pkg.replace('/', '\\/')}['"]`);
      for (const source of moduleSources) {
        expect(source).not.toMatch(pattern);
      }
    },
  );
});