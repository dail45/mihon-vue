<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's `SearchToolbar`.
 *
 * References:
 *  - `mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt:263-418` (SearchToolbar)
 *  - `mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt:137-164` (TopAppBar container)
 *  - `mihon/app/src/main/java/eu/kanade/presentation/browse/components/BrowseSourceToolbar.kt`
 *  - `tachiyomi/presentation/core/components/material/IconButtonTokens.kt`
 *
 * Specifications from Mihon Compose:
 *  - Bar: Material 3 `TopAppBar` (64dp height, surface container color, flat with 0 elevation shadows).
 *    Horizontal layout padding: 4dp at start and end.
 *  - Navigation icon (UpIcon / Close search):
 *    * In search mode: UpIcon (`arrow_back` / `MaterialSymbols.AutoMirroredRounded.ArrowBack`) 24dp,
 *      content description "Navigate up" (`MR.strings.action_bar_up_description`),
 *      M3 PlainTooltip "Navigate up", 48x48dp interactive touch target, 40dp circular state layer (CornerFull).
 *      Click triggers `onClickCloseSearch` (`{ onChangeSearchQuery(null) }` -> clears query and closes search).
 *    * In regular mode: optional `navigateUp` back button if `hasNav` is true.
 *  - Search field: `BasicTextField`
 *    * Style: `MaterialTheme.typography.titleMedium.copy(color = onBackground, fontWeight = Normal, fontSize = 18.sp)`
 *      (18px / 24px line-height, 400 font-weight, 0.15px letter-spacing, onSurface/onBackground color, caret onBackground).
 *    * Placeholder: `MR.strings.action_search_hint` ("Search…") with `secondaryItemAlpha` = 0.78 (SECONDARY_ALPHA).
 *    * Single line, no background/border, autofocus when opened.
 *  - Clear / Reset action:
 *    * Rendered when search is open and query is not empty (`searchQuery.isNotEmpty()`).
 *    * Icon: `close` (`MaterialSymbols.Rounded.Close`) 24dp.
 *    * Content description: "Reset" (`MR.strings.action_reset`), M3 PlainTooltip "Reset".
 *    * 48x48dp interactive touch target, 40dp circular state layer (CornerFull).
 *    * Click clears the query and keeps focus in the search field (`focusRequester.requestFocus()`).
 *  - Search action:
 *    * Rendered when search is closed and `searchEnabled` is true.
 *    * Icon: `search` (`MaterialSymbols.Rounded.Search`) 24dp.
 *    * Content description: "Search" (`MR.strings.action_search`), M3 PlainTooltip "Search".
 *    * 48x48dp interactive touch target, 40dp circular state layer (CornerFull).
 *    * Click opens search with empty query and requests focus in the search field.
 *  - Key handling:
 *    * `Enter`: runs `searchAndClearFocus`: if query is not blank, triggers `onSearch(query)`; drops focus / keyboard.
 *    * `Escape`: closes search mode, clears query, restores normal toolbar.
 *  - Title slot (regular mode):
 *    * Style: `titleLarge` (22px / 28px w400, onSurface, ellipsis, single line).
 *    * Keyline: 16dp from edge when no navigation icon (12px margin with 4px padding), 56dp when nav icon is present.
 *    * Optional subtitle: `bodyMedium` (14px / 20px w400, onSurfaceVariant, ellipsis, single line).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Bar title (`AppBarTitle`). */
    title?: string
    /** Optional bar subtitle (`AppBarTitle.subtitle`). */
    subtitle?: string
    /** Accessible name of the search input (`BasicTextField`). */
    label?: string
    /** Accessible name of the button that opens the search (`action_search`). */
    openLabel?: string
    /** Accessible name of the close/back button (`action_bar_up_description`). */
    closeLabel?: string
    /** Accessible name of the reset/clear button (`action_reset`). */
    resetLabel?: string
    /** Placeholder, `MR.strings.action_search_hint` by default ("Search…"). */
    placeholder?: string
    /**
     * `SearchToolbar(searchEnabled = ...)`: when false the reference hides the search action
     * completely and always shows the plain title (TabbedScreen.kt:44-50).
     */
    searchable?: boolean
    /** Whether to show a navigation up button even when search is closed. */
    hasNav?: boolean
    /** Callback when navigation up button is clicked when search is closed. */
    navigateUp?: () => void
  }>(),
  {
    title: '',
    subtitle: '',
    label: '',
    openLabel: 'Search',
    closeLabel: 'Navigate up',
    resetLabel: 'Reset',
    placeholder: 'Search…',
    searchable: true,
    hasNav: false,
    navigateUp: undefined,
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'update:open', value: boolean): void
  (event: 'search', query: string): void
  (event: 'close'): void
  (event: 'clear'): void
  (event: 'navigate-up'): void
}>()

