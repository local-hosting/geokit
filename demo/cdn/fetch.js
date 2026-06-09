import { fetchGlobeCdn, fetchGlobeCdnJson } from '../../src/cdn/fetch.ts';
import { mountDemoNavFromDocument } from '../shared/nav.js';
import { appendLog, cdnBaseLabel, getCdnOptions } from './shared.js';

mountDemoNavFromDocument();
const logEl = document.getElementById('log');
const pathInput = document.getElementById('path');
const opts = getCdnOptions();

appendLog(logEl, `baseUrl: ${cdnBaseLabel()}`);

document.getElementById('load').addEventListener('click', async () => {
  const path = pathInput.value.trim();
  appendLog(logEl, `fetchGlobeCdnJson(${path})`);
  const data = await fetchGlobeCdnJson(path, opts);
  if (!data) {
    appendLog(logEl, 'null — check path, Accept header, or CDN availability');
    return;
  }
  const preview =
    typeof data === 'object' && data !== null && 'features' in data
      ? { type: data.type, featureCount: data.features?.length }
      : data;
  appendLog(logEl, 'ok', preview);
});

document.getElementById('head').addEventListener('click', async () => {
  const path = pathInput.value.trim();
  appendLog(logEl, `fetchGlobeCdn HEAD ${path}`);
  const res = await fetchGlobeCdn(path, { ...opts, init: { method: 'GET' } });
  appendLog(logEl, `status ${res.status}`, {
    ok: res.ok,
    contentType: res.headers.get('content-type'),
    cache: res.headers.get('x-vercel-cache'),
  });
});
