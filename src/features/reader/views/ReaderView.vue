<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useReaderStore } from '../stores/reader'
import { useReaderPreferences } from '../stores/readerPreferences'
import { readPreference } from '@/features/settings/stores/preferences'
import ReaderTopBar from '@/features/reader/components/ReaderTopBar.vue'
import ReaderBottomBar from '@/features/reader/components/ReaderBottomBar.vue'
import ChapterNavigator, { type ChapterNavigatorType } from '@/features/reader/components/ChapterNavigator.vue'
import ReaderPageIndicator from '@/features/reader/components/ReaderPageIndicator.vue'
import ReaderContentOverlay from '@/features/reader/components/ReaderContentOverlay.vue'
import ReaderSettingsDialog from '@/features/reader/components/ReaderSettingsDialog.vue'
import ReadingModeSelectDialog from '@/features/reader/components/ReadingModeSelectDialog.vue'
import OrientationSelectDialog from '@/features/reader/components/OrientationSelectDialog.vue'
import ReaderPageActionsDialog from '@/features/reader/components/ReaderPageActionsDialog.vue'
import ChapterTransition from '@/features/reader/components/ChapterTransition.vue'
import { useReaderKeybindings } from '../composables/useReaderKeybindings'
import { useReaderFullscreen } from '../composables/useReaderFullscreen'

/**
 * Mihon reference:
 *  - eu/kanade/tachiyomi/ui/reader/ReaderActivity.kt (screen composition and behaviour)
 *  - eu/kanade/presentation/reader/appbars/ReaderAppBars.kt (the bar layout)
 *
 * The reference composes the screen as:
 *
 *   Box(Modifier.fillMaxSize()) {
 *       if (!state.menuVisible && showPageNumber) {
 *           ReaderPageIndicator(currentPage, totalPages, align BottomCenter + navigationBarsPadding)
 *       }
 *       ContentOverlay(state)
 *       AppBars(state)
 *   }
 *
 * and `AppBars` renders `ReaderAppBars`:
 *
 *   Column(Modifier.fillMaxHeight()) {
 *       AnimatedVisibility(visible) { ReaderTopBar(...) }            // slide + fade
 *       // the vertical chapter navigator row (VERTICAL_LEFT / VERTICAL_RIGHT)
 *       AnimatedVisibility(visible) {
 *           Column(verticalArrangement = spacedBy(MaterialTheme.padding.small)) {
 *               ChapterNavigator(type, currentPage, totalPages, ...)
 *               ReaderBottomBar(Modifier.fillMaxWidth().background(backgroundColor)
 *                   .padding(horizontal = MaterialTheme.padding.small)
 *                   .windowInsetsPadding(WindowInsets.navigationBars))
 *           }
 *       }
 *   }
 *
 * So the bottom area is exactly two rows - the chapter navigator and the bottom
 * bar, separated by 8.dp. Mihon's reader has no separate "next page" button, no
 * chapter list button and no save button: pages are turned with gestures or the
 * arrow keys and chapters are jumped with the navigator's skip buttons (or the
 * N / P keyboard shortcuts). The web-only helpers for those actions are kept
 * here as screen-reader-only controls so they do not change the layout.
 */
const route = useRoute(), router = useRouter(), server = useSuwayomiStore(), reader = useReaderStore(), preferences = useReaderPreferences()

/** Mihon: `state.menuVisible` - the bars are shown by default and toggled by a tap. */
const controls = ref(true)
const settings = ref(false), readingModeDialog = ref(false), orientationDialog = ref(false), pageActions = ref(false)
const chaptersOpen = ref(false)
const viewport = ref<HTMLElement | null>(null)
const toast = ref(''), toastOpen = ref(false)

const title = computed(() => reader.manga?.title ?? '')
const subtitle = computed(() => reader.chapter?.name ?? '')
const chapterUrl = computed(() => reader.chapter?.realUrl || reader.chapter?.url || '')

/* ------------------------------------------------------------- preferences */

/**
 * The reference reads its preferences through `ReaderPreferences`; this build keeps them in
 * `localStorage` under `mihon.reader.*` keys. `prefTick` re-reads them after a dialog wrote one.
 */
