/**
 * The action flags of the Updates bottom bar.
 *
 * Reference: `mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesScreen.kt:216-248`
 *   `UpdatesBottomBar(selected, ...)` -> `MangaBottomActionMenu(visible = selected.isNotEmpty(), ...)`
 *   with the six `takeIf { ... }` guards that decide which buttons exist.
 */
export interface UpdatesBottomActionChapter {
  read: boolean
  bookmarked: boolean
  lastPageRead: number
  downloaded: boolean
}

export interface UpdatesBottomActionFlags {
  canBookmark: boolean
  canRemoveBookmark: boolean
  canMarkAsRead: boolean
  canMarkAsUnread: boolean
  canDownload: boolean
  canDelete: boolean
}

export function updatesBottomActionFlags(chapters: UpdatesBottomActionChapter[]): UpdatesBottomActionFlags {
  const any = (predicate: (chapter: UpdatesBottomActionChapter) => boolean) => chapters.some(predicate)
  const all = (predicate: (chapter: UpdatesBottomActionChapter) => boolean) => chapters.every(predicate)
  return {
    // onBookmarkClicked        = selected.fastAny { !it.update.bookmark }
    canBookmark: any(chapter => !chapter.bookmarked),
    // onRemoveBookmarkClicked = selected.fastAll { it.update.bookmark }
    canRemoveBookmark: chapters.length > 0 && all(chapter => chapter.bookmarked),
    // onMarkAsReadClicked     = selected.fastAny { !it.update.read }
    canMarkAsRead: any(chapter => !chapter.read),
    // onMarkAsUnreadClicked   = selected.fastAny { it.update.read || it.update.lastPageRead > 0 }
    canMarkAsUnread: any(chapter => chapter.read || chapter.lastPageRead > 0),
    // onDownloadClicked       = selected.fastAny { it.downloadStateProvider() != Download.State.DOWNLOADED }
    canDownload: any(chapter => !chapter.downloaded),
    // onDeleteClicked         = selected.fastAny { it.downloadStateProvider() == Download.State.DOWNLOADED }
    canDelete: any(chapter => chapter.downloaded),
  }
}
