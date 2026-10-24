import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSourceCatalogue } from '../../src/composables/useSourceCatalogue'
import { manga } from '../fixtures'

const fetchPage = vi.hoisted(() => vi.fn())
vi.mock('../../src/api/client', () => ({
  createSuwayomiApi: () => ({ sourceCatalogue: fetchPage }),
  apiErrorMessage: () => 'Server error',
}))

beforeEach(() => {
  fetchPage.mockReset()
})

describe('useSourceCatalogue composable', () => {
  it('loads first page, deduplicates items and updates pagination state', async () => {
    const catalogue = useSourceCatalogue()
    fetchPage
      .mockResolvedValueOnce({ mangaList: [manga(1)], hasNextPage: true })
      .mockResolvedValueOnce({ mangaList: [manga(1), manga(2), manga(2)], hasNextPage: false })

    await catalogue.open('/api/v1', '9223372036854775806', 'search', 'stars & moon')
    expect(fetchPage).toHaveBeenCalledWith('9223372036854775806', 'search', 1, 'stars & moon')

    await catalogue.loadMore()
    expect(catalogue.items.map(m => m.id)).toEqual([1, 2])
    expect(catalogue.page).toBe(2)
    expect(catalogue.hasNextPage).toBe(false)
  })

  it('keeps previous items and sets error on failed page', async () => {
    const catalogue = useSourceCatalogue()
    fetchPage
      .mockResolvedValueOnce({ mangaList: [manga(1)], hasNextPage: true })
      .mockRejectedValueOnce(new Error('Network error'))

    await catalogue.open('/api/v1', '123', 'popular')
    expect(catalogue.items).toHaveLength(1)

    await catalogue.loadMore()
    expect(catalogue.error).toBe('Server error')
    expect(catalogue.items).toHaveLength(1)
  })

  it('clears state on close', async () => {
    const catalogue = useSourceCatalogue()
    fetchPage.mockResolvedValueOnce({ mangaList: [manga(1)], hasNextPage: true })

    await catalogue.open('/api/v1', '123', 'popular')
    expect(catalogue.items).toHaveLength(1)

    catalogue.close()
    expect(catalogue.items).toHaveLength(0)
    expect(catalogue.page).toBe(0)
    expect(catalogue.hasNextPage).toBe(false)
  })
})
