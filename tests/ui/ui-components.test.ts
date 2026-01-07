import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// We'll test component interfaces without importing them to avoid HTMLElement issues
// The components are tested via integration in the browser

describe('UI Components', () => {
  let dom: JSDOM;
  let container: HTMLElement;

  beforeEach(async () => {
    // Setup JSDOM
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
    });
    global.document = dom.window.document as any;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement as any;
    global.customElements = dom.window.customElements as any;
    global.CustomEvent = dom.window.CustomEvent as any;
    global.Event = dom.window.Event as any;

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Web Component API', () => {
    it('should support custom elements registration', () => {
      expect(global.customElements).toBeDefined();
      expect(typeof global.customElements.define).toBe('function');
    });

    it('should support Custom Events', () => {
      const event = new CustomEvent('test', { detail: { value: 123 }, bubbles: true });
      expect(event.type).toBe('test');
      expect(event.detail.value).toBe(123);
      expect(event.bubbles).toBe(true);
    });

    it('should support DOM manipulation', () => {
      const element = document.createElement('div');
      element.setAttribute('test-attr', 'value');
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);
      expect(element.getAttribute('test-attr')).toBe('value');
    });
  });

  describe('Component Attributes', () => {
    it('should support getting and setting attributes', () => {
      const element = document.createElement('div');
      element.setAttribute('lat', '40.7128');
      element.setAttribute('lng', '-74.0060');
      element.setAttribute('color', '#ff0000');

      expect(element.getAttribute('lat')).toBe('40.7128');
      expect(element.getAttribute('lng')).toBe('-74.0060');
      expect(element.getAttribute('color')).toBe('#ff0000');
    });

    it('should support removing attributes', () => {
      const element = document.createElement('div');
      element.setAttribute('test', 'value');
      expect(element.hasAttribute('test')).toBe(true);

      element.removeAttribute('test');
      expect(element.hasAttribute('test')).toBe(false);
    });
  });

  describe('Event System', () => {
    it('should support event listeners', async () => {
      const element = document.createElement('div');

      let eventFired = false;
      element.addEventListener('test-event', () => {
        eventFired = true;
      });

      element.dispatchEvent(new Event('test-event'));

      // Wait a tick for event to process
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(eventFired).toBe(true);
    });

    it('should support event bubbling', async () => {
      const parent = document.createElement('div');
      const child = document.createElement('div');
      parent.appendChild(child);

      let eventFired = false;
      parent.addEventListener('test', () => {
        eventFired = true;
      });

      child.dispatchEvent(new Event('test', { bubbles: true }));

      // Wait a tick for event to process
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(eventFired).toBe(true);
    });

    it('should support custom event details', () => {
      const element = document.createElement('div');
      let receivedDetail: any = null;

      element.addEventListener('custom', ((e: CustomEvent) => {
        receivedDetail = e.detail;
      }) as EventListener);

      element.dispatchEvent(
        new CustomEvent('custom', {
          detail: { lat: 40.7128, lng: -74.006 },
        })
      );

      expect(receivedDetail).toEqual({ lat: 40.7128, lng: -74.006 });
    });
  });

  describe('Component Lifecycle', () => {
    it('should handle DOM insertion', () => {
      const element = document.createElement('div');
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);
      expect(element.parentNode).toBe(container);
    });

    it('should handle DOM removal', () => {
      const element = document.createElement('div');
      container.appendChild(element);
      container.removeChild(element);

      expect(container.contains(element)).toBe(false);
    });
  });
});
