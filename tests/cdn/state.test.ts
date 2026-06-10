import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import {
  fetchStateShapeFeature,
  resolveUsStateShapeFeature,
  stateFeatureMatchesHint,
} from '../../src/cdn/state';

describe('state CDN helpers', () => {
  describe('stateFeatureMatchesHint', () => {
    const california: GeoJSON.Feature = {
      type: 'Feature',
      properties: { stateCode: 'ca', name: 'California' },
      geometry: { type: 'Polygon', coordinates: [] },
    };

    it('matches state code and name hints', () => {
      expect(stateFeatureMatchesHint(california, 'ca')).toBe(true);
      expect(stateFeatureMatchesHint(california, 'California')).toBe(true);
      expect(stateFeatureMatchesHint(california, 'california')).toBe(true);
      expect(stateFeatureMatchesHint(california, 'Texas')).toBe(false);
    });
  });

  describe('fetchStateShapeFeature', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', fetchMock);
      fetchMock.mockReset();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('loads a state polygon from the CDN shard path', async () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: { stateCode: 'ca', name: 'California' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      };
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(feature), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const result = await fetchStateShapeFeature('ca', { baseUrl: 'https://cdn.test' });

      expect(result).toEqual(feature);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://cdn.test/us/state/ca.json',
        expect.any(Object)
      );
    });
  });

  describe('resolveUsStateShapeFeature', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', fetchMock);
      fetchMock.mockReset();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('resolves by two-letter code without bulk lookup', async () => {
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: { stateCode: 'ca' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      };
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(feature), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const result = await resolveUsStateShapeFeature('CA', { baseUrl: 'https://cdn.test' });

      expect(result).toEqual(feature);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
