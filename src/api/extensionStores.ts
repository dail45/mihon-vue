import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'

/**
 * Extension store listing.
 *
 * Mihon keeps its extension stores in a local database (`mihon.domain.extension.model.ExtensionStore`:
 * indexUrl, name, badgeLabel, signingKey, contact{website, discord}, isLegacy, extensionListUrl).
 * Suwayomi-Server has no extension-repository management API: it only reports the repository a
 * catalogue entry came from through `GET /extension/list` (`repo`).
 *
 * The web client therefore derives the store list from the extension catalogue, which is the only
 * observable equivalent. Adding, editing and removing a store stay unavailable (the Suwayomi REST
 * API exposes no endpoint for them), so those actions are honest stubs in the UI.
 */
export interface ExtensionStoreDto {
  /** The store index URL, as reported by the catalogue. */
  indexUrl: string
  /** The store name, derived from the index URL (Mihon reads it from the index file). */
  name: string
  /** The store website, derived from the index URL (Mihon reads it from the index file). */
  website: string
  /** Mihon hides the Discord action when `contact.discord` is null; Suwayomi reports no contact. */
  discord: string | null
}

/** A catalogue entry with a repository, reduced to the fields the store row needs. */
interface ExtensionListEntry {
  repo: string | null
  name: string
}

/** Derives the human readable store name from an index URL ("Keiyoushi" for keiyoushi/...). */
function storeNameFromUrl(indexUrl: string): string {
  try {
    const url = new URL(indexUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    if (url.hostname === 'github.com' && segments.length) {
      const owner = segments[0]!
      return owner.charAt(0).toUpperCase() + owner.slice(1)
    }
    return url.hostname
  } catch {
    return indexUrl
  }
}

/** Derives the store website from an index URL (the repository page, not the raw index file). */
function storeWebsiteFromUrl(indexUrl: string): string {
  try {
    const url = new URL(indexUrl)
    if (url.hostname === 'github.com') {
      const segments = url.pathname.split('/').filter(Boolean)
      if (segments.length >= 2) return `https://github.com/${segments[0]}/${segments[1]}`
    }
    return `${url.origin}${url.pathname}`
  } catch {
    return indexUrl
  }
}

/** Reads the extension catalogue and reduces it to the distinct extension stores it references. */
export async function fetchExtensionStores(apiUrl: string): Promise<ExtensionStoreDto[]> {
  const list = await ofetch<ExtensionListEntry[]>(`${normalizeApiUrl(apiUrl)}/extension/list`, {
    timeout: 20000,
    retry: 0,
    credentials: 'include',
  })
  if (!Array.isArray(list)) return []
  const stores = new Map<string, ExtensionStoreDto>()
  for (const entry of list) {
    const indexUrl = entry?.repo
    if (!indexUrl || stores.has(indexUrl)) continue
    stores.set(indexUrl, {
      indexUrl,
      name: storeNameFromUrl(indexUrl),
      website: storeWebsiteFromUrl(indexUrl),
      discord: null,
    })
  }
  return [...stores.values()]
}
