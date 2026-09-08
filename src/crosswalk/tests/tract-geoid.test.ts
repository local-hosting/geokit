import { describe, expect, it } from 'vitest';
import { loadUsCrosswalk, resetCrosswalkForTest } from '../src/load/load.js';
import { US_CROSSWALK_PRESETS } from '../src/us/table-names.js';
import { h3ForTract, tractsForH3 } from '../src/lookup/convert.js';
import { statesForH3Cell, stateForTract } from '../src/lookup/spatial.js';
import {
  normalizeTractGeoid,
  stateAbbrForTract,
  tractCountyFips,
  tractStateFips,
} from '../src/us/tract-geoid.js';

describe('tract GEOID helpers', () => {
  it('normalizes and splits tract GEOID', () => {
    expect(normalizeTractGeoid('1001020100')).toBe('01001020100');
    expect(tractStateFips('01001020100')).toBe('01');
    expect(tractCountyFips('01001020100')).toBe('01001');
    expect(stateAbbrForTract('01001020100')).toBe('al');
  });
});

describe('tract H3 crosswalk tables', () => {
  it('loads tract tables and resolves GEOID to platform H3 r1', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.tractResolve, projectH3: false });
    const h3 = h3ForTract('44001030100');
    expect(h3).toBeTruthy();
    expect(tractsForH3(h3!).length).toBeGreaterThan(0);
  });
});

describe('tract state helpers', () => {
  it('resolves tract state and states for H3 r1 cell', async () => {
    resetCrosswalkForTest();
    await loadUsCrosswalk({ tables: US_CROSSWALK_PRESETS.tractResolve, projectH3: false });
    const geoid = '44001030100';
    expect(stateForTract(geoid)).toBe('ri');
    const h3 = h3ForTract(geoid);
    expect(h3).toBeTruthy();
    expect(statesForH3Cell(h3!).length).toBeGreaterThan(0);
  });
});
