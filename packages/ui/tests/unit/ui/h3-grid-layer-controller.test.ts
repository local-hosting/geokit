import { describe, expect, it, vi } from 'vitest';
import { createH3GridLayerController } from '../../../src/utils/h3-grid-layer-controller';

function createController() {
  return createH3GridLayerController({
    sourceId: 'test-h3-grid',
    fillLayerId: 'test-h3-grid-fill',
    fillLayer: {
      id: 'test-h3-grid-fill',
      type: 'fill',
      source: 'test-h3-grid',
    },
  });
}

describe('h3-grid-layer-controller', () => {
  it('skips ensureLayers until map style is loaded', () => {
    const controller = createController();
    const addSource = vi.fn();
    const addLayer = vi.fn();

    controller.ensureLayers({
      isStyleLoaded: () => false,
      getSource: () => undefined,
      addSource,
      getLayer: () => undefined,
      addLayer,
    });

    expect(addSource).not.toHaveBeenCalled();
    expect(addLayer).not.toHaveBeenCalled();
  });

  it('adds source and fill layer after style load', () => {
    const controller = createController();
    const addSource = vi.fn();
    const addLayer = vi.fn();

    controller.ensureLayers({
      isStyleLoaded: () => true,
      getSource: () => undefined,
      addSource,
      getLayer: () => undefined,
      addLayer,
    });

    expect(addSource).toHaveBeenCalledWith('test-h3-grid', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    expect(addLayer).toHaveBeenCalled();
  });
});
