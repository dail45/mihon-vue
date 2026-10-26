<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's Updates app bar.
 *
 * Reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesScreen.kt:155-214
 *     `UpdatesAppBar(onCalendarClicked, onUpdateLibrary, onFilterClicked, hasFilters,
 *                    actionModeCounter, onSelectAll, onInvertSelection, onCancelActionMode)`
 *     -> `AppBar(title = stringResource(MR.strings.label_recent_updates), actions = …,
 *                actionModeCounter = state.selected.size, actionModeActions = …)`
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt:67-164
 *     - the action mode replaces the navigation icon with a close button
 *       (`IconButton(Close)`, contentDescription = MR.strings.action_cancel),
 *     - the title becomes the selection counter (`AppBarTitle(actionModeCounter.toString())`),
 *     - the container colour is `surfaceColorAtElevation(3.dp)` in the action mode and
 *       `surfaceColorAtElevation(0.dp)` (the plain surface) otherwise,
 *     - every action is an `IconButton` whose content description is the action title.
 *
 * The three regular actions of the reference are, in order:
 *   1. `AppBar.Action(title = MR.strings.action_filter, icon = FilterList,
 *      iconTint = colorScheme.active when hasFilters else LocalContentColor.current)`
 *   2. `AppBar.Action(title = MR.strings.action_view_upcoming, icon = CalendarMonth)`
 *   3. `AppBar.Action(title = MR.strings.action_update_library, icon = Refresh)`
 *
 * The action mode actions are `SelectAll` and `FlipToBack`
 * (MR.strings.action_select_all / MR.strings.action_select_inverse).
 *
 * The search field is an addition of the web client: Mihon's Updates screen has no search
 * field, but the web client can only page through the feed, so a local search over the loaded
 * chapters is the only way to narrow it down. Following `SearchToolbar` in AppBar.kt:268-418:
 * - Search icon opens the field and focuses the input.
 * - When open, back arrow icon closes search (`closeSearch`).
 * - Esc closes search.
 * - Non-empty query shows reset button (`close` icon, MR.strings.action_reset).
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useTheme } from 'vuetify'

const theme = useTheme()

const props = withDefaults(defineProps<{
  /** Optional custom title; defaults to MR.strings.label_recent_updates ("Updates"). */
  title?: string
  /** `state.selected.size` — greater than zero switches the bar into the action mode. */
  selectedCount?: number
  /** `hasActiveFilters` — tints the filter action with the "active" colour. */
  hasFilters?: boolean
  /** `MaterialTheme.colorScheme.active` (presentation-core/.../theme/Color.kt). */
  activeColor?: string
  /** `state.isLoading` — the refresh action shows a spinner while the feed reloads. */
  loading?: boolean
  /** The local search query of the web client; `null` closes the search field. */
  searchQuery?: string | null
}>(), {
  title: 'Updates',
  selectedCount: 0,
  hasFilters: false,
  activeColor: undefined,
  loading: false,
  searchQuery: null,
})

const emit = defineEmits<{
  'update:searchQuery': [value: string | null]
  'filter': []
  'calendar': []
  'update-library': []
  'select-all': []
  'invert-selection': []
  'cancel-selection': []
}>()

/** `isActionMode = actionModeCounter > 0`. */
const actionMode = computed(() => props.selectedCount > 0)

/**
 * Resolved active color from Mihon:
 * `ColorScheme.active = if (isSystemInDarkTheme()) Color(255, 235, 59) else Color(255, 193, 7)`
 */
const resolvedActiveColor = computed(() => {
  if (props.activeColor) return props.activeColor
  return theme.global.current.value.dark ? '#FFEB3B' : '#FFC107'
})

/**
 * Search state: whether the search input is currently open.
 * Follows SearchToolbar pattern:
 * - If searchQuery is non-null, search is open.
 * - Clicking search button opens search and focuses the input.
 * - Closing search clears query and closes the search field.
 */
const opened = ref(props.searchQuery !== null)
watch(() => props.searchQuery, (val) => {
  if (val !== null) opened.value = true
})
const searchOpen = computed(() => !actionMode.value && (opened.value || props.searchQuery !== null))

const input = ref<{ focus: () => void; blur: () => void } | null>(null)

function openSearch() {
  opened.value = true
  emit('update:searchQuery', '')
  void nextTick(() => input.value?.focus())
}
function closeSearch() {
  opened.value = false
  emit('update:searchQuery', null)
}
function resetSearch() {
  emit('update:searchQuery', '')
  void nextTick(() => input.value?.focus())
}
</script>

