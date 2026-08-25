import '../../packages/ui/src/theme.css';
import { mountDemoNavFromDocument } from './nav.js';
import { configure } from '../../packages/ui/src/providers/registry.ts';

const ELEMENT_LOADERS = {
  point: () => import('../../packages/ui/src/components/elements/point/point'),
  popup: () => import('../../packages/ui/src/components/elements/popup/popup'),
  isochrone: () => import('../../packages/ui/src/components/elements/isochrone/isochrone'),
  polygon: () => import('../../packages/ui/src/components/elements/polygon.ts'),
  layer: () => import('../../packages/ui/src/components/elements/layer/layer.ts'),
  h3: () => import('../../packages/ui/src/components/elements/h3.ts'),
  'navigation-control': () => import('../../packages/ui/src/components/controls/navigation-control.ts'),
  marker: () => import('../../packages/ui/src/components/elements/marker.ts'),
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
    await import('../../packages/ui/src/index.ts');
  } else {
    await import('../../packages/ui/src/elements-lite.ts');
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
    console.warn('[gk-demo] No Mapbox token found. Isochrones will not work. Set MAPBOX_TOKEN environment variable.');
    return;
  }
  const initMapbox = async () => {
    try {
      const { registerService, initService } = await import('@geokit/service/registry');
      const { MapboxService } = await import('@geokit/mapbox');
      registerService('mapbox', new MapboxService());
      await initService('mapbox', { accessToken: mapboxToken });
    } catch (error) {
      console.warn('[gk-demo] Failed to register Mapbox API provider:', error);
    }
  };
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => void initMapbox(), { timeout: 2000 });
  } else {
    setTimeout(() => void initMapbox(), 2000);
  }
}
