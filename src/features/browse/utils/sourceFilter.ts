/**
 * Mihon reference (pinned commit 446f6df):
 * mihon/app/src/main/java/eu/kanade/tachiyomi/ui/browse/source/browse/SourceFilterDialog.kt
 *   -> `fun SourceFilterDialog(onDismissRequest, filters, onReset, onFilter, onUpdate)` (lines 33-77)
 *   -> `private fun FilterItem(filter: Filter<*>, onClick)` (lines 79-165)
 *
 * The filter list itself is a `FilterList` (`List<Filter<*>>`) defined in
 * mihon/source-api/src/main/java/eu/kanade/tachiyomi/source/model/Filter.kt:
 *   Filter.Header | Filter.Separator | Filter.Select<V> | Filter.Text |
 *   Filter.CheckBox | Filter.TriState | Filter.Group<V> | Filter.Sort
 *
 * Suwayomi-Server exposes the same filter kinds through
 * GET /api/v1/source/{sourceId}/filters, which returns
 * `Array<Search.FilterObject>` = `[{ "type": "Select", "filter": { ... } }]`
 * (pinned Suwayomi-Server commit e2ce828). The shapes below mirror both
 * models so the dialog can stay a pure view over the server payload.
 */

export type SourceFilterType =
  | 'Header'
  | 'Separator'
  | 'Select'
  | 'Text'
  | 'CheckBox'
  | 'TriState'
  | 'Group'
  | 'Sort'

/** A single filter entry, flattened out of the Suwayomi `FilterObject` wrapper. */
export interface SourceFilter {
  type: SourceFilterType
  /** Filter name: the label shown by every item kind. */
  name: string
  /** `Select` and `Sort` option values. */
  values?: (string | number)[]
  /** Optional `Select` display labels (Suwayomi `displayValues`). */
  displayValues?: string[]
  /**
   * Current state:
   * - `CheckBox`: boolean
   * - `Text`: string
   * - `Select`: selected index (number)
   * - `TriState`: 0 = ignore, 1 = include, 2 = exclude
   * - `Sort`: `{ index, ascending }` or `null`
   */
  state?: unknown
  /** `Group` children (Suwayomi serializes a group state as a list of filter objects). */
  children?: SourceFilter[]
}

/** The raw Suwayomi `Search.FilterObject` entry. */
export interface RawSourceFilterObject {
  type: string
  filter: {
    name?: string
    values?: (string | number)[]
    displayValues?: string[]
    state?: unknown
  }
}

/** Converts the Suwayomi `FilterObject` list into the flat filter model used by the dialog. */
export function toSourceFilters(raw: RawSourceFilterObject[] | null | undefined): SourceFilter[] {
  if (!raw) return []
  return raw.map(entry => {
    const filter = entry.filter ?? {}
    const item: SourceFilter = { type: entry.type as SourceFilterType, name: filter.name ?? '' }
    if (filter.values) item.values = filter.values
    if (filter.displayValues) item.displayValues = filter.displayValues
    if (entry.type === 'Group') {
      const children = Array.isArray(filter.state) ? (filter.state as RawSourceFilterObject[]) : []
      item.children = toSourceFilters(children)
    } else if (filter.state !== undefined) {
      item.state = filter.state
    }
    return item
  })
}

/** Converts the flat filter model back into Suwayomi `FilterObject` list for API search. */
export function toRawSourceFilters(filters: SourceFilter[]): RawSourceFilterObject[] {
  return filters.map(item => {
    if (item.type === 'Group') {
      return {
        type: item.type,
        filter: {
          name: item.name,
          state: item.children ? toRawSourceFilters(item.children) : [],
        },
      }
    }
    const filterObj: RawSourceFilterObject['filter'] = {
      name: item.name,
      state: item.state,
    }
    if (item.values) filterObj.values = item.values
    if (item.displayValues) filterObj.displayValues = item.displayValues
    return {
      type: item.type,
      filter: filterObj,
    }
  })
}

/** Deep copy of a filter list; safely handles Vue reactive proxies without throwing DataCloneError. */
export function cloneSourceFilters(filters: SourceFilter[]): SourceFilter[] {
  if (!filters || !Array.isArray(filters)) return []
  return filters.map(item => {
    const copy: SourceFilter = {
      type: item.type,
      name: item.name,
    }
    if (item.values) copy.values = [...item.values]
    if (item.displayValues) copy.displayValues = [...item.displayValues]
    if (item.children) copy.children = cloneSourceFilters(item.children)
    if (item.state !== undefined) {
      if (Array.isArray(item.state)) {
        copy.state = [...item.state]
      } else if (item.state !== null && typeof item.state === 'object') {
        copy.state = { ...(item.state as Record<string, unknown>) }
      } else {
        copy.state = item.state
      }
    }
    return copy
  })
}
