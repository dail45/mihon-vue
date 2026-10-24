<script setup lang="ts">
/**
 * Open source licenses screen — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/about/OpenSourceLicensesScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   AboutLibraries 15.3.0 (compose M3 variant) — the list/sheet rendering used by Mihon
 *
 * Reference structure (OpenSourceLicensesScreen.kt):
 *   Scaffold(topBar = AppBar(title = "Open source licenses", navigateUp = pop))
 *     LibrariesContainer(
 *       libraries = produceLibraries(R.raw.aboutlibraries),
 *       detailMode = LibraryDetailMode.Sheet,
 *     )
 *
 * AboutLibraries defaults used by that call:
 *   variant = Traditional, density = Cozy, actionMode = Chips,
 *   badges  = version + author + license (description = false, funding = false),
 *   detail  = LibraryDetailMode.Sheet (ModalBottomSheet with a drag handle).
 *
 * The web build has no `R.raw.aboutlibraries` artifact (the AboutLibraries Gradle plugin only
 * exists in the Android build), so the list is rendered from the licenses that actually ship in
 * this web client (npm dependencies of package.json), using the same Traditional row layout,
 * the same license hue palette and the same modal bottom sheet detail.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'

import apacheLicenseText from '../../licenses/Mihon-APACHE-2.0.txt?raw'
import oflLicenseText from '../../licenses/Roboto-OFL-1.1.txt?raw'

interface LibraryEntry {
  /** AboutLibraries `Library.name`. */
  name: string
  /** AboutLibraries `Library.artifactVersion` — rendered with FontFamily.Monospace. */
  version: string
  /** AboutLibraries `Library.author`. */
  author: string
  /** AboutLibraries `Library.description` — shown in the sheet only (row badge = false). */
  description: string
  /** SPDX id of the first license — drives the license badge hue. */
  spdxId: string
  /** AboutLibraries `Library.licenses[].name` — the badge label. */
  licenseName: string
  /** AboutLibraries `Library.licenses[].url`. */
  licenseUrl: string
  /** AboutLibraries `Library.website`. */
  website: string
  /** AboutLibraries `Library.licenseContent` — the body shown in the sheet. */
  licenseContent: string
}

/** MIT license body (AboutLibraries ships the full text for MIT-licensed packages). */
const mitLicense = (copyright: string) => `MIT License

Copyright (c) ${copyright}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`

