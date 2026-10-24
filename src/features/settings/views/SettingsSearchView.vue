<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's `SettingsSearchScreen`.
 *
 * References:
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsSearchScreen.kt`:
 *   Scaffold whose top bar is a `Column { TopAppBar { navigationIcon = IconButton(UpIcon)
 *   (when navigator can pop), title = BasicTextField (single line, bodyLarge,
 *   onSurface, ImeAction.Search), actions = IconButton(Close) when query is not empty },
 *   HorizontalDivider() }`, and whose body is the `SearchResult` composable.
 * - `SearchToolbar.kt` / `AppBar.kt` (`eu.kanade.presentation.components.AppBar.kt`):
 *   `TopAppBar` 64dp, flat surface (0 elevation), `UpIcon` (`arrow_back` 24dp) with
 *   `PlainTooltip` "Navigate up" (`action_bar_up_description`), 48x48dp interactive touch target
 *   and 40dp circular state layer; Close button (`close` 24dp) with `PlainTooltip` "Reset"
 *   (`action_reset`); `BasicTextField` with autofocus, enter blur, escape exit.
 * - `SearchResult`: the query is read outside composition; `result` is `null` when query is empty
 *   (renders nothing); empty result renders `EmptyScreen(stringResource(MR.strings.no_results_found))`
 *   with kaomoji glyph in displayMedium and text in bodyMedium at 78% opacity (`secondaryItemAlpha`);
 *   non-empty result renders a `LazyColumn` of rows with min-height 56dp, padding 14dp vertical / 24dp horizontal,
 *   title in titleMedium / bodyLarge 16/24sp w400, matched query term highlighted, breadcrumbs in bodySmall
 *   12/16sp w400 onSurfaceVariant at 0.78 alpha, paddingFromBaseline 16dp.
 * - `search(index, searchKey, isLtr)`: case-insensitive match against title and subtitle across all 9
 *   settings screens, group titles produce group heading results, breadcrumbs formatted as "$path > $node",
 *   results capped at 10 items (`.take(10)`).
 * - Target navigation: `SearchableSettings.highlightKey = result.highlightKey; navigator.replace(result.route)`.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import { searchSettings, type SettingsSearchResult } from '@/data/settingsIndex'
import { useSettingsHighlight } from '../stores/settingsHighlight'

const props = withDefaults(
  defineProps<{
    /** Placeholder text, `MR.strings.action_search_settings` ("Search settings") by default. */
    placeholder?: string
  }>(),
  {
    placeholder: 'Search settings',
  },
)

const router = useRouter()
const highlight = useSettingsHighlight()

const query = ref('')
const input = ref<HTMLInputElement | null>(null)

/**
 * Mihon: `val result by produceState<List<SearchResultItem>?>(initialValue = null, index)`
 * When query is empty, result is null (nothing rendered).
 */
const results = computed<SettingsSearchResult[] | null>(() =>
  query.value.trim().length === 0 ? null : searchSettings(query.value.trim()),
)

function goUp() {
  // Mihon: `IconButton(onClick = navigator::pop)`
  if (window.history.length > 1 && typeof window.history.state?.back === 'string') {
    router.back()
  } else {
    void router.push('/settings')
  }
}

function clear() {
  // Mihon: `IconButton(onClick = { textFieldState.clearText() })` + focusRequester.requestFocus()
  query.value = ''
  nextTick(() => input.value?.focus())
}

function onScroll() {
  // Mihon: `LaunchedEffect(listState.isScrollInProgress) { if (listState.isScrollInProgress) focusManager.clearFocus() }`
  input.value?.blur()
}

function open(result: SettingsSearchResult) {
  // Mihon: `SearchableSettings.highlightKey = result.highlightKey; navigator.replace(result.route)`
  highlight.set(result.highlightKey)
  void router.replace({
    path: `/settings/${result.route}`,
    query: { highlight: result.highlightKey },
  })
}

/**
 * Splits text into matched and non-matched segments for query match highlighting.
 */
function splitMatch(text: string, search: string): Array<{ text: string; isMatch: boolean }> {
  const q = search.trim().toLowerCase()
  if (!q) return [{ text, isMatch: false }]
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return [{ text, isMatch: false }]
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + q.length)
  const after = text.slice(idx + q.length)
  const parts: Array<{ text: string; isMatch: boolean }> = []
  if (before) parts.push({ text: before, isMatch: false })
  parts.push({ text: match, isMatch: true })
  if (after) {
    parts.push(...splitMatch(after, q))
  }
  return parts
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    goUp()
  }
}

onMounted(() => {
  // Mihon: `LaunchedEffect(focusRequester) { focusRequester.requestFocus() }`
  nextTick(() => input.value?.focus())
  window.addEventListener('keydown', onWindowKeydown)
})

onBeforeUnmount(() => {
  // Mihon: `DisposableEffect(Unit) { onDispose { softKeyboardController?.hide() } }`
  input.value?.blur()
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <div class="settings-search">
    <!-- TopAppBar { navigationIcon, title = BasicTextField, actions } + HorizontalDivider -->
    <header class="ss-bar">
      <!-- Navigation icon: UpIcon (arrow_back 24dp) with PlainTooltip "Navigate up" -->
      <div class="ss-action-wrap">
        <button
          type="button"
          class="ss-icon-btn"
          aria-label="Navigate up"
          title="Navigate up"
          @click="goUp"
        >
          <span class="material-symbols-rounded ss-icon" aria-hidden="true">arrow_back</span>
        </button>
        <span class="ss-tooltip" role="tooltip">Navigate up</span>
      </div>

      <!-- Title slot: BasicTextField (single line, bodyLarge, onSurface, primary caret) -->
      <div class="ss-title">
        <input
          ref="input"
          v-model="query"
          type="search"
          class="ss-input"
          :placeholder="props.placeholder"
          :aria-label="props.placeholder"
          autocomplete="off"
          enterkeyhint="search"
          @keydown.enter.prevent="input?.blur()"
          @keydown.esc.prevent="goUp"
        />
      </div>

      <!-- Actions slot: IconButton(Close 24dp) with PlainTooltip "Reset" when query is not empty -->
      <div v-if="query" class="ss-action-wrap">
        <button
          type="button"
          class="ss-icon-btn"
          aria-label="Reset"
          title="Reset"
          @click="clear"
        >
          <span class="material-symbols-rounded ss-icon" aria-hidden="true">close</span>
        </button>
        <span class="ss-tooltip" role="tooltip">Reset</span>
      </div>
    </header>

    <!-- HorizontalDivider: 1dp, outlineVariant -->
    <div class="ss-divider" role="separator" />

    <!-- Scaffold body: Crossfade between null (empty), empty list (MihonEmptyScreen), and results LazyColumn -->
    <main class="ss-body" @scroll.passive="onScroll">
      <Transition name="ss-fade" mode="out-in">
        <div v-if="results" :key="results.length ? 'list' : 'empty'" class="ss-result-container">
          <!-- EmptyScreen: "No results found" with kaomoji glyph and 78% opacity secondary alpha -->
          <MihonEmptyScreen
            v-if="!results.length"
            message="No results found"
            class="ss-empty-screen"
          />

          <!-- LazyColumn of SearchResultItem: minHeight 56dp, padding 14dp vertical / 24dp horizontal -->
          <ul v-else class="ss-results" role="list" aria-label="Settings search results">
            <li v-for="result in results" :key="`${result.route}-${result.title}-${result.breadcrumbs}`">
              <button
                type="button"
                class="ss-result"
                @click="open(result)"
              >
                <!-- Title: titleMedium / bodyLarge 16/24sp w400 with query match highlight -->
                <span class="ss-result-title">
                  <template v-for="(part, idx) in splitMatch(result.title, query)" :key="idx">
                    <mark v-if="part.isMatch" class="ss-match">{{ part.text }}</mark>
                    <template v-else>{{ part.text }}</template>
                  </template>
                </span>
                <!-- Breadcrumbs: bodySmall 12/16sp w400 onSurfaceVariant at 0.78 secondary alpha -->
                <span class="ss-result-crumbs">{{ result.breadcrumbs }}</span>
              </button>
            </li>
          </ul>
        </div>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
@layer app-components {
/* Scaffold container: full viewport height minus bottom bar space, surface background */
.settings-search {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 64px);
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* TopAppBar: 64dp height, container color surface (0dp elevation), 4dp horizontal padding */
.ss-bar {
  display: flex;
  align-items: center;
  height: 64px;
  padding-inline: 4px;
  background: rgb(var(--v-theme-surface));
  flex: none;
}

/* Action button wrapper for M3 PlainTooltip */
.ss-action-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/*
 * M3 IconButton: 48x48dp interactive touch target with a 40dp circular state layer
 * (CornerFull) and 24x24dp icon glyph.
 */
.ss-icon-btn {
  position: relative;
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
  -webkit-tap-highlight-color: transparent;
}

/* 40dp circular state layer */
.ss-icon-btn::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none;
}

.ss-icon-btn:hover::before {
  opacity: 0.08;
}

.ss-icon-btn:focus-visible::before {
  opacity: 0.12;
}

.ss-icon-btn:active::before {
  opacity: 0.12;
}

.ss-icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  user-select: none;
}

/*
 * M3 PlainTooltip (anchored below button):
 * Container: inverseSurface, text: inverseOnSurface, shape: CornerExtraSmall (4dp),
 * typography: bodySmall (12sp / 16sp w400).
 */
.ss-tooltip {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 100ms linear;
  z-index: 1000;
}

.ss-action-wrap:hover .ss-tooltip,
.ss-action-wrap:focus-within .ss-tooltip {
  opacity: 1;
  visibility: visible;
}

/* Title slot of the TopAppBar: 4dp after nav icon, 16dp before actions */
.ss-title {
  flex: 1 1 auto;
  min-width: 0;
  margin-inline: 4px 16px;
}

/*
 * BasicTextField: bodyLarge (16sp / 24sp w400, letter-spacing 0.5px) in onSurface,
 * caret in primary, single line.
 */
.ss-input {
  width: 100%;
  min-width: 0;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  caret-color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 16px;
  font-weight: 400;
  line-height: 24px;
  letter-spacing: 0.5px;
}

/* Placeholder drawn in onSurfaceVariant with secondaryItemAlpha (0.78) */
.ss-input::placeholder {
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 78%, transparent);
  opacity: 1;
}

.ss-input::-webkit-search-cancel-button,
.ss-input::-webkit-search-decoration {
  display: none;
}

/* HorizontalDivider: 1dp, colour outlineVariant */
.ss-divider {
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
  flex: none;
}

/* Scaffold body: scrollable list container */
.ss-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.ss-result-container {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 100%;
}

/* MihonEmptyScreen: centers vertically & horizontally */
.ss-empty-screen {
  flex: 1 1 auto;
  min-height: 50vh;
}

/* LazyColumn of results */
.ss-results {
  margin: 0;
  padding: 0;
  list-style: none;
  width: 100%;
}

/*
 * SearchResultItem: BasePreferenceWidget minimum touch target (min-height 56dp),
 * Column(padding(horizontal = 24.dp, vertical = 14.dp)), clickable.
 */
.ss-result {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  padding: 14px 24px;
  border: 0;
  background: transparent;
  text-align: start;
  color: inherit;
  font: inherit;
  cursor: pointer;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease;
}

.ss-result:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent);
}

.ss-result:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.ss-result:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

/*
 * Result title: titleMedium (16sp / 24sp) with FontWeight.Normal (w400),
 * onSurface, single line with ellipsis.
 */
.ss-result-title {
  display: block;
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Highlighted match segment */
.ss-match {
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

/*
 * Result breadcrumbs: bodySmall (12sp / 16sp w400, letter-spacing 0.4px) in onSurfaceVariant
 * at secondaryItemAlpha (0.78), paddingFromBaseline(top = 16.dp).
 */
.ss-result-crumbs {
  display: block;
  margin-top: 2px;
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 78%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Crossfade transitions */
.ss-fade-enter-active,
.ss-fade-leave-active {
  transition: opacity 150ms ease;
}

.ss-fade-enter-from,
.ss-fade-leave-to {
  opacity: 0;
}
}
</style>
