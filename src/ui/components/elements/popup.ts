/**
 * Geokit Popup Component
 *
 * Creates styled popups for displaying information on maps
 *
 * Usage:
 * <gk-popup lat="40.7128" lng="-74.0060" content="Hello World"></gk-popup>
 */

import { BaseElement } from '../base-element';
import { getUIProvider } from '../../providers/registry';

export interface PopupOptions {
  lat: number;
  lng: number;
  content?: string;
  anchor?: string;
  offset?: number;
}

export class PopupElement extends BaseElement {
  static observedAttributes = ['lat', 'lng', 'content', 'anchor', 'offset'];

  private popupInstance: any = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected override async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.showPopup();
  }

  private showPopup(): void {
    if (!this.map) return;

    const lat = parseFloat(this.getAttribute('lat') || '');
    const lng = parseFloat(this.getAttribute('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Popup: Invalid lat/lng coordinates');
      return;
    }

    const content = this.getAttribute('content') || '';
    const anchor = this.getAttribute('anchor') || 'bottom';

    // Remove existing popup
    this.removePopup();

    try {
      const provider = getUIProvider();
      const options: any = {
        anchor,
        closeButton: true,
        closeOnClick: false,
      };

      const offset = this.getAttribute('offset');
      if (offset) {
        options.offset = parseInt(offset);
      }

      this.popupInstance = provider.createPopup(options);
      
      if (this.popupInstance) {
        this.popupInstance
          .setLngLat([lng, lat])
          .setHTML(content)
          .addTo(this.map);

        // Dispatch event
        this.dispatchEvent(
          new CustomEvent('popup-opened', {
            detail: { lat, lng, content, element: this },
            bubbles: true,
          })
        );
      }
    } catch (error) {
      console.error('Failed to create popup:', error);
    }
  }

  private removePopup(): void {
    if (this.popupInstance) {
      this.popupInstance.remove();
      this.popupInstance = null;
    }
  }

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (this.isInitialized && oldValue !== newValue) {
      this.showPopup();
    }
  }

  override disconnectedCallback(): void {
    this.removePopup();
    super.disconnectedCallback();
  }

  // Public API
  public open(): void {
    this.showPopup();
  }

  public close(): void {
    this.removePopup();
  }

  public setContent(content: string): void {
    this.setAttribute('content', content);
  }

  public setPosition(lat: number, lng: number): void {
    this.setAttribute('lat', lat.toString());
    this.setAttribute('lng', lng.toString());
  }
}

// Register the custom element
if (!customElements.get('gk-popup')) {
  customElements.define('mapi-popup', PopupElement);
}

