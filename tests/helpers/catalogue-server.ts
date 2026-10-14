import type { Page } from '@playwright/test'
import { source, manga, chapter } from '../fixtures.ts'
import { diagnosticPage } from './reader-server.ts'
export async function catalogueServer(page: Page, options: { initialError?: boolean; noLatest?: boolean } = {}) {
  const requests: string[] = [], writes: string[] = []
  let initialFailed = false, appendFailed = false
  await page.addInitScript(() => localStorage.setItem('mihon.apiUrl', '/api/v1'))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    requests.push(path + url.search)
    if (request.method() !== 'GET') writes.push(request.method() + ' ' + path)
    if (path.endsWith('/thumbnail')) { await route.fulfill({ contentType: 'image/svg+xml', body: diagnosticPage(1) }); return }
    let body: unknown = []
    if (path.endsWith('/source/list')) body = [{ ...source, supportsLatest: !options.noLatest }]
    else if (path.includes('/source/')) {
      if (options.initialError && !initialFailed) { initialFailed = true; await route.fulfill({ status: 503 }); return }
      if (path.endsWith('/popular/2') && !appendFailed) { appendFailed = true; await route.fulfill({ status: 503 }); return }
      if (path.endsWith('/search')) body = { mangaList: url.searchParams.get('searchTerm') === 'nothing' ? [] : [manga(3, 'Search result')], hasNextPage: false }
      else if (path.includes('/latest/')) body = { mangaList: [manga(4, 'Latest title')], hasNextPage: false }
      else if (path.endsWith('/popular/2')) body = { mangaList: [manga(1, 'A journey beyond the stars'), manga(2, 'A second catalogue title')], hasNextPage: false }
      else body = { mangaList: [manga(1, 'A journey beyond the stars')], hasNextPage: true }
    } else if (path.endsWith('/full')) body = manga(1, 'A journey beyond the stars')
    else if (path.endsWith('/chapters')) body = [chapter]
    await route.fulfill({ json: body })
  })
  return { requests, writes }
}
