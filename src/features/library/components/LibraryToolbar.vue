<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTheme } from 'vuetify'
import { stringResource, MR } from '@/core/i18n'

/**
 * Pixel-parity port of Mihon's `presentation/library/components/LibraryToolbar.kt`
 * and its underlying `AppBar.kt` (`AppBar`, `SearchToolbar`, `AppBarActions`).
 *
 * Reference:
 *   - `mihon/app/src/main/java/eu/kanade/presentation/library/components/LibraryToolbar.kt`
 *   - `mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt`
 *   - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/Pill.kt`
 *   - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/theme/Color.kt`
 *
 * Structure in Compose:
 * ```kotlin
 * fun LibraryToolbar(...) = when {
 *     selectedCount > 0 -> LibrarySelectionToolbar(...)
 *     else -> LibraryRegularToolbar(...)
 * }
 * ```
 *
 * Regular Mode (`LibraryRegularToolbar`):
 *  - TopAppBar with containerColor = surface (elevation 0.dp), height 64dp.
 *  - When search is closed (`searchQuery == null`):
 *      * No navigation icon (title starts with 16dp padding).
 *      * Title slot: Row(verticalAlignment = CenterVertically) {
 *          Text(title.text, maxLines = 1, overflow = Ellipsis, titleLarge 22/28 w400)
 *          Pill(numberOfManga, color = onBackground.copy(alpha = pillAlpha), shapes.extraLarge 28dp, fontSize = 14sp)
 *        }
 *      * Actions:
 *          1. Search action (Search icon, tooltip "Search", calls onChangeSearchQuery("")).
 *          2. Filter action (FilterList icon, tooltip "Filter", tint = activeColor if hasFilters else onSurface).
 *             activeColor = #FFEB3B (dark) / #FFC107 (light).
 *          3. Overflow action (MoreVert icon, tooltip "More options", DropdownMenu):
 *             - "Update library" (action_update_library) -> emit('update-library')
 *             - "Update category" (action_update_category) -> emit('update-category')
 *             - "Open random entry" (action_open_random_manga) -> emit('open-random')
 *  - When search is open (`searchQuery != null`):
 *      * Navigation icon: ArrowBack (tooltip "Navigate up", closes search).
 *      * Title slot: BasicTextField with fillMaxWidth:
 *          titleMedium 18sp w400 line-height 24px, placeholder "Search…" with secondaryItemAlpha (0.78).
 *      * Actions:
 *          1. Reset action (Close icon, tooltip "Reset", only shown when searchQuery is not empty).
 *          2. Filter action (retained).
 *          3. Overflow action (retained).
 *
 * Selection Mode (`LibrarySelectionToolbar`):
 *  - TopAppBar with containerColor = surfaceColorAtElevation(3.dp) -> `surface-container-high`.
 *  - Navigation icon: Close (tooltip "Cancel", cancels selection).
 *  - Title: Text("$selectedCount", titleLarge 22/28 w400).
 *  - Actions:
 *      1. Select all action (SelectAll icon, tooltip "Select all").
 *      2. Select inverse action (FlipToBack icon, tooltip "Select inverse").
 */
const props = withDefaults(defineProps<{
  /** `LibraryToolbarTitle.text`. */
  title: string
  /** `LibraryToolbarTitle.numberOfManga` — null hides the count pill. */
  count?: number | null
  /** `hasActiveFilters` — tints the filter action with `colorScheme.active`. */
  hasFilters?: boolean
  /** Mihon `searchQuery`; null means the search field is closed. */
  searchQuery?: string | null
  /** `selectedCount` — greater than zero switches the toolbar to the action mode. */
  selectedCount?: number
}>(), { count: null, hasFilters: false, searchQuery: null, selectedCount: 0 })

const emit = defineEmits<{
  (event: 'update:searchQuery', value: string | null): void
  (event: 'search', value: string): void
  (event: 'filter'): void
  (event: 'update-library'): void
  (event: 'update-category'): void
  (event: 'sync-library'): void
  (event: 'open-random'): void
  (event: 'select-all'): void
  (event: 'invert-selection'): void
  (event: 'cancel-selection'): void
}>()

const theme = useTheme()
const isDark = computed(() => theme.current.value.dark)

/**
 * `tachiyomi.presentation.core.theme.Color.kt`:
 * `val ColorScheme.active: Color = if (isSystemInDarkTheme()) Color(255, 235, 59) else Color(255, 193, 7)`
 */
