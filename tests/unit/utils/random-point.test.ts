import { describe, it, expect } from 'vitest';
import { randomPointInCircle, randomPointInCircleKm } from '../../../src/utils/bearing/random-point-in-circle';
import { haversineMeters } from '../../../src/utils/distance';

describe('randomPointInCircle', () => {
  const center: [number, number] = [40.7128, -74.006];

  it('returns center-adjacent points within radius', () => {
    const radius = 5000;
    const pick = randomPointInCircle(radius);
    for (let i = 0; i < 20; i++) {
      const point = pick(center);
      const distance = haversineMeters(center)(point);
      expect(distance).toBeLessThanOrEqual(radius + 1);
    }
  });

  it('supports kilometer radius helper', () => {
    const pick = randomPointInCircleKm(2);
    const point = pick(center);
    const distance = haversineMeters(center)(point);
    expect(distance).toBeLessThanOrEqual(2001);
  });
});
