import { DEFAULT_MAP_API_KEY, DEFAULT_MAP_ZOOM, NYC } from '../fixtures/locations';

export type MapControlKind = 'navigation' | 'scale' | 'fullscreen';

export type MapWithControlsOptions = {
  apiKey?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  containerClass?: string;
  controls?: MapControlKind[];
  readyTimeoutMs?: number;
  settleMs?: number;
  appendAttributesBeforeMount?: boolean;
};

export type MapWithControlsFixture = {
  container: HTMLDivElement;
  mapElement: HTMLElement & { getMap?: () => unknown };
  cleanup: () => void;
};

const DEFAULT_CONTROLS: MapControlKind[] = ['navigation', 'scale', 'fullscreen'];

async function waitForMapReady(
  mapElement: HTMLElement & { getMap?: () => unknown },
  timeoutMs: number
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      mapElement.removeEventListener('gk-ready', handler);
      reject(new Error(`Map initialization timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = () => {
      clearTimeout(timeout);
      mapElement.removeEventListener('gk-ready', handler);
      resolve();
    };

    mapElement.addEventListener('gk-ready', handler);

    if (mapElement.getMap?.()) {
      clearTimeout(timeout);
      mapElement.removeEventListener('gk-ready', handler);
      resolve();
    }
  });
}

function appendControl(mapElement: HTMLElement, kind: MapControlKind): void {
  if (kind === 'navigation') {
    const control = document.createElement('gk-control-navigation');
    control.setAttribute('position', 'top-right');
    mapElement.appendChild(control);
    return;
  }

  if (kind === 'scale') {
    const control = document.createElement('gk-control-scale');
    control.setAttribute('position', 'bottom-left');
    control.setAttribute('unit', 'imperial');
    mapElement.appendChild(control);
    return;
  }

  const control = document.createElement('gk-control-fullscreen');
  control.setAttribute('position', 'top-left');
  mapElement.appendChild(control);
}

/**
 * Boot a gk-map with MapTiler provider and optional controls.
 * Used by Playwright browser tests under tests/unit/ui/browser/.
 */
export async function createMapWithControlsFixture(
  options: MapWithControlsOptions = {}
): Promise<MapWithControlsFixture> {
  const {
    apiKey = import.meta.env.MAPTILER_KEY || DEFAULT_MAP_API_KEY,
    lat = NYC.lat,
    lng = NYC.lng,
    zoom = DEFAULT_MAP_ZOOM,
    containerClass = 'demo-card',
    controls = DEFAULT_CONTROLS,
    readyTimeoutMs = 30_000,
    settleMs = 500,
    appendAttributesBeforeMount = true,
  } = options;

  const { registerUIProvider, setUIProvider } = await import('../../src/ui/providers/registry');
  const { MapTilerUIProvider } = await import('../../src/ui/providers/maptiler-provider');

  await import('../../src/ui/components/elements/map/map');

  for (const kind of controls) {
    if (kind === 'navigation') {
      await import('../../src/ui/components/controls/navigation-control');
    } else if (kind === 'scale') {
      await import('../../src/ui/components/controls/scale-control');
    } else {
      await import('../../src/ui/components/controls/fullscreen-control');
    }
  }

  await customElements.whenDefined('gk-map');
  for (const kind of controls) {
    const tag =
      kind === 'navigation'
        ? 'gk-control-navigation'
        : kind === 'scale'
          ? 'gk-control-scale'
          : 'gk-control-fullscreen';
    await customElements.whenDefined(tag);
  }

  const provider = new MapTilerUIProvider();
  registerUIProvider('maptiler', provider);
  await setUIProvider('maptiler', { apiKey });

  const container = document.createElement('div');
  container.className = containerClass;
  container.style.width = '400px';
  container.style.height = '400px';
  document.body.appendChild(container);

  const mapElement = document.createElement('gk-map') as HTMLElement & { getMap?: () => unknown };
  mapElement.style.width = '100%';
  mapElement.style.height = '100%';

  if (!appendAttributesBeforeMount) {
    mapElement.setAttribute('api-key', apiKey);
    mapElement.setAttribute('lat', String(lat));
    mapElement.setAttribute('lng', String(lng));
    mapElement.setAttribute('zoom', String(zoom));
  }

  for (const kind of controls) {
    appendControl(mapElement, kind);
  }

  container.appendChild(mapElement);

  if (appendAttributesBeforeMount) {
    mapElement.setAttribute('api-key', apiKey);
    mapElement.setAttribute('lat', String(lat));
    mapElement.setAttribute('lng', String(lng));
    mapElement.setAttribute('zoom', String(zoom));
  }

  await waitForMapReady(mapElement, readyTimeoutMs);

  if (settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, settleMs));
  }

  return {
    container,
    mapElement,
    cleanup: () => {
      container.remove();
    },
  };
}

/** Create a bare gk-map inside a container (no default controls). */
export async function createMapFixture(
  options: Omit<MapWithControlsOptions, 'controls'> & {
    mapClass?: string;
    disableControlVisibility?: boolean;
  } = {}
): Promise<MapWithControlsFixture> {
  const {
    apiKey = import.meta.env.MAPTILER_KEY || DEFAULT_MAP_API_KEY,
    lat = NYC.lat,
    lng = NYC.lng,
    zoom = DEFAULT_MAP_ZOOM,
    containerClass = 'demo-card',
    mapClass,
    disableControlVisibility = false,
    readyTimeoutMs = 30_000,
    settleMs = 500,
  } = options;

  const { registerUIProvider, setUIProvider } = await import('../../src/ui/providers/registry');
  const { MapTilerUIProvider } = await import('../../src/ui/providers/maptiler-provider');
  await import('../../src/ui/components/elements/map/map');
  await customElements.whenDefined('gk-map');

  const provider = new MapTilerUIProvider();
  registerUIProvider('maptiler', provider);
  await setUIProvider('maptiler', { apiKey });

  const container = document.createElement('div');
  container.className = containerClass;
  container.style.width = '400px';
  container.style.height = '400px';
  document.body.appendChild(container);

  const mapElement = document.createElement('gk-map') as HTMLElement & { getMap?: () => unknown };
  mapElement.style.width = '100%';
  mapElement.style.height = '100%';
  if (mapClass) {
    mapElement.classList.add(mapClass);
  }
  container.appendChild(mapElement);

  mapElement.setAttribute('api-key', apiKey);
  mapElement.setAttribute('lat', String(lat));
  mapElement.setAttribute('lng', String(lng));
  mapElement.setAttribute('zoom', String(zoom));
  if (disableControlVisibility) {
    mapElement.setAttribute('disable-control-visibility', 'true');
  }

  await waitForMapReady(mapElement, readyTimeoutMs);
  if (settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, settleMs));
  }

  return {
    container,
    mapElement,
    cleanup: () => container.remove(),
  };
}

export async function tick(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
