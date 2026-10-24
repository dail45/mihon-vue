<script setup lang="ts">
/**
 * Sources filter screen.
 *
 * Reference: `mihon/app/src/main/java/eu/kanade/presentation/browse/SourcesFilterScreen.kt`
 * (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1) and every widget it composes:
 *  - `presentation/more/settings/widget/SwitchPreferenceWidget.kt`
 *  - `presentation/more/settings/widget/TextPreferenceWidget.kt`
 *  - `presentation/more/settings/widget/BasePreferenceWidget.kt`
 *  - `presentation/browse/components/BaseSourceItem.kt` + `BaseBrowseItem.kt`
 *  - `presentation/browse/components/BrowseIcons.kt` (SourceIcon)
 *  - `presentation-core/.../components/LazyList.kt` (FastScrollLazyColumn)
 *  - `presentation-core/.../components/VerticalFastScroller.kt`
 *  - `presentation-core/.../screens/EmptyScreen.kt` and `LoadingScreen.kt`
 *  - `presentation-core/.../components/material/Scaffold.kt`
 *
 * Reference geometry (dp unless noted):
 *  - Scaffold: containerColor = background, no FAB, content padding from the material3 Scaffold.
 *  - AppBar: material3 TopAppBar (container = surface at elevation 0, height 64), up button and
 *    the title "Sources" (`MR.strings.label_sources`). The web shell owns that bar, so the route
 *    is registered with `meta: { title: 'Sources', detail: true }`.
 *  - Content: `FastScrollLazyColumn(contentPadding = contentPadding)`, one flat lazy list with
 *    `item(key = language, contentType = "source-filter-header")` per language and
 *    `item(key = "source-filter-<id>", contentType = "source-filter-item")` per source. Every row
 *    uses `Modifier.animateItem()`, so rows fade in/out and the rest slide into place.
 *  - Per language group: a `SwitchPreferenceWidget` header. Only enabled languages list
 *    their sources.
 *  - Per source: `BaseSourceItem(showLanguageInContent = false)` with a trailing
 *    `Checkbox(checked = enabled, onCheckedChange = null)`.
 *  - Empty state (`state.isEmpty`): `EmptyScreen(MR.strings.source_filter_empty_screen)`
 *    = "No installed source found" plus a random kaomoji face.
 *  - Loading state (Voyager wrapper): centered `LoadingScreen()` (Md3CircularProgress: 40dp, 4dp stroke).
 *  - Error state (Voyager wrapper): toast `MR.strings.internal_error`, then `navigator.pop()`.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { getSourceDisplayName } from '../utils/sourceLanguage'
import Md3CircularProgress from '@/core/components/Md3CircularProgress.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import type { Source } from '@/core/api/types'

const server = useSuwayomiStore()
const router = useRouter()

/** Suwayomi reports the local source with lang "localsourcelang"; Mihon's LocalSource uses "other". */
const LOCAL_LANG = 'localsourcelang'

/**
 * Mihon keeps both sets in app preferences ("source_languages" and "hidden_catalogues").
 * Suwayomi's REST API exposes neither of them, so the web app keeps them in browser storage and
 * says so in a snackbar - the screen stays fully usable, only the storage is local.
 */
const LANGUAGES_KEY = 'mihon.sourceLanguages'
const DISABLED_SOURCES_KEY = 'mihon.disabledSources'

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}
function writeList(key: string, value: string[]) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

/** LocaleHelper.getDefaultEnabledLanguages() = { "all", "en", device locale language }. */
function defaultEnabledLanguages(): string[] {
  const device = (navigator.language || 'en').split('-')[0] || 'en'
  return [...new Set(['all', 'en', device])]
}

const enabledLanguages = ref<string[]>(readList(LANGUAGES_KEY))
const disabledSources = ref<string[]>(readList(DISABLED_SOURCES_KEY))
if (!enabledLanguages.value.length) enabledLanguages.value = defaultEnabledLanguages()

/** LocaleHelper.comparator compares the display names with a plain string comparison. */
function compareDisplayNames(a: string, b: string) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * GetLanguagesWithSources: group the sources by language, sort the map with
 * `compareBy { it !in enabledLanguage }.then(LocaleHelper.comparator)` (enabled languages first,
 * "all"/Multi first, then the localized display name) and inside a group sort with the disabled
 * sources last, then by name (case insensitive).
 */
interface LanguageGroup {
  key: string
  title: string
  sources: Source[]
}

