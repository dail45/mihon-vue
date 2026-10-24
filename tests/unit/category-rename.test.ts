import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
const request = vi.hoisted(() => vi.fn())
vi.mock('ofetch', () => ({ ofetch: request }))
import { renameCategory } from '../../src/api/categoryRename'

describe('category rename mutation', () => {
  beforeEach(() => request.mockReset())

  it('renames through the GraphQL endpoint without retrying', async () => {
    request.mockResolvedValue({ data: { updateCategory: { category: { id: 3, name: 'Manga' } } } })
    await expect(renameCategory('/api/v1', 3, 'Manga')).resolves.toEqual({ id: 3, name: 'Manga' })
    const [url, options] = request.mock.calls[0]!
    expect(url).toBe('/api/graphql')
    expect(options.retry).toBe(0)
    expect(options.body.query).toMatch(/mutation UpdateCategory/)
    expect(options.body.variables).toEqual({ input: { id: 3, patch: { name: 'Manga' } } })
  })

  it('rejects when the server reports errors', async () => {
    request.mockResolvedValue({ errors: [{ message: 'Category not found' }] })
    await expect(renameCategory('/api/v1', 3, 'Manga')).rejects.toThrow(/Category not found/)
  })

  it('does not claim success when the server keeps the old name', async () => {
    request.mockResolvedValue({ data: { updateCategory: { category: { id: 3, name: 'Old' } } } })
    await expect(renameCategory('/api/v1', 3, 'Manga')).rejects.toThrow(/did not apply/)
  })
})

describe('CategoryRenameDialog matches the Mihon reference', () => {
  const source = readFileSync('src/components/CategoryRenameDialog.vue', 'utf8')

  it('renders the reference title, labels and messages', () => {
    expect(source).toContain('action_rename_category')
    expect(source).toContain('MR.strings.name')
    expect(source).toContain('information_required_plain')
    expect(source).toContain('error_category_exists')
    expect(source).toContain('action_ok')
    expect(source).toContain('action_cancel')
  })

  it('keeps the reference enable rule for the confirm button', () => {
    expect(source).toContain(
      'valueHasChanged.value && name.value !== \'\' && !nameAlreadyExists.value',
    )
  })

  it('keeps the reference error rule', () => {
    expect(source).toContain('valueHasChanged.value && nameAlreadyExists.value')
  })

  it('uses the MD3 alert dialog geometry', () => {
    expect(source).toMatch(/padding:\s*24px/)
    expect(source).toMatch(/border-radius:\s*28px/)
    expect(source).toMatch(/min-width:\s*280px/)
    expect(source).toMatch(/max-width:\s*560px/)
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*32px/)
  })

  it('renders the confirm button right of the dismiss button', () => {
    expect(source).toMatch(/\.category-rename-actions\s*\{[^}]*flex-direction:\s*row-reverse/)
  })
})
