import { describe, expect, it } from 'vitest'

import {
  classifyMapInitFailure,
  mapUnavailableLogDetail,
  mapUnavailableMessage,
} from '../../../src/components/elements/map/style/map-unavailable-message'

const TECH_NAMES = /MapTiler|Mapbox|WebGL|MAPTILER_KEY|MAPBOX|api-key|gk-map|console/i

describe('mapUnavailableMessage', () => {
  it('explains a missing provider in plain language', () => {
    const text = mapUnavailableMessage('missing-provider')
    expect(text).toMatch(/isn.?t set up|not configured|needs setup/i)
    expect(text).not.toMatch(TECH_NAMES)
  })

  it('points style timeouts at refresh without tech names', () => {
    const text = mapUnavailableMessage('style-timeout')
    expect(text).toMatch(/didn.?t finish loading|timed out|taking too long/i)
    expect(text).toMatch(/refresh|try again/i)
    expect(text).not.toMatch(TECH_NAMES)
    expect(text).not.toBe(
      'Map unavailable — check MapTiler key, network, or WebGL limits',
    )
  })

  it('describes WebGL budget issues as too many maps', () => {
    const text = mapUnavailableMessage('webgl')
    expect(text).toMatch(/too many maps/i)
    expect(text).not.toMatch(TECH_NAMES)
  })

  it('keeps a generic failure short and non-technical', () => {
    const text = mapUnavailableMessage('generic')
    expect(text).toMatch(/couldn.?t load|failed to load/i)
    expect(text).toMatch(/refresh|try again/i)
    expect(text).not.toMatch(TECH_NAMES)
  })
})

describe('classifyMapInitFailure', () => {
  it('classifies missing provider / api-key errors', () => {
    expect(
      classifyMapInitFailure(
        'No UI provider set. Add provider="maptiler" or provide api-key',
      ),
    ).toBe('missing-provider')
  })

  it('classifies WebGL context loss', () => {
    expect(classifyMapInitFailure('CONTEXT_LOST_WEBGL: loseContext')).toBe('webgl')
    expect(classifyMapInitFailure('WebGL context already lost')).toBe('webgl')
  })

  it('falls back to generic for unknown errors', () => {
    expect(classifyMapInitFailure('boom')).toBe('generic')
  })
})

describe('mapUnavailableLogDetail', () => {
  it('keeps tech names in the log channel, not the UI channel', () => {
    expect(mapUnavailableLogDetail('style-timeout')).toMatch(/MapTiler|WebGL/i)
    expect(mapUnavailableLogDetail('missing-provider')).toMatch(/MAPTILER_KEY|api-key/i)
    expect(mapUnavailableLogDetail('webgl')).toMatch(/WebGL/i)
    expect(mapUnavailableLogDetail('generic', 'boom')).toContain('boom')
  })
})