// preferences are reactively tracked via useReaderPreferences store
function refreshPrefs() { preferences.refresh() }

const showPageNumber = computed(() => {

  return preferences.showPageNumber
})
const readWithLongTap = computed(() => {

  return preferences.readWithLongTap
})
/** ReaderActivity.kt:452 - the pager uses `cropBorders`, the webtoon viewer `cropBordersWebtoon`. */
const cropEnabled = computed(() => {

  return modeIsWebtoon.value ? preferences.cropWebtoon : preferences.crop

})
const alwaysShowChapterTransition = computed(() => {

  return preferences.alwaysShowChapterTransition
})
const pagerTransition = ref<'prev' | 'next' | null>(null)
/** `ReaderOrientation.fromPreference(...)` flag values (ReaderOrientation.kt). */
const orientation = computed<'default' | 'free' | 'portrait' | 'landscape' | 'locked_portrait' | 'locked_landscape' | 'reverse_portrait'>(() => {

  return preferences.getOrientation(reader.manga?.id ?? 0)

})

/* ------------------------------------------------------------------ reader */

const loaded = ref(new Set<number>()), failed = ref(new Set<number>()), revisions = ref<Record<number, number>>({})
const modeIsWebtoon = computed(() => preferences.mode === 'webtoon')
/**
 * ReaderActivity.kt:455-488 - the vertical navigator is only used when the `verticalNavigator`
 * preference contains the current reading mode. The set holds ReadingMode values, so the modes
 * the web reader can reach are "Paged (left to right)", "Paged (right to left)" and "Long strip".
 * When the navigator is vertical it sits on the left (`verticalNavigatorOnLeft`) or on the right
 * and its height is `verticalNavigatorHeight` percent of the reader height.
 */
const verticalNavigatorModes = computed(() => preferences.verticalNavigator.split(',').filter(Boolean))
const currentModeKey = computed(() => (preferences.mode === 'webtoon' ? 'webtoon' : preferences.mode === 'rtl' ? 'rtl' : 'ltr'))
const useVerticalNavigator = computed(() => verticalNavigatorModes.value.includes(currentModeKey.value))
const navigatorType = computed<ChapterNavigatorType>(() => {
  if (useVerticalNavigator.value) return preferences.verticalNavigatorOnLeft ? 'vertical-left' : 'vertical-right'
  return preferences.mode === 'rtl' ? 'horizontal-rtl' : 'horizontal-ltr'
})
/** ReaderActivity.kt:488 - `verticalNavigatorHeight = verticalNavigatorHeight / 100f`. */
const verticalNavigatorHeightPercent = computed(() => preferences.verticalNavigatorHeight)
const resumePage = ref<number | null>(null)
let touchStart: { x: number; y: number } | null = null, animationFrame = 0, longTapTimer: number | undefined

const canBookmark = computed(() => !!reader.chapter && !reader.saveError && !reader.pendingWrites)
async function toggleBookmark() {
  if (!reader.chapter || !canBookmark.value) return
  await reader.bookmark(!reader.chapter.bookmarked)
}
function showToast(message: string) { toast.value = message; toastOpen.value = true }
/** ReaderActivity.kt:512 - toggling the crop borders shows a toast with the new state. */
function toggleCrop() {
  const next = !cropEnabled.value
  if (modeIsWebtoon.value) {
    preferences.cropWebtoon = next
  } else {
    preferences.crop = next
  }
  showToast(next ? 'On' : 'Off')
}

