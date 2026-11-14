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

vi.mock('../../../src/utils/shared-points/shared-point-sync.js', () => ({
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

vi.mock('../../../src/utils/shared-points/shared-point-heal.js', () => ({
  ensureSharedPointLayerSetHealed: mocks.ensureSharedPointLayerSetHealed,
  isSharedPointLayerSetFullyComplete: mocks.isSharedPointLayerSetFullyComplete,
}));

import { createSharedPointLayerController } from '../../../src/utils/shared-points/shared-point-layer-controller';

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
      selectionShadowColor: 'rgba(0, 0, 0, 0.4)',
      selectionPointStrokeWidth: 2.75,
    });

    await controller.updateLayers();
    expect(mocks.syncExistingSharedPointLayers).toHaveBeenCalledTimes(1);
    expect(mocks.syncExistingSharedPointLayers).toHaveBeenCalledWith(
      expect.objectContaining({
        selectionShadowColor: 'rgba(0, 0, 0, 0.4)',
        selectionPointStrokeWidth: 2.75,
      })
    );

    geojson = EMPTY_FC;
    await controller.updateLayers();
    expect(mocks.syncExistingSharedPointLayers).toHaveBeenCalledTimes(2);
    expect(mocks.syncExistingSharedPointLayers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        geojson: EMPTY_FC,
        healIncompleteLayerSet: false,
        selectionShadowColor: 'rgba(0, 0, 0, 0.4)',
      })
    );
  });

  it('does not let a stale empty updateLayers overwrite a newer venue paint', async () => {
    let geojson = EMPTY_FC;
    const styleReadyGates: Array<() => void> = [];
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn(() => ({})),
    };
    const gkMap = {
      getMap: () => map,
      getAttribute: () => null,
      whenStyleReady: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            styleReadyGates.push(resolve);
          }),
      ),
    };

    const controller = createSharedPointLayerController({
      getGkMap: () => gkMap,
      ids: {
        sourceId: 'canvas-venues',
        glowLayerId: 'canvas-venues-glow',
        pointLayerId: 'canvas-venues-point',
      },
      getGeoJson: () => geojson,
      getPaintConfig: () => ({
        ids: {
          sourceId: 'canvas-venues',
          glowLayerId: 'canvas-venues-glow',
          pointLayerId: 'canvas-venues-point',
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

    const staleEmpty = controller.updateLayers();
    await vi.waitFor(() => expect(styleReadyGates.length).toBe(1));

    geojson = ONE_FC;
    const newerFull = controller.updateLayers();
    await vi.waitFor(() => expect(styleReadyGates.length).toBe(2));

    // Newer paint finishes first…
    styleReadyGates[1]?.();
    await newerFull;
    expect(mocks.syncExistingSharedPointLayers).toHaveBeenLastCalledWith(
      expect.objectContaining({ geojson: ONE_FC }),
    );

    // …then the stale empty await resumes and must not wipe venues.
    styleReadyGates[0]?.();
    await staleEmpty;

    expect(mocks.syncExistingSharedPointLayers).toHaveBeenLastCalledWith(
      expect.objectContaining({
        geojson: ONE_FC,
      }),
    );
  });
});
