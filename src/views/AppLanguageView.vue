<script setup lang="ts">
/**
 * App language screen.
 *
 * Reference: `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/appearance/AppLanguageScreen.kt`
 * (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1) and the helpers it uses:
 *  - `eu/kanade/tachiyomi/util/system/LocaleHelper.kt` (`getLocalizedDisplayName`, `getDisplayName`)
 *  - `eu/kanade/presentation/components/AppBar.kt` (`AppBar`, `UpIcon`)
 *  - `tachiyomi/presentation/core/components/material/Scaffold.kt` (containerColor = background)
 *  - `gradle/build-logic/.../GenerateLocalesConfigTask.kt` + `i18n/src/commonMain/moko-resources/*`
 *    (the list of shipped translations = `res/xml/locales_config.xml`)
 *
 * Reference behaviour & metrics:
 *  - TopAppBar: height 64dp, surface background at elevation 0, title `MR.strings.pref_app_language`
 *    = "App language" in typography titleLarge (22sp/28sp w400 onSurface), UpIcon (arrow_back 24dp)
 *    in 48x48dp IconButton with M3 state layers (8% hover, 12% active), contentDescription
 *    `MR.strings.action_bar_up_description` = "Navigate up".
 *  - Body: `LazyColumn` of material3 `ListItem`s, one per shipped translation plus "Default".
 *  - Every `ListItem`:
 *    * Headline: localized display name of the language (`LocaleHelper.getLocalizedDisplayName`,
 *      e.g. "Deutsch", "Русский"), bodyLarge (16sp/24sp w400 onSurface).
 *    * Supporting: language name in device locale (`LocaleHelper.getDisplayName`, e.g. "German",
 *      "Russian"), bodyMedium (14sp/20sp w400 onSurfaceVariant).
 *    * The "Default" entry (`MR.strings.label_default` = "Default") has no supporting content
 *      and measures as a one-line item (min-height 56dp).
 *    * Two-line items measure as min-height 72dp.
 *    * Trailing slot: `MaterialSymbols.Rounded.Check` icon (24dp) tinted with primary color
 *      when `currentLanguage == it.langTag`.
 *    * Horizontal content padding: 16dp start/end (`ListItemDefaults.ContentPadding`).
 *    * Vertical padding: 8dp for single-line / 10dp for two-line.
 *    * State layers: 8% onSurface hover, 12% onSurface active.
 *    * Clicking a row immediately applies the locale (`AppCompatDelegate.setApplicationLocales`),
 *      saves to browser localStorage, and triggers navigation up when `popOnSelect` is enabled.
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { appLanguages, normalizeLocaleTag } from '../utils/appLanguage'
import { setAppLanguage, t, MR } from '../i18n'

const props = withDefaults(defineProps<{
  popOnSelect?: boolean
}>(), {
  popOnSelect: false,
})

const emit = defineEmits<{
  (e: 'navigateUp'): void
  (e: 'select', tag: string): void
}>()

const router = useRouter()

/** The selected application locale, stored in this browser (Mihon keeps it in the app locales). */
const STORAGE_KEY = 'mihon.appLanguage'

const deviceLocale = typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en'

const languages = computed(() => appLanguages(deviceLocale))

function readSelection(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? '' } catch { return '' }
}

const currentLanguage = ref('')

/**
 * `LaunchedEffect(currentLanguage)` applies the locale right away. The web client has no
 * `AppCompatDelegate`, so the locale is stored in the browser and applied to the document, which
 * changes the locale used for dates and numbers.
 */
function applyLocale(tag: string) {
  currentLanguage.value = tag
  try { localStorage.setItem(STORAGE_KEY, tag) } catch { /* storage unavailable */ }
  const effective = tag ? normalizeLocaleTag(tag) : (deviceLocale || 'en')
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', effective)
  }
}

function handleNavigateUp() {
  emit('navigateUp')
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/settings/appearance')
  }
}

function selectLanguage(tag: string) {
  applyLocale(tag)
  void setAppLanguage(tag)
  emit('select', tag)
  const langName = tag ? (languages.value.find(l => l.tag === tag)?.displayName ?? tag) : (t(MR.strings.label_default) || 'Default')
  notify(langName)
  if (props.popOnSelect) {
    handleNavigateUp()
  }
}

onMounted(() => {
  currentLanguage.value = readSelection()
})

/** MD3 snackbar (inverse surface, 4dp radius) for the web-only notice. */
const snackbar = ref('')
let snackbarTimer: number | undefined
function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 5000)
}
</script>

