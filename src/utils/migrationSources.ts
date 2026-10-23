/**
 * The list of sources used for the migration flow.
 *
 * Mihon keeps it in `SourcePreferences.migrationSources`
 * (`mihon/app/src/main/java/eu/kanade/domain/source/service/SourcePreferences.kt:82`,
 * preference key `migration_sources`). The Suwayomi REST API exposes no equivalent
 * preference endpoint, so the web client keeps the selection locally.
 *
 * Source ids are strings on the wire (`Source.id: string` in `src/api/types.ts`),
 * so the stored list holds string ids.
 */
const STORAGE_KEY = 'mihon.migration.sources'

export function readMigrationSources(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
  } catch {
    return []
  }
}

export function writeMigrationSources(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* private mode: session-only selection */
  }
}
