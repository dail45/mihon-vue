<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { stringResource, MR } from '@/core/i18n'
import type { GlobalSearchPinnedState } from '../stores/browsePreferences'

/**
 * Port of Mihon's GlobalSearchToolbar.kt
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/components/GlobalSearchToolbar.kt)
 * and Komikku 3-way cycle filter (PinnedOnly -> Unpinned -> All -> PinnedOnly).
 *
 * Layout, top to bottom:
 *   1. Column background = colorScheme.surface
 *   2. Box: SearchToolbar (TopAppBar) + LinearProgressIndicator aligned BottomStart
 *   3. Horizontally scrollable Row of FilterChips (3-way cycle filter | Has results)
 *   4. HorizontalDivider
 *
 * The bar itself is `eu.kanade.presentation.components.SearchToolbar` (AppBar.kt), which is a
 * `TopAppBar` with:
 *   - a navigation IconButton (UpIcon = AutoMirroredRounded.ArrowBack) that is 48dp wide and
 *     flush with the leading edge,
 *   - a title slot with a 4dp start inset (`TopAppBarTitleInsetWithStart`) and a 4dp end inset,
 *     holding a `BasicTextField` (single line, 18sp / Normal, colour onBackground),
 *   - an actions slot with the search IconButton (closed state) or the reset IconButton
 *     (open state with a non empty query).
 */
const props = withDefaults(
  defineProps<{
    /** null = plain toolbar (title mode), otherwise the search field is shown. */
    searchQuery: string | null
    /** Number of finished sources. */
    progress: number
    /** Number of searched sources. */
    total: number
    sourceFilter: GlobalSearchPinnedState
    onlyShowHasResults: boolean
    hideSourceFilter?: boolean
  }>(),
  { hideSourceFilter: false },
)

const emit = defineEmits<{
  (event: 'navigate-up'): void
  (event: 'update:searchQuery', value: string | null): void
  (event: 'search', value: string): void
  (event: 'change-source-filter', value: GlobalSearchPinnedState): void
  (event: 'toggle-results'): void
  (event: 'toggle-bulk-select'): void
}>()

const draft = ref(props.searchQuery ?? '')
const input = ref<HTMLInputElement | null>(null)

const searchOpen = computed(() => props.searchQuery !== null)

const filterConfig = computed(() => {
  switch (props.sourceFilter) {
    case 'PinnedOnly':
      return {
        label: stringResource(MR.strings.pinned_sources) || 'Pinned',
        symbol: 'keep',
        mdiClass: 'mdi-pin',
        selected: true,
      }
    case 'Unpinned':
      return {
        label: stringResource('unpinned_sources') || 'Unpinned',
        symbol: 'keep_off',
        mdiClass: 'mdi-pin-off-outline',
        selected: true,
      }
    case 'All':
    default:
      return {
        label: stringResource(MR.strings.all) || 'All',
        symbol: 'done_all',
        mdiClass: 'mdi-check-all',
        selected: false,
      }
  }
})

function cycleSourceFilter() {
  const nextMap: Record<GlobalSearchPinnedState, GlobalSearchPinnedState> = {
    PinnedOnly: 'Unpinned',
    Unpinned: 'All',
    All: 'PinnedOnly',
  }
  const next = nextMap[props.sourceFilter] || 'PinnedOnly'
  emit('change-source-filter', next)
}
// Kotlin: `if (progress in 1..<total)`
const progressRatio = computed(() => {
  const { progress, total } = props
  if (progress < 1 || progress >= total || total <= 0) return null
  return progress / total
})

watch(
  () => props.searchQuery,
  value => {
    draft.value = value ?? ''
  },
)

watch(searchOpen, open => {
  if (open) nextTick(() => input.value?.focus())
})

onMounted(() => {
  // Mihon requests the soft keyboard while the query is empty.
  if (props.searchQuery === '') nextTick(() => input.value?.focus())
})

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  draft.value = value
  emit('update:searchQuery', value)
}

function submit() {
  // Mihon: `if (query.isBlank()) return` then `onSearch(query)` with the raw text.
  if (!draft.value.trim()) return
  emit('search', draft.value)
  input.value?.blur()
}

function clear() {
  // Mihon: `searchFieldState.clearText(); onClick(); focusRequester.requestFocus()`.
  draft.value = ''
  emit('update:searchQuery', '')
  nextTick(() => input.value?.focus())
}

function openSearch() {
  emit('update:searchQuery', '')
  nextTick(() => input.value?.focus())
}
</script>

