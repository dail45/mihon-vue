/**
 * Web equivalent of Mihon's `MainActivity.handleIntentAction` (MainActivity.kt:592-667).
 *
 * The Android app receives launcher shortcuts and deep links as `Intent`s. A browser has no
 * intent system, so the same entry points are exposed as URL parameters. The mapping keeps the
 * reference semantics:
 *
 *   Constants.SHORTCUT_LIBRARY   -> /library
 *   Constants.SHORTCUT_MANGA     -> /manga/<id>          (extras "manga")
 *   Constants.SHORTCUT_UPDATES   -> /updates
 *   Constants.SHORTCUT_HISTORY   -> /history
 *   Constants.SHORTCUT_SOURCES   -> /browse
 *   Constants.SHORTCUT_EXTENSIONS-> /browse?tab=extensions
 *   Constants.SHORTCUT_DOWNLOADS  -> /downloads
 *   ACTION_APPLICATION_PREFERENCES -> /settings
 *   ACTION_SEARCH / ACTION_SEND / INTENT_SEARCH -> /browse/global-search?q=<query>
 *   ACTION_VIEW *.tachibk        -> restore backup (not supported in the web version)
 *   mihon://extension-store?url= / tachiyomi://add-repo?url= -> /browse/extension-stores?url=
 */
export interface DeepLinkTarget {
  /** Router path (with query) the shell has to navigate to. */
  path: string
  /** True when the reference replaces the current stack instead of pushing (popUntilRoot). */
  replace: boolean
  /**
   * Set when the reference opens a screen that cannot exist in the web client. The shell shows
   * an explicit "not supported in the web version" dialog instead of a dead link.
   */
  stub?: 'restore-backup'
}

const SHORTCUTS: Record<string, string> = {
  library: '/library',
  updates: '/updates',
  history: '/history',
  sources: '/browse',
  extensions: '/browse?tab=extensions',
  migrate: '/browse?tab=migrate',
  // `HomeScreen.Tab.More(toDownloads = true)` opens the download queue screen.
  downloads: '/download-queue',
  // `Intent.ACTION_APPLICATION_PREFERENCES` opens the settings screen.
  settings: '/settings',
  // The "Support Us" screen of the donation campaign (`SupportUsScreen`).
  support: '/support-us',
}

/** `Constants.MANGA_EXTRA` = "manga" carries the manga id of the shortcut. */
function mangaId(params: URLSearchParams): string | null {
  const raw = params.get('manga') ?? params.get('id')
  if (raw === null) return null
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? String(id) : null
}

/**
 * Resolves a location search string (with or without the leading "?") into a navigation target.
 * Returns `null` when the URL does not carry any of the reference entry points.
 */
export function resolveDeepLink(search: string): DeepLinkTarget | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const shortcut = params.get('shortcut')?.toLowerCase()
  if (shortcut) {
    const path = SHORTCUTS[shortcut]
    if (path) return { path, replace: false }
    return null
  }

  const id = mangaId(params)
  if (id) return { path: `/manga/${id}`, replace: false }

  // DeepLinkActivity / DeepLinkScreen: external URL / URI resolution
  const deeplink = params.get('deeplink') ?? params.get('url') ?? params.get('uri')
  if (deeplink) return { path: `/deeplink?q=${encodeURIComponent(deeplink)}`, replace: true }

  // ACTION_SEARCH / ACTION_SEND / INTENT_SEARCH ("eu.kanade.tachiyomi.SEARCH").
  const query = params.get('query') ?? params.get('q')
  if (query) {
    if (/^https?:\/\//i.test(query.trim())) {
      return { path: `/deeplink?q=${encodeURIComponent(query.trim())}`, replace: true }
    }
    return { path: `/browse/global-search?q=${encodeURIComponent(query)}`, replace: true }
  }

  const action = params.get('action')?.toLowerCase()
  if (action === 'preferences') return { path: '/settings', replace: true }

  // ACTION_VIEW of a ".tachibk" backup file (RestoreBackupScreen).
  const backup = params.get('backup') ?? params.get('file')
  if (backup) return { path: '/settings/data', replace: true, stub: 'restore-backup' }

  // mihon://extension-store?url= and tachiyomi://add-repo?url= (ExtensionStoresScreen).
  const repo = params.get('extension-store') ?? params.get('add-repo')
  if (repo) return { path: `/browse/extensions/stores?url=${encodeURIComponent(repo)}`, replace: true }

  return null
}