const activeColor = computed(() => (isDark.value ? 'rgb(255, 235, 59)' : 'rgb(255, 193, 7)'))

/**
 * `LibraryToolbar.kt:74`:
 * `val pillAlpha = if (isSystemInDarkTheme()) 0.12f else 0.08f`
 */
const pillBgColor = computed(() =>
  isDark.value
    ? 'color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent)'
    : 'color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent)'
)

const input = ref<{ focus: () => void; blur: () => void; $el?: HTMLElement } | null>(null)
const overflowOpen = ref(false)

/** `SearchToolbar`: open while `searchQuery != null`. */
const searchOpen = computed(() => props.searchQuery !== null)

function focusInputField() {
  void nextTick(() => {
    input.value?.focus?.()
    input.value?.$el?.querySelector('input')?.focus()
  })
}

/** `onChangeSearchQuery("")` opens the search field with an empty query. */
function openSearch() {
  emit('update:searchQuery', '')
  focusInputField()
}

/** `onClickCloseSearch = { onChangeSearchQuery(null) }`. */
function closeSearch() {
  emit('update:searchQuery', null)
}

/** `action_reset`: clears query to "", requests focus back. */
function resetSearch() {
  emit('update:searchQuery', '')
  focusInputField()
}

function onInput(value: string) {
  emit('update:searchQuery', value)
}

/**
 * `searchAndClearFocus`:
 * In Compose, Enter triggers search, clears focus, and hides soft keyboard.
 */
function onSubmitSearch() {
  input.value?.blur?.()
  input.value?.$el?.querySelector('input')?.blur()
  if (props.searchQuery) {
    emit('search', props.searchQuery)
  }
}

