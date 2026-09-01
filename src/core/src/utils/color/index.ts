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

  let normalized = hex.startsWith('#') ? hex.slice(1) : hex;
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

export function hexToRgb(hex: string, fallback: Rgb = { r: 136, g: 136, b: 136 }): Rgb {
  if (!hex || typeof hex !== 'string') {
    return fallback;
  }

  let normalized = hex.replace(
    /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
    (_match, red: string, green: string, blue: string) => red + red + green + green + blue + blue
  );

  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!match) {
    return fallback;
  }

  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
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
