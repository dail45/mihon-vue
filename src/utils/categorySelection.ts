import type { Category } from '../api/types'

/** Mihon: tachiyomi.core.common.preference.CheckboxState.State (two-state). */
export type CategoryStateSelection = { kind: 'state'; category: Category; checked: boolean }
/** Mihon: tachiyomi.core.common.preference.CheckboxState.TriState (three-state). */
export type CategoryTriSelection = { kind: 'tri'; category: Category; state: 'include' | 'exclude' | 'none' }
export type CategorySelection = CategoryStateSelection | CategoryTriSelection

export const stateSelection = (category: Category, checked: boolean): CategoryStateSelection => ({ kind: 'state', category, checked })
export const triSelection = (category: Category, state: 'include' | 'exclude' | 'none'): CategoryTriSelection => ({ kind: 'tri', category, state })

/** Mihon: CheckboxState.next() — State: Checked <-> None; TriState: Include -> Exclude -> None -> Include. */
export function nextCategorySelection(selection: CategorySelection): CategorySelection {
  if (selection.kind === 'state') return { kind: 'state', category: selection.category, checked: !selection.checked }
  const state = selection.state === 'include' ? 'exclude' : selection.state === 'exclude' ? 'none' : 'include'
  return { kind: 'tri', category: selection.category, state }
}

/** Mihon: eu.kanade.presentation.category.visualName — the system category is labelled "Default". */
export function categoryVisualName(category: Category): string {
  const isSystem = category.id === 0 || category.isDefaultCategory === true || category.default === true || category.name === 'Default'
  return isSystem ? 'Default' : category.name
}

/** Mihon: CheckboxState.TriState.asToggleableState() — Exclude -> Indeterminate, Include -> On, None -> Off. */
export type Toggleable = 'on' | 'indeterminate' | 'off'
export function selectionToggleable(selection: CategorySelection): Toggleable {
  if (selection.kind === 'state') return selection.checked ? 'on' : 'off'
  return selection.state === 'include' ? 'on' : selection.state === 'exclude' ? 'indeterminate' : 'off'
}

/** Mihon: ChangeCategoryDialog confirm — include = checked/include, exclude = unchecked/none. */
export function selectionCategories(selection: CategorySelection[]) {
  const include = selection.filter(s => (s.kind === 'state' && s.checked) || (s.kind === 'tri' && s.state === 'include')).map(s => s.category.id)
  const exclude = selection.filter(s => (s.kind === 'state' && !s.checked) || (s.kind === 'tri' && s.state === 'none')).map(s => s.category.id)
  return { include, exclude }
}
