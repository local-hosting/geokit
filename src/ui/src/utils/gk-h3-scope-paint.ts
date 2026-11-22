import type { GkH3PaintAttributes } from './sync-gk-map-child-attributes';

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
    strokeColor: stroke,
    strokeWidth: 3,
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
    strokeColor: stroke,
    strokeWidth: 2,
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
    strokeColor: stroke,
    strokeWidth: 2,
  };
}

/** Save-hover preview — outer pan-lock hex. */
export function tentativeOuterGkH3PaintForTheme(theme: string): GkH3PaintAttributes {
  const { fill, stroke } = tentativeScopeColors(theme);
  return {
    color: fill,
    opacity: theme === 'dark' ? 0.28 : 0.34,
    strokeColor: stroke,
    strokeWidth: 2,
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
    strokeColor,
    strokeWidth: 2.5,
  };
}