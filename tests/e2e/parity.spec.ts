import { test, expect, type Page } from '@playwright/test'
import { category, chapter, manga, source } from '../fixtures'
async function setup(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mihon.apiUrl', '/api/v1'))
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path === '/api/v1/category') body = [category(4, 'Default')]
    else if (path === '/api/v1/category/4') body = [manga(1, 'Alpha'), manga(2, 'Beta')]
    else if (path === '/api/v1/source/list') body = [source]
    else if (path.includes('/source/') && path.includes('/popular/')) body = { mangaList: [manga(1, 'Alpha')], hasNextPage: false }
    else if (path.includes('/update/recentChapters/')) body = { page: [{ manga: manga(1, 'Alpha'), chapter: { ...chapter, fetchedAt: Math.floor(Date.now() / 1000) } }], hasNextPage: false }
    else if (path.endsWith('/full')) body = manga(1, 'Alpha')
    else if (path.endsWith('/chapters')) body = [chapter, { ...chapter, id: 110, index: 8, name: 'Chapter 2', read: true, downloaded: true, bookmarked: true }]
    else if (path.endsWith('/thumbnail')) { await route.fulfill({ status: 404 }); return }
    await route.fulfill({ json: body })
  })
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true) }
test('settings, appearance, reader defaults, connection, categories and about routes work', async ({ page }) => {
  await setup(page); await page.goto('/more')
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('link', { name: /Appearance/ }).click()
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('.v-application')).toHaveClass(/mihonDark/)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('link', { name: /^Reader/ }).click()
  // SettingsReaderScreen.kt: the reader section shows the reference preference tree.
  await expect(page.getByText('Default reading mode', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Display', exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Automatically save reading progress' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('link', { name: /^Server connection/ }).click()
  await page.getByRole('button', { name: 'Change server address' }).click()
  await expect(page.getByLabel('REST API URL')).toHaveValue('/api/v1')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  // Mihon `CategoryScreen`: the app bar title is "Edit categories" and a list item opens the
  // rename dialog (the whole row is clickable, `clickable(onClick = onRename)`).
  await page.goto('/categories')
  await expect(page.getByText('Edit categories', { exact: true })).toBeVisible()
  await expect(page.getByText('Default', { exact: true })).toBeVisible()
  await page.getByText('Default', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Rename category' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto('/about'); await expect(page.getByRole('heading', { name: 'Mihon Vue' })).toBeVisible()
  await expect(page.getByText(/SIL Open Font License/)).toBeVisible(); await noOverflow(page)
})
test('library display modes persist and the Mihon automatic tablet thresholds is respected', async ({ page }) => {
  await setup(page); await page.goto('/library')
  for (const [label, value] of [['Comfortable grid','comfortable'], ['Cover-only grid','covers'], ['List','list'], ['Compact grid','compact']]) {
    await page.getByRole('button', { name: 'Filter and sort library' }).click()
    await page.getByRole('tab', { name: 'Display', exact: true }).click()
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.keyboard.press('Escape')
    if (value === 'list') await expect(page.getByLabel('Manga list')).toBeVisible()
    else await expect(page.getByLabel(`${value} manga grid`)).toBeVisible()
    await noOverflow(page)
  }
  await page.reload(); await expect(page.getByLabel('compact manga grid')).toBeVisible()
  for (const width of [699, 700]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.mihon-rail')).toHaveCount(width >= 700 ? 1 : 0)
    if (width >= 700) {
      await expect(page.locator('.mihon-rail')).toHaveClass(/v-navigation-drawer/)
      const box = await page.locator('.mihon-rail').boundingBox()
      expect(box!.x).toBe(0); expect(box!.width).toBe(80)
      await expect(page.locator('.mihon-rail').getByRole('link', { name: 'Updates', exact: true })).toHaveCSS('color', 'rgb(68, 70, 79)')
      const tabs = await page.getByRole('tablist', { name: 'Library categories' }).boundingBox()
      expect(tabs!.x).toBeGreaterThanOrEqual(80); expect(tabs!.y).toBe(64)
    }
    await expect(page.locator('.mihon-navigation')).toHaveCount(width < 700 ? 1 : 0)
    await noOverflow(page)
  }
})
test('updates date groups, search and download filter operate on the feed', async ({ page }) => {
  await setup(page); await page.goto('/updates')
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
  // The chapter title is a link to the reader, like the `combinedClickable` row of the reference.
  await expect(page.getByRole('link', { name: /Read Chapter 1/ })).toHaveAttribute('href', '/manga/1/read/7')
  // The app bar actions of `UpdatesAppBar`; the content description of an action is its title.
  await expect(page.getByRole('button', { name: 'Filter', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View Upcoming Updates' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Update library' })).toBeVisible()
  await page.getByRole('button', { name: 'Open updates search' }).click()
  await page.getByLabel('Search loaded updates').fill('absent')
  // `MR.strings.error_no_match` of the reference EmptyScreen.
  await expect(page.getByRole('heading', { name: 'No match found' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  // The reference dialog is a tabbed sheet whose first page holds the tri-state filters.
  await expect(page.getByRole('tab', { name: 'Filter', exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Downloaded', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'No match found' })).toBeVisible(); await noOverflow(page)
})
test('chapter filters and sort are independent of library filters', async ({ page }) => {
  await setup(page); await page.goto('/manga/1')
  await expect(page.getByText('Chapter 2', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Chapter settings', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Unread', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Chapter 2', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Chapter settings', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Unread', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Unread', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Bookmarked', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Chapter 1', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Chapter 2', { exact: true })).toBeVisible(); await noOverflow(page)
})
test('catalogue supports list and comfortable display without changing library preference', async ({ page }) => {
  await setup(page); await page.goto(`/browse/source/${source.id}`)
  await expect(page.getByLabel('compact manga grid')).toBeVisible()
  await page.getByRole('button', { name: 'Catalogue display mode' }).click()
  await page.getByText('List', { exact: true }).click(); await expect(page.getByRole('list', {name:'Catalogue display modes'})).toBeHidden(); await expect(page.getByLabel('Manga list')).toBeVisible()
  await page.getByRole('button', { name: 'Catalogue display mode' }).click()
  await page.getByText('Comfortable grid', { exact: true }).click(); await expect(page.getByLabel('comfortable manga grid')).toBeVisible()
  await page.goto('/library'); await expect(page.getByLabel('compact manga grid')).toBeVisible(); await noOverflow(page)
})

test('source toolbar uses filter buttons, inline search and no server or moon actions', async ({ page }) => {
  await setup(page); await page.goto(`/browse/source/${source.id}`)
  await expect(page.getByRole('button', { name: 'Popular', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('tab', { name: 'Popular', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Popular', exact: true })).toHaveCSS('border-radius', '8px')
  await expect(page.getByRole('button', { name: 'Popular', exact: true })).toHaveCSS('height', '32px')
  await expect(page.locator('.v-app-bar')).toHaveCount(1)
  await expect(page.locator('.source-toolbar [aria-label="Server connection settings"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Use dark theme' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open source search' }).click()
  const input = page.getByLabel('Search source')
  await expect(input).toBeFocused(); await input.fill('A long search query')
  expect(await input.evaluate(e => e.closest('.v-toolbar__content') !== null)).toBe(true)
  await expect(page.locator('.source-catalogue > form')).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear source search' }).click(); await expect(input).toHaveValue('')
  await input.press('Escape'); await expect(input).toHaveCount(0)
  await noOverflow(page)
})

test('Vuetify 4 runtime uses MD3 typography and native search and checkbox controls', async ({ page }) => {
  await setup(page); await page.goto('/library')
  await expect(page.locator('.v-application')).toHaveAttribute('data-vuetify-version', /^4\./)
  await expect(page.locator('.search-app-bar .text-title-large')).toHaveCSS('font-size','22px')
  await page.getByRole('button',{name:'Open library search'}).click()
  await expect(page.locator('.toolbar-search .v-text-field input')).toBeFocused()
  await expect(page.locator('.toolbar-search .v-text-field input')).toHaveCSS('font-size','18px')
  await expect(page.locator('.toolbar-search .v-text-field input')).toHaveCSS('padding-top','0px')
  await expect(page.locator('.toolbar-search .v-text-field input')).toHaveCSS('padding-bottom','0px')
  await page.getByRole('button',{name:'Close search',exact:true}).click()
  await page.getByRole('button',{name:'Filter and sort library'}).click()
  const checkbox=page.getByRole('checkbox',{name:'Unread',exact:true})
  await expect(checkbox).toHaveAttribute('type','checkbox'); await checkbox.click(); await expect(checkbox).toBeChecked()
  await checkbox.click(); await expect(checkbox).toHaveAttribute('aria-checked','mixed')
  await checkbox.click(); await expect(checkbox).not.toBeChecked()
  await checkbox.press('Space'); await expect(checkbox).toBeChecked()
  await checkbox.press('Space'); await expect(checkbox).toHaveAttribute('aria-checked','mixed')
  await checkbox.press('Space'); await expect(checkbox).not.toBeChecked()
  await page.keyboard.press('Escape'); await noOverflow(page)
})