const libraries: LibraryEntry[] = [
  {
    name: '@fontsource/roboto',
    version: '5.3.0',
    author: 'The Roboto Project Authors',
    description: 'Self-hosted Roboto font files served from the application bundle.',
    spdxId: 'OFL-1.1',
    licenseName: 'OFL-1.1',
    licenseUrl: 'https://openfontlicense.org',
    website: 'https://fonts.google.com/specimen/Roboto',
    licenseContent: oflLicenseText,
  },
  {
    name: '@playwright/test',
    version: '1.64.1',
    author: 'Microsoft Corporation',
    description: 'End-to-end test runner used by the regression suite.',
    spdxId: 'Apache-2.0',
    licenseName: 'Apache-2.0',
    licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    website: 'https://playwright.dev',
    licenseContent: apacheLicenseText,
  },
  {
    name: '@vitejs/plugin-vue',
    version: '6.0.10',
    author: 'Vite Team',
    description: 'Official Vue plugin for Vite, providing single-file component compilation.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://github.com/vitejs/vite-plugin-vue',
    licenseContent: mitLicense('Vite Team'),
  },
  {
    name: 'marked',
    version: '15.0.12',
    author: 'MarkedJS',
    description: 'Markdown parser used to render release notes and notices.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://marked.js.org',
    licenseContent: mitLicense('MarkedJS'),
  },
  {
    name: 'material-symbols',
    version: '0.40.2',
    author: 'Google',
    description: 'Material Symbols font subset shipped with the application for its icons.',
    spdxId: 'Apache-2.0',
    licenseName: 'Apache-2.0',
    licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    website: 'https://fonts.google.com/icons',
    licenseContent: apacheLicenseText,
  },
  {
    name: 'ofetch',
    version: '1.5.1',
    author: 'Pooya Parsa',
    description: 'Fetch wrapper used by the Suwayomi REST client.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://github.com/unjs/ofetch',
    licenseContent: mitLicense('Pooya Parsa'),
  },
  {
    name: 'pinia',
    version: '3.0.4',
    author: 'Eduardo San Martin',
    description: 'State management store used for preferences and server state.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://pinia.vuejs.org',
    licenseContent: mitLicense('Eduardo San Martin'),
  },
  {
    name: 'sass',
    version: '1.105.1',
    author: 'Natalie Weizenbaum and the Dart Sass Team',
    description: 'Sass compiler used to build the application stylesheets.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://sass-lang.com',
    licenseContent: mitLicense('Natalie Weizenbaum and the Dart Sass Team'),
  },
  {
    name: 'typescript',
    version: '5.9.3',
    author: 'Microsoft Corporation',
    description: 'TypeScript compiler and type checker used for the build.',
    spdxId: 'Apache-2.0',
    licenseName: 'Apache-2.0',
    licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    website: 'https://www.typescriptlang.org',
    licenseContent: apacheLicenseText,
  },
  {
    name: 'vite',
    version: '7.3.7',
    author: 'Vite Team',
    description: 'Development server and production bundler.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://vite.dev',
    licenseContent: mitLicense('Vite Team'),
  },
  {
    name: 'vitest',
    version: '3.2.7',
    author: 'Vitest Team',
    description: 'Unit test runner used by the component test suite.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://vitest.dev',
    licenseContent: mitLicense('Vitest Team'),
  },
  {
    name: 'vue',
    version: '3.5.44',
    author: 'Evan You',
    description: 'Vue 3 reactivity and component runtime.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://vuejs.org',
    licenseContent: mitLicense('Evan You'),
  },
  {
    name: 'vue-router',
    version: '4.6.4',
    author: 'Eduardo San Martin',
    description: 'Client side router used by every screen of the application.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://router.vuejs.org',
    licenseContent: mitLicense('Eduardo San Martin'),
  },
  {
    name: 'vue-tsc',
    version: '3.3.13',
    author: 'Vue Language Tools',
    description: 'Vue aware TypeScript checker used by the type check step.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://github.com/vuejs/language-tools',
    website: 'https://github.com/vuejs/language-tools',
    licenseContent: mitLicense('Vue Language Tools'),
  },
  {
    name: 'vuetify',
    version: '4.2.5',
    author: 'John Leider',
    description: 'Material Design 3 component framework used for the whole interface.',
    spdxId: 'MIT',
    licenseName: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    website: 'https://vuetifyjs.com',
    licenseContent: mitLicense('John Leider'),
  },
]

/**
 * AboutLibraries `Library.scm.url` — the source repository of each library. The detail sheet
 * renders the "Source" chip before "Website" (LibraryActions.kt:68).
 */
const SOURCE_URLS: Record<string, string> = {
  '@fontsource/roboto': 'https://github.com/fontsource/font-source',
  '@playwright/test': 'https://github.com/microsoft/playwright',
  '@vitejs/plugin-vue': 'https://github.com/vitejs/vite-plugin-vue',
  'marked': 'https://github.com/markedjs/marked',
  'material-symbols': 'https://github.com/material-components/material-symbols',
  'ofetch': 'https://github.com/unjs/ofetch',
  'pinia': 'https://github.com/vuejs/pinia',
  'sass': 'https://github.com/sass/sass',
  'typescript': 'https://github.com/microsoft/TypeScript',
  'vite': 'https://github.com/vitejs/vite',
  'vitest': 'https://github.com/vitest-dev/vitest',
  'vue': 'https://github.com/vuejs/core',
  'vue-router': 'https://github.com/vuejs/router',
  'vue-tsc': 'https://github.com/vuejs/language-tools',
  'vuetify': 'https://github.com/vuetifyjs/vuetify',
}

/**
 * AboutLibraries M3 license hue palette (m3_tokens.kt) — the badge container is the hue at
 * 15% alpha and the badge content is the hue itself.
 */
