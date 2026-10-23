<script setup lang="ts">
/**
 * Mihon reference (pinned commit 446f6df):
 * mihon/app/src/main/java/eu/kanade/tachiyomi/ui/browse/source/browse/SourceFilterDialog.kt
 *   -> `private fun FilterItem(filter: Filter<*>, onUpdate: () -> Unit)` (lines 79-165)
 *
 * Item geometry comes from
 * mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/SettingsItems.kt
 *   - `SettingsItemsPaddings.Horizontal = 24.dp`, `Vertical = 10.dp` (lines 65-68)
 *   - `HeadingItem` (lines 76-87): Text(typography.header) + padding(24, 10)
 *   - `BaseSettingsItem` (lines 436-458): Row(padding(24, 10), spacedBy(24.dp)) { widget; label }
 *   - `CheckboxItem` (lines 148-160): BaseSettingsItem + MD3 Checkbox widget
 *   - `SortItem` / `BaseSortItem` (lines 104-136): arrow icon (primary) or 24.dp spacer
 *   - `SelectItem` (lines 281-332): OutlinedTextField, padding(24, 10), readOnly, dropdown
 *   - `TextItem` (lines 387-398): OutlinedTextField, padding(24, 4)
 *   - `TriStateItem` (lines 334-385): Row(padding(24, 10), spacedBy(MaterialTheme.padding.large = 24.dp))
 * mihon/presentation-core/.../components/CollapsibleBox.kt (lines 25-59):
 *   header row padding(horizontal = 24.dp, vertical = 12.dp) + typography.header +
 *   keyboard_arrow_down/up, content in AnimatedVisibility (starts collapsed).
 * mihon/presentation-core/.../theme/Typography.kt: `header` = bodyMedium with onSurfaceVariant
 *   colour and SemiBold weight.
 */
import { ref } from 'vue'
import type { SourceFilter } from './sourceFilter'

const props = defineProps<{ filters: SourceFilter[] }>()
const emit = defineEmits<{ (event: 'change'): void }>()

/** CollapsibleBox keeps its expanded state per box and starts collapsed. */
const expanded = ref<Record<number, boolean>>({})
/** Open state of every `Select` dropdown menu. */
const menus = ref<Record<number, boolean>>({})
/**
 * `ExposedDropdownMenu(modifier = Modifier.exposedDropdownSize())`: the dropdown surface is
 * exactly as wide as the exposed text field it belongs to.
 */
const menuWidths = ref<Record<number, number>>({})

function isExpanded(index: number): boolean {
  return expanded.value[index] === true
}

function toggle(index: number) {
  expanded.value = { ...expanded.value, [index]: !expanded.value[index] }
}

function onSelectMenu(index: number, value: boolean) {
  menus.value = { ...menus.value, [index]: value }
}

/** Measures the activator so the dropdown can match the exposed field width. */
function measureActivator(index: number, event: Event) {
  const width = (event.currentTarget as HTMLElement).offsetWidth
  if (width > 0) menuWidths.value = { ...menuWidths.value, [index]: width }
}

/** `Filter.TriState` states: 0 ignore, 1 include, 2 exclude. */
function triStateIcon(state: unknown): string {
  if (state === 1) return 'check_box'
  if (state === 2) return 'disabled_by_default'
  return 'check_box_outline_blank'
}

/** `Filter.TriState.next()`: DISABLED -> ENABLED_IS -> ENABLED_NOT -> DISABLED. */
function nextTriState(state: unknown): number {
  if (state === 1) return 2
  if (state === 2) return 0
  return 1
}

function selectOptions(filter: SourceFilter): string[] {
  const values = filter.values ?? []
  const display = filter.displayValues
  return values.map((value, index) =>
    display && display.length === values.length ? (display[index] ?? String(value)) : String(value),
  )
}

function selectedIndex(filter: SourceFilter): number {
  const idx = typeof filter.state === 'number' ? filter.state : 0
  const max = Math.max(0, (filter.values?.length ?? 1) - 1)
  return Math.max(0, Math.min(max, idx))
}

function selectedText(filter: SourceFilter): string {
  return selectOptions(filter)[selectedIndex(filter)] ?? ''
}

interface SortSelection {
  index: number
  ascending: boolean
}

function sortSelection(filter: SourceFilter): SortSelection | null {
  const state = filter.state
  if (state && typeof state === 'object' && typeof (state as SortSelection).index === 'number') {
    return state as SortSelection
  }
  return null
}