<template>
  <div class="global-search-toolbar">
    <div class="gst-bar">
      <!-- IconButton(onClick = navigateUp) { UpIcon(AutoMirroredRounded.ArrowBack) } -->
      <button
        type="button"
        class="gst-icon-btn gst-icon-btn--nav"
        aria-label="Navigate up"
        @click="emit('navigate-up')"
      >
        <span class="material-symbols-rounded gst-icon" aria-hidden="true">arrow_back</span>
      </button>

      <!-- BasicTextField in the title slot: fillMaxWidth, single line, ImeAction.Search. -->
      <form v-if="searchOpen" class="gst-search" role="search" @submit.prevent="submit">
        <input
          ref="input"
          :value="draft"
          type="search"
          class="gst-input"
          placeholder="Search…"
          aria-label="Search"
          autocomplete="off"
          enterkeyhint="search"
          @input="onInput"
          @keydown.enter.prevent="submit"
          @keydown.esc="input?.blur()"
        />
      </form>
      <div v-else class="gst-title" />

      <!-- actions slot: the search action while closed, the reset action while open. -->
      <button
        v-if="!searchOpen"
        type="button"
        class="gst-icon-btn gst-icon-btn--action"
        aria-label="Search"
        title="Search"
        @click="openSearch"
      >
        <span class="material-symbols-rounded gst-icon" aria-hidden="true">search</span>
      </button>
      <button
        v-else-if="draft"
        type="button"
        class="gst-icon-btn gst-icon-btn--action"
        aria-label="Reset"
        title="Reset"
        @click="clear"
      >
        <span class="material-symbols-rounded gst-icon" aria-hidden="true">close</span>
      </button>

      <!-- Bulk select action -->
      <button
        type="button"
        class="gst-icon-btn gst-icon-btn--action"
        :aria-label="stringResource('action_bulk_select') || 'Bulk favorite'"
        :title="stringResource('action_bulk_select') || 'Bulk favorite'"
        @click="emit('toggle-bulk-select')"
      >
        <span class="material-symbols-rounded gst-icon" aria-hidden="true">checklist</span>
      </button>

      <!-- LinearProgressIndicator(progress = { progress / total }) aligned to the bottom start. -->
      <div
        v-if="progressRatio !== null"
        class="gst-progress"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        :aria-valuemax="total"
      >
        <div
          class="gst-progress-bar"
          :style="{ width: `calc((100% - 8px) * ${progressRatio})` }"
        />
        <div class="gst-progress-stop" />
      </div>
    </div>

    <!-- Row(horizontalScroll, padding(horizontal = padding.small = 8dp), spacedBy(8dp)). -->
    <div class="gst-filters" role="group" aria-label="Search filters">
      <template v-if="!hideSourceFilter">
        <!-- 3-state cycling filter chip: PinnedOnly -> Unpinned -> All -> PinnedOnly -->
        <button
          type="button"
          class="gst-chip"
          :class="[{ 'gst-chip--selected': filterConfig.selected }, filterConfig.mdiClass]"
          :aria-pressed="filterConfig.selected"
          :aria-label="filterConfig.label"
          @click="cycleSourceFilter"
        >
          <span
            class="material-symbols-rounded gst-chip-icon"
            :class="filterConfig.mdiClass"
            aria-hidden="true"
          >{{ filterConfig.symbol }}</span>
          <span class="gst-chip-label">{{ filterConfig.label }}</span>
        </button>

        <!-- VerticalDivider(Modifier.height(FilterChipDefaults.Height)) -->
        <span class="gst-divider" role="separator" aria-orientation="vertical" />
      </template>

      <!-- FilterChip(selected = onlyShowHasResults) { Icon(FilterList) } -->
      <button
        type="button"
        class="gst-chip"
        :class="{ 'gst-chip--selected': onlyShowHasResults }"
        :aria-pressed="onlyShowHasResults"
        @click="emit('toggle-results')"
      >
        <span class="material-symbols-rounded gst-chip-icon" aria-hidden="true">filter_list</span>
        <span class="gst-chip-label">Has results</span>
      </button>
    </div>

    <!-- HorizontalDivider() -->
    <div class="gst-hr" role="separator" />
  </div>
</template>

<style scoped>
/* MaterialTheme.colorScheme.surface */
.global-search-toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  background: rgb(var(--v-theme-surface));
}