const query = defineModel<string>({ default: '' })

/*
 * The open state of the search field. The reference uses the null-ness of the search query
 * for it: `SearchToolbar(searchQuery = null)` shows the plain title, a non-null query shows
 * the field. A parent that owns the state (e.g. Browse tab bar) can bind it with
 * `v-model:open`; otherwise the component manages it internally.
 */
const openModel = defineModel<boolean | undefined>('open', { default: undefined })
const opened = ref(false)

const canSearch = computed(() => props.searchable !== false)
const isOpen = computed(() => (openModel.value !== undefined ? openModel.value : opened.value))
const showNav = computed(() => isOpen.value || props.hasNav || Boolean(props.navigateUp))

const inputEl = ref<{ focus?: () => void; blur?: () => void; $el?: HTMLElement } | null>(null)

function setOpen(value: boolean) {
  opened.value = value
  if (openModel.value !== undefined) {
    openModel.value = value
  }
  emit('update:open', value)
}

function focusInput() {
  void nextTick(() => {
    inputEl.value?.focus?.()
    const rawInput = inputEl.value?.$el?.querySelector('input') as HTMLInputElement | null
    if (rawInput) {
      rawInput.focus()
      const len = rawInput.value.length
      rawInput.setSelectionRange(len, len)
    }
  })
}

function blurInput() {
  inputEl.value?.blur?.()
  const rawInput = inputEl.value?.$el?.querySelector('input') as HTMLInputElement | null
  rawInput?.blur()
}

/** `onClick` on Search button: opens the field and requests focus. */
function open() {
  setOpen(true)
  focusInput()
}

/**
 * `onClickCloseSearch` = `onChangeSearchQuery(null)`: the query is cleared,
 * search is closed, and the bar returns to the plain title.
 */
function close() {
  query.value = ''
  emit('update:modelValue', '')
  setOpen(false)
  emit('close')
}

/**
 * Navigation icon click:
 * In search mode, closes search.
 * In normal mode, triggers navigation up.
 */
function onNavClick() {
  if (isOpen.value) {
    close()
  } else {
    props.navigateUp?.()
    emit('navigate-up')
  }
}

/**
 * `action_reset`: clears the text, notifies callers, and refocuses the input field
 * (`searchFieldState.clearText()`, `focusRequester.requestFocus()`).
 */
function clear() {
  query.value = ''
  emit('update:modelValue', '')
  emit('clear')
  focusInput()
}

/**
 * `searchAndClearFocus`:
 * Enter / submit: if query is not blank, triggers onSearch; drops focus and soft keyboard.
 */
function submit() {
  const current = (query.value ?? '').trim()
  if (current) {
    emit('search', current)
  }
  blurInput()
}

/* Close search on tab change / disabling search */
watch(canSearch, value => {
  if (!value && isOpen.value) {
    close()
  }
})

/* Autofocus when search opens */
watch(isOpen, value => {
  if (value) {
    focusInput()
  }
})

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
  if (isOpen.value) {
    focusInput()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})

defineExpose({
  focus: focusInput,
  blur: blurInput,
  clear,
  open,
  close,
  input: inputEl,
})
</script>

