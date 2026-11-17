import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(import.meta.dirname, '../../../src/bootstrap/ensure-map-ready.ts'),
  'utf8'
);

describe('ensureMapReady Mapbox UI path', () => {
  it('registers MapboxUIProvider when provider is mapbox (does not only configure tokens)', () => {
    expect(source).toMatch(/providerId === ['"]mapbox['"]/);
    expect(source).toMatch(/MapboxUIProvider/);
    expect(source).toMatch(/mapbox-gl\/dist\/mapbox-gl\.css/);
    expect(source).toMatch(/setUIProvider\(['"]mapbox['"]/);
  });
});