const HUE_DARK: Record<string, string> = {
  'Apache-2.0': '#B69CFF',
  'MIT': '#7AC0FF',
  'EPL-2.0': '#E4A56A',
  'EPL-1.0': '#E4A56A',
  'BSD-3-Clause': '#8AD4A4',
  'BSD-2-Clause': '#8AD4A4',
  'GPL-3.0': '#FF8E8E',
  'GPL-3.0-only': '#FF8E8E',
  'GPL-3.0-or-later': '#FF8E8E',
  'GPL-2.0': '#FF8E8E',
  'LGPL-2.1': '#FFB088',
  'LGPL-3.0': '#FFB088',
  'MPL-2.0': '#FFD27A',
  'ISC': '#7AC0FF',
  'Unlicense': '#B7B7B7',
  'CC0-1.0': '#B7B7B7',
  'OFL-1.1': '#B7B7B7',
}
const HUE_LIGHT: Record<string, string> = {
  'Apache-2.0': '#5030BB',
  'MIT': '#1560A8',
  'EPL-2.0': '#8F4C0A',
  'EPL-1.0': '#8F4C0A',
  'BSD-3-Clause': '#1E6B3D',
  'BSD-2-Clause': '#1E6B3D',
  'GPL-3.0': '#BB2222',
  'GPL-3.0-only': '#BB2222',
  'GPL-3.0-or-later': '#BB2222',
  'GPL-2.0': '#BB2222',
  'LGPL-2.1': '#963F18',
  'LGPL-3.0': '#963F18',
  'MPL-2.0': '#7A5400',
  'ISC': '#1560A8',
  'Unlicense': '#5A5A5A',
  'CC0-1.0': '#5A5A5A',
  'OFL-1.1': '#5A5A5A',
}

const theme = useTheme()
const router = useRouter()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})
const isDark = computed(() => theme.global.current.value?.dark ?? false)

function hueFor(spdxId: string): string {
  const palette = isDark.value ? HUE_DARK : HUE_LIGHT
  return palette[spdxId] ?? (isDark.value ? '#B7B7B7' : '#5A5A5A')
}

const isScrolled = ref(false)
const sheetOpen = ref(false)
const selected = ref<LibraryEntry | null>(null)

// Touch drag / swipe-down to dismiss the sheet (>56dp threshold, matching M3 AnchoredDraggable).
const dragStartY = ref<number | null>(null)
const dragOffsetY = ref(0)
const isDragging = ref(false)

function onTouchStart(e: TouchEvent) {
  dragStartY.value = e.touches[0]?.clientY ?? null
  dragOffsetY.value = 0
  isDragging.value = true
}

function onTouchMove(e: TouchEvent) {
  if (dragStartY.value === null) return
  const currentY = e.touches[0]?.clientY ?? dragStartY.value
  const delta = currentY - dragStartY.value
  dragOffsetY.value = delta > 0 ? delta : 0
}

function onTouchEnd() {
  if (dragOffsetY.value > 56) {
    closeSheet()
  }
  dragStartY.value = null
  dragOffsetY.value = 0
  isDragging.value = false
}

function openSheet(entry: LibraryEntry) {
  selected.value = entry
  dragOffsetY.value = 0
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  dragOffsetY.value = 0
}

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function goBack() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  void router.push('/about')
}

function handleScroll() {
  isScrolled.value = window.scrollY > 0
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && sheetOpen.value) {
    e.stopPropagation()
    closeSheet()
  }
}