watch(() => [route.params.id, route.params.chapterIndex, server.apiUrl], async (_value, _old, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  loaded.value = new Set(); failed.value = new Set(); revisions.value = {}; controls.value = true
  pagerTransition.value = null
  await reader.open(server.apiUrl, Number(route.params.id), Number(route.params.chapterIndex))
  if (!active) return
  const storedMangaMode = readPreference(`mihon.reader.mode.${route.params.id}`)
  if (storedMangaMode === 'ltr' || storedMangaMode === 'rtl' || storedMangaMode === 'webtoon') {
    preferences.mode = storedMangaMode
  }
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
function imageFailed(index: number, event: Event) {
  if (!eventMatchesPage(event, index)) return
  const currentRetry = revisions.value[index] || 0
  if (currentRetry < 2) {
    setTimeout(() => { retryImage(index) }, 1500)
    return
  }
  failed.value = new Set([...failed.value, index])
  loaded.value.delete(index)
}
function retryImage(index: number) { failed.value.delete(index); revisions.value = { ...revisions.value, [index]: (revisions.value[index] || 0) + 1 } }
function scrollToCurrent() {
  if (modeIsWebtoon.value) viewport.value?.querySelector<HTMLElement>(`[data-page="${reader.pageIndex}"]`)?.scrollIntoView({ block: 'start' })
  else if (viewport.value) viewport.value.scrollTop = 0
}
async function goPage(index: number) {
  pagerTransition.value = null
  reader.setPage(index)
  await nextTick(); scrollToCurrent(); maybeSave(reader.pageIndex)
}
function turn(delta: number) {
  if (pagerTransition.value === 'prev') {
    if (delta > 0) {
      pagerTransition.value = null
      void goPage(0)
    } else if (reader.previousChapter) {
      pagerTransition.value = null
      goChapter(reader.previousChapter.index)
    }
    return
  }
  if (pagerTransition.value === 'next') {
    if (delta < 0) {
      pagerTransition.value = null
      void goPage(reader.pageCount - 1)
    } else if (reader.nextChapter) {
      pagerTransition.value = null
      goChapter(reader.nextChapter.index)
    }
    return
  }
  const target = reader.pageIndex + delta
  if (target < 0) {
    if (alwaysShowChapterTransition.value) {
      pagerTransition.value = 'prev'
    } else if (reader.previousChapter) {
      goChapter(reader.previousChapter.index)
    }
    return
  }
  if (target >= reader.pageCount) {
    if (alwaysShowChapterTransition.value) {
      pagerTransition.value = 'next'
    } else if (reader.nextChapter) {
      goChapter(reader.nextChapter.index)
    }
    return
  }
  void goPage(target)
}
function goChapter(index: number) { chaptersOpen.value = false; pagerTransition.value = null; void router.replace(`/manga/${route.params.id}/read/${index}`) }
function navigateUp() {
  if (typeof window.history.state?.back === 'string' && window.history.state.back.includes('/manga/')) {
    router.back()
  } else {
    void router.push(`/manga/${route.params.id}`)
  }
}
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

/* -------------------------------------------------------------------- flash */

/**
 * DisplayRefreshHost.kt: the reader paints a full screen rectangle over the page when the page
 * changes. The colour is black for `FlashColor.BLACK` and white for `WHITE`; `WHITE_BLACK`
 * paints white for the first half of the duration and black for the second half. The flash
 * happens on every `flashPageInterval`-th page change.
 */
const flashColor = ref<'black' | 'white' | null>(null)
let flashTimer: number | undefined, flashCount = 0
function clearFlashTimer() { if (flashTimer !== undefined) { window.clearTimeout(flashTimer); flashTimer = undefined } }
function flash() {
  if (!preferences.flashOnPageChange) return
  const interval = Math.max(1, preferences.flashInterval)
  if (flashCount % interval !== 0) { flashCount++; return }
  flashCount++
  const half = Math.max(1, preferences.flashDuration / 2)
  const mode = preferences.flashColor
  flashColor.value = mode === 'white' || mode === 'white_black' ? 'white' : 'black'
  clearFlashTimer()
  flashTimer = window.setTimeout(() => {
    if (mode === 'white_black') {
      flashColor.value = 'black'
      flashTimer = window.setTimeout(() => { flashColor.value = null; flashTimer = undefined }, half)
    } else {
      flashColor.value = null
      flashTimer = undefined
    }
  }, half)
}
watch(() => reader.pageIndex, () => flash())

/* ---------------------------------------------------------------- fullscreen */

useReaderFullscreen({
  fullscreen: () => preferences.fullscreen,
  onError: msg => showToast(msg),
})

/* --------------------------------------------------------- page transitions */

/**
 * ReaderPreferences.pageTransitions: the Android pager slides the pages. The web reader fades the
 * new page in instead, which is the closest CSS equivalent.
 */
const animatePages = computed(() => preferences.pageTransitions)

/* ---------------------------------------------------------------- keybindings & scrolling */

const { onKey, scrollDown, scrollUp } = useReaderKeybindings({
  isDialogActive: () => settings.value || readingModeDialog.value || orientationDialog.value || pageActions.value,
  chaptersOpen,
  controls,
  modeIsWebtoon: () => modeIsWebtoon.value,
  readingMode: () => preferences.mode,
  animatePages: () => animatePages.value,
  viewport,
  pageCount: () => reader.pageCount,
  hasNextChapter: () => !!reader.nextChapter,
  hasPreviousChapter: () => !!reader.previousChapter,
  onNextChapter: () => { if (reader.nextChapter) goChapter(reader.nextChapter.index) },
  onPreviousChapter: () => { if (reader.previousChapter) goChapter(reader.previousChapter.index) },
  onTurn: delta => turn(delta),
  onGoPage: page => { void goPage(page) },
})
/**
 * Gestures & Tap Zones:
 * Mirrors Mihon's `RightAndLeftNavigation` (ViewerNavigation.kt):
 * - Left 33%: LEFT action (prev page in LTR, next page in RTL, scroll up in Webtoon)
 * - Right 33%: RIGHT action (next page in LTR, prev page in RTL, scroll down in Webtoon)
 * - Center 34% (or top 5%): MENU action (toggle reading controls)
 * - InvertMode: optionally swaps left and right tap zones
 * - Long tap (500ms): opens ReaderPageActionsDialog on the selected page
 * - Desktop contextmenu (right-click): opens ReaderPageActionsDialog on the clicked page
 */
let touchMoved = false
let longTapFired = false
let suppressClickUntil = 0

function touchDown(e: TouchEvent) {
  const t = e.touches[0]
  if (!t) return
  touchStart = { x: t.clientX, y: t.clientY }
  touchMoved = false
  longTapFired = false
  window.clearTimeout(longTapTimer)

  const target = (e.target as HTMLElement)?.closest('[data-page]') as HTMLElement | null
  const targetPage = target?.dataset.page !== undefined ? Number(target.dataset.page) : null

  longTapTimer = window.setTimeout(() => {
    longTapTimer = undefined
    longTapFired = true
    suppressClickUntil = Date.now() + 400
    if (targetPage !== null && Number.isInteger(targetPage)) {
      reader.setPage(targetPage)
    }
    if (readWithLongTap.value) {
      pageActions.value = true
    } else {
      controls.value = !controls.value
    }
  }, 500)
}

function touchMove(e: TouchEvent) {
  if (!touchStart) return
  const t = e.touches[0]
  if (!t) return
  const dx = t.clientX - touchStart.x
  const dy = t.clientY - touchStart.y
  if (Math.hypot(dx, dy) > 8) {
    touchMoved = true
    window.clearTimeout(longTapTimer)
  }
}

function touchUp(e: TouchEvent) {
  window.clearTimeout(longTapTimer)
  longTapTimer = undefined
  const t = e.changedTouches[0]
  if (!touchStart || !t) return
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y
  touchStart = null
  if (longTapFired) return

  if (touchMoved && !modeIsWebtoon.value) {
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClickUntil = Date.now() + 400
      turn((dx < 0 ? 1 : -1) * (preferences.mode === 'rtl' ? -1 : 1))
    }
  }
}

function onContextMenu(event: MouseEvent) {
  if (readWithLongTap.value) {
    const target = (event.target as HTMLElement)?.closest('[data-page]') as HTMLElement | null
    if (target?.dataset.page !== undefined) {
      const pageIdx = Number(target.dataset.page)
      if (Number.isInteger(pageIdx)) {
        reader.setPage(pageIdx)
      }
    }
    pageActions.value = true
  }
}

function onViewerClick(event: MouseEvent) {
  if (Date.now() < suppressClickUntil || longTapFired) {
    longTapFired = false
    return
  }
  const target = event.target as HTMLElement | null
  if (target?.closest('button:not(.reader-page-surface), a, input, select, textarea, [role="button"]:not(.reader-page-surface), [role="slider"], .reader-bars, .reader-vertical-navigator, .v-overlay, .v-dialog, .v-bottom-sheet, .v-snackbar')) {
    return
  }

  const rect = viewport.value?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height

  const invertMode = readPreference('mihon.reader.tappingInverted') ?? 'none'
  const invertHorizontal = invertMode === 'horizontal' || invertMode === 'both'

  // Constant menu region: top 5% of height (ViewerNavigation.kt:33)
  if (y <= 0.05) {
    controls.value = !controls.value
    return
  }

  // RightAndLeftNavigation:
  // LEFT: 0..0.33, RIGHT: 0.66..1.0, MENU: 0.33..0.66
  let action: 'menu' | 'left' | 'right' = 'menu'
  if (x < 0.33) {
    action = invertHorizontal ? 'right' : 'left'
  } else if (x > 0.66) {
    action = invertHorizontal ? 'left' : 'right'
  }

  if (action === 'menu') {
    controls.value = !controls.value
  } else if (action === 'left') {
    if (modeIsWebtoon.value) {
      scrollUp()
    } else {
      turn(preferences.mode === 'rtl' ? 1 : -1)
    }
  } else if (action === 'right') {
    if (modeIsWebtoon.value) {
      scrollDown()
    } else {
      turn(preferences.mode === 'rtl' ? -1 : 1)
    }
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  cancelAnimationFrame(animationFrame)
  window.clearTimeout(longTapTimer)
  reader.close()
})
</script>

<template>
  <v-theme-provider theme="mihonDark">
  <section
    class="reader v-theme--mihonDark"
    :class="[
      `reader-background-${preferences.background}`,
      { 'reader-fit-width': preferences.fit === 'width', 'reader-webtoon': modeIsWebtoon, 'reader--crop-borders': cropEnabled }
    ]"
    aria-label="Manga reader"
  >
    <!-- ReaderActivity.kt: the viewer fills the whole screen; the bars are an overlay on top of it. -->
    <div
      ref="viewport"
      class="reader-viewport"
      @scroll.passive="scheduleScroll"
      @touchstart.passive="touchDown"
      @touchmove.passive="touchMove"
      @touchend.passive="touchUp"
      @click="onViewerClick"
    >
      <template v-if="!modeIsWebtoon">
        <!-- Pager chapter transition slide (PagerTransitionHolder.kt) -->
        <div
          v-if="pagerTransition && reader.chapter"
          class="reader-page-surface reader-page-surface--transition"
        >
          <ChapterTransition
            viewer-mode="pager"
            :transition="{
              type: pagerTransition,
              from: reader.chapter,
              to: pagerTransition === 'prev' ? reader.previousChapter : reader.nextChapter,
            }"
            :curr-chapter-downloaded="reader.chapter.downloaded"
            :going-to-chapter-downloaded="pagerTransition === 'prev' ? reader.previousChapter?.downloaded : reader.nextChapter?.downloaded"
          />
        </div>
        <div v-else-if="failed.has(reader.pageIndex)" class="reader-message" role="alert">
          <v-icon icon="broken_image" size="48"/>
          <h2 class="text-title-large mt-4">Page {{ reader.pageIndex + 1 }} could not load</h2>
          <p class="mt-2 mb-4">The source or server may be unavailable. Check your connection and the Suwayomi logs, or retry this page.</p>
          <v-btn color="primary" variant="flat" rounded="pill" @click.stop="retryImage(reader.pageIndex)">Retry page</v-btn>
        </div>
        <div
          v-else
          class="reader-page-surface"
          :class="{ 'reader-page-surface--animated': animatePages }"
          role="region"
          aria-label="Manga page surface"
          @contextmenu.prevent="onContextMenu"
        >
          <img
            :key="`${route.params.chapterIndex}-${reader.pageIndex}-${revisions[reader.pageIndex] || 0}`"
            :src="reader.pageUrl(reader.pageIndex, revisions[reader.pageIndex])"
            :alt="`Page ${reader.pageIndex + 1} of ${reader.pageCount}`"
            :data-page="reader.pageIndex"
            class="reader-page"
            @load="imageLoaded(Number(($event.target as HTMLImageElement).dataset.page), $event)"
            @error="imageFailed(Number(($event.target as HTMLImageElement).dataset.page), $event)"
          />
          <div v-if="!loaded.has(reader.pageIndex)" class="reader-image-loading" role="status">
            <v-progress-circular indeterminate color="primary" size="48" width="4" />
            <span class="reader-loading-text">Loading page {{ reader.pageIndex + 1 }}…</span>
          </div>
        </div>
      </template>
      <div v-else class="reader-strip" @contextmenu.prevent="onContextMenu">
        <!-- Webtoon chapter transition (Prev) at top of strip (WebtoonAdapter.kt) -->
        <ChapterTransition
          v-if="reader.chapter && (reader.previousChapter || alwaysShowChapterTransition)"
          viewer-mode="webtoon"
          :transition="{
            type: 'prev',
            from: reader.chapter,
            to: reader.previousChapter,
          }"
          :curr-chapter-downloaded="reader.chapter.downloaded"
          :going-to-chapter-downloaded="reader.previousChapter?.downloaded"
          @click.stop="reader.previousChapter && goChapter(reader.previousChapter.index)"
        />
        <div v-for="index in reader.pageCount" :key="`${route.params.chapterIndex}-${index}`" class="reader-strip-page" :data-page="index - 1">
          <div v-if="failed.has(index - 1)" class="reader-inline-error">
            <p class="text-body-medium">Page {{ index }} could not load.</p>
            <v-btn color="primary" variant="flat" rounded="pill" class="mt-4" @click.stop="retryImage(index - 1)">Retry page {{ index }}</v-btn>
          </div>
          <div v-else class="reader-strip-image-wrap">
            <img
              :key="revisions[index - 1] || 0"
              :src="reader.pageUrl(index - 1, revisions[index - 1])"
              :alt="`Page ${index} of ${reader.pageCount}`"
              :loading="index - 1 === reader.pageIndex ? 'eager' : 'lazy'"
              @load="imageLoaded(index - 1, $event)"
              @error="imageFailed(index - 1, $event)"
            />
            <div v-if="!loaded.has(index - 1)" class="reader-strip-loading">
              <v-progress-circular indeterminate color="primary" size="36" width="3" />
            </div>
          </div>
        </div>
        <!-- Webtoon chapter transition (Next) at bottom of strip (WebtoonAdapter.kt) -->
        <ChapterTransition
          v-if="reader.chapter && (reader.nextChapter || alwaysShowChapterTransition)"
          viewer-mode="webtoon"
          :transition="{
            type: 'next',
            from: reader.chapter,
            to: reader.nextChapter,
          }"
          :curr-chapter-downloaded="reader.chapter.downloaded"
          :going-to-chapter-downloaded="reader.nextChapter?.downloaded"
          @click.stop="reader.nextChapter && goChapter(reader.nextChapter.index)"
        />
      </div>
    </div>

    <!-- ReaderActivity.kt: ContentOverlay(state) - the brightness / colour filter layers. -->
    <ReaderContentOverlay />

    <!-- ReaderActivity.kt:441 - `if (flashOnPageChange) { DisplayRefreshHost(...) }`. -->
    <div v-if="flashColor" class="reader-flash" :class="`reader-flash--${flashColor}`" aria-hidden="true"/>

    <!-- ReaderAppBars.kt: AnimatedVisibility(visible) { ReaderTopBar } - 200ms slide and 150ms fade. -->
    <Transition name="reader-bar-top">
      <div v-show="controls" class="reader-bars reader-bars--top">
        <ReaderTopBar
          :manga-title="title"
          :chapter-title="subtitle"
          :bookmarked="!!reader.chapter?.bookmarked"
          :can-bookmark="canBookmark"
          :chapter-url="chapterUrl"
          @bookmark="toggleBookmark"
          @back="navigateUp"
          @manga="router.push(`/manga/${route.params.id}`)"
          @unsupported="showToast"
        />
      </div>
    </Transition>

    <!--
      ReaderAppBars.kt:103-139 - when the chapter navigator is vertical it is not part of the bottom
      bar column. It sits in its own row that fills the height, aligned to the bottom, and its
      height is `verticalNavigatorHeight` percent of the reader height.
    -->
    <Transition name="reader-bar-side">
      <div
        v-if="useVerticalNavigator"
        v-show="controls"
        class="reader-vertical-navigator"
        :class="{ 'reader-vertical-navigator--left': preferences.verticalNavigatorOnLeft }"
      >
        <ChapterNavigator
          :type="navigatorType"
          :current-page="reader.pageIndex + 1"
          :total-pages="reader.pageCount"
          :enabled-next="!!reader.nextChapter"
          :enabled-previous="!!reader.previousChapter"
          :style="{ height: `${verticalNavigatorHeightPercent}%` }"
          @next-chapter="reader.nextChapter && goChapter(reader.nextChapter.index)"
          @previous-chapter="reader.previousChapter && goChapter(reader.previousChapter.index)"
          @page-index-change="goPage"
        />
      </div>
    </Transition>

    <!--
      ReaderAppBars.kt: AnimatedVisibility(visible) { Column(spacedBy(8.dp)) {
        ChapterNavigator(...)   // horizontal chapter navigator
        ReaderBottomBar(...)    // reading mode / rotation / crop / settings
      } }
    -->
    <Transition name="reader-bar-bottom">
      <div v-show="controls" class="reader-bars reader-bars--bottom reader-bottom" role="region" aria-label="Page navigation">
        <!-- ReaderAppBars.kt:150 - horizontal chapter navigator -->
        <ChapterNavigator
          v-if="!useVerticalNavigator"
          :type="navigatorType"
          :current-page="reader.pageIndex + 1"
          :total-pages="reader.pageCount"
          :enabled-next="!!reader.nextChapter"
          :enabled-previous="!!reader.previousChapter"
          @next-chapter="reader.nextChapter && goChapter(reader.nextChapter.index)"
          @previous-chapter="reader.previousChapter && goChapter(reader.previousChapter.index)"
          @page-index-change="goPage"
        />
        <ReaderBottomBar
          :reading-mode="preferences.mode"
          :orientation="orientation"
          :crop-enabled="cropEnabled"
          @reading-mode="readingModeDialog = true"
          @orientation="orientationDialog = true"
          @crop="toggleCrop"
          @settings="settings = true"
        />
      </div>
    </Transition>

    <!-- ReaderActivity.kt:261 - `if (!state.menuVisible && showPageNumber) ReaderPageIndicator(BottomCenter)`. -->
    <ReaderPageIndicator
      v-if="reader.chapter && reader.pageCount && !controls && showPageNumber"
      :current-page="reader.pageIndex + 1"
      :total-pages="reader.pageCount"
    />

    <!--
      Web-only helpers. Mihon turns pages with gestures and jumps chapters with the
      navigator's skip buttons, so these controls are only exposed to assistive
      technology and never change the reader layout.
    -->
    <div class="reader-assist">
      <button type="button" aria-label="Previous page" :disabled="preferences.mode === 'rtl' ? reader.pageIndex >= reader.pageCount - 1 : reader.pageIndex <= 0" @click="turn(preferences.mode === 'rtl' ? 1 : -1)"/>
      <button type="button" aria-label="Next page" :disabled="preferences.mode === 'rtl' ? reader.pageIndex <= 0 : reader.pageIndex >= reader.pageCount - 1" @click="turn(preferences.mode === 'rtl' ? -1 : 1)"/>
      <button type="button" aria-label="Chapter list" @click="chaptersOpen = true"/>
      <button type="button" aria-label="Save current page on server" :disabled="!loaded.has(reader.pageIndex) || !!reader.pendingWrites" @click="reader.savePage(reader.pageIndex, true)"/>
      <button type="button" aria-label="Show reading controls" @click="controls = true"/>
    </div>

    <!-- ReaderActivity.kt: Dialog.Loading - an AlertDialog with a spinner and the "Loading" label. -->
    <v-dialog :model-value="reader.loading" persistent max-width="360">
      <v-card class="reader-loading-dialog" color="surface-container-high">
        <v-card-text class="d-flex align-center ga-4 pa-6">
          <v-progress-circular indeterminate color="primary" size="40" width="4"/>
          <span class="text-body-large">Loading…</span>
        </v-card-text>
      </v-card>
    </v-dialog>

    <div v-if="reader.error" class="reader-message" role="alert">
      <v-icon icon="cloud_off" size="56"/>
      <h2 class="text-title-large mt-4">Unable to open chapter</h2>
      <p class="mt-2 mb-6">{{ reader.error }}</p>
      <div class="d-flex ga-3 align-center">
        <v-btn color="primary" variant="flat" rounded="pill" @click="reader.open(server.apiUrl, Number(route.params.id), Number(route.params.chapterIndex))">Try again</v-btn>
        <router-link :to="`/manga/${route.params.id}`" class="v-btn v-btn--density-default v-btn--size-default v-btn--variant-outlined rounded-pill text-none text-primary d-inline-flex align-center px-4" style="text-decoration: none;">Back to manga</router-link>
      </div>
    </div>
    <div v-else-if="!reader.loading && !reader.pageCount && reader.chapter" class="reader-message">
      <v-icon icon="auto_stories" size="56"/>
      <h2 class="text-title-large mt-4">No pages returned</h2>
      <p class="mt-2">Suwayomi returned an empty page list for this chapter.</p>
    </div>

    <ReaderSettingsDialog v-model="settings" :manga-id="reader.manga?.id" @closed="refreshPrefs" />
    <ReadingModeSelectDialog v-model="readingModeDialog" :manga-id="reader.manga?.id" @change="refreshPrefs" />
    <OrientationSelectDialog v-model="orientationDialog" :manga-id="reader.manga?.id" @change="refreshPrefs" />
    <ReaderPageActionsDialog v-model="pageActions" />

    <v-snackbar v-model="toastOpen" :timeout="2500" color="surface-container-high" location="bottom">{{ toast }}</v-snackbar>

    <v-bottom-sheet v-model="chaptersOpen" max-width="640" scrollable>
      <v-card color="surface-container-high" rounded="t-xl">
        <v-card-title class="d-flex align-center justify-space-between">
          Chapters
          <v-btn icon="close" variant="text" aria-label="Close chapter list" @click="chaptersOpen = false"/>
        </v-card-title>
        <v-list max-height="440" class="bg-transparent reader-chapters-list">
          <v-list-item
            v-for="item in reader.orderedChapters"
            :key="item.id"
            :title="item.name"
            :active="item.index === reader.chapter?.index"
            color="primary"
            :prepend-icon="item.index === reader.chapter?.index ? 'play_arrow' : 'article'"
            @click="goChapter(item.index)"
          />
        </v-list>
      </v-card>
    </v-bottom-sheet>
  </section>
  </v-theme-provider>