/**
 * Back handling (`BackHandler(enabled = state.selectionMode || state.searchQuery != null)` in `LibraryTab.kt`):
 * In web, the Escape key cancels selection mode or dismisses search.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (props.selectedCount > 0) {
      emit('cancel-selection')
    } else if (searchOpen.value) {
      closeSearch()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!--
    `TopAppBar(colors = TopAppBarDefaults.topAppBarColors(containerColor = surfaceColorAtElevation(if (isActionMode) 3.dp else 0.dp)))`:
    Elevation 0dp = surface; Elevation 3dp = surface-container-high.
  -->
  <v-app-bar
    flat
    height="64"
    :color="selectedCount > 0 ? 'surface-container-high' : 'surface'"
    class="library-toolbar"
    :class="{
      'library-toolbar--selection': selectedCount > 0,
      'library-toolbar--search-open': selectedCount === 0 && searchOpen,
    }"
  >
    <!--
      Selection Mode navigation icon:
      `IconButton(onClick = onCancelActionMode) { Icon(Close, contentDescription = "Cancel") }`
    -->
    <div v-if="selectedCount > 0" class="library-toolbar__tooltip-wrap">
      <v-btn
        icon="close"
        aria-label="Cancel"
        title="Cancel"
        class="library-toolbar__action"
        @click="emit('cancel-selection')"
      />
      <span class="library-toolbar__tooltip" role="tooltip">Cancel</span>
    </div>

    <!--
      Search Mode navigation icon:
      `IconButton(onClick = onClickCloseSearch) { UpIcon(ArrowBack, contentDescription = "Navigate up") }`
    -->
    <div v-else-if="searchOpen" class="library-toolbar__tooltip-wrap">
      <v-btn
        icon="arrow_back"
        aria-label="Navigate up"
        title="Navigate up"
        class="library-toolbar__action"
        @click="closeSearch"
      />
      <span class="library-toolbar__tooltip" role="tooltip">Navigate up</span>
    </div>

    <!--
      Search Mode Title Slot:
      `BasicTextField(fillMaxWidth, titleMedium 18sp w400, placeholder = "Search…", secondaryItemAlpha = 0.78)`
    -->
    <form
      v-if="selectedCount === 0 && searchOpen"
      class="toolbar-search"
      role="search"
      @submit.prevent="onSubmitSearch"
    >
      <v-text-field
        ref="input"
        :model-value="searchQuery ?? ''"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        aria-label="Search library"
        placeholder="Search…"
        variant="plain"
        density="comfortable"
        hide-details
        class="toolbar-search-field"
        @update:model-value="onInput"
        @keydown.esc="closeSearch"
      />
    </form>

    <!-- Regular Mode Title Slot / Selection Mode Count Slot -->
    <v-app-bar-title
      v-else
      class="library-toolbar-title"
      :class="{ 'library-toolbar-title--no-nav': selectedCount === 0 && !searchOpen }"
    >
      <!-- Selection Mode: Text("$selectedCount", titleLarge 22/28 w400) -->
      <template v-if="selectedCount > 0">
        <span class="library-toolbar-selection-count" :aria-label="`${selectedCount} selected`">{{ selectedCount }}</span>
      </template>

      <!-- Regular Mode: Row(verticalAlignment = CenterVertically) { Text(title) ; Pill(count) } -->
      <div v-else class="library-toolbar-title-row">
        <span class="library-toolbar-title-text">{{ title }}</span>
        <!--
          `Pill(text = "${title.numberOfManga}", color = onBackground.copy(alpha = pillAlpha), fontSize = 14.sp)`:
          shapes.extraLarge = 28dp, start padding = 4dp, inner padding = 6dp / 1dp, 14sp w400.
        -->
        <span
          v-if="count !== null"
          class="library-toolbar-pill"
          :style="{ background: pillBgColor }"
        >{{ count }}</span>
      </div>
    </v-app-bar-title>

    <!-- Selection Mode Actions: "Select all" and "Select inverse" -->
    <template v-if="selectedCount > 0">
      <div class="library-toolbar__tooltip-wrap">
        <v-btn
          icon="select_all"
          aria-label="Select all"
          title="Select all"
          class="library-toolbar__action"
          @click="emit('select-all')"
        />
        <span class="library-toolbar__tooltip" role="tooltip">Select all</span>
      </div>

      <div class="library-toolbar__tooltip-wrap">
        <v-btn
          icon="flip_to_back"
          aria-label="Select inverse"
          title="Select inverse"
          class="library-toolbar__action"
          @click="emit('invert-selection')"
        />
        <span class="library-toolbar__tooltip" role="tooltip">Select inverse</span>
      </div>
    </template>

    <!-- Regular Mode Actions -->
    <template v-else>
      <!-- Search button (shown when search is closed) -->
      <div v-if="!searchOpen" class="library-toolbar__tooltip-wrap">
        <v-btn
          icon="search"
          aria-label="Search"
          title="Search"
          class="library-toolbar__action"
          @click="openSearch"
        />
        <span class="library-toolbar__tooltip" role="tooltip">Search</span>
      </div>

      <!-- Reset button (shown in search mode only while searchQuery is not empty) -->
      <div v-else-if="searchQuery" class="library-toolbar__tooltip-wrap">
        <v-btn
          icon="close"
          aria-label="Reset"
          title="Reset"
          class="library-toolbar__action"
          @click="resetSearch"
        />
        <span class="library-toolbar__tooltip" role="tooltip">Reset</span>
      </div>

      <!--
        Filter action:
        `AppBar.Action(title = "Filter", icon = FilterList, iconTint = activeColor when hasFilters)`
      -->
      <div class="library-toolbar__tooltip-wrap">
        <v-btn
          icon="filter_list"
          :style="{ color: hasFilters ? activeColor : undefined }"
          aria-label="Filter and sort library"
          title="Filter and sort library"
          class="library-toolbar__action"
          @click="emit('filter')"
        />
        <span class="library-toolbar__tooltip" role="tooltip">Filter</span>
      </div>

      <!--
        Overflow action:
        `AppBarActions` overflow: MoreVert icon button opening DropdownMenu with
        "Update library", "Update category" and "Open random entry".
      -->
      <v-menu v-model="overflowOpen" location="bottom end" :offset="4">
        <template #activator="{ props: menuProps }">
          <div class="library-toolbar__tooltip-wrap">
            <v-btn
              v-bind="menuProps"
              icon="more_vert"
              aria-label="More options"
              title="More options"
              class="library-toolbar__action"
            />
            <span class="library-toolbar__tooltip" role="tooltip">More options</span>
          </div>
        </template>
        <v-list density="compact" class="library-toolbar-overflow">
          <v-list-item
            :title="stringResource(MR.strings.action_update_category)"
            class="library-toolbar-overflow__item"
            @click="overflowOpen = false; emit('update-category')"
          />
          <v-list-item
            :title="stringResource(MR.strings.action_update_library)"
            class="library-toolbar-overflow__item"
            @click="overflowOpen = false; emit('update-library')"
          />
          <v-list-item
            :title="stringResource(MR.strings.action_sync_library)"
            class="library-toolbar-overflow__item"
            @click="overflowOpen = false; emit('sync-library')"
          />
          <v-list-item
            :title="stringResource(MR.strings.action_open_random_manga)"
            class="library-toolbar-overflow__item"
            @click="overflowOpen = false; emit('open-random')"
          />
        </v-list>
      </v-menu>
    </template>
  </v-app-bar>
</template>

<style scoped>
@layer app-components {
.library-toolbar {
  box-sizing: border-box;
  transition: background-color 200ms cubic-bezier(0.2, 0, 0, 1), color 200ms cubic-bezier(0.2, 0, 0, 1);
}

/* Material 3 TopAppBar horizontal layout padding: 4dp at start and end */
.library-toolbar :deep(.v-toolbar__content) {
  padding: 0 4px !important;
}

