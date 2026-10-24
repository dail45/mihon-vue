import { generateSourceId, SOURCE_LANGUAGES, type SourceIdentity } from '@/core/utils/sourceId'

const stubCache = new Map<string, SourceIdentity | null>()

/**
 * Resolves the identity of an uninstalled stub source from known extension names
 * and supported languages using async chunking and a memoized cache.
 */
export async function resolveStubSourceIdentity(
  names: string[],
  wanted: string,
  isCancelled?: () => boolean,
): Promise<SourceIdentity | null> {
  if (stubCache.has(wanted)) {
    return stubCache.get(wanted) ?? null
  }

  for (let i = 0; i < names.length; i += 64) {
    if (isCancelled?.()) return null
    const slice = names.slice(i, i + 64)
    for (const name of slice) {
      for (const lang of SOURCE_LANGUAGES) {
        if (generateSourceId(name, lang) === wanted) {
          const match: SourceIdentity = { name, lang }
          stubCache.set(wanted, match)
          return match
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  stubCache.set(wanted, null)
  return null
}

export function clearStubIdentityCache() {
  stubCache.clear()
}
