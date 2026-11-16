import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STYLE_IMAGE_RASTER_SIZE } from '../../../src/utils/map-surface/map-style-images';
import { SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION } from '../../../src/utils/paint/shared-point-paint';
import {
  SHARED_POINT_BADGE_ICON_DISK_FILL,
  SHARED_POINT_BADGE_ICON_PROPERTY,
  ensureSharedPointBadgeIconLayers,
  sharedPointBadgeIconSizeExpression,
  raiseSharedPointBadgeIconLayersOnTop,
  registerBadgeIconImage,
  sharedPointPointBadgeIconLayerId,
  sharedPointSelectionBadgeIconLayerId,
} from '../../../src/utils/paint/shared-point-badge-icon';

describe('shared point badge icon', () => {
  it('registers an image via removeImage then addImage when replacing', () => {
    const removeImage = vi.fn();
    const addImage = vi.fn();
    const map = {
      hasImage: () => true,
      removeImage,
      addImage,
    };

    registerBadgeIconImage(map as never, 'gk-badge-cube', { width: 24, height: 24, data: 'img' });

    expect(removeImage).toHaveBeenCalledWith('gk-badge-cube');
    expect(addImage).toHaveBeenCalledWith(
      'gk-badge-cube',
      { width: 24, height: 24, data: 'img' },
      undefined
    );
  });

  it('adds symbol layers on point + selection sources with _badgeIcon filter', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Map<string, Record<string, unknown>>();
    const addLayer = vi.fn((spec: { id: string; type: string; source?: string; filter?: unknown[]; layout?: Record<string, unknown>; paint?: Record<string, unknown> }) => {
      layers.set(spec.id, spec);
    });
    const map = {
      getSource: (id: string) =>
        id === sourceId || id === `${sourceId}-selection` ? {} : undefined,
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer,
    };

    ensureSharedPointBadgeIconLayers(map as never, {
      sourceId,
      pointLayerId,
    });

    const pointIconId = sharedPointPointBadgeIconLayerId(pointLayerId);
    const selectionIconId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
    expect(layers.get(pointIconId)?.type).toBe('symbol');
    expect(layers.get(pointIconId)?.source).toBe(sourceId);
    expect(layers.get(selectionIconId)?.source).toBe(`${sourceId}-selection`);

    const filter = layers.get(selectionIconId)?.filter as unknown[];
    expect(filter[0]).toBe('all');
    expect(filter).toContainEqual(['has', SHARED_POINT_BADGE_ICON_PROPERTY]);
    expect(layers.get(selectionIconId)?.layout?.['icon-image']).toEqual([
      'get',
      SHARED_POINT_BADGE_ICON_PROPERTY,
    ]);
    expect(layers.get(selectionIconId)?.paint?.['icon-opacity']).toBe(1);
  });

  it('sizes the 64px glyph to sit inside the key-colored core disk at every zoom stop', () => {
    const size = sharedPointBadgeIconSizeExpression();
    const radius = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION;
    expect(size.slice(0, 3)).toEqual(radius.slice(0, 3));
    for (let i = 3; i < radius.length; i += 2) {
      expect(size[i]).toBe(radius[i]);
      const glyphPx = (size[i + 1] as number) * DEFAULT_STYLE_IMAGE_RASTER_SIZE;
      const diskPx = (radius[i + 1] as number) * 2;
      expect(glyphPx).toBeCloseTo(diskPx * SHARED_POINT_BADGE_ICON_DISK_FILL);
      expect(glyphPx).toBeLessThanOrEqual(diskPx);
    }
  });

  it('puts icon-translate on paint (style spec rejects it on layout)', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Map<string, { layout?: Record<string, unknown>; paint?: Record<string, unknown> }>();
    const map = {
      getSource: (id: string) =>
        id === sourceId || id === `${sourceId}-selection` ? {} : undefined,
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer: (spec: { id: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }) => {
        layers.set(spec.id, spec);
      },
    };

    ensureSharedPointBadgeIconLayers(map as never, { sourceId, pointLayerId });

    for (const id of [
      sharedPointPointBadgeIconLayerId(pointLayerId),
      sharedPointSelectionBadgeIconLayerId(pointLayerId),
    ]) {
      const spec = layers.get(id);
      expect(spec?.layout).not.toHaveProperty('icon-translate');
      expect(spec?.layout).not.toHaveProperty('icon-translate-anchor');
      expect(spec?.paint).toHaveProperty('icon-translate');
      expect(spec?.paint?.['icon-translate-anchor']).toBe('viewport');
    }
  });

  it('raises selection icon above badge disks', () => {
    const pointLayerId = 'canvas-places-point';
    const selectionIconId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
    const badgeOuterId = `${pointLayerId}-selection-badge-outer`;
    const badgeId = `${pointLayerId}-selection-badge`;
    const layerIds = new Set([
      pointLayerId,
      badgeOuterId,
      badgeId,
      selectionIconId,
    ]);
    const moveLayer = vi.fn();
    raiseSharedPointBadgeIconLayersOnTop(
      {
        getLayer: (id: string) => (layerIds.has(id) ? {} : undefined),
        moveLayer,
      } as never,
      pointLayerId
    );

    expect(moveLayer).toHaveBeenCalledWith(badgeOuterId, selectionIconId);
    expect(moveLayer).toHaveBeenCalledWith(badgeId, selectionIconId);
    expect(moveLayer).toHaveBeenCalledWith(selectionIconId);
  });
});