</template>

<style scoped>
@layer app-components {
/*
 * ReaderAppBars.kt: ReaderAppBars animates the bars with a 200ms slide tween and a 150ms fade tween.
 */
.reader-bars {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 3;
}
.reader-bars--top {
  top: 0;
  padding-top: env(safe-area-inset-top);
}
.reader-bars--bottom {
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reader-bar-top-enter-active,
.reader-bar-top-leave-active {
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1), opacity 150ms cubic-bezier(0, 0, 0.2, 1);
}
.reader-bar-top-enter-from,
.reader-bar-top-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.reader-bar-bottom-enter-active,
.reader-bar-bottom-leave-active {
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1), opacity 150ms cubic-bezier(0, 0, 0.2, 1);
}
.reader-bar-bottom-enter-from,
.reader-bar-bottom-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.reader-bar-side-enter-active,
.reader-bar-side-leave-active {
  transition: transform 200ms cubic-bezier(0, 0, 0.2, 1), opacity 150ms cubic-bezier(0, 0, 0.2, 1);
}
.reader-bar-side-enter-from,
.reader-bar-side-leave-to {
  opacity: 0;
}

/*
 * ReaderActivity.kt: Dialog.Loading - an AlertDialog with CornerExtraLarge (28dp).
 */
.reader-loading-dialog {
  border-radius: 28px !important;
  min-width: 280px;
  max-width: 560px;
}

/*
 * Page loading indicator - mirrors ReaderProgressIndicator.kt
 */
.reader-image-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: transparent;
  pointer-events: none;
}
.reader-loading-text {
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.reader-strip-image-wrap {
  position: relative;
  min-height: 180px;
}
.reader-strip-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

/*
 * The assistive-only helpers must not influence the layout: they are clipped to a
 * single pixel and stay out of the visible chrome.
 */
.reader-assist {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.reader-chapters-list {
  scrollbar-width: none;
}
.reader-chapters-list::-webkit-scrollbar {
  display: none;
}
}
</style>