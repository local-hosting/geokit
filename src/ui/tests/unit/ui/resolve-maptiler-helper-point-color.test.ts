import { describe, expect, it } from 'vitest';
import { resolveMapTilerHelperPointColor } from '../../../src/utils/layers/styles/types';

describe('resolveMapTilerHelperPointColor', () => {
  it('uses a plain string color', () => {
    expect(resolveMapTilerHelperPointColor('#c3d361')).toBe('#c3d361');
  });

  it('unwraps a MapLibre literal expression so helpers do not flash theme blue', () => {
    expect(resolveMapTilerHelperPointColor(['literal', '#ffffff'])).toBe('#ffffff');
  });
});
