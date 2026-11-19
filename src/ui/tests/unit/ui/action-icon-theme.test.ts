import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const themeCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../src/theme.css'),
  'utf8',
)

describe('gk-ctrl-action-icon theme (MapLibre control style)', () => {
  it('paints save/snap with MapLibre background-image SVGs, not CSS masks', () => {
    expect(themeCss).toMatch(
      /button\.gk-ctrl-action-icon--save[\s\S]*?background-image:\s*url\("data:image\/svg\+xml;charset=utf-8,/,
    )
    expect(themeCss).toMatch(
      /button\.gk-ctrl-action-icon--snap[\s\S]*?background-image:\s*url\("data:image\/svg\+xml;charset=utf-8,/,
    )
    expect(themeCss).toMatch(
      /button\.gk-ctrl-action-icon--save[\s\S]*?fill='%23333'/,
    )
    expect(themeCss).toMatch(
      /button\.gk-ctrl-action-icon--snap[\s\S]*?fill='%23333'/,
    )
    // Heroicons solid viewfinder-circle (save map position) — corner bracket + center target
    expect(themeCss).toMatch(/gk-ctrl-action-icon--save[\s\S]*?M6 3a3 3 0 0 0-3 3v2\.25/)
    expect(themeCss).toMatch(/gk-ctrl-action-icon--save[\s\S]*?a3\.75 3\.75 0 1 0 0 7\.5/)
    // Heroicons solid arrow-left-circle (snap back) — filled circle with left arrow
    expect(themeCss).toMatch(
      /gk-ctrl-action-icon--snap[\s\S]*?M12 2\.25c-5\.385 0-9\.75 4\.365-9\.75 9\.75/,
    )
    expect(themeCss).toMatch(/gk-ctrl-action-icon--snap[\s\S]*?l-1\.72-1\.72h5\.69/)
    expect(themeCss).not.toMatch(/gk-ctrl-action-icon--save[\s\S]{0,400}mask-image:/)
    expect(themeCss).not.toMatch(/gk-ctrl-action-icon--snap[\s\S]{0,400}mask-image:/)
    // No floppy / plain uturn leftovers
    expect(themeCss).not.toMatch(/gk-ctrl-action-icon--save[\s\S]*?zm6 16a3 3 0 1 0 0-6/)
    expect(themeCss).not.toMatch(/gk-ctrl-action-icon--snap[\s\S]*?M9\.53 2\.47a\.75\.75/)
  })

  it('lets action icons use --gk-control-icon-filter like terrain/zoom', () => {
    const block = themeCss.match(
      /gk-map button\.gk-ctrl-action-icon \.maplibregl-ctrl-icon,[\s\S]*?\}/,
    )?.[0]
    expect(block).toBeTruthy()
    expect(block).not.toMatch(/filter:\s*none/)
    expect(block).not.toMatch(/mask-image:/)
    expect(block).toMatch(/background-repeat:\s*no-repeat/)
    expect(block).toMatch(/background-position:\s*(center|50%)/)
  })

  it('sizes save/snap glyphs like MapLibre terrain (intrinsic ~18px, not full 29px button)', () => {
    // MapLibre terrain uses width/height 22; solid Heroicons need more padding → 18.
    const saveUrl = themeCss.match(
      /gk-ctrl-action-icon--save \.maplibregl-ctrl-icon,[\s\S]*?url\("([^"]+)"\)/,
    )?.[1]
    const snapUrl = themeCss.match(
      /gk-ctrl-action-icon--snap \.maplibregl-ctrl-icon,[\s\S]*?url\("([^"]+)"\)/,
    )?.[1]
    expect(saveUrl).toMatch(/width='18' height='18'/)
    expect(snapUrl).toMatch(/width='18' height='18'/)
    expect(saveUrl).not.toMatch(/width='29' height='29'/)
    expect(snapUrl).not.toMatch(/width='29' height='29'/)
  })
})

describe('gk-map terrain + zoom control icons', () => {
  it('uses MapTiler twin-peak mountain in #333 for off and enabled (no cyan)', () => {
    const terrainBlock = themeCss.match(
      /gk-map button\.maplibregl-ctrl-terrain \.maplibregl-ctrl-icon,[\s\S]*?background-image:\s*url\("([^"]+)"\)/,
    )?.[0]
    expect(terrainBlock).toBeTruthy()
    expect(terrainBlock).toMatch(/maplibregl-ctrl-terrain-enabled/)
    expect(terrainBlock).toMatch(/fill='%23333'/)
    expect(terrainBlock).not.toMatch(/33b5e5|%2523/)
    // MapTiler SDK path (not MapLibre m1.754… / not a Heroicon)
    expect(terrainBlock).toMatch(/M1\.083[, ]10\.209/)
    expect(terrainBlock).not.toMatch(/m1\.754 13\.406/)
  })

  it('sizes MapLibre terrain icon classes on Mapbox (no maplibre-gl.css)', () => {
    // Without MapLibre layout CSS, `.maplibregl-ctrl-icon` is inline/auto — paint would be invisible.
    // MapTiler twin-peak needs near-button size (29px control) to match zoom weight.
    const sizeBlock = themeCss.match(
      /gk-map button\.maplibregl-ctrl-terrain \.maplibregl-ctrl-icon,[\s\S]*?background-size:\s*28px 28px;/,
    )?.[0]
    expect(sizeBlock).toBeTruthy()
    expect(sizeBlock).toMatch(/display:\s*block/)
    expect(sizeBlock).toMatch(/width:\s*100%/)
    expect(sizeBlock).toMatch(/height:\s*100%/)
    expect(sizeBlock).toMatch(/mapboxgl-ctrl-icon/)
  })

  it('overrides mapbox + maplibre zoom in/out with thick disc +/- SVGs', () => {
    for (const sel of [
      'button.mapboxgl-ctrl-zoom-in .mapboxgl-ctrl-icon',
      'button.mapboxgl-ctrl-zoom-out .mapboxgl-ctrl-icon',
      'button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon',
      'button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon',
    ]) {
      expect(themeCss).toMatch(
        new RegExp(
          `gk-map ${sel.replace('.', '\\.').replace(/\//g, '\\/')}[\\s\\S]*?background-image:\\s*url\\("data:image\\/svg\\+xml;charset=utf-8,`,
        ),
      )
    }

    const zoomInBlock = themeCss.match(
      /gk-map button\.(?:mapboxgl|maplibregl)-ctrl-zoom-in[\s\S]*?background-image:\s*url\("[^"]+"\);/,
    )?.[0]
    expect(zoomInBlock).toBeTruthy()
    expect(zoomInBlock).toMatch(/fill-rule(?:%3D|=)(?:%27|')evenodd/)
    expect(zoomInBlock).toMatch(/fill(?:%3D|=)(?:%27|')%23333/)
    expect(zoomInBlock).not.toMatch(/%2523/)
    expect(zoomInBlock).not.toMatch(/M14\.5 8\.5c-\.75 0-1\.5\.75/)
  })
})
