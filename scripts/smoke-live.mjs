// Explicit opt-in live smoke. Never submits progress, bookmarks, or library mutations.
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const apiUrl = process.env.LIVE_SUWAYOMI_API_URL
if (!apiUrl) throw Error('Set LIVE_SUWAYOMI_API_URL explicitly. This script is never run by npm test.')
const origin = new URL(apiUrl).origin, base = process.env.QA_BASE_URL || 'http://127.0.0.1:5180'
const result = { apiUrl, library: false, manga: false, chapter: false, image: false, sourceList: false, blockedWrites: [], runtimeErrors: [], notes: [] }
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
    } catch {
      result.notes.push('Reader did not reach a successfully decoded page within the test timeout.')
      const alert = page.locator('.reader-message')
      if (await alert.count()) result.notes.push((await alert.innerText()).slice(0, 450))
    }
  } else result.notes.push('Selected manga had no chapters; reader could not be exercised.')
  await page.goto(`${base}/browse`)
  await page.waitForFunction(() => document.querySelectorAll('.v-list-item').length > 0 || document.body.textContent.includes('Sources unavailable'), undefined, { timeout: 20000 })
  result.sourceList = !await page.getByRole('heading', { name: 'Sources unavailable' }).count() && await page.locator('.v-list-item').count() > 0
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) result.notes.push('Horizontal overflow detected')
  await context.close()
} finally { await browser.close() }
await writeFile(process.env.LIVE_SMOKE_OUTPUT || '/data/mihon-live-smoke.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
if (result.blockedWrites.length || result.runtimeErrors.length || !result.library || !result.manga || !result.chapter || !result.image || !result.sourceList) process.exitCode = 1
