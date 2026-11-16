export type Rgb = { r: number; g: number; b: number };
export type Hsl = [h: number, s: number, l: number];

export function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n: number) => lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (channel: number) => {
    const hex = Math.round(channel * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

export function hexToHsl(hex: string): Hsl {
  if (!hex) {
    return [0, 0, 0];
  }

  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  let r = 0;
  let g = 0;
  let b = 0;

  if (normalized.length === 3) {
    r = Number.parseInt(normalized[0] + normalized[0], 16);
    g = Number.parseInt(normalized[1] + normalized[1], 16);
    b = Number.parseInt(normalized[2] + normalized[2], 16);
  } else if (normalized.length === 6) {
    r = Number.parseInt(normalized.slice(0, 2), 16);
    g = Number.parseInt(normalized.slice(2, 4), 16);
    b = Number.parseInt(normalized.slice(4, 6), 16);
  } else {
    return [0, 0, 0];
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    s = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, lightness * 100];
}

/** Parse `#rgb` / `#rrggbb` to RGB channels; null when invalid. */
export function tryHexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

export function hexToRgb(hex: string, fallback: Rgb = { r: 136, g: 136, b: 136 }): Rgb {
  if (!hex || typeof hex !== 'string') {
    return fallback;
  }

  const channels = tryHexToRgb(hex.startsWith('#') ? hex : `#${hex}`);
  if (!channels) {
    return fallback;
  }

  return { r: channels[0], g: channels[1], b: channels[2] };
}

/** Mix `from` → `to` by `amount` (0–1). Accepts `#rgb` / `#rrggbb`. */
export function mixHexColors(from: string, to: string, amount: number): string {
  const a = tryHexToRgb(from);
  const b = tryHexToRgb(to);
  if (!a || !b) return amount < 0.5 ? from : to;
  const t = Math.min(1, Math.max(0, amount));
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(a[0] + (b[0] - a[0]) * t)}${toHex(a[1] + (b[1] - a[1]) * t)}${toHex(
    a[2] + (b[2] - a[2]) * t
  )}`;
}

/** Mix `hex` toward white by `amount` (0–1). Accepts `#rgb` / `#rrggbb`. */
export function lightenHexTowardWhite(hex: string, amount: number): string {
  return mixHexColors(hex, '#ffffff', amount);
}

/** Mix `hex` toward black by `amount` (0–1). Accepts `#rgb` / `#rrggbb`. */
export function darkenHexTowardBlack(hex: string, amount: number): string {
  return mixHexColors(hex, '#000000', amount);
}

export interface PaletteCycler {
  next: () => string;
  reset: () => void;
}

/**
 * Cycle through a palette without repeats until the palette is exhausted, then reset.
 */
export function createPaletteCycler(
  palette: readonly string[],
  fallback = '#777777'
): PaletteCycler {
  let available = [...palette];

  const reset = () => {
    available = [...palette];
  };

  const next = () => {
    if (available.length === 0) {
      reset();
    }
    if (available.length === 0) {
      return fallback;
    }
    const index = Math.floor(Math.random() * available.length);
    return available.splice(index, 1)[0];
  };

  return { next, reset };
}
