import type { Page } from '@playwright/test'
import { chapter, manga } from '../fixtures.ts'
export interface CapturedPatch { path: string; fields: Record<string, string> }
export function diagnosticPage(number: number) {
  // Deliberately schematic QA chart, not fabricated manga/artwork.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#f4f1e9"/><text x="32" y="54" font-family="sans-serif" font-size="20" fill="#222">UI TEST · PAGE ${number}</text><rect x="32" y="82" width="536" height="250" fill="#d4d1c9" stroke="#333" stroke-width="3"/><path d="M32 256H568M210 82V332" stroke="#777" stroke-width="2"/><rect x="32" y="352" width="258" height="240" fill="#e2dfd7" stroke="#333" stroke-width="3"/><rect x="310" y="352" width="258" height="240" fill="#c5c2ba" stroke="#333" stroke-width="3"/><rect x="32" y="612" width="536" height="230" fill="#dad7cf" stroke="#333" stroke-width="3"/><text x="32" y="875" font-family="sans-serif" font-size="16" fill="#444">Synthetic layout fixture — not manga content</text></svg>`
}
export async function readerServer(page: Page, options: { pageFailure?: boolean; apiFailure?: boolean; noPages?: boolean } = {}) {
  const patches: CapturedPatch[] = [], imageRequests: string[] = []
  let failedOnce = false
  await page.addInitScript(() => localStorage.setItem('mihon.apiUrl', '/api/v1'))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (request.method() === 'PATCH') {
      patches.push({ path, fields: Object.fromEntries(new URLSearchParams(request.postData() || '')) })
      await route.fulfill({ status: 200, body: '' }); return
    }
    if (options.apiFailure && /\/chapter\/\d+$/.test(path)) { await route.fulfill({ status: 503, body: 'Offline fixture' }); return }
    const image = path.match(/\/page\/(\d+)$/)
    if (image) {
      imageRequests.push(url.href)
      if (options.pageFailure && image[1] === '2' && !failedOnce) { failedOnce = true; await route.fulfill({ status: 503, body: 'Image failure' }); return }
      await route.fulfill({ contentType: 'image/svg+xml', body: diagnosticPage(Number(image[1]) + 1) }); return
    }
    if (path.endsWith('/thumbnail')) { await route.fulfill({ contentType: 'image/svg+xml', body: diagnosticPage(1) }); return }
    let body: unknown = []
    if (path.endsWith('/full')) body = manga(1, 'A journey beyond the stars', 2)
    else if (path.endsWith('/chapters')) body = [{ ...chapter, pageCount: 3, lastPageRead: 0 }, { ...chapter, id: 207, index: 9, name: 'Chapter 2', chapterNumber: 2 }]
    else if (/\/chapter\/\d+$/.test(path)) {
      const index = Number(path.split('/').at(-1))
      body = { ...chapter, id: index === 7 ? 109 : 207, index, name: index === 7 ? 'Chapter 1' : 'Chapter 2', pageCount: options.noPages ? 0 : 3, lastPageRead: 0 }
    }
    await route.fulfill({ json: body })
  })
  return { patches, imageRequests }
}
