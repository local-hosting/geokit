import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const h3Source = readFileSync(
  join(import.meta.dirname, '../../../src/components/elements/h3.ts'),
  'utf8',
);

describe('gk-h3 style ready gate', () => {
  it('waits for map style before addSource (avoids Style is not done loading)', () => {
    expect(h3Source).toMatch(/isMapStyleReady\(\)/);
    expect(h3Source).toMatch(/waitForMapStyleReady\(\)/);
    expect(h3Source.indexOf('isMapStyleReady')).toBeLessThan(h3Source.indexOf('addSource'));
  });

  it('drops cached layer indices on map unload so Vite HMR can re-render hexes', () => {
    expect(h3Source).toMatch(/onMapUnload\(\)/);
    expect(h3Source).toMatch(/currentH3Index = null/);
    expect(h3Source).toMatch(/removeH3\(\)/);
  });
});