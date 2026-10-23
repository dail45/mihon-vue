import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTrackerCallback, trackerCallbackUrl } from '../../src/api/trackerLogin'

const source = readFileSync('src/views/TrackerLoginView.vue', 'utf8')
const indicatorSource = readFileSync('src/components/Md3CircularProgress.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/views/TrackerLoginView.vue` with
 * mihon/app/src/main/java/eu/kanade/tachiyomi/ui/setting/track/TrackLoginActivity.kt
 * and its base class BaseOAuthLoginActivity.kt.
 */
describe('TrackerLoginView parity with Mihon', () => {
  it('renders only the LoadingScreen of the native activity', () => {
    // BaseOAuthLoginActivity.onCreate → setComposeContent { LoadingScreen() }.
    // LoadingScreen.kt: Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center)
    // { CircularProgressIndicator() } — no app bar, no title, no button.
    expect(source).toContain('.tracker-login {')
    expect(source).toMatch(/\.tracker-login \{[^}]*position: fixed;/s)
    expect(source).toMatch(/\.tracker-login \{[^}]*inset: 0;/s)
    expect(source).toMatch(/\.tracker-login__content \{[^}]*justify-content: center;/s)
    expect(source).toMatch(/\.tracker-login__content \{[^}]*align-items: center;/s)
    // CircularProgressIndicator(): M3 indeterminate, 40dp diameter, 4dp round-capped arc.
    expect(source).toContain('<Md3CircularProgress class="tracker-login__indicator"')
    expect(source).toMatch(/\.tracker-login__indicator \{[^}]*width: 40px;/s)
    expect(source).toMatch(/\.tracker-login__indicator \{[^}]*height: 40px;/s)
    expect(indicatorSource).toMatch(/\.md3-circular-progress__arc \{[^}]*stroke-width: 4;/s)
    expect(indicatorSource).toMatch(/\.md3-circular-progress__arc \{[^}]*stroke-linecap: round;/s)
    expect(indicatorSource).toContain('stroke: rgb(var(--v-theme-primary))')
    // M3 cycle: 1080deg global rotation over 6s + 90deg steps + 10%..87% sweep.
    expect(indicatorSource).toContain('animation: md3-circular-progress-global-rotate 6s linear infinite;')
    expect(indicatorSource).toContain('animation: md3-circular-progress-step-rotate 6s linear infinite;')
    expect(indicatorSource).toContain('animation: md3-circular-progress-sweep 6s linear infinite;')
    // The native screen has no title text and no action button.
    expect(source).not.toContain('<v-btn')
    expect(source).not.toContain('<v-app-bar')
  })

  it('returns to the settings screen like returnToSettings()', () => {
    // BaseOAuthLoginActivity.returnToSettings(): finish() + MainActivity.
    expect(source).toContain("router.replace({ path: '/settings/tracking' })")
  })

  it('reads the credential from the query or the fragment, like handleResult()', () => {
    // handleResult: uri.encodedQuery ?: uri.encodedFragment, split on "&" and "=".
    const query = parseTrackerCallback({ host: 'myanimelist-auth', search: '?code=abc123', hash: '' })
    expect(query?.credential).toBe('abc123')
    // AniList returns its token in the fragment.
    const fragment = parseTrackerCallback({ host: 'anilist-auth', search: '', hash: '#access_token=tok' })
    expect(fragment?.credential).toBe('tok')
    // The state parameter is read for the trackers that verify it.
    const state = parseTrackerCallback({ host: 'comick-auth', search: '?code=c&state=s', hash: '' })
    expect(state?.credential).toBe('c')
    expect(state?.state).toBe('s')
    // A missing credential is null, which Mihon turns into a logout.
    expect(parseTrackerCallback({ host: 'anilist-auth', search: '', hash: '' })?.credential).toBeNull()
    // The callback URL handed to Suwayomi keeps the raw credential.
    expect(trackerCallbackUrl('anilist-auth', 'a b')).toBe('access_token=a b')
    expect(trackerCallbackUrl('bangumi-auth', 'xyz')).toBe('code=xyz')
  })
})
