// Explicit opt-in live smoke. Never submits progress, bookmarks, or library mutations.
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const apiUrl = process.env.LIVE_SUWAYOMI_API_URL
if (!apiUrl) throw Error('Set LIVE_SUWAYOMI_API_URL explicitly. This script is never run by npm test.')
const origin = new URL(apiUrl).origin, base = process.env.QA_BASE_URL || 'http://127.0.0.1:5180'
const result = { apiUrl, library: false, manga: false, chapter: false, image: false, sourceList: false, blockedWrites: [], runtimeErrors: [], notes: [], readerNavigation: false, readerRtl: false, readerWebtoon: false }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(url => {
    localStorage.setItem('mihon.apiUrl', url)
    localStorage.setItem('mihon.reader.saveProgress', 'false')
    localStorage.setItem('mihon.reader.mode', 'ltr')
  }, apiUrl)
  const page = await context.newPage()
  page.on('pageerror', e => result.runtimeErrors.push(e.message))
  await page.route(`${origin}/**`, route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method()) || /\/manga\/\d+\/library\/?$/.test(url.pathname) || url.searchParams.get('onlineFetch') === 'true' || (/\/page\/\d+$/.test(url.pathname) && url.searchParams.get('updateProgress') !== 'false')) {
      result.blockedWrites.push(`${request.method()} ${url.pathname}`)
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })
  await page.goto(`${base}/library`)
  const first = page.locator('.manga-card').first()
  await first.waitFor({ timeout: 25000 })
  result.library = true
  await first.click()
  await page.locator('.manga-detail h1').waitFor({ timeout: 25000 })
  result.manga = true
  const readingSourceId = await page.evaluate(async api => {
    const id = location.pathname.split('/')[2]
    const response = await fetch(`${api}/manga/${id}/full?onlineFetch=false`, { credentials: 'include' })
    if (!response.ok) throw Error(`Manga HTTP ${response.status}`)
    return (await response.json()).sourceId
  }, apiUrl)
  // Choose a downloaded chapter if available; no forced source refresh.
  const selected = await page.evaluate(async api => {
    const id = location.pathname.split('/')[2]
    const response = await fetch(`${api}/manga/${id}/chapters?onlineFetch=false`, { credentials: 'include' })
    if (!response.ok) throw Error(`Chapter list HTTP ${response.status}`)
    const list = await response.json()
    return list.find(c => c.downloaded) || list.slice().sort((a,b) => a.index - b.index)[0] || null
  }, apiUrl)
  if (selected) {
    const id = new URL(page.url()).pathname.split('/')[2]
    await page.goto(`${base}/manga/${id}/read/${selected.index}`)
    try {
      await page.locator('.reader-page').waitFor({ timeout: 25000 })
      result.chapter = true
      await page.waitForFunction(() => {
        const image = document.querySelector('.reader-page')
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
      }, undefined, { timeout: 25000 })
      result.image = true
      const initialPage = Number(await page.locator('.reader-page').getAttribute('data-page'))
      const next = page.getByRole('button', { name: 'Next page', exact: true })
      const previous = page.getByRole('button', { name: 'Previous page', exact: true })
      const direction = await next.isEnabled() ? 1 : await previous.isEnabled() ? -1 : 0
      if (direction) {
        await (direction === 1 ? next : previous).click()
        await page.waitForFunction(expected => {
          const image = document.querySelector('.reader-page')
          return image instanceof HTMLImageElement && Number(image.dataset.page) === expected && image.complete && image.naturalWidth > 0
        }, initialPage + direction, { timeout: 30000 })
        result.readerNavigation = true
      } else result.notes.push('Single-page chapter: page-turn navigation not exercised.')
      await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
      await page.getByText('Reading mode', { exact: true }).click()
      await page.getByRole('radio', { name: 'Right to left', exact: true }).click()
      await page.keyboard.press('Escape')
      // Return to the initial page with reversed controls; no progress writes.
      if (result.readerNavigation) {
        await page.getByRole('button', { name: direction === 1 ? 'Previous page' : 'Next page', exact: true }).click()
        await page.waitForFunction(expected => Number(document.querySelector('.reader-page')?.getAttribute('data-page')) === expected, initialPage)
        result.readerRtl = true
      }
      await page.getByRole('button', { name: 'Reader settings', exact: true }).click()
      await page.getByText('Reading mode', { exact: true }).click()
      await page.getByRole('radio', { name: 'Webtoon · vertical scroll', exact: true }).click()
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => {
        const image = document.querySelector('.reader-strip img')
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
      }, undefined, { timeout: 30000 })
      result.readerWebtoon = true
    } catch {
      result.notes.push('Reader page decoding or extended navigation did not complete within the test timeout.')
      const alert = page.locator('.reader-message')
      if (await alert.count()) result.notes.push((await alert.first().innerText()).slice(0, 450))
    }
  } else result.notes.push('Selected manga had no chapters; reader could not be exercised.')
  await page.goto(`${base}/browse`)
  await page.waitForFunction(() => document.querySelectorAll('.v-list-item').length > 0 || document.body.textContent.includes('Sources unavailable'), undefined, { timeout: 20000 })
  result.sourceList = !await page.getByRole('heading', { name: 'Sources unavailable' }).count() && await page.locator('.v-list-item').count() > 0
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) result.notes.push('Horizontal overflow detected')
  if (process.env.LIVE_TEST_CATALOGUE === '1') {
    result.catalogue = false
    // Use the same source as the manga that was successfully read, not the
    // usually-empty local source. Override explicitly when testing another one.
    // Cataloguing can populate server cache; it does not change membership.
    const sourceId = process.env.LIVE_CATALOGUE_SOURCE_ID || readingSourceId
    if (sourceId) {
      await page.goto(`${base}/browse/source/${encodeURIComponent(sourceId)}`)
      try {
        await page.locator('.manga-card').first().waitFor({ timeout: 30000 }); result.catalogue = true
        const title = (await page.locator('.manga-title-text').first().innerText()).trim()
        const latest = page.getByRole('button', { name: 'Latest', exact: true })
        if (await latest.count() && await latest.isEnabled()) {
          const response = page.waitForResponse(r => new URL(r.url()).pathname.includes(`/source/${sourceId}/latest/`), { timeout: 25000 })
          await latest.click()
          const data = await response
          result.catalogueLatest = data.ok() && Array.isArray((await data.json()).mangaList)
        }
        const response = page.waitForResponse(r => new URL(r.url()).pathname.endsWith(`/source/${sourceId}/search`), { timeout: 25000 })
        await page.getByRole('button', { name: 'Open source search' }).click()
    await page.getByLabel('Search source').fill(title)
        await page.getByLabel('Search source').press('Enter')
        const data = await response
        result.catalogueSearch = data.ok() && Array.isArray((await data.json()).mangaList)
        await page.waitForFunction(() => !document.querySelector('[aria-label="Loading catalogue"]'))
      }
      catch { result.notes.push('Live catalogue verification did not finish all requested stages.') }
    }
  }
  await context.close()
} finally { await browser.close() }
await writeFile(process.env.LIVE_SMOKE_OUTPUT || '/data/mihon-live-smoke.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
if (result.blockedWrites.length || result.runtimeErrors.length || !result.library || !result.manga || !result.chapter || !result.image || !result.sourceList || !result.readerWebtoon || (process.env.LIVE_TEST_CATALOGUE === '1' && (!result.catalogue || !result.catalogueSearch || result.catalogueLatest === false))) process.exitCode = 1