/**
 * `Filter.Sort` selection: picking the active index flips the direction, picking another
 * index keeps the current direction (ascending when nothing was selected yet).
 */
function pickSort(filter: SourceFilter, index: number) {
  const current = sortSelection(filter)
  const ascending = current && current.index === index ? !current.ascending : (current ? current.ascending : true)
  filter.state = { index, ascending } satisfies SortSelection
  emit('change')
}

function toggleCheck(filter: SourceFilter) {
  filter.state = !filter.state
  emit('change')
}

function cycleTriState(filter: SourceFilter) {
  filter.state = nextTriState(filter.state)
  emit('change')
}

function setText(filter: SourceFilter, event: Event) {
  filter.state = (event.target as HTMLInputElement).value
  emit('change')
}

function selectAt(filter: SourceFilter, optionIndex: number, menuIndex?: number) {
  filter.state = optionIndex
  if (menuIndex !== undefined) {
    menus.value = { ...menus.value, [menuIndex]: false }
  }
  emit('change')
}

function onFieldClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement | null
  const input = target?.querySelector('input')
  if (input && document.activeElement !== input) {
    input.focus()
  }
}
</script>

<template>
  <div class="source-filter-items">
    <template v-for="(filter, index) in props.filters" :key="index">
      <!-- Filter.Header -> HeadingItem(name) -->
      <div v-if="filter.type === 'Header'" class="source-filter-heading">{{ filter.name }}</div>

      <!-- Filter.Separator -> HorizontalDivider() -->
      <hr v-else-if="filter.type === 'Separator'" class="source-filter-divider" />

      <!-- Filter.CheckBox -> CheckboxItem(label, checked) -->
      <button
        v-else-if="filter.type === 'CheckBox'"
        type="button"
        class="source-filter-row source-filter-row--checkbox"
        :aria-pressed="filter.state ? 'true' : 'false'"
        @click="toggleCheck(filter)"
      >
        <span class="source-filter-check" :class="{ 'is-checked': filter.state }">
          <span class="source-filter-check-box">
            <svg v-if="filter.state" class="source-filter-check-mark" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4.5 9.5 L7.5 12.5 L13.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </span>
        <span class="source-filter-label">{{ filter.name }}</span>
      </button>

      <!-- Filter.TriState -> TriStateItem(label, state.toTriStateFilter()) -->
      <button
        v-else-if="filter.type === 'TriState'"
        type="button"
        class="source-filter-row"
        :aria-pressed="filter.state === 1 ? 'true' : 'false'"
        :aria-description="filter.state === 2 ? 'Exclude matching items' : filter.state === 1 ? 'Include matching items' : 'No filter'"
        @click="cycleTriState(filter)"
      >
        <span class="source-filter-icon" :class="filter.state ? 'is-active' : 'is-inactive'">
          <span class="material-symbols-rounded" :class="filter.state ? 'filled-symbol' : ''">{{ triStateIcon(filter.state) }}</span>
        </span>
        <span class="source-filter-label">{{ filter.name }}</span>
      </button>

      <!-- Filter.Text -> TextItem(label, value): OutlinedTextField, padding(24, 4) -->
      <div v-else-if="filter.type === 'Text'" class="source-filter-text">
        <div class="source-filter-field" @click="onFieldClick">
          <input
            class="source-filter-field-input"
            type="text"
            :value="typeof filter.state === 'string' ? filter.state : ''"
            :aria-label="filter.name"
            @input="setText(filter, $event)"
          >
          <span
            class="source-filter-field-label"
            :class="{ 'is-floating': typeof filter.state === 'string' && filter.state !== '' }"
          >{{ filter.name }}</span>
        </div>
      </div>

      <!-- Filter.Select -> SelectItem(label, options, selectedIndex): OutlinedTextField, padding(24, 10) -->
      <div v-else-if="filter.type === 'Select'" class="source-filter-select">
        <v-menu
          :model-value="menus[index] === true"
          location="bottom start"
          content-class="source-filter-menu"
          @update:model-value="onSelectMenu(index, $event)"
        >
          <template #activator="{ props: menuProps }">
            <div
              v-bind="menuProps"
              class="source-filter-field source-filter-field--select"
              :class="{ 'is-menu-open': menus[index] === true }"
              role="combobox"
              tabindex="0"
              :aria-expanded="menus[index] === true"
              :aria-label="filter.name"
              @click="measureActivator(index, $event)"
              @keydown.enter.space.prevent="onSelectMenu(index, !menus[index])"
            >
              <span class="source-filter-field-value">{{ selectedText(filter) }}</span>
              <span
                class="source-filter-field-label"
                :class="{ 'is-floating': selectedText(filter) !== '' || menus[index] === true }"
              >{{ filter.name }}</span>
              <span class="material-symbols-rounded source-filter-field-trailing">{{ menus[index] === true ? 'arrow_drop_up' : 'arrow_drop_down' }}</span>
            </div>
          </template>
          <v-list
            class="source-filter-menu-list"
            density="default"
            :style="menuWidths[index] ? { width: `${menuWidths[index]}px` } : undefined"
          >
            <v-list-item
              v-for="(option, optionIndex) in selectOptions(filter)"
              :key="optionIndex"
              :title="option"
              @click="selectAt(filter, optionIndex, index)"
            />
          </v-list>
        </v-menu>
      </div>

      <!-- Filter.Sort -> CollapsibleBox(heading) { SortItem(...) } -->
      <div v-else-if="filter.type === 'Sort'" class="source-filter-collapsible">
        <button type="button" class="source-filter-collapsible-header" :aria-expanded="isExpanded(index)" @click="toggle(index)">
          <span class="source-filter-heading-text">{{ filter.name }}</span>
          <span class="source-filter-spacer" />
          <span class="material-symbols-rounded source-filter-collapsible-icon">{{ isExpanded(index) ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}</span>
        </button>
        <div class="source-filter-collapse" :class="{ 'is-open': isExpanded(index) }">
          <div class="source-filter-collapse-inner">
            <button
              v-for="(option, optionIndex) in (filter.values ?? [])"
              :key="optionIndex"
              type="button"
              class="source-filter-row"
              :aria-pressed="sortSelection(filter)?.index === optionIndex ? 'true' : 'false'"
              @click="pickSort(filter, optionIndex)"
            >
              <span class="source-filter-icon is-active">
                <span
                  v-if="sortSelection(filter)?.index === optionIndex"
                  class="material-symbols-rounded"
                >{{ sortSelection(filter)?.ascending ? 'arrow_upward' : 'arrow_downward' }}</span>
              </span>
              <span class="source-filter-label">{{ option }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Filter.Group -> CollapsibleBox(heading) { FilterItem(child) } -->
      <div v-else-if="filter.type === 'Group'" class="source-filter-collapsible">
        <button type="button" class="source-filter-collapsible-header" :aria-expanded="isExpanded(index)" @click="toggle(index)">
          <span class="source-filter-heading-text">{{ filter.name }}</span>
          <span class="source-filter-spacer" />
          <span class="material-symbols-rounded source-filter-collapsible-icon">{{ isExpanded(index) ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}</span>
        </button>
        <div class="source-filter-collapse" :class="{ 'is-open': isExpanded(index) }">
          <div class="source-filter-collapse-inner">
            <SourceFilterItems :filters="filter.children ?? []" @change="emit('change')" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
/* ExposedDropdownMenu: a Material3 menu surface (shape = cornerExtraSmall = 4.dp,
   container color = surfaceContainer, elevation = level 2). The menu is teleported to the
   body, so the rules cannot live in the scoped block. */
.source-filter-menu .v-list {
  background: rgb(var(--v-theme-surface-container));
  border-radius: 4px;
}
/* DropdownMenuItem with ExposedDropdownMenuDefaults.ItemContentPadding (start = 16.dp). */
.source-filter-menu-list .v-list-item {
  min-height: 48px;
  padding-inline-start: 16px;
  padding-inline-end: 16px;
}
.source-filter-menu-list .v-list-item-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  color: rgb(var(--v-theme-on-surface));
}
</style>

<style scoped>
@layer app-components {
/* SettingsItemsPaddings.Horizontal = 24.dp, Vertical = 10.dp; BaseSettingsItem spacing = 24.dp. */
.source-filter-row {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  min-height: 44px;
  padding: 10px 24px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  text-align: start;
  cursor: pointer;
  transition: background-color 150ms ease-in-out;
}
.source-filter-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 6%, transparent); }
.source-filter-row:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.source-filter-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.source-filter-label { flex: 1 1 auto; min-width: 0; }

/* MD3 Checkbox: the Compose widget applies `minimumInteractiveComponentSize()` (48.dp)
   and draws the 18.dp box centred inside the 20.dp stateful slot. The box has a 2.dp
   corner radius and a 2.dp outline (1.dp when checked); the checked state fills it with
   the primary colour and draws the check in onPrimary. */
.source-filter-check {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.source-filter-check-box {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 2px;
  color: rgb(var(--v-theme-on-primary));
  background: transparent;
  box-sizing: border-box;
}
.source-filter-check.is-checked .source-filter-check-box {
  border-width: 0;
  background: rgb(var(--v-theme-primary));
}
.source-filter-check-mark { width: 18px; height: 18px; display: block; }

/* TriStateItem icon: 24.dp, onSurfaceVariant when disabled, primary when include/exclude. */
.source-filter-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.source-filter-icon.is-inactive { color: rgb(var(--v-theme-on-surface-variant)); }
.source-filter-icon.is-active { color: rgb(var(--v-theme-primary)); }

/* Typography.header = bodyMedium.copy(color = onSurfaceVariant, fontWeight = SemiBold).
   bodyMedium letter-spacing = 0.0178571429em. */
.source-filter-heading {
  padding: 10px 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.source-filter-heading-text {
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* HorizontalDivider: 1.dp outlineVariant line. */
.source-filter-divider {
  margin: 0;
  border: 0;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}

/* CollapsibleBox header row: padding(horizontal = 24.dp, vertical = 12.dp). */
.source-filter-collapsible-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 24px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color 150ms ease-in-out;
}
.source-filter-collapsible-header:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 6%, transparent); }
.source-filter-collapsible-header:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.source-filter-collapsible-header:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.source-filter-spacer { flex: 1 1 auto; }
.source-filter-collapsible-icon { font-size: 24px; color: rgb(var(--v-theme-on-surface)); }

/* AnimatedVisibility(expanded) equivalent: a collapsing grid track. */
.source-filter-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 200ms cubic-bezier(0.2, 0, 0, 1);
}
.source-filter-collapse.is-open { grid-template-rows: 1fr; }
.source-filter-collapse-inner { overflow: hidden; }

