<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiErrorMessage, createSuwayomiApi } from '../api/client'
import type { Chapter, Manga, Source } from '../api/types'
import { useSuwayomiStore } from '../stores/suwayomi'

/**
 * Pixel-parity port of Mihon's deep link screen.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 * - `tachiyomi/ui/deeplink/DeepLinkScreen.kt`:
 *   - `Scaffold(topBar = { scrollBehavior -> AppBar(title = stringResource(MR.strings.action_search_hint),
 *     navigateUp = navigator::pop, scrollBehavior = scrollBehavior) })` — a `TopAppBar` (64dp)
 *     with the up arrow and the title "Search…" (`action_search_hint` in
 *     `i18n/src/commonMain/moko-resources/base/strings.xml` → "Search…").
 *   - `State.Loading` → `LoadingScreen(Modifier.padding(contentPadding))`:
 *     a `Box(fillMaxSize)` with a centred `CircularProgressIndicator`.
 *   - `State.NoResults` → `navigator.replace(GlobalSearchScreen(query))`.
 *   - `State.Result` without a chapter → `navigator.replace(MangaScreen(manga.id, fromSource = true))`.
 *   - `State.Result` with a chapter → `navigator.pop()` + `ReaderActivity.newIntent(context, manga.id,
 *     chapter.id)` (the reader opens the resolved chapter).
 * - `tachiyomi/ui/deeplink/DeepLinkViewModel.kt`:
 *   - the sources are filtered to `ResolvableSource` instances whose `getUriType(query) != Unknown`,
 *   - `source.getManga(query)` resolves the manga, `source.getChapter(query)` the chapter,
 *   - the chapter is used only when it exists in the local database, otherwise the manga is opened.
 *
 * The web client cannot ask a source extension to resolve an arbitrary URI
 * (`ResolvableSource.getUriType/getManga/getChapter` are extension-side native calls) and the
 * Suwayomi REST API has no per-URI resolve endpoint. The resolution is therefore reproduced with
 * the endpoints the server does expose:
 *   - the source whose `baseUrl` host matches the host of the query is asked for its catalogue
 *     (`GET /source/{id}/search?searchTerm=…&pageNum=1`); the comparison uses the registrable
 *     domain, because a source declares its API host (`https://api.remanga.org`) while the manga
 *     URLs it publishes use the site host (`https://remanga.org/manga/…`),
 *   - the manga is the entry whose `realUrl` path matches the requested path,
 *   - the chapter is the entry of `GET /manga/{id}/chapters?onlineFetch=true` whose path matches the
 *     remainder of the requested path.
 * A query that is not a URI, or a URI that no source can resolve, behaves exactly like Mihon's
 * `State.NoResults`: the global search screen is opened with that query.
 *
 * The screen renders its own app bar (`AppBar.kt`: 64dp TopAppBar, up arrow, title "Search…"), so
 * the route needs `meta: { manga: true, detail: true }` to hide the app bar and the navigation bar
 * of the shell.
 */

type State = 'loading' | 'result' | 'noresults'

interface UriParts {
  host: string
  /** Decoded path of the URI. */
  path: string
  /** Last path segment of the URI, empty for a root path. */
  slug: string
  /**
   * Guess of the manga slug of the URI. A manga URI ends with the slug
   * (`/manga/solo-leveling_`), a chapter URI appends the chapter to it
   * (`/manga/solo-leveling_/ch211773`), so the slug of the manga is the second to last segment
   * of a three segment path.
   */
  mangaSlug: string
}

const server = useSuwayomiStore()
const route = useRoute()
const router = useRouter()

const state = ref<State>('loading')
const error = ref<string | null>(null)

const query = computed(() => {
  const value = route.query.q ?? route.query.query ?? route.query.uri ?? route.query.url
  return typeof value === 'string' ? value.trim() : ''
})

const isLoading = computed(() => state.value === 'loading')
/** True while the global search route is not registered (integration task). */
const globalSearchMissing = computed(() => !router.getRoutes().some(item => item.path === '/browse/global-search'))

