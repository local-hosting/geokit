import type { GkH3PaintAttributes } from './sync-gk-map-child-attributes';

/** Scope ring line width (committed / tentative / live outer). */
export const GK_H3_SCOPE_OUTER_STROKE_WIDTH = 2;
export const GK_H3_SCOPE_LIVE_OUTER_STROKE_WIDTH = 2.5;
export const GK_H3_SCOPE_INNER_STROKE_WIDTH = GK_H3_SCOPE_OUTER_STROKE_WIDTH;
export const GK_H3_SCOPE_LIVE_INNER_STROKE_WIDTH = GK_H3_SCOPE_LIVE_OUTER_STROKE_WIDTH;

const GK_H3_SCOPE_OUTER_STROKE_ALPHA = 0.45;
const GK_H3_SCOPE_INNER_STROKE_ALPHA = 0.3;

function hexRgbWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.trim();
  const long = normalized.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  const short = normalized.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
  const expand = (h: string) => (h.length === 1 ? h + h : h);
  const parts = long ?? short;
  if (!parts) return normalized;
  const r = parseInt(expand(parts[1]), 16);
  const g = parseInt(expand(parts[2]), 16);
  const b = parseInt(expand(parts[3]), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Semi-transparent outline for outer pan-lock / scope hex rings. */
export function gkH3ScopeOuterStrokeColor(strokeHex: string): string {
  return hexRgbWithAlpha(strokeHex, GK_H3_SCOPE_OUTER_STROKE_ALPHA);
}

/** Softer outline for inner scope hex (nested inside the outer ring). */
export function gkH3ScopeInnerStrokeColor(strokeHex: string): string {
  return hexRgbWithAlpha(strokeHex, GK_H3_SCOPE_INNER_STROKE_ALPHA);
}

const THEME_H3_COLOR_FALLBACK = {
  light: '#04a86d',
  dark: '#3dd69a',
} as const;

export function resolveGkH3StrokeColor(theme: string, accentHex?: string | null): string {
  const hex = accentHex?.trim();
  if (hex && /^#[0-9a-fA-F]{3,8}$/.test(hex)) return hex;
  return THEME_H3_COLOR_FALLBACK[theme === 'dark' ? 'dark' : 'light'];
}

const COMMITTED_SCOPE_ORANGE = {
  light: { fill: '#fb923c', stroke: '#ea580c' },
  dark: { fill: '#fdba74', stroke: '#f97316' },
} as const;

function committedScopeOrange(theme: string): { fill: string; stroke: string } {
  return COMMITTED_SCOPE_ORANGE[theme === 'dark' ? 'dark' : 'light'];
}

/** Inner geo-scope hex (`gk-h3` on the locker cell). */
export function coreGkH3PaintForTheme(
  theme: string,
  _accentHex?: string | null,
): GkH3PaintAttributes {
  const { fill, stroke } = committedScopeOrange(theme);
  return {
    color: fill,
    opacity: theme === 'dark' ? 0.38 : 0.45,
    strokeColor: gkH3ScopeInnerStrokeColor(stroke),
    strokeWidth: GK_H3_SCOPE_INNER_STROKE_WIDTH,
  };
}

/** Outer pan-lock region — see `mapCameraScopeH3Cells` / `panLockH3CellFromMapCamera`. */
export function outerRegionGkH3PaintForTheme(
  theme: string,
  _accentHex?: string | null,
): GkH3PaintAttributes {
  const { fill, stroke } = committedScopeOrange(theme);
  return {
    color: fill,
    opacity: 0.05,
    strokeColor: gkH3ScopeOuterStrokeColor(stroke),
    strokeWidth: GK_H3_SCOPE_OUTER_STROKE_WIDTH,
  };
}

const TENTATIVE_SCOPE_GRAY = {
  light: { fill: '#d4d4d4', stroke: '#a3a3a3' },
  dark: { fill: '#525252', stroke: '#737373' },
} as const;

function tentativeScopeColors(theme: string): { fill: string; stroke: string } {
  return TENTATIVE_SCOPE_GRAY[theme === 'dark' ? 'dark' : 'light'];
}

/** Save-hover preview — inner hex. */
export function tentativeInnerGkH3PaintForTheme(theme: string): GkH3PaintAttributes {
  const { fill, stroke } = tentativeScopeColors(theme);
  return {
    color: fill,
    opacity: theme === 'dark' ? 0.45 : 0.5,
    strokeColor: gkH3ScopeInnerStrokeColor(stroke),
    strokeWidth: GK_H3_SCOPE_INNER_STROKE_WIDTH,
  };
}

/** Save-hover preview — outer pan-lock hex. */
export function tentativeOuterGkH3PaintForTheme(theme: string): GkH3PaintAttributes {
  const { fill, stroke } = tentativeScopeColors(theme);
  return {
    color: fill,
    opacity: theme === 'dark' ? 0.28 : 0.34,
    strokeColor: gkH3ScopeOuterStrokeColor(stroke),
    strokeWidth: GK_H3_SCOPE_OUTER_STROKE_WIDTH,
  };
}

/** Live pan scope — outer hex matching locker-bar inspect title (`MAP_VIEW_SCOPE_LIVE`). */
export function liveScopeOuterGkH3PaintForTheme(
  theme: string,
  accentHex?: string | null,
): GkH3PaintAttributes {
  const strokeColor = resolveGkH3StrokeColor(theme, accentHex);
  return {
    color: strokeColor,
    opacity: theme === 'dark' ? 0.38 : 0.42,
    strokeColor: gkH3ScopeOuterStrokeColor(strokeColor),
    strokeWidth: GK_H3_SCOPE_LIVE_OUTER_STROKE_WIDTH,
  };
}

/** Live pan scope — inner hex (softer stroke than outer). */
export function liveScopeInnerGkH3PaintForTheme(
  theme: string,
  accentHex?: string | null,
): GkH3PaintAttributes {
  const strokeColor = resolveGkH3StrokeColor(theme, accentHex);
  return {
    ...liveScopeOuterGkH3PaintForTheme(theme, accentHex),
    strokeColor: gkH3ScopeInnerStrokeColor(strokeColor),
  };
}