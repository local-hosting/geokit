import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMapFixture,
  createMapWithControlsFixture,
  tick,
  type MapWithControlsFixture,
} from '../../../fixtures/map-with-controls';
import { DEFAULT_MAP_API_KEY } from '../../../fixtures/locations';

describe('Map control visibility toggle (browser)', () => {
  let fixture: MapWithControlsFixture;

  beforeEach(async () => {
    fixture = await createMapWithControlsFixture({
      controls: ['navigation', 'scale'],
      settleMs: 500,
    });
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should toggle map-active class on click', async () => {
    const { container, mapElement } = fixture;
    expect(container.classList.contains('map-active')).toBe(false);

    mapElement.click();
    await tick(100);
    expect(container.classList.contains('map-active')).toBe(true);

    mapElement.click();
    await tick(100);
    expect(container.classList.contains('map-active')).toBe(false);
  });

  it('should dispatch gk-control-visibility-toggle event', async () => {
    const { mapElement } = fixture;
    let eventFired = false;
    let eventDetail: { active: boolean; map: unknown } | null = null;

    const handler = (e: Event) => {
      eventFired = true;
      eventDetail = (e as CustomEvent).detail;
    };

    mapElement.addEventListener('gk-control-visibility-toggle', handler);
    mapElement.click();
    await tick(100);

    expect(eventFired).toBe(true);
    expect(eventDetail?.active).toBe(true);
    expect(eventDetail?.map).toBeDefined();

    mapElement.removeEventListener('gk-control-visibility-toggle', handler);
  });

  it('should remove map-active from other containers when clicked', async () => {
    const fixture2 = await createMapFixture({ settleMs: 500 });

    try {
      fixture.mapElement.click();
      await tick(100);
      expect(fixture.container.classList.contains('map-active')).toBe(true);
      expect(fixture2.container.classList.contains('map-active')).toBe(false);

      fixture2.mapElement.click();
      await tick(100);
      expect(fixture.container.classList.contains('map-active')).toBe(false);
      expect(fixture2.container.classList.contains('map-active')).toBe(true);
    } finally {
      fixture2.cleanup();
    }
  });

  it('should not toggle controls for hero maps', async () => {
    const hero = await createMapFixture({
      containerClass: 'hero-map',
      mapClass: 'hero-map-element',
      settleMs: 500,
    });

    try {
      hero.mapElement.click();
      await tick(100);
      expect(hero.container.classList.contains('map-active')).toBe(false);
    } finally {
      hero.cleanup();
    }
  });

  it('should respect disable-control-visibility attribute', async () => {
    const disabled = await createMapFixture({
      disableControlVisibility: true,
      settleMs: 500,
    });

    try {
      disabled.mapElement.setAttribute(
        'api-key',
        import.meta.env.MAPTILER_KEY || DEFAULT_MAP_API_KEY
      );
      disabled.mapElement.click();
      await tick(100);
      expect(disabled.container.classList.contains('map-active')).toBe(false);
    } finally {
      disabled.cleanup();
    }
  });
});
