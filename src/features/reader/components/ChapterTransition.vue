<script setup lang="ts">
import { computed } from 'vue'
import {
  missingChaptersWarning,
  transitionChapterGap,
  transitionLabels,
  type TransitionChapter,
  type TransitionChapterData,
} from '@/features/reader/utils/chapterTransition'

/**
 * Mihon reference: eu/kanade/presentation/reader/ChapterTransition.kt
 * (Mihon 446f6df8) plus the holders that host it:
 *  - eu/kanade/tachiyomi/ui/reader/viewer/ReaderTransitionView.kt
 *  - eu/kanade/tachiyomi/ui/reader/viewer/pager/PagerTransitionHolder.kt
 *  - eu/kanade/tachiyomi/ui/reader/viewer/webtoon/WebtoonTransitionHolder.kt
 *
 * Structure of the reference composable:
 *  - ChapterTransition(transition, currChapterDownloaded, goingToChapterDownloaded)
 *      - Prev: top = going-to chapter ("Previous:"), bottom = current chapter ("Current:")
 *      - Next: top = current chapter ("Finished:"), bottom = going-to chapter ("Next:")
 *  - TransitionText: Column(Modifier.widthIn(max = 460.dp).fillMaxWidth())
 *      - topChapter != null    -> ChapterText(topLabel, topChapter) + Spacer(24.dp)
 *      - topChapter == null    -> NoChapterNotification(fallbackLabel)
 *      - bottomChapter != null -> (if gap > 0 ChapterGapWarning) + Spacer(24.dp) + ChapterText(bottomLabel, bottomChapter)
 *      - bottomChapter == null -> NoChapterNotification(fallbackLabel)
 *  - NoChapterNotification / ChapterGapWarning: OutlinedCard (transparent container, onSurface
 *    content, 12dp CornerMedium shape, 1dp outlineVariant border) with Row(padding 16.dp horizontal / 12.dp vertical, spacedBy 16.dp, centered).
 *  - ChapterText: header (titleMedium, padding bottom 4.dp), name (titleLarge with fontSize
 *    20.sp, maxLines 5, inline downloaded icon check_circle), scanlator (bodySmall, alpha 0.78, padding top 2.dp).
 *  - PagerTransitionHolder / WebtoonTransitionHolder:
 *      - Pager: padding(horizontal = 64.dp), vertical centering
 *      - Webtoon: padding(horizontal = 32.dp, vertical = 128.dp)
 *      - pagesContainer: loading spinner (40dp primary) + "Loading pages…", or "Failed to load pages: %s" + M3 filled retry button.
 */

const props = withDefaults(
  defineProps<{
    transition: TransitionChapterData
    /** ReaderTransitionView resolves it from the local page loader; falls back to chapter.downloaded. */
    currChapterDownloaded?: boolean
    /** ReaderTransitionView resolves it from the download manager; falls back to chapter.downloaded. */
    goingToChapterDownloaded?: boolean
    /**
     * State of the target chapter's page list. PagerTransitionHolder / WebtoonTransitionHolder
     * show a progress indicator while the pages load and an error with a retry button when they
     * fail.
     */
    pagesState?: 'loading' | 'error' | null
    /** Message shown in the error state (`MR.strings.transition_pages_error`). */
    pagesError?: string
    /**
     * Viewer mode to adjust holder padding and centering:
     * - 'pager': 64dp horizontal padding, full height vertical centering (PagerTransitionHolder.kt)
     * - 'webtoon': 32dp horizontal padding, 128dp vertical padding (WebtoonTransitionHolder.kt)
     * - 'raw': no container padding
     */
    viewerMode?: 'pager' | 'webtoon' | 'raw'
  }>(),
  {
    currChapterDownloaded: undefined,
    goingToChapterDownloaded: undefined,
    pagesState: null,
    pagesError: '',
    viewerMode: 'pager',
  },
)

const emit = defineEmits<{
  (event: 'retry'): void
}>()

const labels = computed(() => transitionLabels(props.transition.type))

const topChapter = computed(() =>
  props.transition.type === 'prev' ? props.transition.to ?? null : props.transition.from,
)

const bottomChapter = computed(() =>
  props.transition.type === 'prev' ? props.transition.from : props.transition.to ?? null,
)

function isDownloaded(chapter: TransitionChapter | null | undefined, explicit: boolean | undefined): boolean {
  if (!chapter) return false
  return explicit === undefined ? Boolean(chapter.downloaded) : explicit
}

const topDownloaded = computed(() =>
  isDownloaded(
    topChapter.value,
    props.transition.type === 'prev' ? props.goingToChapterDownloaded : props.currChapterDownloaded,
  ),
)

const bottomDownloaded = computed(() =>
  isDownloaded(
    bottomChapter.value,
    props.transition.type === 'prev' ? props.currChapterDownloaded : props.goingToChapterDownloaded,
  ),
)

