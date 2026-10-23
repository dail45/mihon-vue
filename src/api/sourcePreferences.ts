import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'
import type { Source } from './types'

/** Suwayomi REST v1 source preferences (GET/POST /source/{sourceId}/preferences).
 *
 * The payload mirrors the `Source.PreferenceObject` shape of Suwayomi-Server
 * (commit e2ce828): `{ type, props }` where `type` is the AndroidX preference
 * class simple name ("" for anonymous header preferences) and `props` carries
 * the serialized preference fields. */

export interface SourcePreferenceProps {
  key: string
  title: string | null
  summary: string | null
  currentValue: unknown
  defaultValue: unknown
  defaultValueType: string
  enabled: boolean
  visible: boolean
  entries?: string[]
  entryValues?: string[]
  dialogTitle?: string | null
  dialogMessage?: string | null
  text?: string | null
  [extra: string]: unknown
}

export interface SourcePreference {
  type: string
  props: SourcePreferenceProps
}

/** Read-only listing of one source's preference screen. */
export async function fetchSourcePreferences(apiUrl: string, sourceId: string): Promise<SourcePreference[]> {
  const list = await ofetch<SourcePreference[]>(`${normalizeApiUrl(apiUrl)}/source/${encodeURIComponent(sourceId)}/preferences`, {
    timeout: 20000,
    retry: 0,
    credentials: 'include',
  })
  return Array.isArray(list) ? list : []
}

/** Persist one preference of a source. `position` is the index of the preference
 * inside the source preference screen (the order returned by the GET above). */
export async function saveSourcePreference(apiUrl: string, sourceId: string, position: number, value: string): Promise<void> {
  await ofetch<void>(`${normalizeApiUrl(apiUrl)}/source/${encodeURIComponent(sourceId)}/preferences`, {
    method: 'POST',
    body: { position, value },
    timeout: 20000,
    retry: 0,
    credentials: 'include',
  })
}

/** Single source metadata (used for the screen title, mirroring Mihon's `source.toString()`). */
export async function fetchSource(apiUrl: string, sourceId: string): Promise<Source | null> {
  try {
    const source = await ofetch<Source>(`${normalizeApiUrl(apiUrl)}/source/${encodeURIComponent(sourceId)}`, {
      timeout: 20000,
      retry: 0,
      credentials: 'include',
    })
    return source ?? null
  } catch {
    return null
  }
}
