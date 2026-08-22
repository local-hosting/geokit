/**
 * Popup content builders (Single Responsibility: build DOM for popup body)
 */

import type { PointPopupProperties, PopupContentOptions, PopupTag } from '../../../../types/popup';

const EXTERNAL_LINK_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

function decodeHtmlEntitiesForText(value: unknown): string {
  if (value == null) return '';
  const raw = String(value);
  if (!raw.includes('&')) return raw;
  if (typeof document === 'undefined') return raw;

  // Browsers typically require semicolons; upstream data sometimes omits it (e.g. "&amp").
  const normalized = raw.replace(/&amp(?!;)/g, '&amp;');

  // Decode using the browser's entity parser, then always assign via textContent elsewhere.
  const el = document.createElement('textarea');
  el.innerHTML = normalized;
  return el.value;
}

/**
 * Build popup content DOM with title and ID tags (native DOM only, safe from Vue reactivity).
 */
export function buildPopupContent(title?: string, properties?: PointPopupProperties): HTMLElement {
  const listingUrl =
    typeof properties?.url === 'string' && properties.url.trim() ? properties.url.trim() : '';
  const container = document.createElement('div');
  container.setAttribute(
    'class',
    listingUrl ? 'geokit-popup-content geokit-popup-content--listing' : 'geokit-popup-content'
  );

  if (title) {
    const titleEl = document.createElement('h4');
    titleEl.setAttribute('class', 'geokit-popup-title');
    const titleText = decodeHtmlEntitiesForText(title);
    if (listingUrl) {
      const titleLink = document.createElement('a');
      titleLink.setAttribute('class', 'geokit-popup-title-link');
      titleLink.setAttribute('href', listingUrl);
      titleLink.setAttribute('target', '_blank');
      titleLink.setAttribute('rel', 'noopener noreferrer');
      titleLink.textContent = titleText;
      titleEl.appendChild(titleLink);
    } else {
      titleEl.textContent = titleText;
    }
    container.appendChild(titleEl);
  }

  if (properties) {
    const parts: string[] = [];
    if (properties.city) parts.push(decodeHtmlEntitiesForText(properties.city).trim());
    if (properties.state) parts.push(decodeHtmlEntitiesForText(properties.state).trim());
    if (parts.length > 0) {
      const addressEl = document.createElement('h5');
      addressEl.setAttribute('class', 'geokit-popup-address');
      addressEl.textContent = parts.join(', ');
      container.appendChild(addressEl);
    }
  }

  if (properties) {
    const tagsContainer = document.createElement('div');
    tagsContainer.setAttribute('class', 'geokit-popup-tags');
    let hasTags = false;

    const idKeys = Object.keys(properties)
      .filter((key) => key.startsWith('id:'))
      .sort();
    for (const key of idKeys) {
      const val = properties[key];
      if (val != null && val !== '') {
        const tag = document.createElement('span');
        tag.setAttribute('class', 'geokit-popup-tag');
        tag.textContent = decodeHtmlEntitiesForText(String(val));
        tagsContainer.appendChild(tag);
        hasTags = true;
      }
    }
    if (!hasTags && properties.id != null && properties.id !== '') {
      const tag = document.createElement('span');
      tag.setAttribute('class', 'geokit-popup-tag');
      tag.textContent = decodeHtmlEntitiesForText(properties.id);
      tagsContainer.appendChild(tag);
      hasTags = true;
    }
    if (hasTags) container.appendChild(tagsContainer);
  }

  if (listingUrl) {
    const linkLabel = listingUrl.includes('zillow.com') ? 'View on Zillow' : 'View listing';
    const actionsContainer = document.createElement('div');
    actionsContainer.setAttribute('class', 'geokit-popup-actions geokit-popup-actions--listing');
    const linkEl = document.createElement('a');
    linkEl.setAttribute(
      'class',
      'geokit-popup-action geokit-popup-action--text geokit-popup-action--listing'
    );
    linkEl.setAttribute('href', listingUrl);
    linkEl.setAttribute('target', '_blank');
    linkEl.setAttribute('rel', 'noopener noreferrer');
    linkEl.setAttribute('title', linkLabel);
    linkEl.setAttribute('aria-label', linkLabel);
    linkEl.innerHTML = `${linkLabel}${EXTERNAL_LINK_ICON_SVG}`;
    actionsContainer.appendChild(linkEl);
    container.appendChild(actionsContainer);
  }

  return container;
}

