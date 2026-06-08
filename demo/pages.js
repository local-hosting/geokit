/**
 * Single registry for geokit demo pages — used by nav and Playwright smoke tests.
 * @typedef {{ id: string, path: string, label: string }} DemoPage
 * @typedef {{ id: string, label: string, items: DemoPage[] }} DemoSection
 */

/** @type {DemoSection[]} */
export const DEMO_SECTIONS = [
  {
    id: 'maps',
    label: 'Maps',
    items: [
      { id: 'main', path: '/index.html', label: 'Main' },
      { id: 'layers-test', path: '/layers-test.html', label: 'Layers' },
      { id: 'scrolling', path: '/scrolling.html', label: 'Scrolling' },
      { id: 'centered', path: '/centered.html', label: 'Providers' },
      { id: 'mcp-map', path: '/mcp-map.html', label: 'MCP' },
    ],
  },
  {
    id: 'cdn',
    label: 'CDN',
    items: [
      { id: 'cdn-hub', path: '/cdn/index.html', label: 'Hub' },
      { id: 'fetch', path: '/cdn/fetch.html', label: 'fetch' },
      { id: 'paths', path: '/cdn/paths.html', label: 'paths' },
      { id: 'bulk', path: '/cdn/bulk.html', label: 'bulk' },
      { id: 'county', path: '/cdn/county.html', label: 'county' },
      { id: 'place', path: '/cdn/place.html', label: 'place' },
      { id: 'bounds', path: '/cdn/bounds.html', label: 'bounds' },
      { id: 'resolve-shape', path: '/cdn/resolve-shape.html', label: 'resolve-shape' },
    ],
  },
];

/** @type {readonly string[]} */
export const DEMO_PAGES = DEMO_SECTIONS.flatMap((section) => section.items.map((item) => item.path));
