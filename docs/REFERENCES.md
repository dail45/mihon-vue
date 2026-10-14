# Inspected reference revisions

References were cloned and inspected during implementation. All links below are pinned for reproducibility; matching a later Suwayomi release is not assumed.

## Mihon

Revision: `446f6df82c390ab760802c2fce3b677bce3f31c1`

- [Default theme tokens](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/theme/colorscheme/TachiyomiColorScheme.kt)
- [Library toolbar](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/library/components/LibraryToolbar.kt)
- [Category tabs](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/library/components/LibraryTabs.kt)
- [Grid geometry: 8dp padding, 128dp adaptive cells, 4dp gaps](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/library/components/LazyLibraryGrid.kt)
- [Compact cards and badges](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/library/components/CommonMangaItem.kt)
- [Home navigation](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/tachiyomi/ui/home/HomeScreen.kt)
- [Manga screen](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/manga/MangaScreen.kt)

CSS pixels approximate Compose dp. Browser font rendering, system bars, dynamic Android colors, and native widget behavior differ. Current parity is structural/token-based, not a native screenshot-diff guarantee.

## Suwayomi-Server

Revision: `e2ce828abb81f0f5ce1a3fb86194a2746b519c85`

- [REST route registration](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/manga/MangaAPI.kt)
- [Manga controllers](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/manga/controller/MangaController.kt)
- [Category controllers](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/manga/controller/CategoryController.kt)
- [DTO directory](https://github.com/Suwayomi/Suwayomi-Server/tree/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/manga/model/dataclass)
- [Category/library query behavior](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/manga/impl/CategoryManga.kt)
- [OpenAPI plugin registration is commented out](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/server/JavalinSetup.kt)
- [Documentation DSL uses stub builders](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/server/util/DocumentationDsl.kt)

No checked-in OpenAPI JSON/YAML was found in this checkout. There was no running server from which to retrieve `/api/openapi.json`. Interfaces in `src/api/types.ts` were transcribed from DTO definitions and checked against controller response declarations, excluding `@JsonIgnore` fields.

### Implemented endpoint map (relative to /api/v1)

| Method | Path | Response/use |
|---|---|---|
| GET | `/category` | `Category[]` |
| GET | `/category/{categoryId}` | `Manga[]`, titles belonging to that category |
| GET | `/manga/{mangaId}/full?onlineFetch=false` | `Manga` with user/library aggregates |
| GET | `/manga/{mangaId}/chapters?onlineFetch=false` | `Chapter[]` |
| GET | `/manga/{mangaId}/thumbnail` | Image bytes; cover requests go through the server |
| GET | `/manga/{mangaId}/library` | Legacy add-to-library mutation, empty successful response |
| DELETE | `/manga/{mangaId}/library` | Remove-from-library mutation, empty successful response |
| GET | `/source/list` | `Source[]` |

Explicit refresh sets `onlineFetch=true`. Even `false` chapter requests may fetch on the server if no chapters exist; the frontend never scrapes. No retry is enabled, including for the legacy mutating GET. Failed mutation responses do not trigger optimistic membership changes and instruct the user to refresh before retrying.

Do not invent `/library`: this version loads the library through real category IDs. The default category contains **uncategorized** library manga, not the complete library. All categories are fetched before publishing a complete library state; duplicate manga IDs are removed only when calculating the total count.

Source IDs are strings to avoid 64-bit precision loss. Kotlin `Long` DTO numbers use JavaScript numbers, as exposed by upstream JSON; values beyond the safe integer range would need a future lossless JSON adapter. Chapters have distinct `id`, `index`, and `chapterNumber`: future reader paths must use the one-based `index`, not `id`. `uploadDate` originates from `SChapter.date_upload` and is epoch milliseconds; do not reuse that conversion for unrelated server timestamps.


## Reader extension references

Mihon layout references at the revision above:

- [Reader top bar](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/reader/appbars/ReaderTopBar.kt)
- [Reader bottom bar](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/reader/appbars/ReaderBottomBar.kt)
- [Tabbed reader settings](https://github.com/mihonapp/mihon/blob/446f6df82c390ab760802c2fce3b677bce3f31c1/app/src/main/java/eu/kanade/presentation/reader/settings/ReaderSettingsDialog.kt)

Additional REST contracts verified in `MangaController.kt`:

| Method | Path | Contract |
|---|---|---|
| GET | `/manga/{mangaId}/chapter/{chapterIndex}` | `Chapter` with page count; server retrieves source page list as needed |
| GET | `/manga/{mangaId}/chapter/{chapterIndex}/page/{index}?updateProgress=false` | Image bytes; page index is zero-based |
| PATCH | `/manga/{mangaId}/chapter/{chapterIndex}` | Form fields: optional `read`, `bookmarked`, `markPrevRead`, `lastPageRead`; HTTP 200, no JSON response required |

`ChapterPatch` is serialized as `application/x-www-form-urlencoded`, not JSON. `markPrevRead` is typed for API completeness but never sent by this reader.

[Chapter ordering and progress update implementation](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/manga/impl/Chapter.kt) establishes reversed source-list indexing (oldest first) and zero-based saved pages. [Chapter serialization](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/manga/model/table/ChapterTable.kt) leaves deprecated user fields at DTO defaults; [chapter retrieval](https://github.com/Suwayomi/Suwayomi-Server/blob/e2ce828abb81f0f5ce1a3fb86194a2746b519c85/server/src/main/kotlin/suwayomi/tachidesk/manga/impl/chapter/ChapterForDownload.kt) reads `ChapterTable` without hydrating `ChapterUserTable`. This is why autosave is opt-in and no reliable legacy bookmark toggle/restore is claimed.
