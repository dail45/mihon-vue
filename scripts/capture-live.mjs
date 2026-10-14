// Explicit opt-in LIVE UI inspection. No fixtures, mock routes or synthetic pages.
// Images and metadata are private QA output and must never be committed.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const api = process.env.LIVE_SUWAYOMI_API_URL
if (!api) throw Error('Set LIVE_SUWAYOMI_API_URL explicitly.')
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5180'
const output = process.env.QA_OUTPUT || '/data/live-ui-qa'
const origin = new URL(api).origin
await mkdir(output, { recursive: true })
const report = { api, fixtures: false, captures: [], blockedWrites: [], errors: [], imageFailures: [] }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] })
try {
  for (const [size, width, height] of [['mobile', 390, 844], ['desktop', 1440, 1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'light' })
    await context.addInitScript(url => {
      localStorage.setItem('mihon.apiUrl', url)
      localStorage.setItem('mihon.reader.saveProgress', 'false')
      localStorage.setItem('mihon.reader.mode', 'ltr')
    }, api)
    const page = await context.newPage()
    page.on('pageerror', e => report.errors.push(e.message))
    // Guard only; allowed requests use the real server without mock responses.
    await page.route(`${origin}/**`, route => {
      const request = route.request(), url = new URL(request.url())
      if (!['GET', 'HEAD'].includes(request.method()) || /\/manga\/\d+\/library\/?$/.test(url.pathname) || url.searchParams.get('onlineFetch') === 'true' || (/\/page\/\d+$/.test(url.pathname) && url.searchParams.get('updateProgress') !== 'false')) {
        report.blockedWrites.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient')
      }
      return route.continue()
    })
    async function capture(state) {
      await page.evaluate(() => document.fonts.ready)
      // Wait for real visible images, without waiting for an entire webtoon chapter.
      await page.waitForFunction(() => [...document.images].filter(i => {
        const r = (i.closest('.v-img') || i).getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0
      }).every(i => i.complete), undefined, { timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(350)
      const failures = await page.evaluate(() => [...document.images].filter(i => {
        const r = (i.closest('.v-img') || i).getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0 && (!i.complete || !i.naturalWidth)
      }).length)
      if (failures) report.imageFailures.push({ size, state, count: failures })
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Horizontal overflow: ${size}/${state}`)
      await page.screenshot({ path: `${output}/${size}-${state}.png`, fullPage: false, animations: 'disabled' })
      report.captures.push(`${size}-${state}`)
    }
    await page.goto(`${base}/library`)
    await page.locator('.manga-card').first().waitFor({ timeout: 25000 }); await capture('library')
    await page.locator('.manga-card').first().click()
    await page.locator('.manga-detail h1').waitFor({ timeout: 25000 }); await capture('manga')
    const mangaId = new URL(page.url()).pathname.split('/')[2]
    const selected = await page.evaluate(async ({api, id}) => {
      const detailResponse = await fetch(`${api}/manga/${id}/full?onlineFetch=false`, { credentials: 'include' })
      const chapterResponse = await fetch(`${api}/manga/${id}/chapters?onlineFetch=false`, { credentials: 'include' })
      if (!detailResponse.ok || !chapterResponse.ok) throw Error('Live manga/chapter request failed')
      const detail = await detailResponse.json(), chapters = await chapterResponse.json()
      return { sourceId: detail.sourceId, title: detail.title, chapter: chapters.find(c => c.downloaded) || chapters.slice().sort((a,b) => a.index-b.index)[0] }
    }, {api, id:mangaId})
    if (!selected.chapter) throw Error('Selected real manga has no chapters')
    await page.goto(`${base}/manga/${mangaId}/read/${selected.chapter.index}`)
    await page.waitForFunction(() => { const i = document.querySelector('.reader-page'); return i instanceof HTMLImageElement && i.complete && i.naturalWidth > 0 }, undefined, { timeout: 35000 })
    await capture('reader')
    await page.getByRole('button', { name: 'Toggle reading controls' }).click(); await capture('immersive')
    await page.getByRole('button', { name: 'Show reading controls' }).click()
    const next = page.getByRole('button', { name: 'Next page', exact: true })
    if (await next.isEnabled()) { await next.click(); await capture('next-page') }
    await page.getByRole('button', { name: 'Reader settings', exact: true }).click(); await capture('reader-settings')
    await page.getByRole('combobox', { name: 'Reading mode', exact: true }).press('Enter')
    await page.getByRole('option', { name: 'Webtoon · vertical scroll', exact: true }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click(); await capture('webtoon')
    await page.getByRole('button', { name: 'Chapter list', exact: true }).click(); await capture('chapters')
    await page.goto(`${base}/browse/source/${encodeURIComponent(selected.sourceId)}`)
    await page.locator('.manga-card').first().waitFor({ timeout: 30000 }); await capture('popular')
    const title = (await page.locator('.manga-title-text').first().innerText()).trim()
    const latest = page.getByRole('button', { name: 'Latest', exact: true })
    if (await latest.count() && await latest.isEnabled()) {
      const response = page.waitForResponse(r => new URL(r.url()).pathname.includes(`/source/${selected.sourceId}/latest/`), { timeout: 25000 })
      await latest.click(); if (!(await response).ok()) throw Error('Live Latest request failed')
      await page.waitForFunction(() => !document.querySelector('[aria-label="Loading catalogue"]'))
      await page.locator('.manga-card').first().waitFor({ timeout: 25000 }); await capture('latest')
    }
    await page.getByRole('button', { name: 'Open source search' }).click()
    await page.getByLabel('Search source').fill(title)
    const searchResponse = page.waitForResponse(r => new URL(r.url()).pathname.endsWith(`/source/${selected.sourceId}/search`), { timeout: 25000 })
    await page.getByLabel('Search source').press('Enter')
    if (!(await searchResponse).ok()) throw Error('Live search request failed')
    await page.waitForFunction(() => !document.querySelector('[aria-label="Loading catalogue"]'))
    await page.locator('.manga-card').first().waitFor({ timeout: 25000 }); await capture('search')
    const searchUrl = page.url()
    await page.goto(`${base}/settings/appearance`); await page.getByRole('radio', { name: 'Dark', exact: true }).check()
    await page.goto(searchUrl); await page.locator('.manga-card').first().waitFor(); await capture('search-dark')
    await context.close()
  }
} catch (error) { report.errors.push(error.message); process.exitCode = 1 }
finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)) }
console.log(JSON.stringify(report, null, 2))
if (report.blockedWrites.length || report.errors.length || report.imageFailures.length) process.exitCode = 1