/**
 * Prev compares the current chapter against the previous one and Next the next chapter against
 * the current one; the higher chapter number is always the first argument of the calculation.
 */
const chapterGap = computed(() => transitionChapterGap(props.transition))

/** MR.plurals.missing_chapters_warning */
const gapText = computed(() => missingChaptersWarning(chapterGap.value))
</script>

<template>
  <div class="chapter-transition-wrap" :class="[`chapter-transition-wrap--${viewerMode}`]">
    <div class="chapter-transition">
      <!-- Top chapter block: ChapterTransition.kt lines 101-115 -->
      <template v-if="topChapter">
        <div class="ct-chapter">
          <!-- ChapterHeaderText: MaterialTheme.typography.titleMedium, padding(bottom = 4.dp) -->
          <p class="ct-header">{{ labels.top }}</p>
          <!--
            Text(fontSize = 20.sp, maxLines = 5, style = titleLarge) whose annotated string starts
            with the inline downloaded icon followed by a space. The icon is an InlineTextContent
            with a 22sp placeholder box, centered in the line (PlaceholderVerticalAlign.Center => 3px from top).
          -->
          <div class="ct-name-wrap">
            <p class="ct-name" :class="{ 'ct-name--downloaded': topDownloaded }">{{ topChapter.name }}</p>
            <span v-if="topDownloaded" class="ct-downloaded" role="img" aria-label="Downloaded">
              <v-icon icon="check_circle" size="22" class="filled-symbol" />
            </span>
          </div>
          <!-- Scanlator: bodySmall, secondaryItemAlpha() (0.78), padding(top = 2.dp), maxLines = 2 -->
          <p v-if="topChapter.scanlator?.trim()" class="ct-scanlator">{{ topChapter.scanlator }}</p>
        </div>
        <!-- Spacer(Modifier.height(VerticalSpacerSize = 24.dp)) -->
        <div class="ct-spacer" aria-hidden="true" />
      </template>
      <div v-else class="ct-notice">
        <!-- NoChapterNotification: MaterialSymbols.Rounded.Info tinted with colorScheme.primary -->
        <v-icon icon="info" size="24" class="ct-notice-icon ct-notice-icon--primary" />
        <span class="ct-notice-text">{{ labels.fallback }}</span>
      </div>

      <!-- Bottom chapter block: ChapterTransition.kt lines 117-139 -->
      <template v-if="bottomChapter">
        <!-- if (chapterGap > 0) ChapterGapWarning: MaterialSymbols.RoundedFilled.Warning tinted with colorScheme.error -->
        <div v-if="chapterGap > 0" class="ct-notice">
          <v-icon icon="warning" size="24" class="ct-notice-icon ct-notice-icon--error filled-symbol" />
          <span class="ct-notice-text">{{ gapText }}</span>
        </div>
        <!-- Spacer(Modifier.height(VerticalSpacerSize = 24.dp)) -->
        <div class="ct-spacer" aria-hidden="true" />
        <div class="ct-chapter">
          <!-- ChapterHeaderText: MaterialTheme.typography.titleMedium, padding(bottom = 4.dp) -->
          <p class="ct-header">{{ labels.bottom }}</p>
          <div class="ct-name-wrap">
            <p class="ct-name" :class="{ 'ct-name--downloaded': bottomDownloaded }">{{ bottomChapter.name }}</p>
            <span v-if="bottomDownloaded" class="ct-downloaded" role="img" aria-label="Downloaded">
              <v-icon icon="check_circle" size="22" class="filled-symbol" />
            </span>
          </div>
          <p v-if="bottomChapter.scanlator?.trim()" class="ct-scanlator">{{ bottomChapter.scanlator }}</p>
        </div>
      </template>
      <div v-else class="ct-notice">
        <v-icon icon="info" size="24" class="ct-notice-icon ct-notice-icon--primary" />
        <span class="ct-notice-text">{{ labels.fallback }}</span>
      </div>

      <!--
        PagerTransitionHolder / WebtoonTransitionHolder show the page list state of the target
        chapter below the transition text in a container with Gravity.CENTER: a
        CircularProgressIndicator with "Loading pages…" while loading, and
        "Failed to load pages: <error>" with a retry button on failure.
      -->
      <div v-if="pagesState === 'loading'" class="ct-pages ct-pages--loading">
        <v-progress-circular indeterminate color="primary" size="40" width="4" />
        <span class="ct-pages-text">Loading pages…</span>
      </div>
      <div v-else-if="pagesState === 'error'" class="ct-pages ct-pages--error">
        <span class="ct-pages-text">Failed to load pages: {{ pagesError || 'Unknown error' }}</span>
        <button type="button" class="ct-retry" @click="emit('retry')">Retry</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
/*
 * Holder containers:
 * - PagerTransitionHolder.kt: LinearLayout(VERTICAL), gravity = Gravity.CENTER, padding(horizontal = 64.dp)
 * - WebtoonTransitionHolder.kt: LinearLayout(VERTICAL), gravity = Gravity.CENTER, padding(horizontal = 32.dp, vertical = 128.dp)
 */