<template>
  <!--
    `TopAppBarDefaults.topAppBarColors(containerColor = surfaceColorAtElevation(3.dp))` in the
    action mode and `surfaceColorAtElevation(0.dp)` (= the plain surface) otherwise
    (AppBar.kt:156-160).
  -->
  <v-app-bar
    flat
    height="64"
    :color="actionMode ? 'surface-container' : 'surface'"
    class="updates-app-bar"
    :class="{ 'is-action-mode': actionMode }"
  >
    <!--
      Navigation icon:
      1. Action mode: Close button (MR.strings.action_cancel = "Cancel").
      2. Search open: Arrow back button (MR.strings.action_bar_up_description = "Close search").
    -->
    <v-btn
      v-if="actionMode"
      icon="close"
      variant="text"
      aria-label="Cancel"
      title="Cancel"
      class="updates-app-bar__nav"
      @click="emit('cancel-selection')"
    />
    <v-btn
      v-else-if="searchOpen"
      icon="arrow_back"
      variant="text"
      aria-label="Close search"
      title="Close search"
      class="updates-app-bar__nav"
      @click="closeSearch"
    />

    <!-- The search field replaces the title while a query is active. -->
    <form
      v-if="!actionMode && searchOpen"
      class="toolbar-search"
      role="search"
      @submit.prevent="input?.blur()"
    >
      <v-text-field
        ref="input"
        :model-value="searchQuery ?? ''"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        aria-label="Search loaded updates"
        placeholder="Search…"
        variant="plain"
        density="comfortable"
        hide-details
        class="toolbar-search-field"
        @update:model-value="emit('update:searchQuery', $event ?? '')"
        @keydown.esc="closeSearch"
      />
    </form>
    <v-app-bar-title v-else class="text-title-large font-weight-regular updates-app-bar-title">
      <!-- `AppBarTitle(actionModeCounter.toString())`. -->
      <template v-if="actionMode">{{ selectedCount }}</template>
      <!-- `MR.strings.label_recent_updates` = "Updates". -->
      <template v-else>{{ title }}</template>
    </v-app-bar-title>

    <template v-if="actionMode">
      <!-- `actionModeActions`: SelectAll and FlipToBack. -->
      <v-btn
        icon="select_all"
        variant="text"
        aria-label="Select all"
        title="Select all"
        class="updates-app-bar__action"
        @click="emit('select-all')"
      />
      <v-btn
        icon="flip_to_back"
        variant="text"
        aria-label="Select inverse"
        title="Select inverse"
        class="updates-app-bar__action"
        @click="emit('invert-selection')"
      />
    </template>
    <template v-else>
      <!-- `AppBar.Action(action_filter, FilterList)` — tinted while a filter is active. -->
      <v-btn
        icon="filter_list"
        variant="text"
        aria-label="Filter"
        title="Filter"
        class="updates-app-bar__action"
        :class="{ 'action--active': hasFilters }"
        :style="hasFilters ? { color: resolvedActiveColor } : undefined"
        @click="emit('filter')"
      />
      <!-- `AppBar.Action(action_view_upcoming, CalendarMonth)`. -->
      <v-btn
        icon="calendar_month"
        variant="text"
        aria-label="View Upcoming Updates"
        title="View Upcoming Updates"
        class="updates-app-bar__action"
        @click="emit('calendar')"
      />
      <!-- `AppBar.Action(action_update_library, Refresh)`. -->
      <v-btn
        icon="refresh"
        variant="text"
        aria-label="Update library"
        title="Update library"
        :loading="loading"
        class="updates-app-bar__action"
        @click="emit('update-library')"
      />
      <!-- The search action of the web client (SearchToolbar). -->
      <v-btn
        v-if="!searchOpen"
        icon="search"
        variant="text"
        aria-label="Open updates search"
        title="Search loaded updates"
        class="updates-app-bar__action"
        @click="openSearch"
      />
      <v-btn
        v-else-if="searchQuery"
        icon="close"
        variant="text"
        aria-label="Reset"
        title="Reset"
        class="updates-app-bar__action"
        @click="resetSearch"
      />
    </template>
  </v-app-bar>
</template>

<style scoped>
@layer app-components {
/* Material 3 TopAppBar: 64dp tall, no elevation shadow. */
.updates-app-bar {
  box-shadow: none;
}
.updates-app-bar.is-action-mode {
  background-color: rgb(var(--v-theme-surface-container)) !important;
}

/* Material 3 TopAppBar Title: typography.titleLarge (22sp / 28sp / w400). */
.updates-app-bar-title {
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}
.updates-app-bar-title :deep(.v-toolbar-title__placeholder) {
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Material 3 Navigation and Action buttons: 48dp touch target, 24dp icon. */
.updates-app-bar__action,
.updates-app-bar__nav {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 9999px;
  color: rgb(var(--v-theme-on-surface));
}
.updates-app-bar__nav {
  margin-inline: 4px;
}
.updates-app-bar__action {
  margin-inline: 0;
}
.updates-app-bar__action:last-child {
  margin-inline-end: 4px;
}
.updates-app-bar__action :deep(.v-icon),
.updates-app-bar__nav :deep(.v-icon) {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

/* Active filter state: MaterialTheme.colorScheme.active. */
.updates-app-bar__action.action--active,
.updates-app-bar__action.action--active :deep(.v-icon) {
  color: inherit;
}

/* The search field takes the available title slot (BasicTextField fillMaxWidth). */
.toolbar-search {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  margin-right: 4px;
}

/* typography.titleMedium.copy(fontSize = 18.sp, fontWeight = Normal). */
.toolbar-search-field :deep(.v-field) {
  padding: 0;
  min-width: 0;
}
.toolbar-search-field :deep(.v-field__input) {
  min-height: 40px;
  padding-top: 0;
  padding-bottom: 0;
}
.toolbar-search-field :deep(input) {
  font-size: 18px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-surface));
}
.toolbar-search-field :deep(input::placeholder) {
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
}
}
</style>