onMounted(() => {
  if (!props.embedded) {
    document.body.classList.add('licenses-screen-active')
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (!props.embedded) {
    document.body.classList.remove('licenses-screen-active')
  }
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section class="licenses-screen" :class="{ 'licenses-screen--embedded': embedded }">
    <!-- AppBar.kt: TopAppBar, 64dp, surfaceColorAtElevation(0dp) = surface, elevated to surfaceContainer on scroll. -->
    <header v-if="!embedded" class="licenses-toolbar" :class="{ 'is-scrolled': isScrolled }">
      <!-- UpIcon: MaterialSymbols.AutoMirroredRounded.ArrowBack (action_bar_up_description = "Navigate up"). -->
      <v-btn
        icon="arrow_back"
        variant="text"
        aria-label="Navigate up"
        title="Navigate up"
        class="licenses-nav-btn"
        @click="goBack"
      />
      <h1 class="licenses-toolbar-title">Open source licenses</h1>
    </header>

    <!-- LibrariesContainer: LazyColumn, background = colorScheme.background, contentPadding. -->
    <div class="licenses-list">
      <!-- TraditionalRow: Column(fillMaxWidth, padding 20dp/14dp, spacedBy 4dp), clickable surface. -->
      <button
        v-for="entry in libraries"
        :key="entry.name"
        type="button"
        class="library-row"
        :aria-label="`${entry.name} ${entry.version}`"
        @click="openSheet(entry)"
      >
        <!-- Row 1: name (titleMedium 16sp/24sp w500, onSurface) + version (labelSmall 11sp, monospace). -->
        <span class="library-row__line">
          <span class="library-row__name">{{ entry.name }}</span>
          <span class="library-row__version">{{ entry.version }}</span>
        </span>
        <!-- Row 2: author (bodySmall 11sp, subtle onSurfaceVariant). -->
        <span class="library-row__author">{{ entry.author }}</span>
        <!-- Row 3: license badges (FlowRow, spacedBy 6dp). -->
        <span class="library-row__badges">
          <span
            class="licenses-license-badge"
            :style="{ backgroundColor: `color-mix(in srgb, ${hueFor(entry.spdxId)} 15%, transparent)`, color: hueFor(entry.spdxId) }"
          >{{ entry.licenseName }}</span>
        </span>
      </button>
    </div>

    <!-- LibraryDetailMode.Sheet: ModalBottomSheet (surfaceContainerHigh, 28dp top corners, 40% scrim). -->
    <v-bottom-sheet
      v-model="sheetOpen"
      class="licenses-sheet"
      content-class="licenses-sheet__content"
      aria-label="Library details"
      @keydown.esc="closeSheet"
    >
      <div
        class="licenses-sheet__body"
        :style="{ transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined }"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      >
        <!-- DefaultDragHandle: 32dp x 4dp, radius 2dp, onSurfaceVariant @ 0.4. -->
        <div class="licenses-sheet__handle-wrapper" aria-hidden="true">
          <div class="licenses-sheet__handle" />
        </div>

        <!-- LibrarySheetDetail: Column(spacedBy 12dp), padding start 24 / top 8 / end 24 / bottom 28. -->
        <div v-if="selected" class="licenses-sheet__content-inner">
          <!-- Sheet Header: Title, version & close button (крестик). -->
          <div class="licenses-sheet__header">
            <div class="licenses-sheet__header-text">
              <h2 class="licenses-sheet__title">{{ selected.name }}</h2>
              <p class="licenses-sheet__meta">
                {{ selected.author }} · <span class="licenses-sheet__version">{{ selected.version }}</span>
              </p>
            </div>
            <button
              type="button"
              class="licenses-sheet__close-btn"
              aria-label="Close"
              title="Close"
              @click="closeSheet"
            >
              <v-icon icon="close" size="24" />
            </button>
          </div>

          <!-- Description -->
          <p v-if="selected.description" class="licenses-sheet__description">{{ selected.description }}</p>

          <!-- LibraryActions: Outlined chips with open_in_new icons for source/website, filled chip for license. -->
          <div class="licenses-sheet__actions">
            <button
              v-if="SOURCE_URLS[selected.name]"
              type="button"
              class="licenses-action-chip"
              @click="openUrl(SOURCE_URLS[selected.name]!)"
            >
              <span>Source</span>
              <v-icon icon="open_in_new" size="16" />
            </button>
            <button
              v-if="selected.website"
              type="button"
              class="licenses-action-chip"
              @click="openUrl(selected.website)"
            >
              <span>Website</span>
              <v-icon icon="open_in_new" size="16" />
            </button>
            <button
              v-if="selected.licenseUrl"
              type="button"
              class="licenses-action-chip licenses-action-chip--filled"
              @click="openUrl(selected.licenseUrl)"
            >
              <span>View license</span>
              <v-icon icon="open_in_new" size="16" />
            </button>
          </div>

          <!-- License content box: monospace, surfaceContainerHighest, 16dp radius, 16dp padding. -->
          <pre class="licenses-sheet__license">{{ selected.licenseContent }}</pre>
        </div>
      </div>
    </v-bottom-sheet>
  </section>
</template>

<style>
/* The shared shell bar is hidden while this screen provides its own top bar (OpenSourceLicensesScreen.kt). */
body.licenses-screen-active .app-toolbar { display: none; }
</style>

<style scoped>
.licenses-screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-surface));
}

/* AppBar.kt / TopAppBar: 64dp tall, container surfaceColorAtElevation(0dp) = surface. */
.licenses-toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.licenses-toolbar.is-scrolled {
  background: rgb(var(--v-theme-surface-container));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Up button: 48x48dp touch target, centered 24dp arrow_back icon. */
.licenses-nav-btn {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 24px;
  color: rgb(var(--v-theme-on-surface));
}

/* TopAppBar title slot uses titleLarge (22sp / 28sp, weight 400). */
.licenses-toolbar-title {
  flex: 1 1 auto;
  margin: 0;
  padding: 0 12px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* LibraryListScaffold: LazyColumn background = colorScheme.background, items top aligned. */
.licenses-list {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  background: rgb(var(--v-theme-background));
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

/* TraditionalRow: Column(fillMaxWidth, padding horizontal 20dp / vertical 14dp, spacedBy 4dp). */
.library-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-bottom: 1px solid color-mix(in srgb, rgb(var(--v-theme-outline-variant)) 40%, transparent);
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
  cursor: pointer;
  font: inherit;
  transition: background-color 0.15s ease;
}

.library-row:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, rgb(var(--v-theme-surface)));
}

