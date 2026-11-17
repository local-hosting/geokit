import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(import.meta.dirname, '../../../src/components/elements/map/map-connected-init.ts'),
  'utf8'
);

describe('map-connected-init style-url preference', () => {
  it('resolves first-paint style via resolveInitialMapStyle (host style-url wins)', () => {
    expect(source).toMatch(/resolveInitialMapStyle/);
    expect(source).toMatch(/getAttribute\(['"]style-url['"]\)/);
  });
});
