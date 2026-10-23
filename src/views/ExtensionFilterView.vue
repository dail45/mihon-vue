<script setup lang="ts">
/**
 * Extension filter screen (Mihon "Extensions" -> overflow "Filter").
 *
 * Reference (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *  - `app/src/main/java/eu/kanade/presentation/browse/ExtensionFilterScreen.kt`
 *  - `app/src/main/java/eu/kanade/tachiyomi/ui/browse/extension/ExtensionFilterScreen.kt`
 *  - `app/src/main/java/eu/kanade/tachiyomi/ui/browse/extension/ExtensionFilterViewModel.kt`
 *  - `app/src/main/java/eu/kanade/domain/extension/interactor/GetExtensionLanguages.kt`
 *  - `app/src/main/java/eu/kanade/domain/source/interactor/ToggleLanguage.kt`
 *  - `app/src/main/java/eu/kanade/presentation/more/settings/widget/SwitchPreferenceWidget.kt`
 *  - `app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt`
 *  - `app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt`
 *  - `app/src/main/java/eu/kanade/tachiyomi/util/system/LocaleHelper.kt`
 *  - `presentation-core/.../screens/EmptyScreen.kt`, `.../screens/LoadingScreen.kt`
 *  - `presentation-core/.../components/material/Scaffold.kt`
 *
 * Structure (top -> bottom):
 *  - AppBar: material3 TopAppBar (container = surface at elevation 0, height 64), up button and
 *    the title "Extensions" (`MR.strings.label_extensions`). The web shell owns that bar, so the
 *    route has to be registered with `meta: { title: 'Extensions', detail: true }`.
 *  - Body: `LazyColumn(contentPadding = contentPadding)` with one `SwitchPreferenceWidget` per
 *    language, `Modifier.animateItem()` so the rows slide when the order changes.
 *  - Empty state (`state.isEmpty`, i.e. no languages at all): `EmptyScreen(MR.strings.empty_screen)`
 *    = "Well, this is awkward" plus a random kaomoji face.
 *  - Loading state (Voyager wrapper): centred `CircularProgressIndicator` (LoadingScreen).
 *  - Error state (Voyager wrapper): `MR.strings.internal_error`
 *    = "InternalError: Check crash logs for further information".
 *
 * Data: `GetExtensionLanguages` collects the languages of the sources of the available
 * extensions and sorts them with `compareBy { it !in enabledLanguage }.then(LocaleHelper.comparator)`
 * (enabled languages first, then "all"/Multi first, then the localized display name).
 * Suwayomi reports the same information per source (`/source/list`) and per extension
 * (`/extension/list`), so both lists feed the language set here.
 *
 * The enabled-language set itself (`SourcePreferences.enabledLanguages`, preference key
 * "source_languages") has no Suwayomi REST contract, so it is kept in browser storage under
 * the same key the source filter screen uses and every toggle explains that the setting stays
 * in this browser.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useSuwayomiStore } from '../stores/suwayomi'
import { fetchExtensionList, type ExtensionDto } from '../api/extensions'

const server = useSuwayomiStore()

/** Suwayomi reports the local source with lang "localsourcelang"; Mihon's LocalSource uses "other". */
const LOCAL_LANG = 'localsourcelang'

/**
 * Mihon keys the local source under "other", so both spellings have to end up in the same
 * row ("Other", MR.strings.other_source) instead of two identical rows.
 */
function normalizeLang(lang: string): string {
  if (!lang) return 'other'
  return lang === LOCAL_LANG ? 'other' : lang
}

/** Mihon's `SourcePreferences.enabledLanguages` preference key ("source_languages"). */
const LANGUAGES_KEY = 'mihon.sourceLanguages'

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
if (!enabledLanguages.value.length) enabledLanguages.value = defaultEnabledLanguages()

/** The extensions the server knows about (`/extension/list`). */
const extensions = ref<ExtensionDto[]>([])
const loadingExtensions = ref(true)

async function loadExtensionLanguages() {
  loadingExtensions.value = true
  try {
    extensions.value = await fetchExtensionList(server.apiUrl)
  } catch {
    extensions.value = []
    // ExtensionFilterEvent.FailedFetchingLanguages -> MR.strings.internal_error
    notify('InternalError: Check crash logs for further information')
  } finally {
    loadingExtensions.value = false
  }
}

/**
 * LocaleHelper.getSourceDisplayName(lang, context):
 * "other" -> "Other" (MR.strings.other_source), "all" -> "Multi" (MR.strings.multi_lang),
 * otherwise `LocaleHelper.getLocalizedDisplayName(lang)`, i.e. the locale display name in its
 * own language with an uppercased first letter.
 */
