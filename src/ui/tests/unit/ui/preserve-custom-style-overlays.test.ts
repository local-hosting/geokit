import { describe, expect, it } from 'vitest'

import {
  mapHasOverlay,
  mapStyleSwapOptions,
  preserveCustomStyleOverlays,
  styleWithPreservedOverlays,
} from '../../../src/components/elements/map/style/preserve-custom-style-overlays'

describe('preserveCustomStyleOverlays', () => {
  it('keeps venue sources and layers when swapping basemap themes', () => {
    const previous = {
      version: 8,
      sources: {
        basemap: { type: 'vector', tiles: ['https://a/{z}/{x}/{y}.pbf'] },
        'canvas-venues': {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: { venueId: 'dock' }, geometry: { type: 'Point', coordinates: [0, 0] } }],
          },
        },
        'canvas-venues-selection': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [
        { id: 'water', type: 'fill', source: 'basemap' },
        { id: 'canvas-venues-glow', type: 'circle', source: 'canvas-venues' },
        { id: 'canvas-venues-point', type: 'circle', source: 'canvas-venues' },
      ],
    }
    const next = {
      version: 8,
      sources: {
        basemap: { type: 'vector', tiles: ['https://b/{z}/{x}/{y}.pbf'] },
      },
      layers: [{ id: 'water', type: 'fill', source: 'basemap' }],
    }

    const merged = preserveCustomStyleOverlays(previous, next)

    expect(merged.sources?.['canvas-venues']).toEqual(previous.sources['canvas-venues'])
    expect(merged.sources?.['canvas-venues-selection']).toBeTruthy()
    expect(merged.sources?.basemap).toEqual(next.sources.basemap)
    expect(merged.layers?.map((l) => l.id)).toEqual([
      'water',
      'canvas-venues-glow',
      'canvas-venues-point',
    ])
  })

  it('returns next style unchanged when there is no previous style', () => {
    const next = { version: 8, sources: {}, layers: [] }
    expect(preserveCustomStyleOverlays(null, next)).toBe(next)
  })

  it('disables incremental style diff so sprite/glyph swaps do not warn on MapTiler GL', () => {
    expect(mapStyleSwapOptions().diff).toBe(false)
  })

  it('exposes transformStyle options for setStyle theme swaps', () => {
    const opts = mapStyleSwapOptions()
    const previous = {
      sources: { 'canvas-venues': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
      layers: [{ id: 'canvas-venues-point', type: 'circle', source: 'canvas-venues' }],
    }
    const next = { sources: { basemap: { type: 'vector' } }, layers: [{ id: 'road', type: 'line', source: 'basemap' }] }
    const merged = opts.transformStyle(previous, next)
    expect(merged.layers?.map((l) => l.id)).toContain('canvas-venues-point')
    expect(merged.sources?.['canvas-venues']).toBeTruthy()
  })

  it('mapHasOverlay is true only when both source and layer exist', () => {
    const map = {
      getSource: (id: string) => (id === 'canvas-venues' ? {} : undefined),
      getLayer: (id: string) => (id === 'canvas-venues-point' ? {} : undefined),
    }
    expect(mapHasOverlay(map, 'canvas-venues', 'canvas-venues-point')).toBe(true)
    expect(mapHasOverlay(map, 'canvas-venues', 'missing')).toBe(false)
    expect(mapHasOverlay(null, 'canvas-venues', 'canvas-venues-point')).toBe(false)
  })

  it('pre-merges overlays into object styles when MapTiler ignores transformStyle', () => {
    const previous = {
      sources: {
        'canvas-venues': {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }] },
        },
      },
      layers: [{ id: 'canvas-venues-point', type: 'circle', source: 'canvas-venues' }],
    }
    const next = {
      version: 8,
      sources: { basemap: { type: 'vector' } },
      layers: [{ id: 'water', type: 'fill', source: 'basemap' }],
    }
    const merged = styleWithPreservedOverlays(previous, next)
    expect(typeof merged).toBe('object')
    expect((merged as typeof next).sources?.['canvas-venues']).toBeTruthy()
    expect((merged as typeof next).layers?.map((l) => l.id)).toContain('canvas-venues-point')
    // URL styles still rely on transformStyle / remount safety net.
    expect(styleWithPreservedOverlays(previous, 'https://example.com/style.json')).toBe(
      'https://example.com/style.json',
    )
  })
})
