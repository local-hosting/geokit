/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../../../providers/types.js';
import type { Feature } from '@geokit/core/types';
import { getFeatureId } from '@geokit/core/geojson';
import { getCSSVariable, getCSSVariableNumber } from '../../map-surface/theme.js';
import { debug } from '../../map-surface/logger.js';
import { HOVER_CONFIG, type HoverStateHandlers } from '../../map-surface/feature-state-hover.js';
import {
  buildSharedPointFeatureStateHoverPaint,
  expandInterpolateCaseMultiply,
} from '../../paint/shared-point-paint.js';
import { resolveSharedPointLayerIdForSource } from '../../shared-points/shared-point-heal.js';

// ============================================================================
// Types
// ============================================================================
export * from './types.js';
export * from './category-expressions.js';
export * from './circle-glow.js';
export * from './shared-point-layers.js';
export * from './glow-point-api.js';
