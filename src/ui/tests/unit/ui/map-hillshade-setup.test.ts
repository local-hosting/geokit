import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/components/elements/map/surface/map-terrain-buildings.ts'),
  'utf8',
);

describe('setupHillshade', () => {
  it('skips MapTiler hillshade when the overlay attribute is disabled', () => {
    expect(source).toMatch(/hillshade-enabled/);
    const enabledCheckIndex = source.indexOf("ctx.getAttribute('hillshade-enabled')");
    expect(enabledCheckIndex).toBeGreaterThan(-1);
  });

  it('returns before MapTiler setup when provider is not maptiler', () => {
    const providerGuard = source.indexOf("provider !== 'maptiler'");
    const enabledCheckIndex = source.indexOf("ctx.getAttribute('hillshade-enabled')");
    expect(providerGuard).toBeGreaterThan(enabledCheckIndex);
    expect(source).not.toMatch(/Hillshade requires maptiler/);
  });
});