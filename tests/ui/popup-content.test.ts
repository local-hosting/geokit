import { describe, it, expect } from 'vitest';
import {
  buildPopupContent,
  buildPopupContentGeneric,
} from '../../src/ui/components/elements/popup/popup-content';

describe('Popup content builders', () => {
  it('decodes HTML entities for display text (e.g. &amp;)', () => {
    const el = buildPopupContent('T-Mobile Granite St &amp East Ave', {
      city: 'Las &amp; Vegas',
      state: 'NV',
      'id:store-number': '123 &amp; 456',
    });

    const title = el.querySelector('.geokit-popup-title');
    expect(title?.textContent).toBe('T-Mobile Granite St & East Ave');

    const address = el.querySelector('.geokit-popup-address');
    expect(address?.textContent).toBe('Las & Vegas, NV');

    const tags = Array.from(el.querySelectorAll('.geokit-popup-tag')).map((t) => t.textContent);
    expect(tags).toContain('123 & 456');
  });

  it('decodes numeric entities (e.g. &#x27;) in generic popup tags', () => {
    const el = buildPopupContentGeneric({
      headline: 'Store O&#x27;Dneal &amp; Sons',
      tags: [{ label: 'Name', value: 'Louis O&#x27;Dneal &amp; Co' }],
    });

    const title = el.querySelector('.geokit-popup-title');
    expect(title?.textContent).toContain("Store O'Dneal & Sons");

    const tag = el.querySelector('.geokit-popup-tag');
    // Visible value is truncated (max 12 chars) but should still be decoded.
    expect(tag?.textContent).toContain("Louis O'Dnea");
    expect(tag?.textContent).toContain('…');
    // Full decoded value should be preserved for hover/tooltips.
    expect(tag?.getAttribute('title')).toBe("Louis O'Dneal & Co");
  });
});
