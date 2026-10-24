<script setup lang="ts">
/**
 * Mihon reference: mihon/app/src/main/java/eu/kanade/presentation/history/components/HistoryItem.kt
 *
 * Row layout (from the Kotlin source):
 *  Row(clickable -> onClickResume).height(96.dp).padding(horizontal = 16.dp, vertical = 8.dp)
 *    - MangaCover.Book(fillMaxHeight)   -> 2:3 cover, extraSmall (4dp) clipped shape
 *    - Column(weight(1f)).padding(start = 16.dp, end = 8.dp)
 *        - Text(title, bodyMedium, SemiBold, maxLines = 2, ellipsis)
 *        - Text("Ch. <n> - <time>" | "<time>", bodyMedium, padding(top = 4.dp))
 *    - IconButton(favorite)  only when the manga is NOT in the library
 *    - IconButton(delete)    always
 *
 * Metrics taken from the reference tree:
 *  - MaterialTheme.padding: medium = 16.dp, small = 8.dp, extraSmall = 4.dp
 *    (mihon/presentation-core/.../material/Constants.kt:12-26)
 *  - MaterialTheme.shapes.extraSmall = 4.dp (MangaCover.kt:28)
 *  - MangaCover placeholder / error colour = Color(0x1F888888) (MangaCover.kt:53) and
 *    @color/cover_placeholder = #1F888888 (presentation-core/res/values/colors.xml:3)
 *  - MD3 IconButton state layer = 40.dp (IconButtonTokens.kt:11), icon = 24.dp
 *  - MD3 bodyMedium = 14.sp / 20.sp line height / 0.0178em tracking
 */
import { computed, ref, watch } from 'vue'
import '@fontsource/roboto/600.css'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { formatRecentMangaTime, formatReadAt, type HistoryEntry } from '@/core/utils/history'

const props = withDefaults(
  defineProps<{
    entry: HistoryEntry & {
      hasUnread?: boolean
      readProgress?: string | null
      read?: boolean
      lastPageRead?: number
    }
    selected?: boolean
    selectionMode?: boolean
    wideCover?: boolean
  }>(),
  {
    selected: false,
    selectionMode: false,
    wideCover: false,
  },
)

const emit = defineEmits<{
  (event: 'cover', mangaId: number): void
  (event: 'resume', mangaId: number, chapterId: number): void
  (event: 'favorite', mangaId: number): void
  (event: 'delete', entry: HistoryEntry): void
  (event: 'select', entry: HistoryEntry): void
  (event: 'longpress', entry: HistoryEntry): void
}>()

const server = useSuwayomiStore()
const coverBroken = ref(false)
watch(() => [server.apiUrl, props.entry.mangaId], () => { coverBroken.value = false })

/** Mihon: `history.readAt?.toTimestampString(timeFormatter) ?: ""` */
const readAtLabel = computed(() => formatReadAt(props.entry.readAt))
/** Mihon: `MR.strings.recent_manga_time` = "Ch. %1$s - %2$s" (only when chapterNumber > -1). */
const subtitle = computed(() => formatRecentMangaTime(props.entry.chapterNumber, readAtLabel.value))
/** Mihon: `if (!history.coverData.isMangaFavorite)` renders the favorite action. */
const showFavorite = computed(() => !props.entry.inLibrary)
const coverUrl = computed(() => server.thumbnailUrl(props.entry.mangaId))

let pressTimer: ReturnType<typeof setTimeout> | null = null

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  pressTimer = setTimeout(() => {
    emit('longpress', props.entry)
    pressTimer = null
  }, 500)
}

function onPointerMove() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function onPointerUp() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function onPointerCancel() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function onRowClick(event: MouseEvent) {
  if (props.selectionMode) {
    event.stopPropagation()
    emit('select', props.entry)
    return
  }
  onResume(event)
}

function onCover(event: MouseEvent) { event.stopPropagation(); emit('cover', props.entry.mangaId) }
function onResume(event?: MouseEvent) { event?.stopPropagation(); emit('resume', props.entry.mangaId, props.entry.chapterId) }
function onFavorite(event: MouseEvent) { event.stopPropagation(); emit('favorite', props.entry.mangaId) }
function onDelete(event: MouseEvent) { event.stopPropagation(); emit('delete', props.entry) }
function onCoverError() { coverBroken.value = true }
</script>

