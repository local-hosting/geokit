import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { FeatureCollection } from 'geojson';

const mocks = vi.hoisted(() => ({
  updateSharedPointSelection: vi.fn(),
  setSharedPointSelection: vi.fn(),
  ensureSharedPointSelectionRingLayer: vi.fn(),
  updateGeodesicRadiusRingData: vi.fn(),
  ensureGeodesicRadiusRingLayers: vi.fn(),
  syncExistingSharedPointLayers: vi.fn(async () => true),
  isSharedPointLayerSetComplete: vi.fn(() => true),
  isSharedPointLayerSetFullyComplete: vi.fn(() => true),
  waitForSharedPointLayerSetComplete: vi.fn(async () => true),
  ensureSharedPointLayerSetHealed: vi.fn(async () => true),
  attachSharedPointHoverGlowRadiusSync: vi.fn(() => () => {}),
  DEFAULT_SHARED_POINT_ID_PROPERTIES: ['venueId', 'slug', 'id'],
}));

vi.mock('../../../src/utils/layers/styles/shared-point-layers.js', () => ({
  updateSharedPointSelection: mocks.updateSharedPointSelection,
  setSharedPointSelection: mocks.setSharedPointSelection,
  ensureSharedPointSelectionRingLayer: mocks.ensureSharedPointSelectionRingLayer,
  DEFAULT_SHARED_POINT_ID_PROPERTIES: mocks.DEFAULT_SHARED_POINT_ID_PROPERTIES,
}));

