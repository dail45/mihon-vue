import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('CategoryDeleteDialog matches the Mihon reference', () => {
  const source = readFileSync('src/components/CategoryDeleteDialog.vue', 'utf8')

  it('renders the reference title, message and buttons', () => {
    expect(source).toContain('delete_category')
    expect(source).toContain('delete_category_confirmation')
    expect(source).toContain('action_ok')
    expect(source).toContain('action_cancel')
  })

  it('uses the MD3 alert dialog geometry', () => {
    expect(source).toMatch(/padding:\s*24px/)
    expect(source).toMatch(/border-radius:\s*28px/)
    expect(source).toMatch(/min-width:\s*min\(280px/)
    expect(source).toMatch(/max-width:\s*min\(560px/)
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*32px/)
    expect(source).toMatch(/font-size:\s*14px;\s*line-height:\s*20px/)
  })

  it('renders the confirm button right of the dismiss button', () => {
    expect(source).toMatch(/\.category-delete-actions\s*\{[^}]*flex-direction:\s*row-reverse/)
  })

  it('dismisses the dialog before the deletion runs, like the reference', () => {
    expect(source).toMatch(/open\.value = false[\s\S]{0,800}await deleteCategory/)
  })
})
