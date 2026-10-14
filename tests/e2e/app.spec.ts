import { expect, test, type Page } from '@playwright/test'
import { category, chapter, manga, source } from '../fixtures'
async function mockServer(page: Page, mode: 'populated' | 'empty' | 'error' = 'populated') {
  await page.addInitScript(() => localStorage.setItem('mihon.apiUrl', '/api/v1'))
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (mode === 'error') { await route.fulfill({ status: 503, body: 'Offline fixture' }); return }
    let body: unknown = []
    if (path === '/api/v1/category') body = [category(4, 'Default'), category(19, 'Reading', 1)]
    else if (path === '/api/v1/category/4') body = mode === 'empty' ? [] : [manga(1, 'A journey beyond the stars', 5), manga(2, 'The quiet city', 0), manga(3, 'A very long manga title to verify wrapping on narrow displays', 2)]
    else if (path === '/api/v1/category/19') body = mode === 'empty' ? [] : [manga(4, 'Reading category title', 1)]
    else if (path.endsWith('/full')) body = manga(1, 'A journey beyond the stars', 5)
    else if (path.endsWith('/chapters')) body = [chapter]
    else if (path.startsWith('/api/v1/update/recentChapters/')) body = { page: [], hasNextPage: false }
    else if (path === '/api/v1/source/list') body = [source]
    else if (path.endsWith('/thumbnail')) { await route.fulfill({ status: 404 }); return }
    await route.fulfill({ json: body })
  })
}
async function noOverflow(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.fonts.check('24px "Material Symbols Rounded"'))).toBe(true)
  // Catch a missing font/ligature: named icons must shape to a single 24px glyph.
  expect(await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = '24px "Material Symbols Rounded"'
    return [...document.querySelectorAll('.material-symbols-rounded')].every(e => ctx.measureText(e.textContent || '').width <= 26)
  })).toBe(true)

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
test('library, search, filters, category tabs and manga details work', async ({ page }) => {
  await mockServer(page); await page.goto('/library')
  await expect(page.getByRole('link', { name: /A journey/ })).toBeVisible()
  await page.getByRole('button', { name: 'Open library search' }).click()
  await page.getByLabel('Search library').fill('quiet')
  await expect(page.getByRole('link', { name: /The quiet city/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /A journey/ })).toHaveCount(0)
  await page.getByLabel('Search library').fill('')
  await page.getByLabel('Filter and sort library').click()
  await page.getByRole('checkbox', { name: 'Unread', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('link', { name: /The quiet city/ })).toHaveCount(0)
  await page.getByRole('tab', { name: /Reading/ }).click()
  await expect(page.getByRole('link', { name: /Reading category/ })).toBeVisible()
  await page.getByRole('tab', { name: /Default/ }).click()
  await page.getByRole('link', { name: /A journey/ }).click()
  await expect(page.getByRole('heading', { name: 'A journey beyond the stars' })).toBeVisible()
  await expect(page.getByText('Chapter 1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'In library', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await noOverflow(page)
})
test('connection error, address validation, and theme toggle', async ({ page }) => {
  await mockServer(page, 'error'); await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Your library, on your server' })).toBeVisible()
  await expect(page.locator('.app-toolbar [aria-label="Server connection settings"]')).toHaveCount(0)
  await page.goto('/settings/appearance')
  await page.getByRole('radio', { name: 'Dark', exact: true }).check()
  await page.goto('/library')
  await expect(page.locator('.v-application')).toHaveClass(/v-theme--mihonDark/)
  await page.getByRole('button', { name: 'Connect to Suwayomi' }).click()
  await page.getByLabel('REST API URL').fill('javascript:bad')
  await page.getByRole('button', { name: 'Save & connect' }).click()
  await expect(page.getByText(/Use an HTTP\(S\) API URL/)).toBeVisible()
  await noOverflow(page)
})
test('empty library and each navigation route are honest and usable', async ({ page }) => {
  await mockServer(page, 'empty'); await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Your library is empty' })).toBeVisible()
  await page.getByRole('link', { name: 'Updates', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No recent updates' })).toBeVisible()
  await page.getByRole('link', { name: 'History', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'History is not implemented yet' })).toBeVisible()
  await page.getByRole('link', { name: 'Browse', exact: true }).click()
  await expect(page.getByText('Test source', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'More', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mihon Vue' })).toBeVisible()
  await noOverflow(page)
})