<template>
  <div class="al-screen">
    <!-- AppBar.kt: TopAppBar (64dp) with up button and pref_app_language title. -->
    <header class="al-topbar appearance-language-bar" role="banner">
      <button
        type="button"
        class="al-topbar__up appearance-language-bar__up"
        aria-label="Navigate up"
        title="Navigate up"
        @click="handleNavigateUp"
      >
        <v-icon icon="arrow_back" size="24" class="al-topbar__icon" />
      </button>
      <h1 class="al-topbar__title appearance-language-bar__title">{{ t(MR.strings.pref_app_language) || 'App language' }}</h1>
    </header>

    <!-- LazyColumn of material3 ListItems. -->
    <main class="al-scroll">
      <ul class="al-list appearance-language-list" role="listbox" aria-label="App language">
        <li v-for="language in languages" :key="language.tag" role="none">
          <button
            type="button"
            role="option"
            class="al-item appearance-language-item"
            :class="{ 'al-item--two-line': !!language.localizedDisplayName }"
            :aria-selected="currentLanguage === language.tag"
            @click="selectLanguage(language.tag)"
          >
            <span class="al-text appearance-language-item__text">
              <span class="al-headline appearance-language-item__headline">{{ language.tag === '' ? (t(MR.strings.label_default) || language.displayName) : language.displayName }}</span>
              <span
                v-if="language.localizedDisplayName"
                class="al-supporting appearance-language-item__supporting"
              >
                {{ language.localizedDisplayName }}
              </span>
            </span>
            <!-- MaterialSymbols.Rounded.Check, 24dp, tinted with the primary color. -->
            <v-icon
              v-if="currentLanguage === language.tag"
              icon="check"
              size="24"
              color="primary"
              class="al-trailing appearance-language-item__check"
            />
          </button>
        </li>
      </ul>
    </main>

    <div v-if="snackbar" class="al-snackbar" role="status" aria-live="polite">{{ snackbar }}</div>
  </div>
</template>

<style scoped>
/* Scaffold(containerColor = background). */
.al-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100dvh;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

/* AppBar: Material 3 TopAppBar, height 64dp, surface container elevation 0. */
.al-topbar,
.appearance-language-bar {
  display: flex;
  align-items: center;
  height: 64px;
  min-height: 64px;
  padding: 0 4px;
  box-sizing: border-box;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  z-index: 2;
}

/* IconButton: 48x48dp interactive touch target, 40x40dp state layer, 24dp icon. */
.al-topbar__up,
.appearance-language-bar__up {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.al-topbar__up:hover,
.appearance-language-bar__up:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.al-topbar__up:active,
.appearance-language-bar__up:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.al-topbar__up:focus-visible,
.appearance-language-bar__up:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.al-topbar__icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

/* AppBarTitle: titleLarge (22sp / 28sp w400). */
.al-topbar__title,
.appearance-language-bar__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 12px 0 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* LazyColumn container: takes remaining viewport height. */
.al-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 24%, transparent) transparent;
}
.al-list,
.appearance-language-list {
  margin: 0;
  padding: 0 0 16px 0;
  list-style: none;
}

/* Material 3 ListItem:
   - One-line item (Default): min-height 56dp, padding 8dp 16dp
   - Two-line item: min-height 72dp, padding 10dp 16dp
   - 16dp horizontal padding (ListItemDefaults.ContentPadding)
   - 16dp gap between text and trailing checkmark
   - Trailing check icon 24dp */
.al-item,
.appearance-language-item {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 56px;
  padding: 8px 16px;
  box-sizing: border-box;
  border: none;
  background: transparent;
  text-align: start;
  font-family: inherit;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.al-item--two-line,
.appearance-language-item {
  min-height: 72px;
  padding: 10px 16px;
}
.al-item:not(.al-item--two-line) {
  min-height: 56px;
  padding: 8px 16px;
}
/* M3 state layers: hover 8%, active 12%. */
.al-item:hover,
.appearance-language-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.al-item:active,
.appearance-language-item:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.al-item:focus-visible,
.appearance-language-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.al-text,
.appearance-language-item__text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ItemLabelTextFont = bodyLarge (16sp / 24sp, letterSpacing 0.5sp, w400). */
.al-headline,
.appearance-language-item__headline {
  display: block;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ItemSupportingTextFont = bodyMedium (14sp / 20sp, letterSpacing 0.25sp, w400). */
.al-supporting,
.appearance-language-item__supporting {
  display: block;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.al-trailing,
.appearance-language-item__check {
  flex: 0 0 auto;
  font-size: 24px;
  width: 24px;
  height: 24px;
  color: rgb(var(--v-theme-primary));
}

/* MD3 snackbar: inverse surface, 4dp radius, 14sp/20sp text. */
.al-snackbar {
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
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
