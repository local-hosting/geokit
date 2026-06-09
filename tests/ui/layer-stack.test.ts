import { describe, expect, it } from 'vitest';
import {
  findInsertBeforeLayer,
  listLayerIdsByPrefix,
  stackLayersAboveAnchor,
} from '../../src/ui/utils/layer-stack';

describe('layer-stack', () => {
  it('listLayerIdsByPrefix returns style-order ids', () => {
    const map = {
      getStyle: () => ({
        layers: [{ id: 'a' }, { id: 'dma-boundary-fill' }, { id: 'b' }],
      }),
    };
    expect(listLayerIdsByPrefix(map, 'dma-boundary-')).toEqual(['dma-boundary-fill']);
  });

  it('findInsertBeforeLayer skips underlays and returns first match', () => {
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'cdn-state-lines', type: 'line' },
          { id: 'dma-boundary-fill', type: 'fill' },
          { id: 'venues-louisville', type: 'circle' },
          { id: 'waterway-label', type: 'symbol' },
        ],
      }),
    };

    const id = findInsertBeforeLayer(map, {
      skipLayer: (layer) => (layer.id ?? '').startsWith('cdn-'),
      matchLayer: (layer) => layer.type === 'circle' && (layer.id ?? '').includes('venue'),
    });
    expect(id).toBe('venues-louisville');
  });

  it('findInsertBeforeLayer returns undefined when no match', () => {
    const map = {
      getStyle: () => ({
        layers: [{ id: 'background', type: 'background' }],
      }),
    };
    expect(findInsertBeforeLayer(map, { matchLayer: () => false })).toBeUndefined();
  });

  it('stackLayersAboveAnchor moves layers above anchor', () => {
    const order = ['platform-h3-grid-fill', 'dma-boundary-fill', 'venues', 'labels'];
    const map = {
      getStyle: () => ({
        layers: order.map((id) => ({ id })),
      }),
      getLayer: (id: string) => (order.includes(id) ? {} : undefined),
      moveLayer: (layerId: string, beforeId?: string) => {
        const from = order.indexOf(layerId);
        if (from < 0) return;
        order.splice(from, 1);
        const insertAt = beforeId === undefined ? order.length : order.indexOf(beforeId);
        order.splice(insertAt, 0, layerId);
      },
    };

    stackLayersAboveAnchor(map, ['dma-boundary-fill'], 'platform-h3-grid-fill');
    expect(order.indexOf('dma-boundary-fill')).toBeGreaterThan(
      order.indexOf('platform-h3-grid-fill')
    );
    expect(order.indexOf('dma-boundary-fill')).toBeLessThan(order.indexOf('venues'));
  });
});
