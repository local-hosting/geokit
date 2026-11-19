import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const uiSrc = resolve(import.meta.dirname, '../../../src');

function read(rel: string): string {
  return readFileSync(resolve(uiSrc, rel), 'utf8');
}

describe('Mapbox GL CSS load detection (Vite injects style tags without href)', () => {
  it('exposes isMapboxGlCssLoaded that looks for the Mapbox canary rule', () => {
    const source = read('utils/map-provider-css.ts');
    expect(source).toMatch(/export function isMapboxGlCssLoaded/);
    expect(source).toMatch(/mapboxgl-canary/);
    expect(source).toMatch(/ensureMapboxGlCss/);
    expect(source).toMatch(/mapbox-gl\/dist\/mapbox-gl\.css/);
  });

  it('map-connected-init uses ensureMapboxGlCss instead of stylesheet.href', () => {
    const source = read('components/elements/map/map-connected-init.ts');
    expect(source).toMatch(/ensureMapboxGlCss/);
    expect(source).not.toMatch(/sheet\.href\?\.includes\(['"]mapbox-gl['"]\)/);
  });

  it('MapboxUIProvider.createMap awaits ensureMapboxGlCss before new Map', () => {
    const source = read('providers/mapbox-provider.ts');
    expect(source).toMatch(/ensureMapboxGlCss/);
    const ensureAt = source.indexOf('ensureMapboxGlCss');
    const newMapAt = source.indexOf('new this.sdk.Map');
    expect(ensureAt).toBeGreaterThan(-1);
    expect(newMapAt).toBeGreaterThan(ensureAt);
  });
});