<template>
  <div
    class="history-item"
    :class="{ 'is-selected': selected }"
    @click="onRowClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @contextmenu.prevent="emit('longpress', props.entry)"
  >
    <!-- Selection checkbox in selection mode -->
    <div v-if="selectionMode" class="history-item__checkbox" @click.stop>
      <v-checkbox
        :model-value="selected"
        color="primary"
        density="compact"
        hide-details
        aria-label="Select history entry"
        @update:model-value="emit('select', props.entry)"
      />
    </div>

    <button
      type="button"
      class="history-item__cover"
      :class="{ 'history-item__cover--wide': wideCover }"
      :aria-label="`Open ${entry.title}`"
      @click="onCover"
    >
      <img v-if="!coverBroken" class="history-item__cover-image" :src="coverUrl" alt="" @error="onCoverError" />
      <span v-else class="history-item__cover-fallback">
        <!-- Mihon's cover_error drawable: 24dp vector painted with @color/cover_placeholder (#1F888888). -->
        <svg class="history-item__cover-error" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
          <path d="M21,5v6.59l-2.29,-2.3c-0.39,-0.39 -1.03,-0.39 -1.42,0L14,12.59 10.71,9.3c-0.39,-0.39 -1.02,-0.39 -1.41,0L6,12.59 3,9.58L3,5c0,-1.1 0.9,-2 2,-2h14c1.1,0 2 0.9 2 2zM18,11.42l3,3.01L21,19c0,1.1 -0.9,2 -2,2L5,21c-1.1,0 -2,-0.9 -2,-2v-6.58l2.29,2.29c0.39,0.39 1.02,0.39 1.41,0l3.3,-3.3 3.29,3.29c0.39,0.39 1.02,0.39 1.41,0l3.3,-3.28z" />
        </svg>
      </span>
    </button>
    <div class="history-item__body">
      <span class="history-item__title">{{ entry.title }}</span>
      <span class="history-item__subtitle">
        <span v-if="entry.hasUnread" class="history-item__unread-dot" aria-hidden="true" />
        <span>{{ subtitle }}</span>
        <span v-if="entry.readProgress" class="history-item__progress">&nbsp;• {{ entry.readProgress }}</span>
      </span>
    </div>
    <button
      v-if="showFavorite"
      type="button"
      class="history-item__action"
      aria-label="Add to library"
      @click="onFavorite"
    >
      <span class="material-symbols-rounded history-item__action-icon" aria-hidden="true">favorite</span>
    </button>
    <button type="button" class="history-item__action" aria-label="Delete" @click="onDelete">
      <span class="material-symbols-rounded history-item__action-icon" aria-hidden="true">delete</span>
    </button>
  </div>
</template>

<style scoped>
/* HistoryItem.kt: HistoryItemHeight = 96.dp, padding(horizontal = 16.dp, vertical = 8.dp). */
.history-item {
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  height: 96px;
  padding: 8px 16px;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  user-select: none;
}
/* Modifier.clickable ripple: a press state layer in the content colour (on-surface). */
.history-item::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: rgb(var(--v-theme-on-surface));
  opacity: 0;
  pointer-events: none;
}
.history-item > * { position: relative; z-index: 1; }
.history-item:hover::after { opacity: 0.08; }
.history-item:active::after { opacity: 0.12; }
.history-item.is-selected {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}

.history-item__checkbox {
  flex: 0 0 auto;
  margin-right: 8px;
}

/* MangaCover.Book: fillMaxHeight (96 - 8 - 8 = 80dp) + aspectRatio(2f / 3f) + shapes.extraSmall (4dp). */
.history-item__cover {
  flex: 0 0 auto;
  width: 53.3333px;
  height: 80px;
  padding: 0;
  border: none;
  border-radius: 4px;
  overflow: hidden;
  background: #8888881f;
  cursor: pointer;
}
.history-item__cover.history-item__cover--wide {
  width: 142.2222px;
}
.history-item__cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.history-item__cover-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: #8888881f;
}
.history-item__cover-error { fill: #8888881f; }

/* Column(weight(1f)).padding(start = 16.dp, end = 8.dp) */
.history-item__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 8px 0 16px;
  color: inherit;
}

/* MaterialTheme.typography.bodyMedium: 14sp / 20sp line height / 0.0178em tracking. */
.history-item__title,
.history-item__subtitle {
  display: block;
  font-family: Roboto, sans-serif;
  font-size: 0.875rem;
  line-height: 20px;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
}
/* Text(fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = Ellipsis) */
.history-item__title {
  font-weight: 600;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  word-break: break-word;
}
/* Text(modifier = Modifier.padding(top = 4.dp)) */
.history-item__subtitle { margin-top: 4px; }
.history-item__unread-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  margin-right: 6px;
  flex: 0 0 auto;
  vertical-align: middle;
}
.history-item__progress {
  color: inherit;
  white-space: nowrap;
  flex: 0 0 auto;
}
.history-item__body span {
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * MD3 IconButton: the button keeps the 48dp minimum interactive touch target
 * (Modifier.minimumInteractiveComponentSize) while the visible circular state
 * layer is 40dp (IconButtonTokens.StateLayerSize) and the icon is 24dp.
 */
.history-item__action {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  border-radius: 24px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
.history-item__action::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  border-radius: 20px;
  background: rgb(var(--v-theme-on-surface));
  opacity: 0;
  pointer-events: none;
}
.history-item__action:hover::before { opacity: 0.08; }
.history-item__action:active::before { opacity: 0.12; }
.history-item__action:focus-visible { outline: 2px solid rgb(var(--v-theme-on-surface)); outline-offset: 2px; }
.history-item__action-icon {
  position: relative;
  font-size: 24px;
  line-height: 1;
  width: 24px;
  height: 24px;
}
</style>