/* TextItem: padding(horizontal = 24.dp, vertical = 4.dp) around the OutlinedTextField. */
.source-filter-text { padding: 4px 24px; }

/* SelectItem: padding(horizontal = 24.dp, vertical = 10.dp) around the OutlinedTextField. */
.source-filter-select { padding: 10px 24px; }

/* MD3 OutlinedTextField: 56.dp tall, 1.dp outline (2.dp when focused), shape = small (4.dp),
   label 16.sp at rest and 12.sp when floating above the outline, content padding 16.dp.
   In Compose M3, container color is transparent. */
.source-filter-field {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 56px;
  padding: 0 12px 0 16px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 4px;
  background: transparent;
  box-sizing: border-box;
}
.source-filter-field.is-menu-open,
.source-filter-field:focus-within {
  border-width: 2px;
  border-color: rgb(var(--v-theme-primary));
  padding: 0 11px 0 15px;
}
.source-filter-field--select {
  cursor: pointer;
  user-select: none;
}
.source-filter-field--select:focus-visible {
  outline: none;
  border-width: 2px;
  border-color: rgb(var(--v-theme-primary));
  padding: 0 11px 0 15px;
}
.source-filter-field-input {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  outline: none;
}
.source-filter-field-value {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface));
}
.source-filter-field-label {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  padding: 0 4px;
  background: transparent;
  font-size: 16px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface-variant));
  pointer-events: none;
  transition: top 150ms cubic-bezier(0.2, 0, 0, 1), font-size 150ms cubic-bezier(0.2, 0, 0, 1), color 150ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms cubic-bezier(0.2, 0, 0, 1);
}
/* MD3 OutlinedTextField: the label floats (12.sp) as soon as the field is focused or
   holds a value; the floating colour is primary while focused, onSurfaceVariant otherwise. */
.source-filter-field-label.is-floating {
  top: 0;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 16px;
  background: rgb(var(--v-theme-surface-container-high));
}
.source-filter-field:focus-within .source-filter-field-label,
.source-filter-field.is-menu-open .source-filter-field-label {
  top: 0;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-surface-container-high));
}
.source-filter-field-trailing {
  flex-shrink: 0;
  font-size: 24px;
  color: rgb(var(--v-theme-on-surface-variant));
}
}
</style>