/* TooltipBox with PlainTooltip anchored above: inverseSurface container, inverseOnSurface text, 4dp shape. */
.library-toolbar__tooltip-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.library-toolbar__tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-family: Roboto, sans-serif;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.1s linear;
  z-index: 1000;
}

.library-toolbar__tooltip-wrap:hover .library-toolbar__tooltip,
.library-toolbar__tooltip-wrap:focus-within .library-toolbar__tooltip {
  opacity: 1;
  visibility: visible;
}

/* TopAppBar action buttons: 48dp touch target, 24dp glyph */
.library-toolbar__action {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  border-radius: 50% !important;
}

.library-toolbar__action :deep(.v-icon) {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

/* TopAppBar title container:
 * In Compose TopAppBar, with a navigation icon (48dp with 4dp start padding = 52dp),
 * the title starts at 56dp (4dp gap between icon and title).
 * Reset Vuetify's default 20px margin-inline-start to 4px.
 */
.library-toolbar-title {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-inline-start: 4px !important;
  padding-inline-start: 0 !important;
}

/* When no navigation icon is present, TopAppBar starts title at 16dp from edge.
 * Since .v-toolbar__content has 4dp padding, margin-inline-start = 12px (4 + 12 = 16px).
 */
.library-toolbar-title--no-nav {
  margin-inline-start: 12px !important;
  padding-inline-start: 0 !important;
}

.library-toolbar-title-row {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

/* `Text(text = title, maxLines = 1, overflow = Ellipsis)`: titleLarge 22sp / 28sp w400 */
.library-toolbar-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: Roboto, sans-serif;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}

/* `AppBar(titleContent = { Text(text = "$selectedCount") })`: titleLarge 22sp / 28sp w400 */
.library-toolbar-selection-count {
  font-family: Roboto, sans-serif;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  user-select: none;
}

/*
 * `Pill(text, color = onBackground.copy(alpha = 0.12 dark / 0.08 light), fontSize = 14.sp)`:
 * Surface(shape = shapes.extraLarge = 28dp) with padding(start = 4.dp) and an inner
 * box padded 6dp horizontally / 1dp vertically.
 */
.library-toolbar-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-inline-start: 4px;
  padding: 1px 6px;
  border-radius: 28px;
  color: rgb(var(--v-theme-on-surface));
  font-family: Roboto, sans-serif;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
}

/* Search input field fills the title slot (fillMaxWidth) */
.toolbar-search {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  margin-inline: 4px 8px;
}

.toolbar-search-field :deep(.v-field) {
  padding: 0;
  min-width: 0;
}

.toolbar-search-field :deep(.v-field__input) {
  min-height: 40px;
  padding-top: 0;
  padding-bottom: 0;
}

/* typography.titleMedium.copy(fontSize = 18.sp, fontWeight = Normal) */
.toolbar-search-field :deep(input) {
  font-family: Roboto, sans-serif;
  font-size: 18px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-surface));
  caret-color: rgb(var(--v-theme-on-surface));
}

/* Placeholder with secondaryItemAlpha (SECONDARY_ALPHA = 0.78) */
.toolbar-search-field :deep(input::placeholder) {
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
}

/* DropdownMenu: surfaceContainer container, CornerExtraSmall (4dp), elevation 3 */
.library-toolbar-overflow {
  background: rgb(var(--v-theme-surface-container)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  border-radius: 4px !important;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2) !important;
  min-width: 196px;
  padding: 8px 0 !important;
}

.library-toolbar-overflow__item {
  min-height: 48px !important;
  padding: 0 12px !important;
}

.library-toolbar-overflow__item :deep(.v-list-item-title) {
  font-family: Roboto, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
}
</style>