vi.mock('../../../src/utils/map-surface/geodesic-circle.js', () => ({
  ensureGeodesicRadiusRingLayers: mocks.ensureGeodesicRadiusRingLayers,
  updateGeodesicRadiusRingData: mocks.updateGeodesicRadiusRingData,
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

import { createSharedPointMapOrchestrator } from '../../../src/utils/shared-points/shared-point-map-orchestrator';

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

describe('createSharedPointMapOrchestrator selection ring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-creates selection isochrone fill with antialias + transparent outline (no hex seam folds)', () => {
    const layers = new Set<string>();
    const map = {
      getSource: vi.fn((id: string) => (id.startsWith('isochrone-') ? undefined : {})),
      getLayer: vi.fn((id: string) => {
        if (layers.has(id)) return {};
        if (id.includes('point') || id.includes('glow')) return {};
        return undefined;
      }),
      addSource: vi.fn(),
      addLayer: vi.fn((spec: { id: string }) => {
        layers.add(spec.id);
      }),
      setPaintProperty: vi.fn(),
      moveLayer: vi.fn(),
    };
    const gkMap = { getMap: () => map };

    const orchestrator = createSharedPointMapOrchestrator({
      marketSlug: 'canvas',
      isochroneFillColor: '#c3d361',
      selectionRingColor: '#ffffff',
      getGkMap: () => gkMap,
      ids: {
        sourceId: 'canvas-venues',
        glowLayerId: 'canvas-venues-glow',
        pointLayerId: 'canvas-venues-point',
      },
      getGeoJson: () => EMPTY_FC,
      getPaintConfig: () => ({
        ids: {
          sourceId: 'canvas-venues',
          glowLayerId: 'canvas-venues-glow',
          pointLayerId: 'canvas-venues-point',
        },
        pointColorExpression: ['literal', '#fff'],
        pointRadiusExpression: ['literal', 4],
        glowColorExpression: ['literal', '#888'],
      }),
    });

    orchestrator.ensureSelectionLayers(map as never);

    const fillCall = map.addLayer.mock.calls.find(
      (c) => (c[0] as { id?: string })?.id === 'polygon-fill-isochrone-selection-canvas',
    );
    expect(fillCall).toBeTruthy();
    const paint = (fillCall![0] as { paint: Record<string, unknown> }).paint;
    expect(paint['fill-antialias']).toBe(true);
    expect(paint['fill-outline-color']).toBe('transparent');
  });

  it('writes the white selection ring when selection coords update (even without radius rings)', () => {
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn((id: string) => (id.includes('point') ? {} : undefined)),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setPaintProperty: vi.fn(),
      moveLayer: vi.fn(),
    };
    const gkMap = { getMap: () => map };

    const orchestrator = createSharedPointMapOrchestrator({
      marketSlug: 'canvas',
      isochroneFillColor: '#ffffff',
      selectionRingColor: '#ffffff',
      getGkMap: () => gkMap,
      ids: {
        sourceId: 'canvas-venues',
        glowLayerId: 'canvas-venues-glow',
        pointLayerId: 'canvas-venues-point',
      },
      getGeoJson: () => EMPTY_FC,
      getPaintConfig: () => ({
        ids: {
          sourceId: 'canvas-venues',
          glowLayerId: 'canvas-venues-glow',
          pointLayerId: 'canvas-venues-point',
        },
        pointColorExpression: ['literal', '#fff'],
        pointRadiusExpression: ['literal', 4],
        glowColorExpression: ['literal', '#888'],
      }),
    });

    orchestrator.updateSelectionCoords({ lng: -79.33, lat: 42.48 });

    expect(mocks.ensureSharedPointSelectionRingLayer).toHaveBeenCalledWith(
      map,
      'canvas-venues',
      'canvas-venues-point',
      '#ffffff',
      ['literal', 4],
      0,
    );
    expect(mocks.updateSharedPointSelection).toHaveBeenCalledWith(map, 'canvas-venues', {
      lngLat: { lng: -79.33, lat: 42.48 },
    });
  });

  it('clears selection via setSharedPointSelection when coords are null', () => {
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn((id: string) => (id.includes('point') ? {} : undefined)),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setPaintProperty: vi.fn(),
      moveLayer: vi.fn(),
    };
    const gkMap = { getMap: () => map };

    const orchestrator = createSharedPointMapOrchestrator({
      marketSlug: 'canvas',
      isochroneFillColor: '#ffffff',
      getGkMap: () => gkMap,
      ids: {
        sourceId: 'canvas-venues',
        glowLayerId: 'canvas-venues-glow',
        pointLayerId: 'canvas-venues-point',
      },
      getGeoJson: () => EMPTY_FC,
      getPaintConfig: () => ({
        ids: {
          sourceId: 'canvas-venues',
          glowLayerId: 'canvas-venues-glow',
          pointLayerId: 'canvas-venues-point',
        },
        pointColorExpression: ['literal', '#fff'],
        pointRadiusExpression: ['literal', 4],
        glowColorExpression: ['literal', '#888'],
      }),
    });

    orchestrator.updateSelectionCoords(null);

    expect(mocks.setSharedPointSelection).toHaveBeenCalledWith(
      map,
      'canvas-venues',
      expect.objectContaining({ featureId: null, lngLat: null }),
      expect.objectContaining({ pointLayerId: 'canvas-venues-point' }),
    );
  });

  it('skips halo resize and flags selectionGroundBadge for floating-badge paint', () => {
    const map = {
      getSource: vi.fn(() => ({})),
      getLayer: vi.fn((id: string) => (id.includes('point') ? {} : undefined)),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setPaintProperty: vi.fn(),
      moveLayer: vi.fn(),
    };
    const gkMap = { getMap: () => map };

    const orchestrator = createSharedPointMapOrchestrator({
      marketSlug: 'canvas',
      isochroneFillColor: '#ffffff',
      selectionRingColor: '#ffffff',
      promoteId: 'venueId',
      getGkMap: () => gkMap,
      ids: {
        sourceId: 'canvas-venues',
        glowLayerId: 'canvas-venues-glow',
        pointLayerId: 'canvas-venues-point',
      },
      getGeoJson: () => EMPTY_FC,
      getPaintConfig: () => ({
        ids: {
          sourceId: 'canvas-venues',
          glowLayerId: 'canvas-venues-glow',
          pointLayerId: 'canvas-venues-point',
        },
        pointColorExpression: ['literal', '#fff'],
        pointRadiusExpression: ['literal', 8],
        glowColorExpression: ['literal', '#000'],
        selectionGroundBadge: true,
      }),
    });

    orchestrator.updateSelectionCoords(
      { lng: -79.33, lat: 42.48 },
      { featureId: 'venue-1', properties: { _color: '#9acd32' } },
    );

    expect(mocks.ensureSharedPointSelectionRingLayer).not.toHaveBeenCalled();
    expect(mocks.setSharedPointSelection).toHaveBeenCalledWith(
      map,
      'canvas-venues',
      expect.objectContaining({ featureId: 'venue-1' }),
      expect.objectContaining({ selectionGroundBadge: true }),
    );
  });
});