/**
 * Build popup content with generic headline, subhead, tags, actions (Open/Closed for extension).
 */
export function buildPopupContentGeneric(options: PopupContentOptions): HTMLElement {
  const {
    headline,
    headlineBadge,
    headlineBadgeColor,
    headlineBadge2,
    headlineBadge2Color,
    subhead,
    tags,
    actions,
    footerLabel,
  } = options;

  const container = document.createElement('div');
  container.setAttribute('class', 'geokit-popup-content');

  if (headline || headlineBadge || headlineBadge2) {
    const headlineEl = document.createElement('h4');
    headlineEl.setAttribute('class', 'geokit-popup-title');

    if (headline) {
      const textSpan = document.createElement('span');
      textSpan.setAttribute('class', 'geokit-popup-title-text');
      textSpan.appendChild(document.createTextNode(decodeHtmlEntitiesForText(headline)));
      headlineEl.appendChild(textSpan);
    }

    if (headlineBadge || headlineBadge2) {
      const badgesWrap = document.createElement('span');
      badgesWrap.setAttribute('class', 'geokit-popup-title-badges');

      if (headlineBadge) {
        const badgeEl = document.createElement('span');
        badgeEl.setAttribute('class', 'geokit-popup-badge');
        badgeEl.textContent = decodeHtmlEntitiesForText(headlineBadge);
        if (headlineBadgeColor) {
          badgeEl.style.background = headlineBadgeColor;
          badgeEl.style.color = '#fff';
        }
        badgesWrap.appendChild(badgeEl);
      }

      if (headlineBadge2) {
        if (headline || headlineBadge) {
          badgesWrap.appendChild(document.createTextNode('\u00A0'));
        }
        const badge2El = document.createElement('span');
        badge2El.setAttribute('class', 'geokit-popup-badge');
        badge2El.textContent = decodeHtmlEntitiesForText(headlineBadge2);
        if (headlineBadge2Color) {
          badge2El.style.background = headlineBadge2Color;
          badge2El.style.color = '#fff';
        }
        badgesWrap.appendChild(badge2El);
      }

      headlineEl.appendChild(badgesWrap);
    }

    container.appendChild(headlineEl);
  }

  if (subhead) {
    const subheadEl = document.createElement('h5');
    subheadEl.setAttribute('class', 'geokit-popup-address');
    subheadEl.textContent = decodeHtmlEntitiesForText(subhead);
    container.appendChild(subheadEl);
  }

  if (tags && tags.length > 0) {
    const tagsContainer = document.createElement('div');
    tagsContainer.setAttribute('class', 'geokit-popup-tags');
    const truncate = (text: string, maxLen = 12) =>
      text.length > maxLen ? text.slice(0, maxLen) + '…' : text;

    for (const tagItem of tags) {
      if (!tagItem) continue;
      const tagEl = document.createElement('span');
      tagEl.setAttribute('class', 'geokit-popup-tag');

      if (typeof tagItem === 'string') {
        const decoded = decodeHtmlEntitiesForText(tagItem);
        tagEl.textContent = truncate(decoded);
        if (decoded.length > 12) tagEl.setAttribute('title', decoded);
      } else {
        if (tagItem.label) {
          const labelEl = document.createElement('span');
          labelEl.setAttribute('class', 'geokit-popup-tag-label');
          labelEl.textContent = decodeHtmlEntitiesForText(tagItem.label);
          tagEl.appendChild(labelEl);
        }
        const decodedValue = decodeHtmlEntitiesForText(tagItem.value);
        const truncatedValue = truncate(decodedValue);
        tagEl.appendChild(document.createTextNode(truncatedValue));
        if (decodedValue.length > 12) tagEl.setAttribute('title', decodedValue);
      }
      tagsContainer.appendChild(tagEl);
    }

    if (tagsContainer.hasChildNodes()) container.appendChild(tagsContainer);
  }

  if ((actions && actions.length > 0) || footerLabel) {
    const actionsContainer = document.createElement('div');
    actionsContainer.setAttribute('class', 'geokit-popup-actions');

    if (footerLabel) {
      const labelEl = document.createElement('span');
      labelEl.setAttribute('class', 'geokit-popup-footer-label');
      labelEl.textContent = decodeHtmlEntitiesForText(footerLabel);
      actionsContainer.appendChild(labelEl);
    }

    const spacer = document.createElement('span');
    spacer.setAttribute('class', 'geokit-popup-actions-spacer');
    actionsContainer.appendChild(spacer);

    if (actions) {
      for (const action of actions) {
        if (!action || !action.label || !action.href) continue;
        const linkEl = document.createElement('a');
        const baseClass = action.svg
          ? 'geokit-popup-action geokit-popup-action--icon'
          : 'geokit-popup-action geokit-popup-action--text';
        linkEl.setAttribute(
          'class',
          action.className ? `${baseClass} ${action.className}` : baseClass
        );
        linkEl.setAttribute('href', action.href);
        linkEl.setAttribute('target', '_blank');
        linkEl.setAttribute('rel', 'noopener noreferrer');
        linkEl.setAttribute('title', decodeHtmlEntitiesForText(action.label));
        if (action.svg) linkEl.innerHTML = action.svg;
        else linkEl.textContent = decodeHtmlEntitiesForText(action.label);
        actionsContainer.appendChild(linkEl);
      }
    }

    container.appendChild(actionsContainer);
  }

  return container;
}

