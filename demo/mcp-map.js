// Minimal geokit host for MCP open_map — query params drive viewport; no Fieldwise.
import { mountDemoNav } from './nav.js';
import '../src/ui/theme.css';

mountDemoNav('mcp-map');
import { configure } from '../src/ui/providers/registry.ts';

const params = new URLSearchParams(window.location.search);
const lat = Number(params.get('lat') ?? '39.8283');
const lng = Number(params.get('lng') ?? '-98.5795');
const zoom = Number(params.get('zoom') ?? '4');
const theme = 'light';

const maptilerKey = import.meta.env.MAPTILER_KEY;
if (!maptilerKey) {
  console.warn('[mcp-map] MAPTILER_KEY missing — set it in packages/geokit/.env');
}

configure({
  maptiler: { apiKey: maptilerKey },
});

await import('../src/ui/core.ts');

const mapElement = document.getElementById('mcp-map');
if (mapElement) {
  mapElement.setAttribute('lat', String(lat));
  mapElement.setAttribute('lng', String(lng));
  mapElement.setAttribute('zoom', String(zoom));
  mapElement.setAttribute('theme', theme);
}
