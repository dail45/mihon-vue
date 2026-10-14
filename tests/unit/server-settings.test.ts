import { beforeEach, describe, expect, it, vi } from 'vitest'
const request = vi.hoisted(() => vi.fn())
vi.mock('ofetch', () => ({ ofetch: request }))
import { readServerSettings, saveServerSettings } from '../../src/api/serverSettings'
const settings = { downloadAsCbz:false, autoDownloadNewChapters:false, autoDownloadIgnoreReUploads:true, autoDownloadNewChaptersLimit:0, globalUpdateInterval:12, maxSourcesInParallel:6 }
beforeEach(() => request.mockReset())
describe('server settings request discipline', () => {
  it('reads only allowed fields and never requests secrets', async () => {
    request.mockResolvedValue({data:{settings}});await expect(readServerSettings('/api/v1')).resolves.toEqual(settings)
    const options=request.mock.calls[0]![1];expect(options.retry).toBe(0);expect(options.body.query).toMatch(/^query /);expect(options.body.query).not.toMatch(/Password|ApiKey|Username/)
  })
  it('sends only explicit changed fields, without retrying a mutation', async () => {
    request.mockResolvedValue({data:{setSettings:{settings:{...settings,downloadAsCbz:true}}}})
    await saveServerSettings('/api/v1',{downloadAsCbz:true});const options=request.mock.calls[0]![1]
    expect(options.retry).toBe(0);expect(options.body.variables).toEqual({input:{settings:{downloadAsCbz:true}}})
  })
  it('does not claim success when returned values differ', async () => {
    request.mockResolvedValue({data:{setSettings:{settings}}})
    await expect(saveServerSettings('/api/v1',{downloadAsCbz:true})).rejects.toThrow(/did not confirm/);expect(request).toHaveBeenCalledTimes(1)
  })
  it('rejects nonallowlisted writes before making a request', async () => {
    await expect(saveServerSettings('/api/v1',{authPassword:true})).rejects.toThrow(/Unapproved/);expect(request).not.toHaveBeenCalled()
  })
})
