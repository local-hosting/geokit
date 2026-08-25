import { describe, expect, it } from 'vitest';
import {
  findInsertBeforeLayer,
  datasetFillLayerId,
  listLayerIdsByPrefix,
  stackGkOutlineLayersAboveDatasetFill,
  stackLayersAboveAnchor,
} from '../../../src/utils/layer-stack';

describe('layer-stack', () => {
  it('listLayerIdsByPrefix returns matching layer ids', () => {
    const map = {
      getStyle: () => ({
        layers: [{ id: 'a' }, { id: 'gk-dataset-state-line' }, { id: 'b' }],
      }),
    };
    expect(listLayerIdsByPrefix(map, 'gk-dataset-')).toEqual(['gk-dataset-state-line']);
  });

  it('findInsertBeforeLayer skips layers when requested', () => {
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'gk-dataset-state-line', type: 'line' },
          { id: 'gk-dataset-territory-fill', type: 'fill' },
          { id: 'venues', type: 'circle' },
        ],
      }),
    };
    expect(
      findInsertBeforeLayer(map, {
        skipLayer: (layer) => (layer.id ?? '').startsWith('gk-dataset-'),
        matchLayer: (layer) => layer.id === 'venues',
      })
    ).toBe('venues');
  });

  it('stackLayersAboveAnchor moves layers above anchor', () => {
    const order = ['platform-h3-grid-fill', 'gk-dataset-county-fill', 'venues', 'labels'];
    const map = {
      getStyle: () => ({ layers: order.map((id) => ({ id })) }),
      getLayer: (id: string) => (order.includes(id) ? {} : undefined),
      moveLayer: (id: string, before?: string) => {
        const from = order.indexOf(id);
        if (from < 0) return;
        order.splice(from, 1);
        const to = before ? order.indexOf(before) : order.length;
        order.splice(to >= 0 ? to : order.length, 0, id);
      },
    };

    stackLayersAboveAnchor(map, ['gk-dataset-county-fill'], 'platform-h3-grid-fill');
    expect(order.indexOf('gk-dataset-county-fill')).toBeGreaterThan(
      order.indexOf('platform-h3-grid-fill')
    );
    expect(order.indexOf('gk-dataset-county-fill')).toBeLessThan(order.indexOf('venues'));
  });

  it('stackGkOutlineLayersAboveDatasetFill stacks gk-dataset lines above fill', () => {
    const fillId = datasetFillLayerId('territory');
    const order = ['gk-dataset-state-line', fillId, 'gk-dataset-county-line', 'labels'];
    const map = {
      getStyle: () => ({ layers: order.map((id) => ({ id })) }),
      getLayer: (id: string) => (order.includes(id) ? {} : undefined),
      moveLayer: (id: string, before?: string) => {
        const from = order.indexOf(id);
        if (from < 0) return;
        order.splice(from, 1);
        const to = before ? order.indexOf(before) : order.length;
        order.splice(to >= 0 ? to : order.length, 0, id);
      },
    };

    stackGkOutlineLayersAboveDatasetFill(map, fillId);
    expect(order.indexOf('gk-dataset-state-line')).toBeGreaterThan(order.indexOf(fillId));
    expect(order.indexOf('gk-dataset-county-line')).toBeGreaterThan(order.indexOf(fillId));
    expect(order.indexOf(fillId)).toBeLessThan(order.indexOf('labels'));
  });
});