const groups = computed<LanguageGroup[]>(() => {
  const byLanguage = new Map<string, Source[]>()
  for (const source of server.sources) {
    // `SourceRepositoryImpl.getOnlineSources()` keeps only HttpSource instances, so the local
    // source is not part of the sources filter screen in Mihon.
    if (source.id === '0' || source.lang === LOCAL_LANG) continue
    const lang = source.lang || 'other'
    const list = byLanguage.get(lang) || []
    list.push(source)
    byLanguage.set(lang, list)
  }
  const enabled = new Set(enabledLanguages.value)
  const disabled = new Set(disabledSources.value)
  const entries = [...byLanguage.entries()].map(([key, sources]) => ({
    key,
    title: getSourceDisplayName(key),
    sources: sources.slice().sort((a, b) => {
      const aDisabled = disabled.has(String(a.id)) ? 1 : 0
      const bDisabled = disabled.has(String(b.id)) ? 1 : 0
      if (aDisabled !== bDisabled) return aDisabled - bDisabled
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    }),
  }))
  entries.sort((a, b) => {
    const aEnabled = enabled.has(a.key) ? 0 : 1
    const bEnabled = enabled.has(b.key) ? 0 : 1
    if (aEnabled !== bEnabled) return aEnabled - bEnabled
    if (a.key === 'all') return -1
    if (b.key === 'all') return 1
    return compareDisplayNames(a.title, b.title)
  })
  return entries
})

/** The flat lazy list of the screen: one header per language plus the sources of enabled ones. */
type Row =
  | { type: 'header'; key: string; title: string; language: string }
  | { type: 'source'; key: string; source: Source }

const rows = computed<Row[]>(() => {
  const result: Row[] = []
  for (const group of groups.value) {
    result.push({ type: 'header', key: group.key, title: group.title, language: group.key })
    if (!isLanguageEnabled(group.key)) continue
    for (const source of group.sources) {
      result.push({ type: 'source', key: `source-filter-${source.id}`, source })
    }
  }
  return result
})

/** `SourcesFilterViewModel.State.Success.isEmpty` = items.isEmpty(), i.e. no language group at all. */
const isEmpty = computed(() => !server.loadingSources && !server.sourcesError && !groups.value.length)

/** ToggleLanguage.await(language): toggles the membership in the "source_languages" preference. */
function toggleLanguage(language: string) {
  const next = enabledLanguages.value.includes(language)
    ? enabledLanguages.value.filter(item => item !== language)
    : [...enabledLanguages.value, language]
  enabledLanguages.value = next
  writeList(LANGUAGES_KEY, next)
  notifyOnce('Language filter is stored in this browser only - the Suwayomi REST API has no source language filter.')
}

/** ToggleSource.await(source): toggles "${source.id}" in the "hidden_catalogues" preference. */
function toggleSource(source: Source) {
  const id = String(source.id)
  const next = disabledSources.value.includes(id)
    ? disabledSources.value.filter(item => item !== id)
    : [...disabledSources.value, id]
  disabledSources.value = next
  writeList(DISABLED_SOURCES_KEY, next)
  notifyOnce('Source visibility is stored in this browser only - the Suwayomi REST API has no per-source enable/disable.')
}

function isLanguageEnabled(language: string) { return enabledLanguages.value.includes(language) }
function isSourceEnabled(source: Source) { return !disabledSources.value.includes(String(source.id)) }

/** Suwayomi serves the source icons relative to the server root. */
const serverBase = computed(() => server.apiUrl.replace(/\/api\/v1\/?$/, ''))
/** Sources whose icon failed to load fall back to the default source icon. */
const iconFailed = reactive<Record<string, boolean>>({})
function iconUrl(source: Source) {
  if (!source.iconUrl) return ''
  return /^https?:\/\//.test(source.iconUrl) ? source.iconUrl : `${serverBase.value}${source.iconUrl}`
}

/** Snackbar used for the web-only notice and for the reference error toast. */
const snackbar = ref('')
let snackbarTimer: number | undefined
function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 5000)
}

/** The web-only notice is shown once per session, not on every tap. */
const shownNotices = new Set<string>()
function notifyOnce(message: string) {
  if (shownNotices.has(message)) return
  shownNotices.add(message)
  notify(message)
}

watch(() => server.sourcesError, error => {
  if (!error) return
  // Voyager wrapper: toast MR.strings.internal_error, then navigator.pop().
  notify('InternalError: Check crash logs for further information')
  window.setTimeout(() => {
    if (typeof window.history.state?.back === 'string') router.back()
    else void router.push('/browse')
  }, 1200)
})