/** Mihon: `navigateUp = navigator::pop` — the up arrow of the app bar. */
function goUp() {
  if (typeof window.history.state?.back === 'string') {
    router.back()
    return
  }
  void router.push('/library')
}

/** Mihon: `navigator.replace(GlobalSearchScreen(query))`. */
function openGlobalSearch() {
  void router.replace({ path: '/browse/global-search', query: query.value ? { q: query.value } : {} })
}

function parseUri(raw: string): UriParts | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null
  const path = decodeURIComponent(url.pathname)
  const segments = path.split('/').filter(Boolean)
  const slug = segments[segments.length - 1] ?? ''
  const mangaSlug = segments.length >= 3 ? segments[segments.length - 2] : slug
  return { host: url.host, path, slug, mangaSlug }
}

/**
 * Registrable domain of a host. A source declares its API base URL (`baseUrl`), while the manga
 * URLs it publishes use the site host (`https://remanga.org/manga/…` for the base URL
 * `https://api.remanga.org`), so the comparison uses the last two labels of the host.
 */
function domainOf(host: string): string {
  const labels = host.split('.').filter(Boolean)
  if (labels.length <= 2) return labels.join('.')
  return labels.slice(-2).join('.')
}

function hostOf(baseUrl: string | null): string {
  if (!baseUrl) return ''
  try {
    return new URL(baseUrl).host
  } catch {
    return ''
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/** Path of a `realUrl`, or an empty string when the source did not provide one. */
function realPath(url: string | null | undefined): string {
  if (!url) return ''
  try {
    return stripTrailingSlash(decodeURIComponent(new URL(url, 'https://example.invalid').pathname))
  } catch {
    return stripTrailingSlash(url)
  }
}

/**
 * Mihon: `source.getManga(uri)` resolves the manga of the URI. The web client compares the
 * `realUrl` of the catalogue entries with the requested path; the remainder of the path after the
 * manga path is the chapter candidate (`source.getChapter(uri)`).
 * The sentinel `\u0000` means "no match".
 */
function matchManga(manga: Manga, parts: UriParts): string {
  const path = realPath(manga.realUrl)
  if (path) {
    if (path === parts.path) return ''
    if (parts.path.startsWith(`${path}/`)) return parts.path.slice(path.length + 1)
  }
  const slug = parts.mangaSlug
  if (slug && manga.url && (manga.url === slug || manga.url.endsWith(`/${slug}`) || manga.url.endsWith(slug))) {
    // The source did not provide a `realUrl`; the part of the URI after the manga slug is the
    // chapter candidate.
    const marker = `/${slug}`
    const at = parts.path.lastIndexOf(marker)
    if (at >= 0 && at + marker.length < parts.path.length) return parts.path.slice(at + marker.length + 1)
    return ''
  }
  return '\u0000'
}

function matchChapter(chapter: Chapter, parts: UriParts, remainder: string): boolean {
  if (!remainder) return false
  const path = realPath(chapter.realUrl)
  if (path && path === parts.path) return true
  if (chapter.url && (chapter.url === remainder || chapter.url.endsWith(`/${remainder}`) || chapter.url.endsWith(remainder))) return true
  return false
}

async function searchSource(source: Source, parts: UriParts, term: string): Promise<Manga[]> {
  const api = createSuwayomiApi(server.apiUrl)
  const slug = parts.mangaSlug || term
  try {
    const page = await api.sourceCatalogue(source.id, 'search', 1, slug)
    return page.mangaList
  } catch {
    return []
  }
}

async function resolve(): Promise<void> {
  const raw = query.value
  state.value = 'loading'
  error.value = null
  if (!raw) {
    noResults()
    return
  }
  const parts = parseUri(raw)
  // Mihon: a source can only resolve a URI it knows (`getUriType(uri) != UriType.Unknown`);
  // a plain text query is not a URI, so the screen ends in `State.NoResults`.
  if (!parts) {
    noResults()
    return
  }
  try {
    if (!server.sources.length && !server.loadingSources) await server.loadSources()
    const candidates = server.sources.filter(source => domainOf(hostOf(source.baseUrl)) === domainOf(parts.host))
    if (!candidates.length) {
      noResults()
      return
    }
    const api = createSuwayomiApi(server.apiUrl)
    let manga: Manga | null = null
    let remainder = ''
    for (const source of candidates) {
      const list = await searchSource(source, parts, raw)
      for (const item of list) {
        const rest = matchManga(item, parts)
        if (rest !== '\u0000') {
          manga = item
          remainder = rest
          break
        }
      }
      if (manga) break
    }
    if (!manga) {
      noResults()
      return
    }
    // Mihon: the chapter is only opened when it exists for the resolved manga.
    let chapter: Chapter | undefined
    if (remainder) {
      try {
        const chapters = await api.chapters(manga.id, true)
        chapter = chapters.find(item => matchChapter(item, parts, remainder))
      } catch (failure) {
        error.value = apiErrorMessage(failure)
      }
    }
    state.value = 'result'
    if (chapter) {
      // Mihon: `navigator.pop()` + `ReaderActivity.newIntent(context, manga.id, chapter.id)`.
      void router.replace(`/manga/${manga.id}/read/${chapter.index}`)
      return
    }
    // Mihon: `navigator.replace(MangaScreen(manga.id, fromSource = true))`.
    void router.replace(`/manga/${manga.id}`)
  } catch (err) {
    error.value = apiErrorMessage(err)
    noResults()
  }
}

/** Mihon: `State.NoResults` → `navigator.replace(GlobalSearchScreen(query))`. */
function noResults() {
  state.value = 'noresults'
  if (!globalSearchMissing.value) openGlobalSearch()
}

onMounted(() => {
  void resolve()
})

watch(query, () => {
  void resolve()
})
</script>

<template>
  <div class="deep-link">
    <!--
      Mihon: `AppBar(title = stringResource(MR.strings.action_search_hint), navigateUp = navigator::pop)`
      — a `TopAppBar` (64dp) with the up arrow (`MaterialSymbols.AutoMirroredRounded.ArrowBack`,
      contentDescription = `action_bar_up_description` "Navigate up") and the title "Search…"
      (`action_search_hint` in `i18n/.../base/strings.xml` → "Search…").
    -->
    <v-app-bar flat height="64" color="surface" class="deep-link-toolbar">
      <v-btn icon="arrow_back" aria-label="Navigate up" title="Navigate up" @click="goUp" />
      <v-app-bar-title class="text-title-large font-weight-regular">Search…</v-app-bar-title>
    </v-app-bar>

    <!-- Mihon: `LoadingScreen.kt` — Box(fillMaxSize) with `contentAlignment = Alignment.Center`. -->
    <div v-if="isLoading" class="deep-link-loading" role="status" aria-label="Loading">
      <v-progress-circular indeterminate color="primary" size="40" width="4" />
    </div>

    <!--
      Mihon resolves the URI and replaces the screen, so the body is only visible for the moment
      the navigation happens. The fallback link keeps the screen usable when the global search
      route is not registered yet or when an error occurs.
    -->
    <div v-else class="deep-link-body" role="status" aria-live="polite">
      <p v-if="error" class="deep-link-error text-body-medium">{{ error }}</p>
      <v-btn v-if="globalSearchMissing" color="primary" variant="text" @click="openGlobalSearch">
        Search everywhere
      </v-btn>
      <v-btn v-else-if="error" color="primary" variant="text" @click="openGlobalSearch">
        Global search
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
/* The app bar of the screen is the shell app bar (64dp, `AppBar.kt`); the body starts below it. */
.deep-link {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 64px);
  background: rgb(var(--v-theme-surface));
}

/* `LoadingScreen.kt`: Box(fillMaxSize) with `contentAlignment = Alignment.Center`. */
.deep-link-loading {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.deep-link-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
}

.deep-link-error {
  color: rgb(var(--v-theme-error));
  text-align: center;
}
</style>
