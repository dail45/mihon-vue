/** Hand-written REST v1 DTOs from Suwayomi e2ce828. See docs/REFERENCES.md.
 * Kotlin Long/Float -> number; source IDs are strings, never numbers.
 * Nullable Kotlin fields stay nullable. @JsonIgnore fields are excluded.
 * Types describe wire payloads, not local business entities.
 */
export interface Source {
  id: string; name: string; lang: string; iconUrl: string; supportsLatest: boolean;
  isConfigurable: boolean; isNsfw: boolean; displayName: string; baseUrl: string | null;
}
export type MangaStatus = 'UNKNOWN' | 'ONGOING' | 'COMPLETED' | 'LICENSED' | 'PUBLISHING_FINISHED' | 'CANCELLED' | 'ON_HIATUS'
export interface Chapter {
  id: number; url: string; name: string; uploadDate: number; chapterNumber: number;
  scanlator: string | null; mangaId: number;
  /** Deprecated upstream, retained for the REST v1 contract. */
  read: boolean; bookmarked: boolean; lastPageRead: number; lastReadAt: number;
  /** REST uses this one-based source index, NOT chapter ID or chapter number. */
  index: number; fetchedAt: number; realUrl: string | null; downloaded: boolean;
  pageCount: number; lastModifiedAt: number; version: number; chapterCount: number;
}
export interface TrackRecord {
  id: number; mangaId: number; trackerId: number; remoteId: number; libraryId: number | null;
  title: string; lastChapterRead: number; totalChapters: number; status: number; score: number;
  scoreString: string | null; remoteUrl: string; startDate: number; finishDate: number; private: boolean;
}
export interface MangaTracker {
  id: number; name: string; icon: string; statusList: number[];
  statusTextMap: Record<string, string>; scoreList: string[]; record: TrackRecord | null;
}
export interface Manga {
  id: number; sourceId: string; url: string; title: string; thumbnailUrl: string | null;
  thumbnailUrlLastFetched: number; initialized: boolean; artist: string | null;
  author: string | null; description: string | null; genre: string[]; status: MangaStatus;
  /** Deprecated upstream; REST v1 still exposes these. */
  inLibrary: boolean; inLibraryAt: number; source: Source | null; realUrl: string | null;
  lastFetchedAt: number | null; chaptersLastFetchedAt: number | null;
  updateStrategy: 'ALWAYS_UPDATE' | 'ONLY_FETCH_ONCE'; freshData: boolean;
  unreadCount: number | null; downloadCount: number | null; chapterCount: number | null;
  lastReadAt: number | null; lastChapterRead: Chapter | null; age: number | null;
  chaptersAge: number | null; trackers: MangaTracker[] | null; lastModifiedAt: number; version: number;
  favorite?: boolean; readerOrientation?: number | null; viewer?: number | null; categories?: number[];
}
export interface Category {
  id: number; order: number; name: string; default: boolean;
  includeInUpdate: -1 | 0 | 1; includeInDownload: -1 | 0 | 1;
  /** Present in the reference master DTO; omitted by live stable v2.4.2366. */
  isDefaultCategory?: boolean; version: number; uid: number; lastModifiedAt: number;
}
export interface PagedMangaList { mangaList: Manga[]; hasNextPage: boolean }

/** PATCH chapter fields are submitted as application/x-www-form-urlencoded. */
export interface ChapterPatch { read?: boolean; bookmarked?: boolean; markPrevRead?: boolean; lastPageRead?: number }

export interface MangaChapter { manga: Manga; chapter: Chapter }
/** Recent chapters are zero-based pages; the payload key is page, NOT mangaList. */
export interface RecentChapters { page: MangaChapter[]; hasNextPage: boolean }

/** Raw Suwayomi filter object payload for GET /source/{id}/filters and search queries */
export interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

export interface RawSourceFilterObject {
  type: string
  filter: {
    name?: string
    values?: (string | number)[]
    displayValues?: string[]
    state?: unknown
  }
}
