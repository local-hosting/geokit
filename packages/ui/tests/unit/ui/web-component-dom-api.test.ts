import { describe, it, expect, beforeEach, afterEach } from 'vitest';
describe('Web component DOM API', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
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
      let received = false;

      element.addEventListener('custom-event', () => {
        received = true;
      });

      element.dispatchEvent(new CustomEvent('custom-event'));
      expect(received).toBe(true);
    });

    it('should support event detail propagation', () => {
      const element = document.createElement('div');
      let detail: unknown;

      element.addEventListener('data-event', (e) => {
        detail = (e as CustomEvent).detail;
      });

      element.dispatchEvent(new CustomEvent('data-event', { detail: { id: 42 } }));
      expect(detail).toEqual({ id: 42 });
    });

    it('should support removing event listeners', () => {
      const element = document.createElement('div');
      let count = 0;
      const handler = () => {
        count++;
      };

      element.addEventListener('repeat', handler);
      element.dispatchEvent(new CustomEvent('repeat'));
      element.removeEventListener('repeat', handler);
      element.dispatchEvent(new CustomEvent('repeat'));

      expect(count).toBe(1);
    });
  });
});
