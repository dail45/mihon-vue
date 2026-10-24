/** Suwayomi tracker OAuth login (headless GraphQL client only).
 *
 * Mihon's `TrackLoginActivity` receives the OAuth callback deep link and hands
 * the credential to the tracker (`anilist-auth`, `myanimelist-auth`, ...).
 * Suwayomi-Server performs the same exchange on the server side
 * (`Tracker.authCallback` → `Tracker.extractToken`), so the client only has to
 * pass the callback URL back to the server.
 *
 * No access tokens are stored in this file, in the docs or in the configuration.
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'
import type { GraphQLResponse } from './types'

/** Deep-link hosts of Mihon's TrackLoginActivity intent filters. */
export const TRACKER_AUTH_HOSTS = [
  'anilist-auth',
  'myanimelist-auth',
  'shikimori-auth',
  'bangumi-auth',
  'comick-auth',
  'mangabaka-auth',
  'hikka-auth',
] as const

export type TrackerAuthHost = (typeof TRACKER_AUTH_HOSTS)[number]

/** Suwayomi tracker ids (`TrackerManager`). Mihon-only trackers have no id. */
export const SUWAYOMI_TRACKER_IDS: Record<string, number> = {
  'anilist-auth': 2,
  'myanimelist-auth': 1,
  'shikimori-auth': 4,
  'bangumi-auth': 5,
}

/** Query/fragment parameter that carries the credential, per tracker host. */
const CREDENTIAL_KEYS: Record<string, string> = {
  'anilist-auth': 'access_token',
  'myanimelist-auth': 'code',
  'shikimori-auth': 'code',
  'bangumi-auth': 'code',
  'comick-auth': 'code',
  'mangabaka-auth': 'code',
  'hikka-auth': 'reference',
}

export interface TrackerCallback {
  host: string
  /** Decoded credential (`code`, `access_token`, `reference`) or null. */
  credential: string | null
  /** Decoded `state` parameter or null. */
  state: string | null
  /** The raw query or fragment the credential was taken from. */
  raw: string
}

/**
 * Mihon `TrackLoginActivity.handleResult`: the credential is taken from the
 * query, or from the fragment when the query is empty; both are split on "&"
 * and "=" and URI-decoded.
 */
export function parseTrackerCallback(url: URL | { host: string; search: string; hash: string }): TrackerCallback | null {
  const search = url.search.replace(/^\?/, '')
  const hash = url.hash.replace(/^#/, '')
  const raw = search.trim() ? search : hash
  const host = url.host
  if (!host) return null
  const values = new Map<string, string>()
  const read = (source: string) => {
    for (const part of source.split('&')) {
      if (!part) continue
      const index = part.indexOf('=')
      const key = index === -1 ? part : part.slice(0, index)
      const value = index === -1 ? '' : part.slice(index + 1)
      values.set(decodeURIComponent(key.replace(/\+/g, ' ')), decodeURIComponent(value.replace(/\+/g, ' ')))
    }
  }
  read(search)
  // AniList returns its token in the fragment; the query of the callback link
  // carries the tracker host only, so the fragment is read as well.
  if (hash) read(hash)
  const key = CREDENTIAL_KEYS[host] ?? 'code'
  return {
    host,
    credential: values.get(key) ?? null,
    state: values.get('state') ?? null,
    raw: raw || hash,
  }
}

/**
 * The callback URL handed to Suwayomi; it parses the credential on its side
 * (`Tracker.extractToken` splits the string on "&" and does not decode it).
 * The raw credential is therefore passed through unchanged, except for "&"
 * which would start a new parameter.
 */
export function trackerCallbackUrl(host: string, credential: string): string {
  const key = CREDENTIAL_KEYS[host] ?? 'code'
  return `${key}=${credential.replace(/&/g, '')}`
}

async function request<T>(apiUrl: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await ofetch<GraphQLResponse<T>>(serverGraphqlUrl(apiUrl), {
    method: 'POST',
    body: { query, variables },
    credentials: 'include',
    timeout: 20000,
    retry: 0,
  })
  if (response.errors?.length) throw new Error(response.errors.map(e => e.message).join(' '))
  if (!response.data) throw new Error('The server returned no data for the tracker login.')
  return response.data
}

/** Suwayomi `TrackMutation.loginTrackerOAuth`. */
export async function loginTrackerOAuth(apiUrl: string, trackerId: number, callbackUrl: string): Promise<boolean> {
  const data = await request<{ loginTrackerOAuth: { isLoggedIn: boolean } }>(
    apiUrl,
    `mutation LoginTrackerOAuth($input: LoginTrackerOAuthInput!) {
      loginTrackerOAuth(input: $input) { isLoggedIn tracker { id isLoggedIn } }
    }`,
    { input: { trackerId, callbackUrl } },
  )
  return Boolean(data.loginTrackerOAuth?.isLoggedIn)
}

/** Suwayomi `TrackMutation.logoutTracker` – Mihon logs the tracker out when the credential is missing. */
export async function logoutTracker(apiUrl: string, trackerId: number): Promise<void> {
  await request(
    apiUrl,
    `mutation LogoutTracker($input: LogoutTrackerInput!) { logoutTracker(input: $input) { clientMutationId } }`,
    { input: { trackerId } },
  )
}