/**
 * Add tags to an existing popup DOM (e.g. async demographics).
 */
export function addTagsToPopup(
  popup: { getElement?: () => HTMLElement | undefined },
  tags: Array<PopupTag | string>
): void {
  if (!popup || !tags || tags.length === 0) return;

  const popupEl = popup.getElement?.();
  if (!popupEl) return;

  let tagsContainer = popupEl.querySelector('.geokit-popup-tags');
  if (!tagsContainer) {
    const contentEl = popupEl.querySelector('.geokit-popup-content');
    if (!contentEl) return;
    tagsContainer = document.createElement('div');
    tagsContainer.setAttribute('class', 'geokit-popup-tags');
    const actionsEl = contentEl.querySelector('.geokit-popup-actions');
    if (actionsEl) contentEl.insertBefore(tagsContainer, actionsEl);
    else contentEl.appendChild(tagsContainer);
  }

  for (const tagItem of tags) {
    if (!tagItem) continue;
    const tagEl = document.createElement('span');
    tagEl.setAttribute('class', 'geokit-popup-tag');
    if (typeof tagItem === 'string') {
      tagEl.textContent = decodeHtmlEntitiesForText(tagItem);
    } else {
      if (tagItem.label) {
        const labelEl = document.createElement('span');
        labelEl.setAttribute('class', 'geokit-popup-tag-label');
        labelEl.textContent = decodeHtmlEntitiesForText(tagItem.label) + ' ';
        tagEl.appendChild(labelEl);
        const valueEl = document.createElement('span');
        valueEl.setAttribute('class', 'geokit-popup-tag-value');
        valueEl.textContent = decodeHtmlEntitiesForText(tagItem.value);
        tagEl.appendChild(valueEl);
      } else {
        tagEl.textContent = decodeHtmlEntitiesForText(tagItem.value);
      }
    }
    tagsContainer.appendChild(tagEl);
  }
}