.library-row:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, rgb(var(--v-theme-surface)));
}

/* Row 1: name + trailing version. */
.library-row__line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

/* nameTextStyle: titleMedium (16sp / 24sp, weight 500, onSurface), single line with ellipsis. */
.library-row__name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* versionTextStyle: labelSmall 11sp, FontFamily.Monospace. */
.library-row__version {
  flex: 0 0 auto;
  font-size: 11px;
  line-height: 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* authorTextStyle: bodySmall 11sp, lineHeight 16sp, subtle color. */
.library-row__author {
  font-size: 11px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Row 3: license badge FlowRow (spacedBy 6dp). */
.library-row__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

/* LicenseBadge: 50% rounded shape (pill), hue at 15% alpha container, hue content, padding 10dp/3dp. */
.licenses-license-badge {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<style>
/* LibraryDetailSheet: containerColor = surfaceContainerHigh, 28dp top corners, scrim at 40%. */
.licenses-sheet .v-overlay__scrim {
  background-color: rgba(0, 0, 0, 0.4) !important;
}

.licenses-sheet .v-bottom-sheet__content {
  border-top-left-radius: 28px !important;
  border-top-right-radius: 28px !important;
  background: rgb(var(--v-theme-surface-container-high)) !important;
  color: rgb(var(--v-theme-on-surface));
  max-width: 640px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  overflow: hidden;
}

.licenses-sheet__body {
  display: flex;
  flex-direction: column;
  transition: transform 0.1s ease-out;
}

/* DefaultDragHandle: 32dp x 4dp, radius 2dp, onSurfaceVariant at 40%. */
.licenses-sheet__handle-wrapper {
  display: flex;
  justify-content: center;
  width: 100%;
  padding-top: 12px;
  padding-bottom: 8px;
  cursor: grab;
  touch-action: none;
}

.licenses-sheet__handle {
  width: 32px;
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 40%, transparent);
}

/* LibrarySheetDetail: Column(spacedBy 12dp), padding start 24 / top 8 / end 24 / bottom 28. */
.licenses-sheet__content-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 24px 28px;
}

/* Sheet Header: title + close button */
.licenses-sheet__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.licenses-sheet__header-text {
  flex: 1 1 auto;
  min-width: 0;
}

/* sheetTitleTextStyle: titleLarge 22sp, SemiBold. */
.licenses-sheet__title {
  margin: 0;
  font-size: 22px;
  line-height: 28px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-word;
}

/* sheetMetaTextStyle: bodyMedium 13sp, subtle color. */
.licenses-sheet__meta {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.licenses-sheet__version {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Close button (крестик): 48x48dp touch target, centered 24dp icon. */
.licenses-sheet__close-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: -8px -8px 0 0;
  padding: 0;
  border: none;
  border-radius: 24px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
}

.licenses-sheet__close-btn::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 20px;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.licenses-sheet__close-btn:hover::before {
  opacity: 0.08;
}

.licenses-sheet__close-btn:active::before {
  opacity: 0.12;
}

/* sheetBodyTextStyle: bodyMedium 14sp, lineHeight 20sp, onSurface. */
.licenses-sheet__description {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface));
}

/* LibraryActions (Chips): horizontal row, spacedBy 8dp, vertically centered. */
.licenses-sheet__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* ActionChip: radius 8dp, padding horizontal 12dp / vertical 6dp, labelLarge 12sp Medium. */
.licenses-action-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.licenses-action-chip:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.licenses-action-chip:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

/* Filled chip: primary container, onPrimary content, no border. */
.licenses-action-chip--filled {
  border-color: transparent;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.licenses-action-chip--filled:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-primary)) 12%, rgb(var(--v-theme-primary)));
}

.licenses-action-chip--filled:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-primary)) 16%, rgb(var(--v-theme-primary)));
}

/* License body box: surfaceContainerHighest, 16dp radius, 16dp padding, 12sp monospace text. */
.licenses-sheet__license {
  width: 100%;
  margin: 0;
  padding: 16px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 40vh;
  overflow-y: auto;
}
</style>
