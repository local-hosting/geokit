import { describe, expect, it } from 'vitest';
import {
  MARKER_BODY_SHAPES,
  SHARED_POINT_MARKER_SHAPE_PROPERTY,
  markerBodyShapeFromProperties,
  sharedPointCircleBodyFilter,
  sharedPointCircleBodyLayerIds,
  sharedPointCircleStackLayerIds,
  sharedPointRoundedRectBodyFilter,
} from '../../../src/utils/markers/marker-shape';

describe('markerBodyShapeFromProperties', () => {
  it('defaults to circle', () => {
    expect(markerBodyShapeFromProperties(null)).toBe('circle');
  });

  it('reads explicit _markerShape when valid', () => {
    expect(
      markerBodyShapeFromProperties({
        [SHARED_POINT_MARKER_SHAPE_PROPERTY]: 'rounded-rect',
      })
    ).toBe('rounded-rect');
  });

  it('ignores invalid shape strings', () => {
    expect(markerBodyShapeFromProperties({ [SHARED_POINT_MARKER_SHAPE_PROPERTY]: 'hex' })).toBe(
      'circle'
    );
  });
});

describe('shared point shape filters', () => {
  it('exposes circle and rounded-rect filters for layer split', () => {
    expect(MARKER_BODY_SHAPES).toEqual(['circle', 'rounded-rect']);
    expect(JSON.stringify(sharedPointRoundedRectBodyFilter())).toContain(
      SHARED_POINT_MARKER_SHAPE_PROPERTY
    );
    expect(sharedPointCircleBodyFilter()).toEqual(
      expect.arrayContaining(['!', expect.any(Array)])
    );
  });

  it('lists circle stack layers including hover mounts', () => {
    expect(sharedPointCircleStackLayerIds('demo-points')).toEqual(
      expect.arrayContaining(['demo-points-hover', 'demo-points-outer-stroke'])
    );
    // Glass draws the zoomed-out glow behind every shape.
    expect(sharedPointCircleStackLayerIds('demo-points')).not.toContain('demo-points-glass');
    expect(sharedPointCircleStackLayerIds('demo-points', 'demo-glow')).toEqual(
      sharedPointCircleBodyLayerIds('demo-points')
    );
  });
});