/* --------------------------------------------------------------------- */
/* VerticalFastScroller: 12dp x 48dp thumb, 6dp radius, primary color.  */
/* The thumb shows while scrolling, fades out after 2s and is draggable.  */
/* --------------------------------------------------------------------- */
const scrollEl = ref<HTMLElement | null>(null)
const thumbTop = ref(0)
const thumbVisible = ref(false)
let thumbTimer: number | undefined
let dragging = false

const THUMB_LENGTH = 48
function trackHeight(el: HTMLElement) { return Math.max(el.clientHeight - THUMB_LENGTH, 1) }

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) { thumbVisible.value = false; return }
  thumbTop.value = (el.scrollTop / max) * trackHeight(el)
  showThumb()
}
function showThumb() {
  thumbVisible.value = true
  if (thumbTimer) window.clearTimeout(thumbTimer)
  thumbTimer = window.setTimeout(() => { if (!dragging) thumbVisible.value = false }, 2000)
}
function startDrag(event: PointerEvent) {
  const el = scrollEl.value
  if (!el) return
  dragging = true
  thumbVisible.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  onDrag(event)
  event.preventDefault()
}
function onDrag(event: PointerEvent) {
  const el = scrollEl.value
  if (!el || !dragging) return
  const rect = el.getBoundingClientRect()
  const track = trackHeight(el)
  const offset = Math.min(Math.max(event.clientY - rect.top - THUMB_LENGTH / 2, 0), track)
  thumbTop.value = offset
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = max > 0 ? (offset / track) * max : 0
}
function endDrag(event?: PointerEvent) {
  if (!dragging) return
  dragging = false
  if (event && (event.currentTarget as HTMLElement)?.hasPointerCapture(event.pointerId)) {
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  }
  if (thumbTimer) window.clearTimeout(thumbTimer)
  thumbTimer = window.setTimeout(() => { thumbVisible.value = false }, 2000)
}

onMounted(() => { if (!server.sources.length && !server.loadingSources) void server.loadSources() })
onBeforeUnmount(() => { if (thumbTimer) window.clearTimeout(thumbTimer) })
</script>

<template>
  <div class="sf-screen">
    <!-- LoadingScreen: Box(fillMaxSize, contentAlignment = Center) with CircularProgressIndicator. -->
    <div v-if="server.loadingSources" class="sf-loading" role="status" aria-label="Loading sources">
      <Md3CircularProgress />
    </div>

    <!-- EmptyScreen: Column(fillMaxSize, horizontal padding 24dp) centered with random kaomoji face. -->
    <MihonEmptyScreen v-else-if="isEmpty" message="No installed source found" />

    <!-- FastScrollLazyColumn: one flat lazy list of headers and source rows. -->
    <div v-else ref="scrollEl" class="sf-scroll" @scroll.passive="onScroll">
      <TransitionGroup name="sf-item" tag="div" class="sf-rows">
        <div v-for="row in rows" :key="row.key" class="sf-row">
          <!-- SourcesFilterHeader -> SwitchPreferenceWidget(title, checked, onCheckedChanged) -->
          <button
            v-if="row.type === 'header'"
            type="button"
            class="sf-pref"
            role="switch"
            :aria-checked="isLanguageEnabled(row.language)"
            @click="toggleLanguage(row.language)"
          >
            <span class="sf-pref-title">{{ row.title }}</span>
            <span class="sf-pref-widget">
              <!-- Switch(checked, onCheckedChange = null): 52x32 track, 16dp/24dp thumb. -->
              <span class="sf-switch" :class="{ 'is-on': isLanguageEnabled(row.language) }" aria-hidden="true">
                <span class="sf-switch-track">
                  <span class="sf-switch-thumb" />
                </span>
              </span>
            </span>
          </button>

          <!-- SourcesFilterItem -> BaseSourceItem(showLanguageInContent = false) + Checkbox -->
          <button
            v-else
            type="button"
            class="sf-source"
            role="checkbox"
            :aria-checked="isSourceEnabled(row.source)"
            @click="toggleSource(row.source)"
          >
            <span class="sf-source-icon-wrap">
              <img
                v-if="iconUrl(row.source) && !iconFailed[row.source.id]"
                class="sf-source-icon"
                :src="iconUrl(row.source)"
                alt=""
                loading="lazy"
                @error="iconFailed[row.source.id] = true"
              />
              <span
                v-else
                class="material-symbols-rounded sf-source-icon-fallback"
                aria-hidden="true"
              >public</span>
            </span>
            <span class="sf-source-name">{{ row.source.name }}</span>
            <!-- Checkbox(checked, onCheckedChange = null): a 20dp box, not interactive on its own. -->
            <span class="sf-checkbox-slot">
              <svg
                class="sf-checkbox"
                :class="{ 'is-checked': isSourceEnabled(row.source) }"
                viewBox="0 0 20 20"
                aria-hidden="true"
                focusable="false"
              >
                <rect class="sf-checkbox-box" x="1" y="1" width="18" height="18" rx="1" />
                <rect class="sf-checkbox-fill" x="0" y="0" width="20" height="20" rx="2" />
                <path class="sf-checkbox-mark" d="M4 10 8 14 16 6" />
              </svg>
            </span>
          </button>
        </div>
      </TransitionGroup>
    </div>

    <!-- VerticalFastScroller track & thumb: 28dp hit target, 12dp x 48dp thumb, 6dp radius, primary color. -->
    <div
      class="sf-fast-scroll"
      :class="{ 'is-visible': thumbVisible }"
      @pointerdown="startDrag"
      @pointermove="onDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <div
        class="sf-thumb"
        :style="{ transform: `translateY(${thumbTop}px)` }"
      />
    </div>

    <!-- Material 3 toast/snackbar -->
    <Transition name="sf-fade">
      <div v-if="snackbar" class="sf-snackbar" role="status" aria-live="polite">{{ snackbar }}</div>
    </Transition>
  </div>
