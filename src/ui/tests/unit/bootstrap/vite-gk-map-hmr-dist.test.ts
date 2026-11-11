import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { transformSync } from 'esbuild';

const uiRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const distFile = join(uiRoot, 'dist/esm/bootstrap/vite-gk-map-hmr.js');

describe('vite-gk-map-hmr dist', () => {
  it('ships parseable ESM JavaScript (no TypeScript syntax in .js)', () => {
    if (!existsSync(distFile)) {
      throw new Error('missing dist — run `yarn build:ui` from geokit root');
    }
    const code = readFileSync(distFile, 'utf8');
    expect(() => transformSync(code, { loader: 'js', format: 'esm' })).not.toThrow();
    expect(code).not.toMatch(/:\s*ParentNode\b/);
    expect(code).not.toMatch(/\):\s*void\b/);
  });
});
