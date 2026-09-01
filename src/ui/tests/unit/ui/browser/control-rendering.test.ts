import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMapWithControlsFixture,
  type MapWithControlsFixture,
} from '../../../fixtures/map-with-controls';

describe('Map control rendering (browser)', () => {
  let fixture: MapWithControlsFixture;

  beforeEach(async () => {
    fixture = await createMapWithControlsFixture({ settleMs: 1000 });
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should have control custom elements in DOM', () => {
    const { mapElement } = fixture;
    expect(mapElement.querySelector('gk-control-navigation')).not.toBeNull();
    expect(mapElement.querySelector('gk-control-scale')).not.toBeNull();
    expect(mapElement.querySelector('gk-control-fullscreen')).not.toBeNull();
  });

  it('should have SDK controls rendered in shadow DOM', () => {
    const map = fixture.mapElement.getMap?.();
    expect(map).toBeDefined();

    const mapContainer = (map as { _container?: ParentNode })?._container;
    expect(mapContainer).toBeDefined();

    const controlContainers = mapContainer?.querySelectorAll('.maplibregl-ctrl, .mapboxgl-ctrl');
    expect(controlContainers?.length).toBeGreaterThan(0);
  });

  it('should have navigation control visible', () => {
    const map = fixture.mapElement.getMap?.();
    const mapContainer = (map as { _container?: ParentNode })?._container;
    const navButtons = mapContainer?.querySelectorAll(
      '.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-zoom-out, .maplibregl-ctrl-compass'
    );

    expect(navButtons?.length).toBeGreaterThan(0);
  });

  it('should have scale control visible', () => {
    const map = fixture.mapElement.getMap?.();
    const mapContainer = (map as { _container?: ParentNode })?._container;
    const scaleElements = mapContainer?.querySelectorAll(
      '.maplibregl-ctrl-scale, .mapboxgl-ctrl-scale'
    );

    expect(scaleElements?.length).toBeGreaterThan(0);
  });

  it('should have fullscreen control visible', () => {
    const map = fixture.mapElement.getMap?.();
    const mapContainer = (map as { _container?: ParentNode })?._container;
    const fullscreenButtons = mapContainer?.querySelectorAll(
      '.maplibregl-ctrl-fullscreen, .mapboxgl-ctrl-fullscreen'
    );

    expect(fullscreenButtons?.length).toBeGreaterThan(0);
  });
});
