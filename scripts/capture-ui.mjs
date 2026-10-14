// Local-only QA utility. Synthetic fixtures never enter the production bundle.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { category, chapter, manga, source } from '../tests/fixtures.ts'
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5173'
const out = process.env.QA_OUTPUT || '/data/mihon-qa'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] })
const errors = []
try {
  for (const [name, width, height] of [['mobile', 390, 844], ['desktop', 1440, 1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    let mode = 'populated'
    await page.addInitScript(() => localStorage.setItem('mihon.apiUrl', '/api/v1'))
    await page.route('**/api/v1/**', async route => {
      if (mode === 'error') return route.fulfill({ status: 503, body: 'Offline fixture' })
      const path = new URL(route.request().url()).pathname
      let body = []
      if (path === '/api/v1/category') body = [category(4, 'Default'), category(19, 'Reading', 1)]
      else if (path === '/api/v1/category/4') body = mode === 'empty' ? [] : [manga(1, 'A journey beyond the stars', 5), manga(2, 'The quiet city', 0), manga(3, 'A very long manga title to verify wrapping on narrow displays', 2)]
      else if (path === '/api/v1/category/19') body = []
      else if (path.endsWith('/full')) body = manga(1, 'A journey beyond the stars', 5)
      else if (path.endsWith('/chapters')) body = [chapter]
      else if (path.startsWith('/api/v1/update/recentChapters/')) body = { page: [], hasNextPage: false }
      else if (path === '/api/v1/source/list') body = [source]
      else if (path.endsWith('/thumbnail')) return route.fulfill({ status: 404 })
      await route.fulfill({ json: body })
    })
    const snap = async state => {
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(250)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      await page.screenshot({ path: `${out}/${name}-${state}.png`, fullPage: true, animations: 'disabled' })
      if (overflow) {
        console.log(await page.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map(e => ({ tag: e.tagName, cls: e.className, right: e.getBoundingClientRect().right }))))
        throw Error(`Horizontal overflow: ${name}/${state}`)
      }
    }
    await page.goto(`${base}/library`)
    await page.getByRole('link', { name: /A journey/ }).waitFor()
    await snap('library')
    await page.getByLabel('Filter and sort library').click()
    await snap('filters')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Open library search' }).click()
    await page.getByLabel('Search library').fill('no match')
    await snap('search-empty')
    await page.goto(`${base}/manga/1`)
    await page.getByRole('heading', { name: 'A journey beyond the stars' }).waitFor()
    await snap('manga')
    await page.getByRole('button', { name: 'In library', exact: true }).click()
    await snap('remove-dialog')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    for (const screen of ['updates', 'history', 'browse', 'more', 'not-found']) {
      await page.goto(`${base}/${screen}`)
      if (screen === 'browse') await page.getByText('Test source', { exact: true }).waitFor()
      await snap(screen)
    }
    mode = 'empty'
    await page.goto(`${base}/library`)
    await page.reload()
    await page.getByRole('heading', { name: 'Your library is empty' }).waitFor()
    await snap('empty')
    mode = 'error'
    await page.reload()
    await page.getByRole('heading', { name: 'Your library, on your server' }).waitFor()
    await snap('error-light')
    await page.goto(`${base}/settings/appearance`); await page.getByRole('radio', { name: 'Dark', exact: true }).check()
    await page.goto(`${base}/library`); await page.getByRole('heading', { name: 'Your library, on your server' }).waitFor()
    await snap('error-dark')
    await page.getByRole('button', { name: 'Connect to Suwayomi' }).click()
    await page.getByLabel('REST API URL').fill('invalid')
    await page.getByRole('button', { name: 'Save & connect' }).click()
    await snap('settings-invalid-dark')
    await context.close()
  }
} finally { await browser.close() }
if (errors.length) throw Error(errors.join('\n'))
console.log('Captured 28 UI states. No runtime exceptions or horizontal overflow.')