function languageDisplayName(lang: string): string {
  if (!lang) return 'Other'
  if (lang === LOCAL_LANG || lang === 'other') return 'Other'
  if (lang === 'all') return 'Multi'
  const normalized = lang === 'zh-CN' ? 'zh-Hans' : lang === 'zh-TW' ? 'zh-Hant' : lang
  try {
    // `locale.getDisplayName(locale)` = the language name in its own language.
    const name = new Intl.DisplayNames([normalized], { type: 'language' }).of(normalized)
    if (name && name !== normalized) return name.charAt(0).toUpperCase() + name.slice(1)
  } catch { /* Intl.DisplayNames cannot resolve this tag */ }
  return normalized.toUpperCase()
}

/** LocaleHelper.comparator: "all" first, then the localized display name (plain compareTo). */
function compareLanguages(a: string, b: string) {
  if (a === 'all') return -1
  if (b === 'all') return 1
  const aName = languageDisplayName(a)
  const bName = languageDisplayName(b)
  if (aName < bName) return -1
  if (aName > bName) return 1
  return 0
}

/**
 * The languages of the screen: the languages of the sources of the available extensions plus
 * the languages the extensions themselves are tagged with ("all", "other", ...), distinct.
 * The local source is not an extension in Mihon, so it never contributes a language here.
 */
const languages = computed<string[]>(() => {
  const all = new Set<string>()
  for (const extension of extensions.value) {
    all.add(normalizeLang(extension.lang))
  }
  for (const source of server.sources) {
    // The local source is not part of any extension in Mihon.
    if (source.id === '0' || source.lang === LOCAL_LANG) continue
    all.add(normalizeLang(source.lang))
  }
  return [...all]
})

/** GetExtensionLanguages: enabled languages first, then LocaleHelper.comparator. */
const orderedLanguages = computed<string[]>(() => {
  const enabled = new Set(enabledLanguages.value)
  return languages.value.slice().sort((a, b) => {
    const aEnabled = enabled.has(a) ? 0 : 1
    const bEnabled = enabled.has(b) ? 0 : 1
    if (aEnabled !== bEnabled) return aEnabled - bEnabled
    return compareLanguages(a, b)
  })
})

const loading = computed(() => server.loadingSources || loadingExtensions.value)
/** `ExtensionFilterState.Success.isEmpty` = languages.isEmpty(). */
const isEmpty = computed(() => !loading.value && orderedLanguages.value.length === 0)

/** ToggleLanguage.await(language): toggles the membership in the "source_languages" preference. */
function toggleLanguage(language: string) {
  const next = enabledLanguages.value.includes(language)
    ? enabledLanguages.value.filter(item => item !== language)
    : [...enabledLanguages.value, language]
  enabledLanguages.value = next
  writeList(LANGUAGES_KEY, next)
  notifyOnce('The language filter is stored in this browser only - the Suwayomi REST API has no source language filter.')
}

function isLanguageEnabled(language: string) { return enabledLanguages.value.includes(language) }

/** EmptyScreen picks a random face (presentation-core/.../screens/EmptyScreen.kt). */
const errorFaces = ['(･o･;)', 'Σ(ಠ_ಠ)', 'ಥ_ಥ', '(˘･_･˘)', '(；￣Д￣)', '(･Д･。', '(╬ಠ益ಠ)', '(╥﹏╥)', '(⋟﹏⋞)', 'Ò︵Ó', ' ˙ᯅ˙)', '(¬_¬)']
const face = errorFaces[Math.floor(Math.random() * errorFaces.length)]

/** Snackbar used for the web-only notice and for the reference error string. */
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
  // ExtensionFilterEvent.FailedFetchingLanguages -> MR.strings.internal_error
  notify('InternalError: Check crash logs for further information')
})
watch(() => server.apiUrl, () => { void loadExtensionLanguages() })
onMounted(() => {
  void loadExtensionLanguages()
  if (!server.sources.length && !server.loadingSources) void server.loadSources()
})
</script>

<template>
  <div class="ef-screen">
    <!-- LoadingScreen: Box(fillMaxSize) with a centered CircularProgressIndicator. -->
    <div v-if="loading" class="ef-loading" role="status" aria-label="Loading extensions">
      <v-progress-circular indeterminate color="primary" size="40" width="4" />
    </div>

    <!-- EmptyScreen: Column(fillMaxSize, horizontal padding 24dp) centered. -->
    <div v-else-if="isEmpty" class="ef-empty">
      <p class="ef-empty-face">{{ face }}</p>
      <p class="ef-empty-message">Well, this is awkward</p>
    </div>

    <!-- LazyColumn: one SwitchPreferenceWidget per language. -->
    <div v-else class="ef-scroll">
      <TransitionGroup name="ef-item" tag="div" class="ef-rows">
        <button
          v-for="language in orderedLanguages"
          :key="language"
          type="button"
          class="ef-pref"
          role="switch"
          :aria-checked="isLanguageEnabled(language)"
          @click="toggleLanguage(language)"
        >
          <span class="ef-pref-title">{{ languageDisplayName(language) }}</span>
          <span class="ef-pref-widget">
            <!-- Switch(checked, onCheckedChange = null): 52x32 track, 16dp/24dp thumb. -->
            <span class="ef-switch" :class="{ 'is-on': isLanguageEnabled(language) }" aria-hidden="true">
              <span class="ef-switch-track">
                <span class="ef-switch-thumb">
                  <svg class="ef-switch-mark" viewBox="0 0 24 24" focusable="false">
                    <path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z" fill="currentColor" />
                  </svg>
                </span>
              </span>
            </span>
          </span>
        </button>
      </TransitionGroup>
    </div>

    <div v-if="snackbar" class="ef-snackbar" role="status" aria-live="polite">{{ snackbar }}</div>
  </div>
