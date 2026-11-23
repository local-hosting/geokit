import { describe, expect, it, vi } from 'vitest'

import { removeEphemeralGkH3LayersFromMap } from '../../../src/utils/map-surface/remove-ephemeral-gk-h3-map-layers'

describe('removeEphemeralGkH3LayersFromMap', () => {
  it('removes orphaned gk-h3 fill/line layers and geojson sources', () => {
    const removedLayers: string[] = []
    const removedSources: string[] = []
    const layers = [
      { id: 'water', type: 'fill', source: 'basemap' },
      { id: 'h3-cell-fill-dead', type: 'fill', source: 'h3-cell-dead' },
      { id: 'h3-cell-line-dead', type: 'line', source: 'h3-cell-dead' },
      { id: 'canvas-venues-point', type: 'circle', source: 'canvas-venues' },
    ]
    const sources: Record<string, unknown> = {
      basemap: { type: 'vector' },
      'h3-cell-dead': { type: 'geojson' },
      'h3-cell-orphan-source-only': { type: 'geojson' },
      'canvas-venues': { type: 'geojson' },
    }
    const map = {
      getStyle: () => ({ layers, sources }),
      getLayer: (id: string) =>
        id === 'h3-cell-fill-dead' || id === 'h3-cell-line-dead' ? {} : undefined,
      getSource: (id: string) => (id in sources ? {} : undefined),
      removeLayer: vi.fn((id: string) => {
        removedLayers.push(id)
      }),
      removeSource: vi.fn((id: string) => {
        removedSources.push(id)
      }),
    }

    removeEphemeralGkH3LayersFromMap(map)

    expect(removedLayers).toEqual(['h3-cell-line-dead', 'h3-cell-fill-dead'])
    expect(removedSources).toEqual(
      expect.arrayContaining(['h3-cell-dead', 'h3-cell-orphan-source-only']),
    )
    expect(removedSources).not.toContain('canvas-venues')
  })

  it('no-ops when map has no style helpers', () => {
    expect(() => removeEphemeralGkH3LayersFromMap(null)).not.toThrow()
    expect(() => removeEphemeralGkH3LayersFromMap({})).not.toThrow()
  })

  it('no-ops when style is not loaded', () => {
    const removeLayer = vi.fn()
    const map = {
      isStyleLoaded: () => false,
      getStyle: () => {
        throw new Error('Style is not done loading')
      },
      removeLayer,
      removeSource: vi.fn(),
    }
    expect(() => removeEphemeralGkH3LayersFromMap(map)).not.toThrow()
    expect(removeLayer).not.toHaveBeenCalled()
  })
})