/* TopAppBar: default height 64dp, container = surfaceColorAtElevation(0) = surface. The bar
   row carries `TopAppBarHorizontalPadding` = 4dp on both sides. */
.gst-bar {
  position: relative;
  display: flex;
  align-items: center;
  height: 64px;
  padding-inline: 4px;
}

/* IconButton: 48dp touch target, 24dp icon, onSurface tint. The navigation and the action
   icon sit flush with the leading / trailing edge of the bar. */
.gst-icon-btn {
  flex: none;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}

.gst-icon-btn:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.gst-icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

/* TopAppBar: the navigation IconButton is the first item of the 4dp padded bar row. */
.gst-icon-btn--nav {
  margin-inline: 0;
}

/* The title slot of the TopAppBar: `TopAppBarTitleInsetWithStart` = 4dp after the navigation
   icon and `TopAppBarTitleInset` = 16dp before the actions. */
.gst-search,
.gst-title {
  flex: 1 1 auto;
  min-width: 0;
  margin-inline: 4px 16px;
}

/* BasicTextField: titleMedium with an explicit 18sp / FontWeight.Normal override, the text
   colour is `colorScheme.onBackground` and the cursor uses the same colour. */
.gst-input {
  width: 100%;
  min-width: 0;
  /* A single line BasicTextField is as tall as its line height (titleMedium = 24sp). */
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: rgb(var(--v-theme-on-background));
  caret-color: rgb(var(--v-theme-on-background));
  font-family: inherit;
  font-size: 18px;
  font-weight: 400;
  line-height: 24px;
  letter-spacing: 0.15px;
}

/* Placeholder keeps the ambient content color at secondaryItemAlpha (0.78). */
.gst-input::placeholder {
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  opacity: 1;
}

.gst-input::-webkit-search-cancel-button {
  display: none;
}

/* LinearProgressIndicator: 4dp track, aligned to the bottom of the top bar. The MD3
   indicator draws a rounded track, the coloured indicator and a 4dp stop indicator at the end
   of the track, separated from the indicator by a 4dp gap. */
.gst-progress {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  /* ProgressIndicatorTokens.TrackColor = secondaryContainer. */
  background: rgb(var(--v-theme-secondary-container));
}

/* The coloured indicator stops 4dp before the end of the track, the 4dp gap is followed by
   the 4dp wide stop indicator. */
.gst-progress-bar {
  height: 100%;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
}

/* The stop indicator is drawn at the end of the track, 4dp wide. */
.gst-progress-stop {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
}

/* FilterChip row: horizontal scroll, 8dp padding, 8dp spacing. */
.gst-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding-inline: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.gst-filters::-webkit-scrollbar {
  display: none;
}

/* FilterChip: FilterChipDefaults.Height = 32dp, the shape is RoundedCornerShape(8dp), the
   label uses labelLarge (14sp / 20sp, Medium) and the leading icon is
   FilterChipDefaults.IconSize = 18dp. The content padding is 8dp on both sides and the
   spacing between the icon and the label is 8dp (FilterChipDefaults.HorizontalSpacing).
   The unselected border is drawn inside the shape (as Compose does) and therefore does not
   change the layout box. */
.gst-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding-inline: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  /* FlatUnselectedOutlineWidth = 1dp, FlatUnselectedOutlineColor = outlineVariant. */
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-outline-variant));
  /* UnselectedLabelTextColor = onSurfaceVariant. */
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.1px;
  cursor: pointer;
}

.gst-chip:hover:not(:disabled) {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

/* Selected chip: FlatSelectedContainerColor = secondaryContainer, the label and the leading
   icon use onSecondaryContainer and the outline width is 0dp. */
.gst-chip--selected {
  box-shadow: none;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}

.gst-chip--selected:hover:not(:disabled) {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 8%, transparent);
}

/* UnselectedLeadingIconColor = primary, SelectedLeadingIconColor = onSecondaryContainer. */
.gst-chip-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
  color: rgb(var(--v-theme-primary));
}

.gst-chip--selected .gst-chip-icon {
  color: rgb(var(--v-theme-on-secondary-container));
}

.gst-chip-label {
  white-space: nowrap;
}

/* VerticalDivider: 1dp x FilterChipDefaults.Height (32dp), colour outlineVariant. */
.gst-divider {
  flex: none;
  width: 1px;
  height: 32px;
  background: rgb(var(--v-theme-outline-variant));
}

/* HorizontalDivider: 1dp, colour outlineVariant. */
.gst-hr {
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
}
</style>
