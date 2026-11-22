import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/bootstrap/ensure-map-ready.ts'),
  'utf8'
);

describe('ensureMapReady registerMapCollection', () => {
  it('dynamic-imports map-collection from components (not a missing ../elements path)', () => {
    expect(source).toMatch(
      /import\(['"]\.\.\/components\/elements\/map-collection\/map-collection['"]\)/
    );
    expect(source).not.toMatch(/import\(['"]\.\.\/elements\/map-collection['"]\)/);
  });
});