import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Browser-only tests for control rendering
 * These tests require real WebGL support and must be run with Playwright
 * Run with: yarn test:browser:controls
 */
describe('Control Rendering', () => {
  let container: HTMLDivElement;
  let mapElement: HTMLElement & { getMap?: () => any };

  beforeEach(async () => {
    // Dynamically import to avoid loading MapLibre GL at module load time
    const { registerUIProvider, setUIProvider } = await import(
      '../../../src/ui/providers/registry'
    );
    const { MapTilerUIProvider } = await import('../../../src/ui/providers/maptiler-provider');

    // Import and register custom elements - must be done before creating elements
    await import('../../../src/ui/components/elements/map');
    await import('../../../src/ui/components/controls/navigation-control');
    await import('../../../src/ui/components/controls/scale-control');
    await import('../../../src/ui/components/controls/fullscreen-control');

    // Wait for custom elements to be defined
    await customElements.whenDefined('gk-map');
    await customElements.whenDefined('gk-control-navigation');
    await customElements.whenDefined('gk-control-scale');
    await customElements.whenDefined('gk-control-fullscreen');

    // Setup MapTiler provider
    const provider = new MapTilerUIProvider();
    registerUIProvider('maptiler', provider);
    await setUIProvider('maptiler', {
      apiKey: import.meta.env.MAPTILER_API_KEY || 'test-key',
    });

    // Create container div
    container = document.createElement('div');
    container.className = 'demo-card';
    container.style.width = '400px';
    container.style.height = '400px';
    document.body.appendChild(container);

    // Create map element - now safe since custom element is defined
    // In Playwright, we need to append before setting attributes for custom elements
    mapElement = document.createElement('gk-map') as HTMLElement & { getMap?: () => any };
    mapElement.style.width = '100%';
    mapElement.style.height = '100%';
    container.appendChild(mapElement);

    // Set attributes after appending to DOM (Playwright requirement)
    mapElement.setAttribute('api-key', import.meta.env.MAPTILER_API_KEY || 'test-key');
    mapElement.setAttribute('lat', '40.7128');
    mapElement.setAttribute('lng', '-74.006');
    mapElement.setAttribute('zoom', '10');

    // Add controls
    const navControl = document.createElement('gk-control-navigation');
    navControl.setAttribute('position', 'top-right');
    mapElement.appendChild(navControl);

    const scaleControl = document.createElement('gk-control-scale');
    scaleControl.setAttribute('position', 'bottom-left');
    scaleControl.setAttribute('unit', 'imperial');
    mapElement.appendChild(scaleControl);

    const fullscreenControl = document.createElement('gk-control-fullscreen');
    fullscreenControl.setAttribute('position', 'top-left');
    mapElement.appendChild(fullscreenControl);

    // Wait for map to be ready with timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        mapElement.removeEventListener('gk-ready', handler);
        reject(new Error('Map initialization timeout after 30 seconds'));
      }, 30000); // 30 second timeout for browser environment

      const handler = () => {
        clearTimeout(timeout);
        mapElement.removeEventListener('gk-ready', handler);
        resolve();
      };
      mapElement.addEventListener('gk-ready', handler);

      // Also check if map is already ready
      if (mapElement.getMap?.()) {
        clearTimeout(timeout);
        mapElement.removeEventListener('gk-ready', handler);
        resolve();
      }
    });

    // Wait for controls to be added
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterEach(() => {
    if (container && container.parentElement) {
      container.remove();
    }
  });

  it('should have control custom elements in DOM', () => {
    const navControl = mapElement.querySelector('gk-control-navigation');
    const scaleControl = mapElement.querySelector('gk-control-scale');
    const fullscreenControl = mapElement.querySelector('gk-control-fullscreen');

    expect(navControl).not.toBeNull();
    expect(scaleControl).not.toBeNull();
    expect(fullscreenControl).not.toBeNull();
  });

  it('should have SDK controls rendered in shadow DOM', () => {
    const map = mapElement.getMap?.();
    expect(map).toBeDefined();

    // Check if map has controls
    const mapContainer = (map as any)?._container;
    expect(mapContainer).toBeDefined();

    // Look for MapTiler SDK control containers
    const controlContainers = mapContainer?.querySelectorAll('.maplibregl-ctrl, .mapboxgl-ctrl');
    // console.log('Control containers found:', controlContainers?.length);
    // console.log('Control containers:', Array.from(controlContainers || []).map((c: any) => c.className));

    expect(controlContainers.length).toBeGreaterThan(0);
  });

  it('should have navigation control visible', () => {
    const _navControl = mapElement.querySelector('gk-control-navigation');
    const map = mapElement.getMap?.();
    const mapContainer = (map as any)?._container;

    // Look for navigation control in map container
    const navButtons = mapContainer?.querySelectorAll(
      '.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-zoom-out, .maplibregl-ctrl-compass'
    );
    // console.log('Navigation buttons found:', navButtons?.length);

    expect(navButtons).toBeDefined();
    expect(navButtons?.length).toBeGreaterThan(0);
  });

  it('should have scale control visible', () => {
    const _scaleControl = mapElement.querySelector('gk-control-scale');
    const map = mapElement.getMap?.();
    const mapContainer = (map as any)?._container;

    // Look for scale control in map container
    const scaleElements = mapContainer?.querySelectorAll(
      '.maplibregl-ctrl-scale, .mapboxgl-ctrl-scale'
    );
    // console.log('Scale elements found:', scaleElements?.length);

    expect(scaleElements).toBeDefined();
    expect(scaleElements?.length).toBeGreaterThan(0);
  });

  it('should have fullscreen control visible', () => {
    const _fullscreenControl = mapElement.querySelector('gk-control-fullscreen');
    const map = mapElement.getMap?.();
    const mapContainer = (map as any)?._container;

    // Look for fullscreen control in map container
    const fullscreenButtons = mapContainer?.querySelectorAll(
      '.maplibregl-ctrl-fullscreen, .mapboxgl-ctrl-fullscreen'
    );
    // console.log('Fullscreen buttons found:', fullscreenButtons?.length);

    expect(fullscreenButtons).toBeDefined();
    expect(fullscreenButtons?.length).toBeGreaterThan(0);
  });
});
