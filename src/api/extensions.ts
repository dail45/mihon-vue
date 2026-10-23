import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'

/** Suwayomi REST v1 extension listing (GET /extension/list).
 * Hand-written from the live payload; fields absent from the wire stay optional. */
export interface ExtensionDto {
  repo: string | null
  apkName: string
  iconUrl: string
  name: string
  pkgName: string
  versionName: string
  versionCode: number
  lang: string
  isNsfw: boolean
  installed: boolean
  hasUpdate: boolean
  obsolete: boolean
}

/** Read-only listing of the extension catalogue. The web client never installs or removes extensions. */
export async function fetchExtensionList(apiUrl: string): Promise<ExtensionDto[]> {
  const list = await ofetch<ExtensionDto[]>(`${normalizeApiUrl(apiUrl)}/extension/list`, {
    timeout: 20000,
    retry: 0,
    credentials: 'include',
  })
  return Array.isArray(list) ? list : []
}