</template>

<style scoped>
/* SourcesFilterScreen: the Scaffold body below the app bar owns the rest of the viewport. */
.sf-screen {
  position: relative;
  height: calc(100dvh - var(--v-layout-top, 64px));
  background: rgb(var(--v-theme-background));
}

/* FastScrollLazyColumn: the list scrolls inside the screen with native scrollbar hidden. */
.sf-scroll {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sf-scroll::-webkit-scrollbar {
  display: none;
}
.sf-rows { position: relative; display: block; }
.sf-row { display: block; }

/* animateItem(): appearing and disappearing rows fade, the remaining rows slide into place. */
.sf-item-enter-active, .sf-item-leave-active { transition: opacity .2s ease; }
.sf-item-enter-from, .sf-item-leave-to { opacity: 0; }
.sf-item-leave-active { position: absolute; width: 100%; }
.sf-item-move { transition: transform .2s ease; }

/* SwitchPreferenceWidget -> BasePreferenceWidget:
   Row(sizeIn(minHeight = 56dp), fillMaxWidth, vertically centered),
   title Text(titleLarge with fontSize 16sp, horizontal padding 16dp, maxLines 2) inside a
   Column(weight 1f, vertical padding 16dp), widget Box(padding end = 16dp) with the
   Switch(padding start = 16dp). */
.sf-pref {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 0;
  border: none;
  background: none;
  text-align: start;
  font-family: inherit;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.sf-pref:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.sf-pref:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.sf-pref:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.sf-pref-title {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  padding: 16px;
  font-size: 16px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.sf-pref-widget { flex: 0 0 auto; padding-inline-end: 16px; }

/* Material3 Switch (SwitchDefaults / SwitchTokens):
   track 52x32dp (radius 16), 2dp outline on the unselected track, thumb 16dp off / 24dp on,
   unchecked track = surfaceContainerHighest, unchecked thumb = outline,
   checked track = primary (transparent border), checked thumb = onPrimary. */
.sf-switch { display: inline-flex; padding-inline-start: 16px; }
.sf-switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 52px;
  height: 32px;
  border-radius: 16px;
  /* Unchecked: track = surfaceContainerHighest with a 2dp outline border. */
  background: rgb(var(--v-theme-surface-container-highest));
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-outline));
  box-sizing: border-box;
  transition: background-color .2s cubic-bezier(.2, 0, 0, 1), box-shadow .2s cubic-bezier(.2, 0, 0, 1);
}
.sf-switch-thumb {
  position: absolute;
  /* Unchecked thumb: 16dp at the track padding start = (32 - 16) / 2 = 8dp. */
  left: 8px;
  top: 8px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(var(--v-theme-outline));
  color: rgb(var(--v-theme-on-primary-container));
  transition: transform .2s cubic-bezier(.2, 0, 0, 1), width .15s .05s cubic-bezier(0, 0, .2, 1), height .15s .05s cubic-bezier(0, 0, .2, 1), top .15s .05s cubic-bezier(0, 0, .2, 1), background-color .2s;
}
/* The reference Switch has no thumbContent, so the thumb carries no check mark. */
/* Checked: track = primary with a transparent border, thumb = onPrimary.
   The checked thumb is 24dp and sits at x = 52 - 24 - 4 = 24dp, i.e. 16dp right of the
   unchecked position. */
