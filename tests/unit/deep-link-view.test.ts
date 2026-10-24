import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/settings/views/DeepLinkView.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/settings/views/DeepLinkView.vue` with
 * mihon/app/src/main/java/eu/kanade/tachiyomi/ui/deeplink/DeepLinkScreen.kt
 * (and its DeepLinkViewModel.kt).
 * The reference is Kotlin, so the invariants are asserted on the ported metrics.
 */
describe('DeepLinkView parity with Mihon', () => {
  it('renders the app bar of the reference with the "Search…" title and the up arrow', () => {
    // AppBar(title = stringResource(MR.strings.action_search_hint), navigateUp = navigator::pop)
    // `action_search_hint` is "Search…" in i18n/.../base/strings.xml.
    expect(source).toContain('<v-app-bar flat height="64" color="surface"')
    expect(source).toContain('>Search…</v-app-bar-title>')
    expect(source).toContain('icon="arrow_back"')
    // MR.strings.action_bar_up_description ("Navigate up")
    expect(source).toContain('aria-label="Navigate up"')
    // The title of the app bar is titleLarge with a regular weight.
    expect(source).toContain('class="text-title-large font-weight-regular"')
  })

  it('renders the centered CircularProgressIndicator of LoadingScreen', () => {
    // LoadingScreen.kt: Box(fillMaxSize) with contentAlignment = Alignment.Center.
    expect(source).toContain('class="deep-link-loading"')
    expect(source).toContain('<v-progress-circular indeterminate color="primary" size="40" width="4" />')
    expect(source).toMatch(/\.deep-link-loading \{[^}]*align-items: center/)
    expect(source).toMatch(/\.deep-link-loading \{[^}]*justify-content: center/)
  })

  it('replaces the screen with the global search when the URI cannot be resolved', () => {
    // State.NoResults -> navigator.replace(GlobalSearchScreen(query)).
    expect(source).toContain("path: '/browse/global-search'")
    expect(source).toMatch(/function noResults\(\)[\s\S]*openGlobalSearch\(\)/)
  })

  it('opens the manga screen and the reader like the reference does', () => {
    // State.Result without a chapter -> navigator.replace(MangaScreen(manga.id, fromSource = true)).
    expect(source).toContain('router.replace(`/manga/${manga.id}`)')
    // State.Result with a chapter -> ReaderActivity.newIntent(context, manga.id, chapter.id).
    expect(source).toContain('router.replace(`/manga/${manga.id}/read/${chapter.index}`)')
    // The chapter is resolved from the local chapter list of the manga.
    expect(source).toContain('api.chapters(manga.id, true)')
  })

  it('resolves the URI against the sources of the server', () => {
    // ResolvableSource.getUriType(uri) != Unknown -> the source of the host of the URI.
    expect(source).toContain('server.sources.filter(source => domainOf(hostOf(source.baseUrl)) === domainOf(parts.host))')
    // The manga is the catalogue entry whose realUrl path matches the requested path.
    expect(source).toContain('api.sourceCatalogue(source.id, \'search\', 1, slug)')
  })

  it('supports url parameter and provides error fallback to global search', () => {
    expect(source).toContain('route.query.url')
    expect(source).toContain('Global search')
  })
})
