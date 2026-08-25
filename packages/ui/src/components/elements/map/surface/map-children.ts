/**
 * Map child element filter helpers (Single Responsibility: filter points/polygons/isochrones by criteria)
 */

import type { PointElement } from '../../point/point';
import type { PolygonElement } from '../../polygon';
import type { IsochroneElement } from '../../isochrone/isochrone';

export function filterPoints(
  elements: HTMLElement[],
  filter?: { visible?: boolean; id?: string }
): PointElement[] {
  const points = elements as PointElement[];
  if (!filter) return points;
  return points.filter((point) => {
    if (filter.visible !== undefined) {
      const isVisible = point.getAttribute('visible') !== 'false';
      if (isVisible !== filter.visible) return false;
    }
    if (filter.id !== undefined) {
      const pointId = point.getAttribute('point-id');
      if (pointId !== filter.id) return false;
    }
    return true;
  });
}

export function filterPolygons(
  elements: HTMLElement[],
  filter?: {
    visible?: boolean;
    dataAttribute?: { key: string; value: string };
  }
): PolygonElement[] {
  const polygons = elements as PolygonElement[];
  if (!filter) return polygons;
  return polygons.filter((polygon) => {
    if (filter.visible !== undefined) {
      const isVisible = polygon.getAttribute('visible') !== 'false';
      if (isVisible !== filter.visible) return false;
    }
    if (filter.dataAttribute) {
      const attrValue = polygon.getAttribute(filter.dataAttribute.key);
      if (attrValue !== filter.dataAttribute.value) return false;
    }
    return true;
  });
}

export function filterIsochrones(
  elements: HTMLElement[],
  filter?: {
    visible?: boolean;
    selection?: boolean;
    dataAttribute?: { key: string; value: string };
  }
): IsochroneElement[] {
  const isochrones = elements as IsochroneElement[];
  if (!filter) return isochrones;
  return isochrones.filter((iso) => {
    if (filter.visible !== undefined) {
      const isVisible = iso.getAttribute('visible') !== 'false';
      if (isVisible !== filter.visible) return false;
    }
    if (filter.selection !== undefined) {
      const isSelection = iso.getAttribute('data-selection-overlay') === 'true';
      if (isSelection !== filter.selection) return false;
    }
    if (filter.dataAttribute) {
      const attrValue = iso.getAttribute(filter.dataAttribute.key);
      if (attrValue !== filter.dataAttribute.value) return false;
    }
    return true;
  });
}
