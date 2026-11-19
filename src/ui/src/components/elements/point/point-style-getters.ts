import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { pointEl } from './point-el';
import { PointBase } from './point-base';

const DEFAULT_POINT_COLOR = '#38bdf8';

/** Paint/style accessors shared by visual and crosswalk-backed gk-point. */
export class PointStyleGetters extends PointBase {
  get color(): string {
    const fromPropOrAttr =
      pointEl(this)._propColor ??
      pointEl(this).safeGetAttribute('color') ??
      '';
    if (fromPropOrAttr.trim()) return fromPropOrAttr.trim();
    const fromTheme = getCSSVariable(
      pointEl(this).mapElement,
      '--gk-point-color',
      DEFAULT_POINT_COLOR,
    );
    return fromTheme.trim() || DEFAULT_POINT_COLOR;
  }

  get size(): number {
    if (pointEl(this)._propSize !== undefined) return pointEl(this)._propSize;
    return parseInt(pointEl(this).safeGetAttribute('size') || '6', 10) || 6;
  }

  get opacity(): number {
    if (pointEl(this)._propOpacity !== undefined) return pointEl(this)._propOpacity;
    return parseFloat(pointEl(this).safeGetAttribute('opacity') || '1.0') || 1.0;
  }

  get pointBlur(): number {
    if (pointEl(this)._propBlur !== undefined) return pointEl(this)._propBlur;
    return parseFloat(pointEl(this).safeGetAttribute('blur') || '0') || 0;
  }

  get strokeColor(): string {
    const value =
      pointEl(this)._propStrokeColor ??
      pointEl(this).safeGetAttribute('stroke-color') ??
      getCSSVariable(pointEl(this).mapElement, '--gk-point-stroke-color', '#ffffff');
    return value.trim() || '#ffffff';
  }

  get strokeWidth(): number {
    if (pointEl(this)._propStrokeWidth !== undefined) return pointEl(this)._propStrokeWidth;
    const strokeWidth = pointEl(this).safeGetAttribute('stroke-width');
    if (strokeWidth === null || strokeWidth === undefined) return 0;
    const parsed = parseFloat(strokeWidth);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  get strokeOpacity(): number {
    if (pointEl(this)._propStrokeOpacity !== undefined) return pointEl(this)._propStrokeOpacity;
    return parseFloat(pointEl(this).safeGetAttribute('stroke-opacity') || '0.8') || 0.8;
  }

  get shadow(): boolean {
    if (pointEl(this)._propShadow !== undefined) return pointEl(this)._propShadow;
    const shadowAttr = pointEl(this).safeGetAttribute('shadow');
    return shadowAttr !== null && shadowAttr !== 'false';
  }

  get shadowColor(): string {
    const value =
      pointEl(this)._propShadowColor ??
      pointEl(this).safeGetAttribute('shadow-color') ??
      getCSSVariable(pointEl(this).mapElement, '--gk-point-shadow-color', 'rgba(0,0,0,0.35)');
    return value.trim() || 'rgba(0,0,0,0.35)';
  }

  get shadowBlur(): number {
    if (pointEl(this)._propShadowBlur !== undefined) return pointEl(this)._propShadowBlur;
    return parseFloat(pointEl(this).safeGetAttribute('shadow-blur') || '0.8') || 0.8;
  }

  get shadowOpacity(): number {
    if (pointEl(this)._propShadowOpacity !== undefined) return pointEl(this)._propShadowOpacity;
    return parseFloat(pointEl(this).safeGetAttribute('shadow-opacity') || '0.4') || 0.4;
  }

  get glow(): boolean {
    if (pointEl(this)._propGlow !== undefined) return pointEl(this)._propGlow;
    const glowAttr = pointEl(this).safeGetAttribute('glow');
    if (glowAttr === null) return false;
    return glowAttr !== 'false';
  }

  get glowColor(): string {
    return pointEl(this)._propGlowColor ?? pointEl(this).safeGetAttribute('glow-color') ?? pointEl(this).color;
  }

  get glowOpacity(): number {
    if (pointEl(this)._propGlowOpacity !== undefined) return pointEl(this)._propGlowOpacity;
    const attrValue = pointEl(this).safeGetAttribute('glow-opacity');
    if (attrValue) return parseFloat(attrValue) || 0;
    return getCSSVariableNumber(pointEl(this).mapElement, '--gk-point-glow-opacity', 0);
  }

  get glowBlur(): number {
    if (pointEl(this)._propGlowBlur !== undefined) return pointEl(this)._propGlowBlur;
    return (
      parseFloat(pointEl(this).safeGetAttribute('glow-blur') || '') ||
      getCSSVariableNumber(pointEl(this).mapElement, '--gk-glow-blur', 0)
    );
  }
}