.sf-switch.is-on .sf-switch-track { background: rgb(var(--v-theme-primary)); box-shadow: inset 0 0 0 2px transparent; }
.sf-switch.is-on .sf-switch-thumb { width: 24px; height: 24px; top: 4px; transform: translateX(16px); background: rgb(var(--v-theme-on-primary)); }

/* BaseBrowseItem: Row(horizontal padding 16dp, vertical padding 8dp), vertically centered.
   The content column itself carries the 16dp horizontal padding, so the row only pads vertically. */
.sf-source {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 16px;
  box-sizing: border-box;
  border: none;
  background: none;
  text-align: start;
  font-family: inherit;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.sf-source:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.sf-source:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.sf-source:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

/* SourceIcon: `modifier.then(defaultModifier)` = size(48.dp) then height(40.dp).aspectRatio(1f).
   The width stays fixed at 48dp and the height becomes 40dp, so the icon is a 40x40 image
   centered in a 48x40 slot. */
.sf-source-icon-wrap {
  position: relative;
  flex: 0 0 auto;
  width: 48px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sf-source-icon { width: 40px; height: 40px; object-fit: contain; display: block; }
.sf-source-icon-fallback { font-size: 24px; line-height: 40px; color: rgb(var(--v-theme-on-surface-variant)); }

/* BaseSourceItem content: Column(padding horizontal 16dp, weight 1f) with a bodyMedium name. */
.sf-source-name {
  flex: 1 1 0;
  min-width: 0;
  margin: 0 16px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .0178571em;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Checkbox (material3 legacy path: containerSize 20dp, padding 2dp, radius 2dp, stroke 2dp):
   the reference passes onCheckedChange = null, so material3 does not apply the 48dp minimum touch
   target and the composable is the 20dp canvas plus the 2dp legacy padding. Unchecked: a
   transparent box with a 2dp outline drawn on an 18dp rect (radius 1dp). Checked: a solid primary
   20dp box (radius 2dp) with an on-primary mark. */
.sf-checkbox-slot { flex: 0 0 auto; width: 24px; height: 24px; padding: 2px; box-sizing: border-box; }
.sf-checkbox { width: 20px; height: 20px; display: block; overflow: visible; }
.sf-checkbox-box { fill: transparent; stroke: rgb(var(--v-theme-on-surface-variant)); stroke-width: 2; }
.sf-checkbox-fill { fill: rgb(var(--v-theme-primary)); display: none; }
.sf-checkbox-mark {
  fill: none;
  stroke: rgb(var(--v-theme-on-primary));
  stroke-width: 2;
  stroke-linecap: square;
  stroke-linejoin: miter;
  opacity: 0;
  transition: opacity .1s;
}
.sf-checkbox.is-checked .sf-checkbox-box { display: none; }
.sf-checkbox.is-checked .sf-checkbox-fill { display: block; }
.sf-checkbox.is-checked .sf-checkbox-mark { opacity: 1; }
.sf-source:hover .sf-checkbox-box { stroke: rgb(var(--v-theme-on-surface)); }

/* LoadingScreen: Box(fillMaxSize, contentAlignment = Center) with CircularProgressIndicator. */
.sf-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* VerticalFastScroller track: 28dp width (8dp horizontal padding + 12dp thumb),
   full height, positioned on the right edge. */
.sf-fast-scroll {
  position: absolute;
  top: 0;
  right: 0;
  width: 28px;
  height: 100%;
  z-index: 4;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease-out;
  touch-action: none;
}
.sf-fast-scroll.is-visible {
  opacity: 1;
  pointer-events: auto;
}

/* VerticalFastScroller thumb: height 48dp, thickness 12dp, radius 6dp, primary color,
   8dp away from the right edge of the list (the reference pads the thumb by 8dp). */
.sf-thumb {
  position: absolute;
  top: 0;
  right: 8px;
  width: 12px;
  height: 48px;
  border-radius: 6px;
  background: rgb(var(--v-theme-primary));
  cursor: pointer;
  user-select: none;
}

/* MD3 snackbar for the web-only notice and the reference error toast. */
.sf-snackbar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: min(560px, calc(100vw - 32px));
  min-width: 288px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}

.sf-fade-enter-active, .sf-fade-leave-active { transition: opacity 0.15s ease; }
.sf-fade-enter-from, .sf-fade-leave-to { opacity: 0; }
</style>
