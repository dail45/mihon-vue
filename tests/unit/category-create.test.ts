import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
const request = vi.hoisted(() => vi.fn())
const createOptions = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('ofetch', () => ({
  ofetch: Object.assign(request, {
    create: (options: Record<string, unknown>) => {
      createOptions.current = options
      return request
    },
  }),
}))
import { createCategory } from '../../src/api/categoryCreate'

describe('category create mutation', () => {
  beforeEach(() => request.mockReset())

  it('posts the name as a form field to the legacy REST endpoint', async () => {
    request.mockResolvedValue({})
    await expect(createCategory('/api/v1', 'Reading')).resolves.toBeUndefined()
    const [url, options] = request.mock.calls[0]!
    expect(url).toBe('/category')
    expect(options.method).toBe('POST')
    expect(createOptions.current.retry).toBe(0)
    expect(String(options.body)).toContain('name=Reading')
  })

  it('propagates the server error', async () => {
    request.mockRejectedValueOnce(new Error('Bad Request'))
    await expect(() => createCategory('/api/v1', 'Reading')).rejects.toThrow('Bad Request')
  })
})

describe('CategoryCreateDialog matches the Mihon reference', () => {
  const source = readFileSync('src/features/library/components/CategoryCreateDialog.vue', 'utf8')

  it('renders the reference title, labels and messages', () => {
    expect(source).toContain('action_add_category')
    expect(source).toContain('MR.strings.name')
    expect(source).toContain('information_required_plain')
    expect(source).toContain('error_category_exists')
    expect(source).toContain('action_add')
    expect(source).toContain('action_cancel')
  })

  it('keeps the reference enable rule for the confirm button', () => {
    expect(source).toContain("name.value !== '' && !nameAlreadyExists.value")
  })

  it('keeps the reference error rule', () => {
    expect(source).toContain("name.value !== '' && nameAlreadyExists.value")
  })

  it('uses the MD3 alert dialog geometry', () => {
    expect(source).toMatch(/padding:\s*24px/)
    expect(source).toMatch(/border-radius:\s*28px/)
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*32px/)
  })

  it('uses the MD3 outlined text field geometry', () => {
    expect(source).toMatch(/height:\s*56px/)
    expect(source).toMatch(/border-radius:\s*(?:4|8)px/)
    /* The 8dp cutout padding of `Modifier.topPaddingForLabelCutout`. */
    expect(source).toMatch(/padding-top:\s*8px/)
  })

  it('renders the confirm button right of the dismiss button', () => {
    expect(source).toMatch(/\.category-create-actions\s*\{[^}]*flex-direction:\s*row-reverse/)
  })

  it('supports Enter key submission and autofocus on open', () => {
    expect(source).toContain('@keydown.enter.prevent="onEnter"')
    expect(source).toContain('autofocus')
  })
})