<template>
  <v-app-bar
    flat
    height="64"
    color="surface"
    class="search-app-bar"
  >
    <!--
      Navigation icon:
      In search mode: `IconButton(onClick = onClickCloseSearch) { UpIcon(ArrowBack) }`
      In regular mode: `IconButton(onClick = navigateUp) { UpIcon(...) }` when navigation enabled.
    -->
    <div
      v-if="showNav"
      class="search-app-bar__action-wrap search-app-bar__action-wrap--nav"
    >
      <v-btn
        icon="arrow_back"
        variant="text"
        class="search-app-bar__action search-app-bar__action--nav"
        :aria-label="closeLabel"
        :title="closeLabel"
        @click="onNavClick"
      />
      <span class="search-app-bar__tooltip" role="tooltip">{{ closeLabel }}</span>
    </div>

    <!--
      Search mode: `BasicTextField(fillMaxWidth)`
      titleMedium 18sp w400, onBackground color, placeholder "Search…" (secondaryItemAlpha 0.78).
    -->
    <form
      v-if="isOpen"
      class="toolbar-search"
      role="search"
      @submit.prevent="submit"
    >
      <v-text-field
        ref="inputEl"
        v-model="query"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        :aria-label="label || placeholder || 'Search…'"
        :placeholder="placeholder || 'Search…'"
        variant="plain"
        density="comfortable"
        hide-details
        class="toolbar-search-field"
        @keydown.enter.prevent="submit"
        @keydown.esc.prevent="close"
      />
    </form>

    <!--
      Regular mode: `AppBarTitle`
      titleLarge 22sp / 28sp w400, onSurface, maxLines = 1, ellipsis.
    -->
    <v-app-bar-title
      v-else
      class="search-app-bar__title-slot"
      :class="{ 'search-app-bar__title-slot--no-nav': !showNav }"
    >
      <div v-if="title" class="search-app-bar__title">{{ title }}</div>
      <div v-if="subtitle" class="search-app-bar__subtitle">{{ subtitle }}</div>
      <slot name="title" />
    </v-app-bar-title>

    <!--
      Actions slot:
      1. Search action (when search is closed and searchEnabled is true).
      2. Reset action (when search is open and query is not empty).
      3. Extra actions of the caller (rendered both in regular and search modes).
    -->
    <!-- Search action: `MaterialSymbols.Rounded.Search` with PlainTooltip "Search" -->
    <div v-if="!isOpen && canSearch" class="search-app-bar__action-wrap">
      <v-btn
        icon="search"
        variant="text"
        class="search-app-bar__action"
        :aria-label="openLabel"
        :title="openLabel"
        @click="open"
      />
      <span class="search-app-bar__tooltip" role="tooltip">{{ openLabel }}</span>
    </div>

    <!-- Reset action: `MaterialSymbols.Rounded.Close` with PlainTooltip "Reset" -->
    <div v-else-if="isOpen && query" class="search-app-bar__action-wrap">
      <v-btn
        icon="close"
        variant="text"
        class="search-app-bar__action"
        :aria-label="resetLabel"
        :title="resetLabel"
        @click="clear"
      />
      <span class="search-app-bar__tooltip" role="tooltip">{{ resetLabel }}</span>
    </div>

    <!-- Extra actions passed by caller -->
    <div class="search-app-bar__actions">
      <slot />
    </div>
  </v-app-bar>
</template>

<style scoped>
/*
 * M3 TopAppBar container (TopAppBarTokens.kt):
 * Height: 64dp, surface container color at elevation 0 (flat, no shadow),
 * content horizontal padding: 4dp at start and end.
 */
