import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const h3Source = readFileSync(
  join(import.meta.dirname, '../../../src/components/elements/h3.ts'),
  'utf8',
);

describe('gk-h3 live index updates', () => {
  it('bumps render generation when scheduling so stale async renders cannot add layers', () => {
    expect(h3Source).toMatch(/renderH3Generation/);
    expect(h3Source).toMatch(/generationAtStart !== this\.renderH3Generation/);
  });

  it('updates existing geojson via setData instead of remove/add when layers already exist', () => {
    expect(h3Source).toMatch(/setData\(geojson\)/);
  });

  it('invalidates in-flight renders on disconnect', () => {
    expect(h3Source).toMatch(/disconnectedCallback/);
    expect(h3Source).toMatch(/renderH3Generation \+= 1/);
  });
});