import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { createSuwayomiApi, normalizeApiUrl } from '../../src/api/client'
let server: Server, address: string
const requests: string[] = []
const bodies: { path: string; body: string; type: string }[] = []
beforeAll(async () => {
  server = createServer(async (req, res) => {
    let body = ''
    for await (const part of req) body += part.toString()
    bodies.push({ path: req.url || '', body, type: req.headers['content-type'] || '' })
    requests.push(`${req.method} ${req.url}`)
    res.setHeader('Content-Type', 'application/json')
    if (req.url?.includes('/library')) { res.statusCode = 200; res.end(); return }
    res.end('[]')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  address = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`
})
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))
describe('REST client', () => {
  it('normalizes addresses and rejects credential-bearing/non-HTTP URLs', () => {
    expect(normalizeApiUrl(' http://localhost:4567/api/v1/ ')).toBe('http://localhost:4567/api/v1')
    expect(normalizeApiUrl('/api/v1/')).toBe('/api/v1')
    for (const value of ['javascript:alert(1)', '//remote.test', 'https://u:p@host/api', '', 'https://host/api?token=secret']) expect(() => normalizeApiUrl(value)).toThrow()
  })
  it('uses inspected REST paths, including /full and onlineFetch query', async () => {
    const api = createSuwayomiApi(address)
    await api.categories(); await api.categoryManga(4); await api.manga(12); await api.chapters(12, true); await api.sources()
    expect(requests).toEqual(expect.arrayContaining(['GET /api/v1/category', 'GET /api/v1/category/4', 'GET /api/v1/manga/12/full?onlineFetch=false', 'GET /api/v1/manga/12/chapters?onlineFetch=true', 'GET /api/v1/source/list']))
  })
  it('uses a source index and form-encoded chapter patches', async () => {
    const api = createSuwayomiApi(address)
    await api.chapter(12, 7)
    await api.modifyChapter(12, 7, { lastPageRead: 2, read: true })
    expect(requests).toContain('GET /api/v1/manga/12/chapter/7')
    expect(requests).toContain('PATCH /api/v1/manga/12/chapter/7')
    const patch = bodies.find(b => b.body.includes('lastPageRead'))!
    expect(patch.body).toBe('lastPageRead=2&read=true')
    expect(patch.type).toContain('application/x-www-form-urlencoded')
  })
  it('keeps legacy membership methods and does not duplicate mutations', async () => {
    const api = createSuwayomiApi(address)
    await api.addToLibrary(12); await api.removeFromLibrary(12)
    expect(requests.filter(p => p.includes('/library'))).toEqual(['GET /api/v1/manga/12/library', 'DELETE /api/v1/manga/12/library'])
  })
})
