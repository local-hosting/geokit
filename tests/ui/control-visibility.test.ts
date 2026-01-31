import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Skip these tests in jsdom/happy-dom environment as MapLibre GL requires real browser WebGL
// These tests require real WebGL support which is available in Playwright browser environment
// Run with: yarn test:browser:controls
function canCreateWebGLContext(): boolean {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

const isTestEnv =
  typeof navigator !== 'undefined' &&
  (navigator.userAgent.includes('jsdom') ||
    navigator.userAgent.includes('Happy DOM') ||
    navigator.userAgent.includes('happy-dom') ||
    typeof WebGLRenderingContext === 'undefined' ||
    !canCreateWebGLContext());

describe.skipIf(isTestEnv)('Control Visibility Toggle', () => {
  let container: HTMLDivElement;
  let mapElement: HTMLElement & { getMap?: () => unknown };

  beforeEach(async () => {
    // Dynamically import to avoid loading MapLibre GL at module load time
    const { registerUIProvider, setUIProvider } = await import('../../src/ui/providers/registry');
    const { MapTilerUIProvider } = await import('../../src/ui/providers/maptiler-provider');
    await import('../../src/ui/components/elements/map');
    await import('../../src/ui/components/controls/navigation-control');
    await import('../../src/ui/components/controls/scale-control');

    // Setup MapTiler provider
    const provider = new MapTilerUIProvider();
    registerUIProvider('maptiler', provider);
    await setUIProvider('maptiler', {
      apiKey: import.meta.env.MAPTILER_KEY || 'test-key',
    });

    // Create container div
    container = document.createElement('div');
    container.className = 'demo-card';
    container.style.width = '400px';
    container.style.height = '400px';
    document.body.appendChild(container);

    // Create map element
    mapElement = document.createElement('gk-map') as HTMLElement & { getMap?: () => unknown };
    mapElement.setAttribute('api-key', import.meta.env.MAPTILER_KEY || 'test-key');
    mapElement.setAttribute('lat', '40.7128');
    mapElement.setAttribute('lng', '-74.006');
    mapElement.setAttribute('zoom', '10');
    mapElement.style.width = '100%';
    mapElement.style.height = '100%';

    // Add controls
    const navControl = document.createElement('gk-control-navigation');
    navControl.setAttribute('position', 'top-right');
    mapElement.appendChild(navControl);

    const scaleControl = document.createElement('gk-control-scale');
    scaleControl.setAttribute('position', 'bottom-left');
    scaleControl.setAttribute('unit', 'imperial');
    mapElement.appendChild(scaleControl);

    container.appendChild(mapElement);

    // Wait for map to be ready with timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        mapElement.removeEventListener('gk-ready', handler);
        reject(new Error('Map initialization timeout'));
      }, 5000); // 5 second timeout

      const handler = () => {
        clearTimeout(timeout);
        mapElement.removeEventListener('gk-ready', handler);
        resolve();
      };
      mapElement.addEventListener('gk-ready', handler);
    }).catch(() => {
      // If map doesn't initialize, skip the test
      throw new Error('Map failed to initialize - skipping test');
    });

    // Wait a bit more for controls to be added
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterEach(() => {
    if (container && container.parentElement) {
      container.remove();
    }
  });

  it('should toggle map-active class on click', async () => {
    // Initially, container should not have map-active class
    expect(container.classList.contains('map-active')).toBe(false);

    // Click on the map
    mapElement.click();

    // Wait for click handler
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Container should now have map-active class
    expect(container.classList.contains('map-active')).toBe(true);

    // Click again
    mapElement.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Container should no longer have map-active class (toggle off)
    expect(container.classList.contains('map-active')).toBe(false);
  });

  it('should dispatch mapi-control-visibility-toggle event', async () => {
    let eventFired = false;
    let eventDetail: { active: boolean; map: unknown } | null = null;

    const handler = (e: Event) => {
      eventFired = true;
      eventDetail = (e as CustomEvent).detail;
    };

    mapElement.addEventListener('gk-control-visibility-toggle', handler);

    // Click on the map
    mapElement.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(eventFired).toBe(true);
    expect(eventDetail).not.toBeNull();
    expect(eventDetail?.active).toBe(true);
    expect(eventDetail?.map).toBeDefined();

    mapElement.removeEventListener('gk-control-visibility-toggle', handler);
  });

  it('should remove map-active from other containers when clicked', async () => {
    // Create a second container and map
    const container2 = document.createElement('div');
    container2.className = 'demo-card';
    container2.style.width = '400px';
    container2.style.height = '400px';
    document.body.appendChild(container2);

    const mapElement2 = document.createElement('gk-map') as HTMLElement & {
      getMap?: () => unknown;
    };
    mapElement2.setAttribute('api-key', import.meta.env.MAPTILER_KEY || 'test-key');
    mapElement2.setAttribute('lat', '40.7128');
    mapElement2.setAttribute('lng', '-74.006');
    mapElement2.setAttribute('zoom', '10');
    mapElement2.style.width = '100%';
    mapElement2.style.height = '100%';
    container2.appendChild(mapElement2);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        mapElement2.removeEventListener('gk-ready', handler);
        reject(new Error('Map initialization timeout'));
      }, 5000);

      const handler = () => {
        clearTimeout(timeout);
        mapElement2.removeEventListener('gk-ready', handler);
        resolve();
      };
      mapElement2.addEventListener('gk-ready', handler);
    }).catch(() => {
      throw new Error('Map failed to initialize - skipping test');
    });

    // Click first map
    mapElement.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(container.classList.contains('map-active')).toBe(true);
    expect(container2.classList.contains('map-active')).toBe(false);

    // Click second map
    mapElement2.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(container.classList.contains('map-active')).toBe(false);
    expect(container2.classList.contains('map-active')).toBe(true);

    // Cleanup
    container2.remove();
  });

  it('should not toggle controls for hero maps', async () => {
    // Create a hero map
    const heroContainer = document.createElement('div');
    heroContainer.className = 'hero-map';
    heroContainer.style.width = '400px';
    heroContainer.style.height = '400px';
    document.body.appendChild(heroContainer);

    const heroMap = document.createElement('gk-map') as HTMLElement & { getMap?: () => unknown };
    heroMap.setAttribute('api-key', import.meta.env.MAPTILER_KEY || 'test-key');
    heroMap.setAttribute('lat', '40.7128');
    heroMap.setAttribute('lng', '-74.006');
    heroMap.setAttribute('zoom', '10');
    heroMap.classList.add('hero-map-element');
    heroMap.style.width = '100%';
    heroMap.style.height = '100%';
    heroContainer.appendChild(heroMap);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        heroMap.removeEventListener('gk-ready', handler);
        reject(new Error('Map initialization timeout'));
      }, 5000);

      const handler = () => {
        clearTimeout(timeout);
        heroMap.removeEventListener('gk-ready', handler);
        resolve();
      };
      heroMap.addEventListener('gk-ready', handler);
    }).catch(() => {
      throw new Error('Map failed to initialize - skipping test');
    });

    // Click hero map
    heroMap.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Hero map container should not have map-active class
    expect(heroContainer.classList.contains('map-active')).toBe(false);

    // Cleanup
    heroContainer.remove();
  });

  it('should respect disable-control-visibility attribute', async () => {
    // Create a map with disabled control visibility
    const disabledContainer = document.createElement('div');
    disabledContainer.className = 'demo-card';
    disabledContainer.style.width = '400px';
    disabledContainer.style.height = '400px';
    document.body.appendChild(disabledContainer);

    const disabledMap = document.createElement('gk-map') as HTMLElement & {
      getMap?: () => unknown;
    };
    disabledMap.setAttribute('api-key', import.meta.env.MAPTILER_KEY || 'test-key');
    disabledMap.setAttribute('lat', '40.7128');
    disabledMap.setAttribute('lng', '-74.006');
    disabledMap.setAttribute('zoom', '10');
    disabledMap.setAttribute('disable-control-visibility', 'true');
    disabledMap.style.width = '100%';
    disabledMap.style.height = '100%';
    disabledContainer.appendChild(disabledMap);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disabledMap.removeEventListener('gk-ready', handler);
        reject(new Error('Map initialization timeout'));
      }, 5000);

      const handler = () => {
        clearTimeout(timeout);
        disabledMap.removeEventListener('gk-ready', handler);
        resolve();
      };
      disabledMap.addEventListener('gk-ready', handler);
    }).catch(() => {
      throw new Error('Map failed to initialize - skipping test');
    });

    // Click disabled map
    disabledMap.click();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Container should not have map-active class
    expect(disabledContainer.classList.contains('map-active')).toBe(false);

    // Cleanup
    disabledContainer.remove();
  });
});
