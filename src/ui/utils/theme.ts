/**
 * Theme system – style values live in CSS (theme.css).
 * Import theme.css in your app: import '@twinfile/geokit/ui/theme.css'
 * Theme logic here: name + mapStyle only; CSS provides --gk-* variables via :root and gk-map.gk-theme-*.
 */

// ============================================================================
// Types
// ============================================================================

export type ThemeName = 'light' | 'dark';

export interface Theme {
  name: ThemeName;
  /** MapTiler style name (e.g., 'dataviz', 'dataviz-dark') */
  mapStyle: string;
}

// ============================================================================
// Theme definitions (logic only; styles in theme.css)
// ============================================================================

export const darkTheme: Theme = {
  name: 'dark',
  mapStyle: 'dataviz-dark',
};

export const lightTheme: Theme = {
  name: 'light',
  mapStyle: 'dataviz',
};

const themes: Map<ThemeName, Theme> = new Map([
  ['dark', darkTheme],
  ['light', lightTheme],
]);

let currentTheme: Theme = darkTheme;

// ============================================================================
// Theme API
// ============================================================================

export function getTheme(name: ThemeName): Theme {
  return themes.get(name) ?? darkTheme;
}

export function getCurrentTheme(): Theme {
  return currentTheme;
}

export function setCurrentTheme(name: ThemeName): Theme {
  currentTheme = getTheme(name);
  return currentTheme;
}

export function getThemeNames(): ThemeName[] {
  return Array.from(themes.keys());
}

export function isValidTheme(name: string): name is ThemeName {
  return themes.has(name as ThemeName);
}

/**
 * Detect system color scheme preference.
 * Returns 'dark' if prefers-color-scheme: dark, otherwise 'light'.
 */
export function getSystemTheme(): ThemeName {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the MediaQueryList for system color scheme.
 * Useful for listening to system theme changes.
 */
export function getSystemThemeMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  return window.matchMedia('(prefers-color-scheme: dark)');
}

// ============================================================================
// Class-based theming (styles from theme.css)
// ============================================================================

const THEME_CLASS_LIGHT = 'gk-theme-light';
const THEME_CLASS_DARK = 'gk-theme-dark';

/**
 * No-op. Styles are in theme.css – ensure your app imports it:
 * import '@twinfile/geokit/ui/theme.css'
 */
export function injectThemeStyles(): void {
  /* Styles live in theme.css; app must import it. */
}

/**
 * Apply theme by class so CSS (theme.css) supplies --gk-* variables.
 */
export function applyThemeToElement(element: HTMLElement, theme: Theme): void {
  element.classList.remove(THEME_CLASS_LIGHT, THEME_CLASS_DARK);
  element.classList.add(theme.name === 'dark' ? THEME_CLASS_DARK : THEME_CLASS_LIGHT);
}

/**
 * Remove theme class from element (reverts to :root / media defaults).
 */
export function removeThemeFromElement(element: HTMLElement): void {
  element.classList.remove(THEME_CLASS_LIGHT, THEME_CLASS_DARK);
}

// ============================================================================
// CSS variable helpers (read from CSS; no style values in TS)
// ============================================================================

export function getCSSVariable(
  element: Element | null,
  property: string,
  defaultValue: string
): string {
  if (!element || typeof getComputedStyle === 'undefined') return defaultValue;
  const value = getComputedStyle(element).getPropertyValue(property).trim();
  return value || defaultValue;
}

export function getCSSVariableNumber(
  element: Element | null,
  property: string,
  defaultValue: number
): number {
  const value = getCSSVariable(element, property, String(defaultValue));
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}
