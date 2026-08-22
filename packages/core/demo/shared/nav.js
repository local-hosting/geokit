import { DEMO_SECTIONS } from './pages.js';

/**
 * @param {string} activeId
 * @returns {string}
 */
export function renderDemoNav(activeId) {
  const sections = DEMO_SECTIONS.map((section) => {
    const links = section.items
      .map((item) => {
        const active = item.id === activeId ? ' active' : '';
        return `<a href="${item.path}" class="demo-nav-link${active}">${item.label}</a>`;
      })
      .join('');
    return `<div class="demo-nav-section"><span class="demo-nav-label">${section.label}</span><div class="demo-nav-links">${links}</div></div>`;
  }).join('');

  return `<div class="demo-nav-brand">geokit</div>${sections}`;
}

/**
 * @param {string} activeId
 * @param {HTMLElement | null} [host]
 */
export function mountDemoNav(activeId, host = document.getElementById('demo-nav')) {
  if (!host) return;
  host.className = 'demo-nav-host';
  host.innerHTML = renderDemoNav(activeId);
  document.body.classList.add('demo-has-nav');
}

/** Read `data-demo-active` on `<body>` and mount nav. */
export function mountDemoNavFromDocument() {
  const activeId = document.body.dataset.demoActive;
  if (activeId) mountDemoNav(activeId);
}
