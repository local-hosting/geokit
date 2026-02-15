/**
 * Popup UI types (gk-popup element and static helpers)
 */

export interface PopupOptions {
  lat: number;
  lng: number;
  content?: string;
  anchor?: string;
  offset?: number;
  closeButton?: boolean;
}

export interface StyledPopupOptions {
  anchor?: 'top' | 'bottom';
  offset?: number | [number, number];
  closeButton?: boolean;
}

export interface PointPopupProperties {
  [key: string]: unknown;
  'id:google-maps'?: string;
  'id:store-sid'?: string;
  'id:store-number'?: string;
  id?: string;
  address?: string;
  city?: string;
  state?: string;
}

/** A tag with an optional label prefix (e.g. { label: 'DMA', value: 'Albuquerque Santa Fe' }) */
export interface PopupTag {
  label?: string;
  value: string;
}

/** An action link in the popup */
export interface PopupAction {
  label: string;
  href: string;
  svg?: string;
  className?: string;
}

/** Generic popup content options for buildPopupContentGeneric */
export interface PopupContentOptions {
  headline?: string;
  headlineBadge?: string;
  headlineBadgeColor?: string;
  headlineBadge2?: string;
  headlineBadge2Color?: string;
  subhead?: string;
  tags?: (string | PopupTag)[];
  actions?: PopupAction[];
  footerLabel?: string;
}
