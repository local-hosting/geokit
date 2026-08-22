import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { FeatureCollection } from 'geojson';

const mocks = vi.hoisted(() => ({
  syncExistingSharedPointLayers: vi.fn(async () => true),
  isSharedPointLayerSetComplete: vi.fn(() => true),
  isSharedPointLayerSetFullyComplete: vi.fn(() => true),
  waitForSharedPointLayerSetComplete: vi.fn(async () => true),
  ensureSharedPointLayerSetHealed: vi.fn(async () => true),
  attachSharedPointHoverGlowRadiusSync: vi.fn(() => () => {}),
}));

vi.mock('../../../src/ui/utils/shared-point-sync.js', () => ({
  attachSharedPointHoverGlowRadiusSync: mocks.attachSharedPointHoverGlowRadiusSync,
  createSharedPointLayersFromPaint: vi.fn(async () => {}),
  ensureSharedPointGeoJsonSource: vi.fn(),
  isMapTilerPointHelperAvailable: vi.fn(() => false),
  isSharedPointLayerSetComplete: mocks.isSharedPointLayerSetComplete,
  removeMapSourcesWithPrefix: vi.fn(),
  syncExistingSharedPointLayers: mocks.syncExistingSharedPointLayers,
  tearDownSharedPointLayers: vi.fn(() => false),
  waitForSharedPointLayerSetComplete: mocks.waitForSharedPointLayerSetComplete,
}));

vi.mock('../../../src/ui/utils/shared-point-heal.js', () => ({
  ensureSharedPointLayerSetHealed: mocks.ensureSharedPointLayerSetHealed,
  isSharedPointLayerSetFullyComplete: mocks.isSharedPointLayerSetFullyComplete,
}));

import { createSharedPointLayerController } from '../../../src/ui/utils/shared-point-layer-controller.js';

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };
const ONE_FC: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-95, 37] },
      properties: { slug: 'a' },
    },
  ],
};

describe('createSharedPointLayerController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSharedPointLayerSetComplete.mockReturnValue(true);
    mocks.isSharedPointLayerSetFullyComplete.mockReturnValue(true);
  });

  it('syncs GeoJSON when layers are already complete (facet filter updates)', async () => {
    let geojson = ONE_FC;
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn(() => ({})),
    };
    const gkMap = {
      getMap: () => map,
      getAttribute: () => null,
    };

    const controller = createSharedPointLayerController({
      getGkMap: () => gkMap,
      ids: {
        sourceId: 'venues-hero',
        glowLayerId: 'hero-venue-glow',
        pointLayerId: 'hero-venue-points',
      },
      getGeoJson: () => geojson,
      getPaintConfig: () => ({
        ids: {
          sourceId: 'venues-hero',
          glowLayerId: 'hero-venue-glow',
          pointLayerId: 'hero-venue-points',
        },
        pointColorExpression: ['literal', '#fff'],
        pointRadiusExpression: ['literal', 4],
        glowColorExpression: ['literal', '#888'],
        glowOpacity: 0.2,
        glowBlur: 1,
        strokeWidthExpression: ['literal', 0],
        strokeColorExpression: ['literal', '#000'],
      }),
      getPaintFingerprint: () => `${geojson.features.length}:light`,
    });

    await controller.updateLayers();
    expect(mocks.syncExistingSharedPointLayers).toHaveBeenCalledTimes(1);

    geojson = EMPTY_FC;
    await controller.updateLayers();
    expect(mocks.syncExistingSharedPointLayers).toHaveBeenCalledTimes(2);
    expect(mocks.syncExistingSharedPointLayers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        geojson: EMPTY_FC,
        healIncompleteLayerSet: false,
      })
    );
  });
});
