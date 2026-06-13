import { describe, expect, it } from 'vitest';
import { resolveStatesInMapView } from '../../../src/utils/bounds/resolve-states-in-viewport';

describe('resolveStatesInMapView', () => {
  it('returns unique lowercase state codes from viewport samples', () => {
    const states = resolveStatesInMapView(
      {
        getBounds: () => ({
          getNorthEast: () => ({ lat: 36.5, lng: -86.0 }),
          getSouthWest: () => ({ lat: 35.0, lng: -90.0 }),
        }),
      },
      (lat, lng) => {
        if (lat > 36 && lng < -87) return 'TN';
        if (lat < 36) return 'AL';
        return 'KY';
      }
    );

    expect(states).toEqual(['al', 'ky', 'tn']);
  });
});
