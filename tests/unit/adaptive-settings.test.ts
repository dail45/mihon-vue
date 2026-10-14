import { describe, expect, it } from 'vitest'
import { isTabletUi } from '../../src/composables/useTabletUi'
import { serverGraphqlUrl, validateServerSettings } from '../../src/api/serverSettings'
describe('shared tablet policy', () => {
  it('uses Mihon orientation thresholds for automatic, not a separate width breakpoint', () => {
    expect(isTabletUi('automatic', 390, 844)).toBe(false)
    expect(isTabletUi('automatic', 1440, 1000)).toBe(true)
    expect(isTabletUi('automatic', 700, 1000)).toBe(true)
    expect(isTabletUi('automatic', 900, 600)).toBe(true)
    expect(isTabletUi('automatic', 1200, 590)).toBe(false)
  })
  it('honors all overrides', () => {
    expect(isTabletUi('always', 390, 844)).toBe(true)
    expect(isTabletUi('never', 1440, 1000)).toBe(false)
    expect(isTabletUi('landscape', 844, 390)).toBe(true)
    expect(isTabletUi('landscape', 390, 844)).toBe(false)
  })
})
describe('server settings boundary', () => {
  it('preserves server subpaths and rejects nonstandard endpoints', () => {
    expect(serverGraphqlUrl('https://server.example/sub/api/v1')).toBe('https://server.example/sub/api/graphql')
    expect(serverGraphqlUrl('/sub/api/v1')).toBe('/sub/api/graphql')
    expect(() => serverGraphqlUrl('https://server.example/custom')).toThrow()
  })
  it('does not turn absent / invalid values into defaults, and returns only allowed fields', () => {
    const settings = { downloadAsCbz: false, autoDownloadNewChapters: false, autoDownloadIgnoreReUploads: true, autoDownloadNewChaptersLimit: 0, globalUpdateInterval: 12, maxSourcesInParallel: 6 }
    expect(validateServerSettings({ ...settings, authPassword: 'fixture-not-a-secret' })).toEqual(settings)
    expect(() => validateServerSettings({ ...settings, maxSourcesInParallel: -1 })).toThrow()
    expect(() => validateServerSettings({ ...settings, autoDownloadNewChapters: null })).toThrow()
    expect(() => validateServerSettings({ ...settings, globalUpdateInterval: NaN })).toThrow()
  })
})
