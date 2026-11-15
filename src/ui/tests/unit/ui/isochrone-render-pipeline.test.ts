import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isochroneFeatureCollection } from '../../fixtures/geojson';
import { prepareIsochroneDisplayData } from '../../../src/components/elements/isochrone/isochrone-render-pipeline';

const convertMock = vi.fn();

vi.mock('../../../src/components/elements/isochrone/isochrone-h3-load', () => ({
  convertIsochroneToH3: (...args: unknown[]) => convertMock(...args),
}));

describe('prepareIsochroneDisplayData', () => {
  beforeEach(() => {
    convertMock.mockReset();
    convertMock.mockResolvedValue({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'MultiPolygon', coordinates: [] },
          properties: {},
        },
      ],
    });
  });

  it('tessellates to H3 before display when render is h3', async () => {
    const api = isochroneFeatureCollection();

    const display = await prepareIsochroneDisplayData({
      result: api,
      render: 'h3',
      h3Resolution: 7,
      color: '#ff0000',
      opacity: 0.24,
    });

    expect(convertMock).toHaveBeenCalledWith(api, 7, { color: '#ff0000', opacity: 0.24 });
    expect(display.features[0]?.geometry.type).toBe('MultiPolygon');
  });

  it('does not tessellate when render is polygon', async () => {
    const api = isochroneFeatureCollection();

    await prepareIsochroneDisplayData({
      result: api,
      render: 'polygon',
      h3Resolution: 7,
      color: '#ff0000',
      opacity: 0.24,
    });

    expect(convertMock).not.toHaveBeenCalled();
  });
});