.search-app-bar {
  box-shadow: none !important;
  background-color: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

.search-app-bar :deep(.v-toolbar__content) {
  height: 64px !important;
  padding: 0 4px !important;
}

/*
 * M3 IconButton (IconButtonTokens.kt):
 * - Interactive touch target: 48x48dp
 * - State layer / bounded ripple container: 40dp circle (CornerFull)
 * - Glyph / Icon: 24dp
 */
.search-app-bar__action-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.search-app-bar__action {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  border-radius: 50% !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

/* 40dp circular state layer & ripple container (CornerFull) inside 48dp target */
.search-app-bar__action :deep(.v-btn__overlay) {
  width: 40px !important;
  height: 40px !important;
  top: 4px !important;
  left: 4px !important;
  border-radius: 50% !important;
}

.search-app-bar__action :deep(.v-btn__underlay) {
  width: 40px !important;
  height: 40px !important;
  top: 4px !important;
  left: 4px !important;
  border-radius: 50% !important;
}

.search-app-bar__action :deep(.v-ripple__container) {
  width: 40px !important;
  height: 40px !important;
  top: 4px !important;
  left: 4px !important;
  border-radius: 50% !important;
}

.search-app-bar__action :deep(.v-icon) {
  font-size: 24px !important;
  width: 24px !important;
  height: 24px !important;
}

/*
 * M3 PlainTooltip (anchored above button):
 * Container: inverseSurface, text: inverseOnSurface, 4dp shape (CornerExtraSmall),
 * labelSmall typography (12sp/16sp w400).
 */
.search-app-bar__tooltip {
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

.search-app-bar__action-wrap:hover .search-app-bar__tooltip,
.search-app-bar__action-wrap:focus-within .search-app-bar__tooltip {
  opacity: 1;
  visibility: visible;
}

/*
 * Title slot in regular mode:
 * M3 titleLarge: 22sp / 28sp w400, onSurface.
 * When no nav icon: 16dp keyline from start (4dp content padding + 12px margin).
 * When nav icon present: 56dp keyline (4dp padding + 48dp button + 4px margin).
 */
.search-app-bar__title-slot {
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  min-width: 0 !important;
  margin-inline-start: 4px !important;
  padding-inline-start: 0 !important;
}

.search-app-bar__title-slot--no-nav {
  margin-inline-start: 12px !important;
  padding-inline-start: 0 !important;
}

.search-app-bar__title {
  font-family: Roboto, sans-serif;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-app-bar__subtitle {
  font-family: Roboto, sans-serif;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * Search field:
 * BasicTextField fills the title slot (fillMaxWidth).
 * Inset after nav icon: 4dp, before action icons: 8dp.
 */
.toolbar-search {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  margin-inline: 4px 8px;
}

.toolbar-search-field :deep(.v-field) {
  padding: 0 !important;
  min-width: 0 !important;
}

.toolbar-search-field :deep(.v-field__input) {
  min-height: 24px !important;
  height: 24px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  padding-inline: 0 !important;
}

/*
 * typography.titleMedium.copy(color = onBackground, fontWeight = Normal, fontSize = 18.sp):
 * 18px / 24px w400, letter-spacing 0.15px, onBackground color & cursorBrush.
 */
.toolbar-search-field :deep(input) {
  font-family: Roboto, sans-serif !important;
  font-size: 18px !important;
  line-height: 24px !important;
  font-weight: 400 !important;
  letter-spacing: 0.15px !important;
  color: rgb(var(--v-theme-on-background)) !important;
  caret-color: rgb(var(--v-theme-on-background)) !important;
}

/* Placeholder uses titleMedium 18sp w400 and secondaryItemAlpha (SECONDARY_ALPHA = 0.78) */
.toolbar-search-field :deep(input::placeholder) {
  color: rgb(var(--v-theme-on-background)) !important;
  opacity: 0.78 !important;
}

.toolbar-search-field :deep(input::-webkit-search-cancel-button),
.toolbar-search-field :deep(input::-webkit-search-decoration) {
  display: none !important;
}

/*
 * Extra actions slot:
 * Formats caller-provided action buttons (e.g. v-btn) with 48x48dp target & 24dp glyph.
 */
.search-app-bar__actions {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}

.search-app-bar__actions :deep(.v-btn) {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  border-radius: 50% !important;
}

.search-app-bar__actions :deep(.v-btn .v-icon) {
  font-size: 24px !important;
  width: 24px !important;
  height: 24px !important;
}
</style>
