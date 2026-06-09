import {
  canonicalDmaCdnSlug,
  createDmaRegionClusterLoader,
  dmaMarketIndexUrl,
  dmaMarketShapeUrl,
  dmaRegionBySlugFromRegionIndex,
  dmaRegionIndexUrl,
  dmaRegionShardUrl,
  validateIdentityJwt,
} from '../../src/cdn/index.ts';
import { boundsFromFeatures } from '../../src/cdn/bounds.ts';
import { getDMAColor } from '../../src/ui/utils/dma-colors.ts';
import { buildChoroplethFillPaint } from '../../src/ui/utils/choropleth-fill-paint.ts';
import { mountDemoNavFromDocument } from '../shared/nav.js';
import {
  appendLog,
  cdnBaseLabel,
  fitBounds,
  getCdnOptions,
  wireMapDemo,
} from './shared.js';

mountDemoNavFromDocument();

const logEl = document.getElementById('log');
const jwtInput = document.getElementById('jwt');
const base = cdnBaseLabel();
const opts = getCdnOptions();
const mapReady = wireMapDemo(document.getElementById('map'));

/** @type {Map<string, string>} */
let regionBySlug = new Map();

function requestInit() {
  const headers = { Accept: 'application/json' };
  const raw = jwtInput.value.trim();
  if (raw) {
    headers.Authorization = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
  }
  return { headers };
}

const loader = createDmaRegionClusterLoader({
  ...opts,
  getRequestInit: requestInit,
  onIndexLoaded: detail => appendLog(logEl, 'region index loaded', detail),
  onIndexUnavailable: detail => appendLog(logEl, 'region index unavailable', detail),
  onShardUnavailable: detail => appendLog(logEl, 'region shard unavailable', detail),
  onMerge: detail => appendLog(logEl, 'shards merged', detail),
});

function enrichDmaColors(collection) {
  return {
    type: 'FeatureCollection',
    features: collection.features.map(feature => {
      const slug = String(feature.properties?.slug ?? feature.id ?? '').toLowerCase();
      const region = regionBySlug.get(slug) ?? 'unknown';
      return {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          slug,
          color: getDMAColor(slug, region),
        },
      };
    }),
  };
}

async function showCollection(collection, label) {
  const map = await mapReady;
  if (!collection?.features?.length) {
    appendLog(logEl, `${label}: no features`);
    return;
  }

  const colored = enrichDmaColors(collection);
  const sourceId = 'dma-demo';

  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(colored);
  } else {
    map.addSource(sourceId, { type: 'geojson', data: colored });
    map.addLayer({
      id: `${sourceId}-fill`,
      type: 'fill',
      source: sourceId,
      paint: buildChoroplethFillPaint(map, {
        'fill-color': ['coalesce', ['get', 'color'], '#666666'],
        'fill-opacity': 0.35,
      }),
    });
    map.addLayer({
      id: `${sourceId}-line`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#666666'],
        'line-width': 1.5,
      },
    });
  }

  const bounds = boundsFromFeatures(colored.features);
  fitBounds(map, bounds);
  appendLog(logEl, label, {
    features: colored.features.length,
    bounds,
  });
}

document.getElementById('paths').addEventListener('click', () => {
  const slug = document.getElementById('slug').value.trim();
  const region = document.getElementById('region').value.trim();
  const canonical = canonicalDmaCdnSlug(slug);
  logEl.textContent = '';
  appendLog(logEl, 'baseUrl', base);
  appendLog(logEl, 'dmaRegionIndexUrl', dmaRegionIndexUrl(base));
  appendLog(logEl, 'dmaRegionShardUrl', dmaRegionShardUrl(base, region));
  appendLog(logEl, 'dmaMarketIndexUrl', dmaMarketIndexUrl(base));
  appendLog(logEl, 'dmaMarketShapeUrl', dmaMarketShapeUrl(base, canonical));
  if (canonical !== slug.toLowerCase()) {
    appendLog(logEl, 'canonicalDmaCdnSlug', { input: slug, canonical });
  }
});

document.getElementById('validate-jwt').addEventListener('click', () => {
  const raw = jwtInput.value.trim();
  if (!raw) {
    appendLog(logEl, 'validateIdentityJwt: no token — production DMA paths return 401 without Bearer JWT');
    return;
  }
  appendLog(logEl, 'validateIdentityJwt', validateIdentityJwt(raw));
});


async function fetchDevIdentityToken() {
  appendLog(logEl, 'GET /api/cdn/identity-token (geokit demo dev mint)');
  try {
    const res = await fetch('/api/cdn/identity-token', { credentials: 'same-origin' });
    if (!res.ok) {
      appendLog(logEl, 'dev token failed', {
        status: res.status,
        hint: 'set GLOBE_CDN_JWT_SECRET in packages/geokit/.env or apps/fieldwise/.env, then restart yarn dev:cdn',
      });
      return null;
    }
    const body = await res.json();
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token) {
      appendLog(logEl, 'dev token empty');
      return null;
    }
    jwtInput.value = token;
    appendLog(logEl, 'dev token loaded', validateIdentityJwt(token));
    return token;
  } catch (err) {
    appendLog(logEl, 'dev token error', String(err));
    return null;
  }
}

document.getElementById('fetch-dev-token').addEventListener('click', () => {
  void fetchDevIdentityToken();
});

async function ensureJwtBeforeLoad(action) {
  if (jwtInput.value.trim()) return true;
  appendLog(logEl, 'no JWT — fetching dev token…');
  const token = await fetchDevIdentityToken();
  if (!token) {
    appendLog(logEl, action + ' blocked — paste JWT or fix GLOBE_CDN_JWT_SECRET');
    return false;
  }
  return true;
}

document.getElementById('index').addEventListener('click', async () => {
  if (!(await ensureJwtBeforeLoad('Load region index'))) return;
  appendLog(logEl, 'fetchDmaRegionClusterIndex()');
  const index = await loader.fetchIndex();
  if (!index) return;
  regionBySlug = dmaRegionBySlugFromRegionIndex(index);
  appendLog(logEl, 'index summary', {
    regions: index.entries.length,
    markets: regionBySlug.size,
    resolution: index.resolution,
  });
});

document.getElementById('shard').addEventListener('click', async () => {
  if (!(await ensureJwtBeforeLoad('Load region shard'))) return;
  const regionId = document.getElementById('region').value.trim().toLowerCase();
  appendLog(logEl, `fetchRegionShardGeoJson(${regionId})`);
  const geojson = await loader.fetchRegionShardGeoJson(regionId);
  if (!geojson) return;
  await showCollection(geojson, `region ${regionId}`);
});

document.getElementById('market').addEventListener('click', async () => {
  if (!(await ensureJwtBeforeLoad('Load market slug'))) return;
  const slug = canonicalDmaCdnSlug(document.getElementById('slug').value.trim());
  appendLog(logEl, `loadFeaturesForSlugs([${slug}])`);
  const index = await loader.fetchIndex();
  if (index) regionBySlug = dmaRegionBySlugFromRegionIndex(index);
  const target = new Map();
  const result = await loader.loadFeaturesForSlugs([slug], target);
  appendLog(logEl, 'load result', result);
  await showCollection(
    { type: 'FeatureCollection', features: [...target.values()] },
    `market ${slug}`
  );
});

document.getElementById('paths').click();
