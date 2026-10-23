<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AdaptiveSettingsSheet from '../AdaptiveSettingsSheet.vue'
import { useReaderPreferences } from '../../stores/readerPreferences'
import { readPreference } from '../../stores/preferences'
import ReadingModePage from './ReadingModePage.vue'
import GeneralSettingsPage from './GeneralSettingsPage.vue'
import ColorFilterPage from './ColorFilterPage.vue'
import { useColorFilter } from './useColorFilter'

/**
 * Reader settings dialog.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/reader/settings/ReaderSettingsDialog.kt
 * (Mihon 446f6df) — a TabbedDialog (AdaptiveSheet + PrimaryTabRow + HorizontalPager) whose three
 * pages are:
 *   0 -> ReadingModePage.kt
 *   1 -> GeneralSettingsPage.kt
 *   2 -> ColorFilterPage.kt
 */

const props = defineProps<{
  mangaId?: number
}>()

const emit = defineEmits<{
  (e: 'closed'): void
}>()

const open = defineModel<boolean>({ required: true })
const reader = useReaderPreferences()

watch(open, v => {
  if (!v) emit('closed')
})

const tab = ref('reading mode')
const tabTitles = ['Reading mode', 'General', 'Custom filter']

// --- Page 2: ColorFilterPage.kt state for reader content overlay -------------------------
const {
  customBrightness,
  customBrightnessValue,
  grayscale,
  invertedColors,
} = useColorFilter()

// --- reader side effects -----------------------------------------------------------------
// ReaderActivity.kt: the brightness dim and the colour filter rect are painted by
// `ReaderContentOverlay`, which the reader view mounts over the page. The settings
// dialog writes preferences; the overlay component and CSS properties apply them.
function syncImageFilters() {
  const root = document.documentElement
  root.style.setProperty('--reader-brightness', customBrightness.value && customBrightnessValue.value > 0 ? String(customBrightnessValue.value / 100) : '1')
  root.style.setProperty('--reader-grayscale', grayscale.value ? '1' : '0')
  root.style.setProperty('--reader-invert', invertedColors.value ? '1' : '0')
  const pad = readPreference('mihon.reader.webtoonPadding') ?? '0'
  root.style.setProperty('--reader-webtoon-padding', `${pad}%`)
  document.querySelector('.reader')?.classList.toggle('reader-hide-page-number', !reader.showPageNumber)
}

watch([customBrightness, customBrightnessValue, grayscale, invertedColors, () => reader.showPageNumber], syncImageFilters)

// Keep screen on uses the browser Screen Wake Lock API (GeneralSettingsPage.kt pref_keep_screen_on).
let wakeLock: { release: () => Promise<void> } | null = null
async function acquireWakeLock() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen')
  } catch { /* the wake lock is optional and may be denied by the browser */ }
}
function releaseWakeLock() {
  void wakeLock?.release()
  wakeLock = null
}
function onVisibilityChange() {
  if (document.visibilityState === 'visible' && reader.keepScreenOn) void acquireWakeLock()
}
watch(() => reader.keepScreenOn, enabled => { if (enabled) void acquireWakeLock(); else releaseWakeLock() })

onMounted(() => {
  syncImageFilters()
  if (reader.keepScreenOn) void acquireWakeLock()
  document.addEventListener('visibilitychange', onVisibilityChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  releaseWakeLock()
})
</script>

<template>
  <AdaptiveSettingsSheet v-model="open" v-model:tab="tab" title="Reader settings" :tabs="tabTitles" card-class="reader-settings-card" flat-tabs>
    <!-- Page 0: ReadingModePage.kt -->
    <section v-show="tab === 'reading mode'" class="reader-settings-page" aria-label="Reading mode settings">
      <ReadingModePage :manga-id="mangaId" @change-mode="syncImageFilters" />
    </section>

    <!-- Page 1: GeneralSettingsPage.kt -->
    <section v-show="tab === 'general'" class="reader-settings-page" aria-label="General reader settings">
      <GeneralSettingsPage />
    </section>

    <!-- Page 2: ColorFilterPage.kt -->
    <section v-show="tab === 'custom filter'" class="reader-settings-page" aria-label="Custom filter settings">
      <ColorFilterPage />
    </section>
  </AdaptiveSettingsSheet>
</template>

<style scoped>
@layer app-components {
/* TabbedDialog(modifier = Modifier.heightIn(max = maxHeight * 0.75f)). */
:deep(.reader-settings-card) { max-height: 75dvh; }
}
</style>

<style>
/* Reader viewer effects driven by the reader settings dialog (ReaderView markup only). */
.reader-page,
.reader-strip img {
  filter: brightness(var(--reader-brightness, 1)) grayscale(var(--reader-grayscale, 0)) invert(var(--reader-invert, 0));
}
.reader-strip {
  padding-left: var(--reader-webtoon-padding, 0%);
  padding-right: var(--reader-webtoon-padding, 0%);
}
.reader-hide-page-number .reader-bottom p.text-center { display: none; }
</style>