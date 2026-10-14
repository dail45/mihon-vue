<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useReaderStore } from '../stores/reader'
import { useReaderPreferences } from '../stores/readerPreferences'
import ReaderSettingsDialog from '../components/reader/ReaderSettingsDialog.vue'
const route = useRoute(), router = useRouter(), server = useSuwayomiStore(), reader = useReaderStore(), preferences = useReaderPreferences()
const controls = ref(true), settings = ref(false), chaptersOpen = ref(false), viewport = ref<HTMLElement | null>(null)
const loaded = ref(new Set<number>()), failed = ref(new Set<number>()), revisions = ref<Record<number, number>>({})
const modeIsWebtoon = computed(() => preferences.mode === 'webtoon')
const resumePage = ref<number | null>(null)
let touchStart: { x: number; y: number } | null = null, animationFrame = 0
const saveLabel = computed(() => reader.saveError ? 'Progress not saved' : reader.pendingWrites ? 'Saving to server…' : reader.lastSavedPage !== null ? `Page ${reader.lastSavedPage + 1} saved on server` : preferences.saveProgress ? 'Progress saves after a page loads' : 'Automatic progress saving is off')
watch(() => [route.params.id, route.params.chapterIndex, server.apiUrl], async (_value, _old, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  loaded.value = new Set(); failed.value = new Set(); revisions.value = {}; controls.value = true
  await reader.open(server.apiUrl, Number(route.params.id), Number(route.params.chapterIndex))
  if (!active) return
  resumePage.value = modeIsWebtoon.value ? reader.pageIndex : null
  await nextTick(); if (active) scrollToCurrent()
}, { immediate: true })
watch(() => preferences.mode, async mode => { resumePage.value = mode === 'webtoon' ? reader.pageIndex : null; await nextTick(); scrollToCurrent() })
watch(() => preferences.saveProgress, enabled => { if (enabled) maybeSave(reader.pageIndex) })
function maybeSave(index: number) { if (preferences.saveProgress && loaded.value.has(index)) void reader.savePage(index) }
function eventMatchesPage(event: Event, index: number) {
  return (event.target as HTMLImageElement).src === new URL(reader.pageUrl(index, revisions.value[index]), window.location.href).href
}
function imageLoaded(index: number, event: Event) {
  if (!eventMatchesPage(event, index)) return
  loaded.value = new Set([...loaded.value, index]); failed.value.delete(index)
  if (modeIsWebtoon.value && resumePage.value === index) {
    void nextTick().then(() => { reader.setPage(index); scrollToCurrent(); resumePage.value = null; maybeSave(index) })
  } else if (index === reader.pageIndex && resumePage.value === null) maybeSave(index)
  if (modeIsWebtoon.value) scheduleScroll()
}
function imageFailed(index: number, event: Event) { if (!eventMatchesPage(event, index)) return; failed.value = new Set([...failed.value, index]); loaded.value.delete(index) }
function retryImage(index: number) { failed.value.delete(index); revisions.value = { ...revisions.value, [index]: (revisions.value[index] || 0) + 1 } }
function scrollToCurrent() {
  if (modeIsWebtoon.value) viewport.value?.querySelector<HTMLElement>(`[data-page="${reader.pageIndex}"]`)?.scrollIntoView({ block: 'start' })
  else if (viewport.value) viewport.value.scrollTop = 0
}
async function goPage(index: number) {
  reader.setPage(index)
  await nextTick(); scrollToCurrent(); maybeSave(reader.pageIndex)
}
function turn(delta: number) { void goPage(reader.pageIndex + delta) }
function goChapter(index: number) { chaptersOpen.value = false; void router.replace(`/manga/${route.params.id}/read/${index}`) }
function scheduleScroll() {
  if (!modeIsWebtoon.value || resumePage.value !== null || animationFrame) return
  animationFrame = requestAnimationFrame(() => {
    animationFrame = 0
    const view = viewport.value
    if (!view) return
    const center = view.getBoundingClientRect().top + view.clientHeight * .45
    const pages = [...view.querySelectorAll<HTMLElement>('[data-page]')]
    const active = pages.find(p => { const box = p.getBoundingClientRect(); return box.top <= center && box.bottom >= center })
    if (active) { reader.setPage(Number(active.dataset.page)); maybeSave(reader.pageIndex) }
  })
}
function onKey(event: KeyboardEvent) {
  if (settings.value || chaptersOpen.value || (event.target as HTMLElement)?.closest('input, textarea, select, [role="slider"], [role="menu"]')) return
  if (event.key === 'Escape') { controls.value = true; return }
  if (event.key === ' ' && !(event.target as HTMLElement)?.closest('button, a')) { event.preventDefault(); controls.value = !controls.value }
  if (modeIsWebtoon.value) return
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault(); const delta = event.key === 'ArrowRight' ? 1 : -1
    turn(preferences.mode === 'rtl' ? -delta : delta)
  }
}
function touchDown(e: TouchEvent) { const t = e.touches[0]; touchStart = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null }
function touchUp(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!touchStart || !t || modeIsWebtoon.value) return
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y
  touchStart = null
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn((dx < 0 ? 1 : -1) * (preferences.mode === 'rtl' ? -1 : 1))
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(animationFrame); reader.close() })
</script>
<template>
  <v-theme-provider theme="mihonDark">
  <section class="reader v-theme--mihonDark" :class="[`reader-background-${preferences.background}`, { 'reader-fit-width': preferences.fit === 'width', 'reader-webtoon': modeIsWebtoon }]" aria-label="Manga reader">
    <div v-show="controls" class="reader-topbar" role="toolbar" aria-label="Reader controls">
      <v-btn icon="arrow_back" variant="text" :to="`/manga/${route.params.id}`" aria-label="Back to manga" />
      <div class="reader-heading"><h1 class="text-body-large font-weight-medium text-truncate">{{ reader.manga?.title || 'Reader' }}</h1><p class="text-body-medium text-truncate">{{ reader.chapter?.name || (reader.loading ? 'Loading chapter…' : 'Chapter unavailable') }}</p></div>
      <v-menu><template #activator="{ props }"><v-btn v-bind="props" icon="bookmark_border" variant="text" :disabled="!reader.chapter || !!reader.saveError || !!reader.pendingWrites" aria-label="Chapter bookmark actions" /></template><v-list><v-list-item title="Add bookmark on server" prepend-icon="bookmark_add" @click="reader.bookmark(true)"/><v-list-item title="Remove bookmark on server" prepend-icon="bookmark_remove" @click="reader.bookmark(false)"/></v-list></v-menu>
      <v-btn icon="settings" variant="text" aria-label="Reader settings" @click="settings = true" />
    </div>
    <div v-if="reader.loading" class="reader-message" role="status"><v-progress-circular indeterminate color="primary" size="40"/><p class="mt-4">Loading chapter from Suwayomi…</p></div>
    <div v-else-if="reader.error" class="reader-message" role="alert"><v-icon icon="cloud_off" size="56"/><h2 class="text-title-large mt-4">Unable to open chapter</h2><p class="mt-2 mb-6">{{ reader.error }}</p><v-btn color="primary" variant="flat" rounded="pill" @click="reader.open(server.apiUrl, Number(route.params.id), Number(route.params.chapterIndex))">Try again</v-btn></div>
    <div v-else-if="!reader.pageCount" class="reader-message"><v-icon icon="auto_stories" size="56"/><h2 class="text-title-large mt-4">No pages returned</h2><p class="mt-2">Suwayomi returned an empty page list for this chapter.</p></div>
    <div v-else ref="viewport" class="reader-viewport" @scroll.passive="scheduleScroll" @touchstart.passive="touchDown" @touchend.passive="touchUp">
      <template v-if="!modeIsWebtoon">
        <div v-if="failed.has(reader.pageIndex)" class="reader-message" role="alert"><v-icon icon="broken_image" size="48"/><h2 class="text-title-large mt-4">Page {{ reader.pageIndex + 1 }} could not load</h2><p class="mt-2 mb-4">The source or server may be unavailable. Check your connection and Suwayomi logs, or retry this page.</p><v-btn color="primary" variant="flat" @click="retryImage(reader.pageIndex)">Retry page</v-btn></div>
        <button v-else class="reader-page-surface" aria-label="Toggle reading controls" @click="controls = !controls">
          <img :key="`${route.params.chapterIndex}-${reader.pageIndex}-${revisions[reader.pageIndex] || 0}`" :src="reader.pageUrl(reader.pageIndex, revisions[reader.pageIndex])" :alt="`Page ${reader.pageIndex + 1} of ${reader.pageCount}`" :data-page="reader.pageIndex" class="reader-page" @load="imageLoaded(Number(($event.target as HTMLImageElement).dataset.page), $event)" @error="imageFailed(Number(($event.target as HTMLImageElement).dataset.page), $event)" />
          <span v-if="!loaded.has(reader.pageIndex)" class="reader-image-loading" role="status">Loading page {{ reader.pageIndex + 1 }}…</span>
        </button>
      </template>
      <div v-else class="reader-strip">
        <div v-for="index in reader.pageCount" :key="`${route.params.chapterIndex}-${index}`" class="reader-strip-page" :data-page="index - 1">
          <div v-if="failed.has(index - 1)" class="reader-inline-error"><p>Page {{ index }} could not load.</p><v-btn color="primary" variant="flat" class="mt-4" @click="retryImage(index - 1)">Retry page {{ index }}</v-btn></div>
          <img v-else :key="revisions[index - 1] || 0" :src="reader.pageUrl(index - 1, revisions[index - 1])" :alt="`Page ${index} of ${reader.pageCount}`" :loading="index - 1 === reader.pageIndex ? 'eager' : 'lazy'" @load="imageLoaded(index - 1, $event)" @error="imageFailed(index - 1, $event)" @click="controls = !controls" />
        </div>
      </div>
    </div>
    <div v-if="reader.chapter && !reader.loading && reader.pageCount && !controls" class="reader-page-indicator text-body-medium" aria-live="polite">{{ reader.pageIndex + 1 }} / {{ reader.pageCount }}</div>
    <div v-show="controls" v-if="reader.chapter && reader.pageCount" class="reader-bottom" role="region" aria-label="Page navigation">
      <v-alert v-if="reader.saveError" type="warning" variant="tonal" class="mb-3 text-body-medium">{{ reader.saveError }}</v-alert>
      <p class="text-center text-body-medium mb-1">{{ reader.pageIndex + 1 }} / {{ reader.pageCount }}</p>
      <p class="text-body-medium reader-save-status mb-1" role="status">{{ reader.notice || saveLabel }}</p>
      <div class="d-flex align-center ga-2" :class="{ 'flex-row-reverse': preferences.mode === 'rtl' }">
        <v-btn :icon="preferences.mode === 'rtl' ? 'skip_next' : 'skip_previous'" variant="text" :disabled="!reader.previousChapter" aria-label="Previous chapter" @click="reader.previousChapter && goChapter(reader.previousChapter.index)"/>
        <span class="text-body-medium">1</span><v-slider :reverse="preferences.mode === 'rtl'" :model-value="reader.pageIndex" :min="0" :max="Math.max(0, reader.pageCount - 1)" :step="1" :disabled="reader.pageCount <= 1" color="primary" track-color="on-surface-variant" hide-details aria-label="Page position" @update:model-value="goPage"/><span class="text-body-medium">{{ reader.pageCount }}</span>
        <v-btn :icon="preferences.mode === 'rtl' ? 'skip_previous' : 'skip_next'" variant="text" :disabled="!reader.nextChapter" aria-label="Next chapter" @click="reader.nextChapter && goChapter(reader.nextChapter.index)"/>
      </div>
      <div class="d-flex align-center justify-space-between">
        <v-btn icon="chevron_left" variant="text" :disabled="preferences.mode === 'rtl' ? reader.pageIndex >= reader.pageCount - 1 : reader.pageIndex <= 0" :aria-label="preferences.mode === 'rtl' ? 'Next page' : 'Previous page'" @click="turn(preferences.mode === 'rtl' ? 1 : -1)"/>
        <v-btn icon="list" variant="text" aria-label="Chapter list" @click="chaptersOpen = true"/>
        <v-btn icon="save" variant="text" :disabled="!loaded.has(reader.pageIndex) || !!reader.pendingWrites" aria-label="Save current page on server" @click="reader.savePage(reader.pageIndex, true)"/>
        <v-btn :icon="modeIsWebtoon ? 'view_day' : preferences.mode === 'rtl' ? 'format_textdirection_r_to_l' : 'format_textdirection_l_to_r'" variant="text" aria-label="Change reading mode" @click="settings = true"/>
        <v-btn icon="chevron_right" variant="text" :disabled="preferences.mode === 'rtl' ? reader.pageIndex <= 0 : reader.pageIndex >= reader.pageCount - 1" :aria-label="preferences.mode === 'rtl' ? 'Previous page' : 'Next page'" @click="turn(preferences.mode === 'rtl' ? -1 : 1)"/>
      </div>
    </div>
    <v-btn v-if="!controls" class="reader-show-controls" icon="tune" color="surface-container" variant="flat" aria-label="Show reading controls" @click="controls = true" />
    <ReaderSettingsDialog v-model="settings" />
    <v-bottom-sheet v-model="chaptersOpen" max-width="640" scrollable>
      <v-card color="surface-container-high" rounded="t-xl"><v-card-title class="d-flex align-center justify-space-between">Chapters<v-btn icon="close" variant="text" aria-label="Close chapter list" @click="chaptersOpen = false"/></v-card-title><v-list max-height="440" class="bg-transparent"><v-list-item v-for="item in reader.orderedChapters" :key="item.id" :title="item.name" :active="item.index === reader.chapter?.index" color="primary" :prepend-icon="item.index === reader.chapter?.index ? 'play_arrow' : 'article'" @click="goChapter(item.index)"/></v-list></v-card>
    </v-bottom-sheet>
  </section>
  </v-theme-provider>
</template>
