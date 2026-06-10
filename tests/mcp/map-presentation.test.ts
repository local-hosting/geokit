// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  resolveMcpRegionHexColors,
  resolveMcpRegionPathStyle,
} from '../../src/mcp/map-presentation.js';
import { getDMAColor } from '../../src/ui/utils/dma-colors.js';

describe('map-presentation', () => {
  it('aligns static path colors with dma slug colors', () => {
    const regionLayer = { dataset: 'dma' as const, slug: 'omaha', region: 'midwest' };
    const hex = getDMAColor('omaha', 'midwest', { darkVariant: true });
    const colors = resolveMcpRegionHexColors({ regionLayer });
    const pathStyle = resolveMcpRegionPathStyle({ regionLayer });

    expect(colors.fill).toBe(hex);
    expect(colors.stroke).toBe(hex);
    expect(pathStyle.fill).toBe(`%23${hex.replace('#', '')}55`);
    expect(pathStyle.stroke).toBe(`%23${hex.replace('#', '')}ff`);
  });
});
