import { describe, it, expect } from 'vitest';
import { buildRouteProgressGradient } from '../../../src/utils/route-progress-gradient';

describe('buildRouteProgressGradient', () => {
  it('builds a stepped line-progress expression', () => {
    const expr = buildRouteProgressGradient({ color: '#6942F8', progress: 0.42 });
    expect(expr[0]).toBe('step');
    expect(expr[1]).toEqual(['line-progress']);
    expect(expr[2]).toBe('rgba(105, 66, 248, 0.55)');
    expect(expr[3]).toBeCloseTo(0.415, 3);
    expect(expr[4]).toBe('rgba(105, 66, 248, 0.35)');
  });
});
