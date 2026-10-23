/**
 * The action visibility rules of the Mihon bottom action menus.
 *
 * Reference: `mihon/app/src/main/java/eu/kanade/presentation/manga/MangaScreen.kt`
 * → `SharedMangaBottomActionMenu` (lines 673-713), which only passes a callback to
 * `MangaBottomActionMenu` when the action makes sense for the current selection:
 *
 *   onBookmarkClicked        = selected.fastAny { !it.chapter.bookmark }
 *   onRemoveBookmarkClicked = selected.fastAll { it.chapter.bookmark }
 *   onMarkAsReadClicked     = selected.fastAny { !it.chapter.read }
 *   onMarkAsUnreadClicked   = selected.fastAny { it.chapter.read || it.chapter.lastPageRead > 0 }
 *   onMarkPreviousAsRead    = selected.size == 1
 *   onDownloadClicked       = onDownloadChapter != null && any { it.downloadState != DOWNLOADED }
 *   onDeleteClicked         = selected.fastAny { it.downloadState == DOWNLOADED }
 *
 * The helper lives here (like `utils/updatesBottomActions.ts`) so that unit tests can
 * import it without a Vue SFC transform.
 */

/** The chapter fields the action visibility rules of `SharedMangaBottomActionMenu` read. */
export interface MangaBottomActionChapter {
  read: boolean
  bookmarked: boolean
  lastPageRead: number
  downloaded: boolean
}

export interface MangaBottomActionFlags {
  canBookmark: boolean
  canRemoveBookmark: boolean
  canMarkAsRead: boolean
  canMarkAsUnread: boolean
  canMarkPreviousAsRead: boolean
  canDownload: boolean
  canDelete: boolean
}

/**
 * `MangaScreen.kt` → `SharedMangaBottomActionMenu` only passes a callback when the action
 * makes sense for the current selection, so the matching button is rendered or not.
 */
export function mangaBottomActionFlags(
  chapters: MangaBottomActionChapter[],
): MangaBottomActionFlags {
  const any = (predicate: (chapter: MangaBottomActionChapter) => boolean) => chapters.some(predicate)
  const all = (predicate: (chapter: MangaBottomActionChapter) => boolean) => chapters.every(predicate)
  return {
    canBookmark: any(chapter => !chapter.bookmarked),
    canRemoveBookmark: chapters.length > 0 && all(chapter => chapter.bookmarked),
    canMarkAsRead: any(chapter => !chapter.read),
    canMarkAsUnread: any(chapter => chapter.read || chapter.lastPageRead > 0),
    canMarkPreviousAsRead: chapters.length === 1,
    // `onDownloadChapter != null && selected.any { it.downloadState != Download.State.DOWNLOADED }`
    canDownload: any(chapter => !chapter.downloaded),
    // `selected.any { it.downloadState == Download.State.DOWNLOADED }`
    canDelete: any(chapter => chapter.downloaded),
  }
}
