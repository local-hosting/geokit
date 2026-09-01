import { JSDOM } from 'jsdom';

export type JsdomFixture = {
  dom: JSDOM;
  cleanup: () => void;
};

/** Install a minimal jsdom window/document for tests that need explicit DOM globals. */
export function installJsdomWindow(
  html = '<!DOCTYPE html><html><body></body></html>'
): JsdomFixture {
  const dom = new JSDOM(html, { url: 'http://localhost' });
  const { window } = dom;

  global.document = window.document as typeof document;
  global.window = window as unknown as Window & typeof globalThis;
  global.HTMLElement = window.HTMLElement;
  global.customElements = window.customElements;
  global.CustomEvent = window.CustomEvent;
  global.Event = window.Event;

  return {
    dom,
    cleanup: () => {
      dom.window.close();
    },
  };
}