.chapter-transition-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
}

.chapter-transition-wrap--pager {
  min-height: 100%;
  padding: 0 64px;
}

.chapter-transition-wrap--webtoon {
  padding: 128px 32px;
}

.chapter-transition-wrap--raw {
  padding: 0;
}

/*
 * TransitionText: Column(Modifier.widthIn(max = 460.dp).fillMaxWidth()).
 * ReaderTransitionView provides LocalContentColor = MaterialTheme.colorScheme.onBackground, so the
 * chapter texts use onBackground; the notification cards override it with onSurface.
 */
.chapter-transition {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 460px;
  margin-inline: auto;
  color: rgb(var(--v-theme-on-background));
  font-family: Roboto, system-ui, -apple-system, sans-serif;
  box-sizing: border-box;
}

.ct-chapter {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/*
 * ChapterText -> ChapterHeaderText: MaterialTheme.typography.titleMedium
 * (16sp / 24sp, weight 500, letter spacing 0.15sp) with Modifier.padding(bottom = 4.dp).
 */
.ct-header {
  margin: 0 0 4px;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  color: inherit;
  text-align: left;
}

/*
 * ChapterText name: style = MaterialTheme.typography.titleLarge with fontSize = 20.sp,
 * maxLines = 5, overflow = TextOverflow.Ellipsis. titleLarge keeps its 28sp line height.
 */
.ct-name-wrap {
  position: relative;
  min-height: 28px;
}

.ct-name {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: inherit;
  text-align: left;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * The downloaded icon is an InlineTextContent with a 22sp x 22sp placeholder box, centred in
 * the 28sp line (PlaceholderVerticalAlign.Center => 3px from the line top) and followed by one
 * space whose Roboto advance at 20sp is 5px.
 *
 * The placeholder only reserves room on the first line of the paragraph, which text-indent
 * reproduces exactly.
 */
.ct-name--downloaded {
  text-indent: 27px;
}

.ct-downloaded {
  position: absolute;
  top: 3px;
  left: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  color: inherit;
  pointer-events: none;
}

/*
 * Scanlator: MaterialTheme.typography.bodySmall (12sp / 16sp, letter spacing 0.4sp),
 * secondaryItemAlpha() = alpha(0.78), padding(top = 2.dp), maxLines = 2.
 */
.ct-scanlator {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  opacity: 0.78;
  color: inherit;
  text-align: left;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* VerticalSpacerSize = 24.dp */
.ct-spacer {
  height: 24px;
  flex: 0 0 auto;
}

/*
 * NoChapterNotification / ChapterGapWarning: OutlinedCard with a transparent container and an
 * onSurface content color, so only the 1dp outline-variant stroke is visible. The card wraps its
 * content and is centered horizontally (Modifier.align(Alignment.CenterHorizontally)).
 *
 * The M3 card shape is a 12dp rounded corner (MaterialTheme.shapes.medium).
 * Row padding: horizontal 16.dp, vertical 12.dp, horizontalArrangement = spacedBy(16.dp),
 * verticalAlignment = Alignment.CenterVertically.
 */
.ct-notice {
  position: relative;
  align-self: center;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  width: fit-content;
  max-width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  background: transparent;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  color: rgb(var(--v-theme-on-surface));
  box-sizing: border-box;
}

/* Typography bodyMedium (14sp / 20sp, weight 400, letter spacing 0.25sp) */
.ct-notice-text {
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
}

/* Icon(tint = colorScheme.primary) / Icon(tint = colorScheme.error) */
.ct-notice-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  font-size: 24px;
}

.ct-notice-icon--primary {
  color: rgb(var(--v-theme-primary));
}

.ct-notice-icon--error {
  color: rgb(var(--v-theme-error));
}

/*
 * PagerTransitionHolder / WebtoonTransitionHolder page loader container:
 * LinearLayout(VERTICAL), gravity = Gravity.CENTER.
 */
.ct-pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.25px;
}

.ct-pages-text {
  text-align: center;
  color: rgb(var(--v-theme-on-background));
}

/*
 * ReaderButton: MaterialButton with R.attr.materialButtonStyle.
 * Filled M3 button: height 40dp, padding 0 24dp, rounded full (20dp),
 * labelLarge (14sp / 20sp, weight 500, letter spacing 0.1sp),
 * background primary, color on-primary.
 */
.ct-retry {
  min-height: 40px;
  padding: 0 24px;
  border: 0;
  border-radius: 20px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
  transition: box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1), background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.ct-retry:hover {
  box-shadow: 0 0 0 8px color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}

.ct-retry:active {
  box-shadow: 0 0 0 8px color-mix(in srgb, rgb(var(--v-theme-primary)) 24%, transparent);
}

.ct-retry:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
}
</style>
