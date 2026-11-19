import { describe, expect, it } from 'vitest';
import { assignFeaturesToH3ByCentroid } from '@local-hosting/geokit/h3';

describe('assignFeaturesToH3ByCentroid', () => {
  it('assigns features to compact H3 cells via centroid', () => {
    const cells = assignFeaturesToH3ByCentroid(
      [
        {
          key: '06037',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-118.5, 34.0],
                [-118.4, 34.0],
                [-118.4, 34.1],
                [-118.5, 34.1],
                [-118.5, 34.0],
              ],
            ],
          },
          record: { fips: '06037', score: 1 },
        },
      ],
      1,
    );

    expect(cells.size).toBe(1);
    const [cellId, records] = [...cells.entries()][0]!;
    expect(cellId).toMatch(/^[0-9a-f]{1,15}$/i);
    expect(records['06037']).toEqual({ fips: '06037', score: 1 });
  });
});
