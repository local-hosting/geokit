import '../../src/ui/theme.css';
import { mountDemoNavFromDocument } from './nav.js';
import { configure } from '../../src/ui/providers/registry.ts';

const ELEMENT_LOADERS = {
  point: () => import('../../src/ui/components/elements/point/point'),
  popup: () => import('../../src/ui/components/elements/popup/popup'),
  isochrone: () => import('../../src/ui/components/elements/isochrone/isochrone'),
  polygon: () => import('../../src/ui/components/elements/polygon.ts'),
  layer: () => import('../../src/ui/components/elements/layer/layer.ts'),
  h3: () => import('../../src/ui/components/elements/h3.ts'),
  'navigation-control': () => import('../../src/ui/components/controls/navigation-control.ts'),
};

/** @param {{ mountNav?: boolean, elements?: string[], useFullUi?: boolean }} [options] */
export async function setupMapsDemo(options = {}) {
  const { mountNav = true, elements = [], useFullUi = false } = options;

  if (mountNav) mountDemoNavFromDocument();

  const maptilerKey = import.meta.env.MAPTILER_KEY;
  const mapboxToken = import.meta.env.MAPBOX_TOKEN;
  configure({
    maptiler: { apiKey: maptilerKey },
    mapbox: { accessToken: mapboxToken },
  });

  if (useFullUi) {
    await import('../../src/ui/index.ts');
  } else {
    await import('../../src/ui/core.ts');
    if (elements.length > 0) {
      await Promise.all(
        elements.map((key) => {
          const load = ELEMENT_LOADERS[key];
          if (!load) throw new Error(`Unknown demo element: ${key}`);
          return load();
        })
      );
    }
  }

  return { maptilerKey, mapboxToken };
}

/** @param {string | undefined} mapboxToken */
export function scheduleMapboxApiInit(mapboxToken) {
  if (!mapboxToken) {
    console.warn('[Demo] No Mapbox token found. Isochrones will not work. Set MAPBOX_TOKEN environment variable.');
    return;
  }
  const initMapbox = async () => {
    try {
      const { registerAPIProvider, initAPIProvider, MapboxAPIProvider } = await import('../../src/api/index.ts');
      registerAPIProvider('mapbox', new MapboxAPIProvider());
      await initAPIProvider('mapbox', { accessToken: mapboxToken });
    } catch (error) {
      console.warn('[Demo] Failed to register Mapbox API provider:', error);
    }
  };
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => void initMapbox(), { timeout: 2000 });
  } else {
    setTimeout(() => void initMapbox(), 2000);
  }
}
