/**
 * Registry for geokit demo pages — map UI only (CDN/DMA demos live in globe-static).
 * @typedef {{ id: string, path: string, label: string, description?: string }} DemoPage
 * @typedef {{ id: string, label: string, items: DemoPage[] }} DemoSection
 */

/** @type {DemoSection[]} */
export const DEMO_SECTIONS = [
  {
    id: 'map',
    label: 'Map',
    items: [
      { id: 'main', path: '/maps/index.html', label: 'Main' },
      { id: 'scrolling', path: '/maps/scrolling.html', label: 'Scrolling' },
      { id: 'centered', path: '/maps/centered.html', label: 'Providers' },
      {
        id: 'h3-viewport',
        path: '/maps/h3-viewport.html',
        label: 'H3 viewport',
        description: 'gk-h3 grid synced to viewport via h3CellsForViewportBounds',
      },
    ],
  },
  {
    id: 'points',
    label: 'Points',
    items: [
      {
        id: 'selection',
        path: '/maps/selection.html',
        label: 'Selection',
        description: 'Shared-point ring on click, setSelectedPoint, gk-point focus',
      },
      {
        id: 'layers-test',
        path: '/maps/layers-test.html',
        label: 'Point layers',
        description: 'MapLibre point layer expressions and category styling',
      },
    ],
  },
];

/** @type {readonly string[]} */
export const DEMO_PAGES = DEMO_SECTIONS.flatMap((section) => section.items.map((item) => item.path));
