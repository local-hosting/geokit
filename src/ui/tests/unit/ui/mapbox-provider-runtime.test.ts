import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/providers/mapbox-provider.ts'),
  'utf8',
);

describe('MapboxUIProvider sdk resolution', () => {
  it('normalizes mapbox-gl import interop before calling Map constructor', () => {
    expect(source).toMatch(/resolveMapboxGlRuntime/);
    expect(source).toMatch(/mapbox-gl\/esm/);
    expect(source).toMatch(/typeof this\.sdk\.Map !== 'function'/);
  });
});