import { describe, expect, it } from 'vitest';
import {
  estimateTravelRadiusMeters,
  estimateTravelRadiusMiles,
} from '../../../src/utils/logistics/travel-radius';

describe('travel-radius', () => {
  it('estimates driving radius in meters and miles', () => {
    const meters = estimateTravelRadiusMeters(30, 'driving');
    expect(meters).toBeCloseTo(25_000, -2);
    const miles = estimateTravelRadiusMiles(30, 'driving');
    expect(miles).toBeCloseTo(15.53, 1);
  });

  it('defaults unknown modes to driving speed', () => {
    expect(estimateTravelRadiusMeters(60, 'hoverboard')).toBe(estimateTravelRadiusMeters(60, 'driving'));
  });
});