</template>

<style scoped>
/* ExtensionFilterScreen: the Scaffold body below the app bar owns the rest of the viewport. */
.ef-screen {
  position: relative;
  height: calc(100dvh - 64px);
  background: rgb(var(--v-theme-background));
}

/* LazyColumn(contentPadding = contentPadding): the list scrolls inside the screen. */
.ef-scroll { height: 100%; overflow-y: auto; overscroll-behavior: contain; }
.ef-rows { position: relative; display: block; }

/* animateItem(): appearing and disappearing rows fade, the remaining rows slide into place. */
.ef-item-enter-active, .ef-item-leave-active { transition: opacity .2s ease; }
.ef-item-enter-from, .ef-item-leave-to { opacity: 0; }
.ef-item-leave-active { position: absolute; width: 100%; }
.ef-item-move { transition: transform .2s ease; }

/* SwitchPreferenceWidget -> TextPreferenceWidget -> BasePreferenceWidget:
   Row(sizeIn(minHeight = 56dp), fillMaxWidth, vertically centered),
   Column(weight 1f, padding vertical = 16dp) with
   title Text(titleLarge with fontSize 16sp, horizontal padding 16dp, maxLines 2, ellipsis),
   widget Box(padding end = 16dp) with Switch(padding start = 16dp).
   The whole row is the click target; the Switch itself is not interactive. */
.ef-pref {
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
}
.ef-pref:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
/* The pressed state layer of the clickable row (M3 onSurface at 12%). */
.ef-pref:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.ef-pref:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.ef-pref-title {
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
.ef-pref-widget { flex: 0 0 auto; padding-inline-end: 16px; }

/* Material3 Switch (SwitchTokens, androidx compose material3):
   track 52x32dp (radius full), thumb 16dp off / 24dp on,
   the thumb sits 8dp from the start edge when off and 4dp from the end edge when on,
   checked thumb = onPrimary with the check mark in onPrimaryContainer,
   unchecked track = surfaceContainerHighest, unchecked thumb = outline,
   unchecked track outline = outline 2dp, checked track outline = transparent. */
.ef-switch { display: inline-flex; padding-inline-start: 16px; }
.ef-switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 52px;
  height: 32px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-highest));
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-outline));
  box-sizing: border-box;
  transition: background-color .2s cubic-bezier(.2, 0, 0, 1), box-shadow .2s cubic-bezier(.2, 0, 0, 1);
}
.ef-switch-thumb {
  position: absolute;
  left: 8px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(var(--v-theme-outline));
  color: rgb(var(--v-theme-on-primary-container));
  transition: transform .2s cubic-bezier(.2, 0, 0, 1), width .15s .05s cubic-bezier(0, 0, .2, 1), height .15s .05s cubic-bezier(0, 0, .2, 1), background-color .2s;
}
.ef-switch-mark { width: 16px; height: 16px; opacity: 0; transition: opacity .15s; }
.ef-switch.is-on .ef-switch-track { background: rgb(var(--v-theme-primary)); box-shadow: none; }
.ef-switch.is-on .ef-switch-thumb { width: 24px; height: 24px; transform: translateX(16px); background: rgb(var(--v-theme-on-primary)); }
.ef-switch.is-on .ef-switch-mark { opacity: 1; }

/* LoadingScreen: Box(fillMaxSize) with a centered CircularProgressIndicator. */
.ef-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* EmptyScreen: Column(fillMaxSize, verticalScroll, horizontal padding 24dp) centered.
   The face is displayMedium (45sp / 52sp) and the message bodyMedium (14sp / 20sp,
   tracking 0.0178571em), both with the secondary item alpha (0.78). */
.ef-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 24px;
  overflow-y: auto;
  text-align: center;
}
.ef-empty-face {
  margin: 0;
  font-size: 45px;
  line-height: 52px;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
}
.ef-empty-message {
  /* paddingFromBaseline(top = 24.dp): the message baseline sits 24dp below the face
     baseline, i.e. 4dp above the bottom of the 52dp face line box. */
  margin: -4px 0 0;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: .0178571em;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
}

/* MD3 snackbar for the web-only notice and the reference error string. */
.ef-snackbar {
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
</style>
