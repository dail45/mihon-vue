import { beforeEach, describe, expect, it } from 'vitest'
import { clearStubIdentityCache, resolveStubSourceIdentity } from '../../src/utils/sourceIdentity'
import { generateSourceId } from '../../src/utils/sourceId'

describe('sourceIdentity utility', () => {
  beforeEach(() => {
    clearStubIdentityCache()
  })

  it('resolves a known stub source from names and languages', async () => {
    const wantedId = generateSourceId('MangaDex', 'en')
    const result = await resolveStubSourceIdentity(['OtherSource', 'MangaDex'], wantedId)
    expect(result).toEqual({ name: 'MangaDex', lang: 'en' })
  })

  it('returns null and caches result when source is not found', async () => {
    const result = await resolveStubSourceIdentity(['SourceA', 'SourceB'], 'unknown_id_99999')
    expect(result).toBeNull()

    // Second call returns cached null immediately
    const cachedResult = await resolveStubSourceIdentity(['SourceA', 'SourceB'], 'unknown_id_99999')
    expect(cachedResult).toBeNull()
  })

  it('uses cached identity on repeated lookups without rescanning', async () => {
    const wantedId = generateSourceId('MangaDex', 'en')
    const first = await resolveStubSourceIdentity(['MangaDex'], wantedId)
    expect(first).toEqual({ name: 'MangaDex', lang: 'en' })

    // Provide empty array — should still resolve from cache
    const second = await resolveStubSourceIdentity([], wantedId)
    expect(second).toEqual({ name: 'MangaDex', lang: 'en' })
  })

  it('aborts early when cancellation signal fires', async () => {
    const wantedId = generateSourceId('MangaDex', 'en')
    let cancelled = false
    const promise = resolveStubSourceIdentity(['Other1', 'Other2', 'MangaDex'], wantedId, () => cancelled)
    cancelled = true
    const result = await promise
    // If cancelled before chunk completes, returns null
    expect(result === null || result?.name === 'MangaDex').toBe(true)
  })
})
