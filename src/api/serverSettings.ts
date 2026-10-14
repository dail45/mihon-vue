import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'
// Deliberate allowlist: never request passwords, API keys, proxy credentials or auth settings.
export const serverSettingFields = [
  { key: 'downloadAsCbz', title: 'Save chapters as CBZ', group: 'Downloads', type: 'boolean' },
  { key: 'autoDownloadNewChapters', title: 'Automatically download new chapters', group: 'Downloads', type: 'boolean' },
  { key: 'autoDownloadIgnoreReUploads', title: 'Ignore reuploads when downloading', group: 'Downloads', type: 'boolean' },
  { key: 'autoDownloadNewChaptersLimit', title: 'New chapter download limit', group: 'Downloads', type: 'integer', min: 0 },
  { key: 'globalUpdateInterval', title: 'Library update interval (hours)', group: 'Library updates', type: 'number', min: 0 },
  { key: 'maxSourcesInParallel', title: 'Maximum parallel sources', group: 'Library updates', type: 'integer', min: 1 },
] as const
export type ServerSettings = Record<string, boolean | number>
const selection = serverSettingFields.map(f => f.key).join(' ')
export function serverGraphqlUrl(apiUrl: string) {
  const normalized = normalizeApiUrl(apiUrl)
  if (!/\/api\/v1$/.test(normalized)) throw new Error('Server settings require the standard /api/v1 API path (including any server subpath).')
  return normalized.replace(/\/v1$/, '/graphql')
}
export function validateServerSettings(value: unknown): ServerSettings {
  if (!value || typeof value !== 'object') throw new Error('The server did not return settings. Check your permissions.')
  const result: ServerSettings = {}
  for (const f of serverSettingFields) {
    const v = (value as Record<string, unknown>)[f.key]
    if (f.type === 'boolean' ? typeof v !== 'boolean' : typeof v !== 'number' || !Number.isFinite(v) || v < f.min || (f.type === 'integer' && !Number.isInteger(v))) throw new Error(`Unsupported or invalid setting: ${f.title}.`)
    result[f.key] = v as boolean | number
  }
  return result
}
async function request(apiUrl: string, query: string, variables?: Record<string, unknown>) {
  const response = await ofetch<{ data?: Record<string, unknown>; errors?: { message: string }[] }>(serverGraphqlUrl(apiUrl), { method: 'POST', body: { query, variables }, credentials: 'include', timeout: 15000, retry: 0 })
  if (response.errors?.length) throw new Error('Server settings request was rejected. Check server permissions and compatibility.')
  if (!response.data) throw new Error('No server settings returned.')
  return response.data
}
export async function readServerSettings(apiUrl: string) { return validateServerSettings((await request(apiUrl, `query WebSettings { settings { ${selection} } }`)).settings) }
export async function saveServerSettings(apiUrl: string, changes: ServerSettings) {
  const allowed = new Set(serverSettingFields.map(f => f.key as string))
  if (Object.keys(changes).some(k => !allowed.has(k))) throw new Error('Unapproved server setting.')
  const result = await request(apiUrl, `mutation WebSettingsSave($input: SetSettingsInput!) { setSettings(input: $input) { settings { ${selection} } } }`, { input: { settings: changes } })
  const returned = validateServerSettings((result.setSettings as { settings?: unknown })?.settings)
  if (Object.entries(changes).some(([key, value]) => returned[key] !== value)) throw new Error('The server did not confirm the requested values. Reload before retrying.')
  return returned
}
