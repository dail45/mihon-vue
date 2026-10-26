<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'

/**
 * Mihon reference: eu/kanade/presentation/reader/appbars/ReaderTopBar.kt
 *  (and the shared eu/kanade/presentation/components/AppBar.kt it builds on).
 *
 * Reference structure:
 *   AppBar(backgroundColor = Color.Transparent, title = mangaTitle, subtitle = chapterTitle,
 *          navigateUp = { finish() },
 *          actions = AppBarActions {
 *              Action(bookmark, Rounded.Bookmark | RoundedFilled.Bookmark, onToggleBookmarked)
 *              OverflowAction("Open in web view")
 *              OverflowAction("Open in browser")
 *              OverflowAction("Share")
 *          })
 *   -> TopAppBar(navigationIcon = IconButton { UpIcon }, title = AppBarTitle, actions = ...)
 *   -> AppBarTitle = Column { Text(title, maxLines 1, ellipsis);
 *                              Text(subtitle, bodyMedium, maxLines 1, ellipsis, basicMarquee(2000ms)) }
 *   -> AppBarActions = IconButton(bookmark) + IconButton(MoreVert) + DropdownMenu of DropdownMenuItem
 *
 * ReaderAppBars.kt paints the whole top bar with `surfaceColorAtElevation(3.dp)` at
 * 0.9 alpha (dark) / 0.95 alpha (light) and makes the whole bar clickable, opening
 * the manga screen.
 *
 * Web notes:
 *  - The reference shows the overflow entries only for HTTP sources
 *    (ReaderActivity.kt: `onOpenInWebView = ::openChapterInWebView.takeIf { isHttpSource }`),
 *    so the overflow button is hidden when the chapter source URL is unknown.
 *  - "Open in web view" is an Android WebViewActivity screen with no browser
 *    equivalent; the entry is kept and reports the limitation instead of hiding it.
 */
const props = withDefaults(defineProps<{
  mangaTitle: string
  chapterTitle: string
  bookmarked: boolean
  canBookmark?: boolean
  chapterUrl?: string | null
}>(), { canBookmark: true, chapterUrl: null })

const emit = defineEmits<{
  (event: 'bookmark'): void
  (event: 'manga'): void
  (event: 'back'): void
  (event: 'unsupported', message: string): void
}>()

const overflowOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const subtitleEl = ref<HTMLElement | null>(null)
const marquee = ref(false)
const marqueeShift = ref('0px')

const theme = useTheme()

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '').trim()
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const int = Number.parseInt(full.slice(0, 6), 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/**
 * ReaderAppBars.kt:
 *   MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp)
 *     .copy(alpha = if (isSystemInDarkTheme()) 0.9f else 0.95f)
 * `surfaceColorAtElevation` composites the surface tint over the surface with
 * `alpha = ((4.5 * ln(elevation + 1)) + 2) / 100` = 8.238 % for 3.dp.
 */
const palette = computed(() => {
  const colors = theme.current.value.colors as Record<string, string>
  const surface = hexToRgb(colors.surface ?? '#1B1B1F')
  const tint = hexToRgb(colors['surface-tint'] ?? colors.primary ?? '#B0C6FF')
  const alpha = ((4.5 * Math.log(4)) + 2) / 100
  const mixed = surface.map((channel, index) => Math.round(tint[index] * alpha + channel * (1 - alpha)))
  const dark = theme.current.value.dark
  return {
    background: `rgba(${mixed.join(', ')}, ${dark ? 0.9 : 0.95})`,
    content: colors['on-surface'] ?? colors['on-background'] ?? '#E3E2E6',
  }
})

/**
 * AppBar.kt: the overflow entries exist only when the source provides them, so the
 * MoreVert button (and the whole DropdownMenu) disappears when there is no chapter URL.
 */
const hasOverflow = computed(() => !!props.chapterUrl)

const bookmarkLabel = computed(() => (props.bookmarked ? 'Remove bookmark' : 'Add bookmark'))

/**
 * AppBar.kt `AppBarTitle`: the subtitle uses `basicMarquee(repeatDelayMillis = 2_000)`,
 * so it only scrolls when the text does not fit and it waits 2s before each pass.
 */
function measureMarquee() {
  const el = subtitleEl.value
  if (!el) { marquee.value = false; return }
  const overflow = el.scrollWidth - el.clientWidth
  if (overflow > 1) {
    marquee.value = true
    marqueeShift.value = `${-overflow}px`
  } else {
    marquee.value = false
    marqueeShift.value = '0px'
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await nextTick()
  measureMarquee()
  if (subtitleEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureMarquee())
    resizeObserver.observe(subtitleEl.value)
  }
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onDocumentKeydown)
})

watch(() => [props.chapterTitle, props.mangaTitle], async () => {
  await nextTick()
  measureMarquee()
})

/** DropdownMenu dismisses on an outside click. */
function onDocumentClick(event: MouseEvent) {
  if (!overflowOpen.value) return
  if (root.value && event.target instanceof Node && root.value.contains(event.target)) return
  overflowOpen.value = false
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') overflowOpen.value = false
}

function openInBrowser() {
  overflowOpen.value = false
  if (!props.chapterUrl) { emit('unsupported', 'The chapter source URL is not available in the web version.'); return }
  window.open(props.chapterUrl, '_blank', 'noopener')
}

async function share() {
  overflowOpen.value = false
  if (!props.chapterUrl) { emit('unsupported', 'The chapter source URL is not available in the web version.'); return }
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  try {
    if (typeof nav.share !== 'function') throw new Error('Sharing is not supported.')
    await nav.share({ title: props.chapterUrl!, url: props.chapterUrl! })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return
    emit('unsupported', 'Sharing is not supported in this browser.')
  }
}
</script>

<template>
  <!--
    ReaderAppBars.kt applies `Modifier.clickable(onClick = onClickTopAppBar)` to the whole top
    bar, so every part of the bar that is not an action opens the manga screen. The IconButtons
    keep their own click handling.
  -->
  <header
    ref="root"
    class="mr-topbar"
    role="banner"
    :style="{ '--mr-background': palette.background, '--mr-content': palette.content }"
    @click="emit('manga')"
  >
    <!-- AppBar.kt: navigationIcon = IconButton { UpIcon(AutoMirroredRounded.ArrowBack) }. -->
    <button type="button" class="mr-topbar-icon" aria-label="Back" @click.stop="emit('back')">
      <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
    </button>

    <!-- AppBarTitle: a Column with the title (titleLarge) and the subtitle (bodyMedium). -->
    <div class="mr-topbar-title" role="button" tabindex="0" aria-label="Open manga screen" @click.stop="emit('manga')" @keydown.enter="emit('manga')">
      <span v-if="mangaTitle" class="mr-topbar-manga">{{ mangaTitle }}</span>
      <span
        v-if="chapterTitle"
        ref="subtitleEl"
        class="mr-topbar-chapter"
        :class="{ 'mr-marquee': marquee }"
        :style="{ '--mr-marquee-shift': marqueeShift }"
      >{{ chapterTitle }}</span>
    </div>

    <div class="mr-topbar-actions">
      <!-- AppBar.Action(bookmark): Rounded.Bookmark, RoundedFilled.Bookmark when bookmarked. -->
      <span class="mr-topbar-btn-wrap">
        <button
          type="button"
          class="mr-topbar-icon"
          :disabled="!canBookmark"
          :aria-label="bookmarkLabel"
          @click.stop="emit('bookmark')"
        >
          <span class="material-symbols-rounded" :class="{ 'filled-symbol': bookmarked }" aria-hidden="true">bookmark</span>
        </button>
        <span class="mr-tooltip" role="tooltip">{{ bookmarkLabel }}</span>
      </span>

      <!-- AppBarActions only renders the overflow button when there is an overflow action. -->
      <span v-if="hasOverflow" class="mr-topbar-btn-wrap">
        <button
          type="button"
          class="mr-topbar-icon"
          aria-label="More options"
          :aria-expanded="overflowOpen"
          aria-haspopup="menu"
          @click.stop="overflowOpen = !overflowOpen"
        >
          <span class="material-symbols-rounded" aria-hidden="true">more_vert</span>
        </button>
        <span class="mr-tooltip" role="tooltip">More options</span>
      </span>
    </div>

    <!-- AppBar.kt overflow: IconButton(MoreVert) + DropdownMenu of DropdownMenuItem. -->
    <div v-if="overflowOpen && hasOverflow" class="mr-topbar-menu" role="menu" aria-label="More options" @click.stop>
      <button type="button" class="mr-topbar-menu-item" role="menuitem" @click="overflowOpen = false; emit('unsupported', 'Opening the chapter in a built-in web view is not supported in the web version.')">Open in web view</button>
      <button type="button" class="mr-topbar-menu-item" role="menuitem" @click="openInBrowser">Open in browser</button>
      <button type="button" class="mr-topbar-menu-item" role="menuitem" @click="share">Share</button>
    </div>
  </header>
</template>

<style scoped>
@layer app-components {
/* ReaderAppBars.kt: the whole top bar carries `surfaceColorAtElevation(3.dp)` with
   0.9 alpha in dark, so the reader content stays faintly visible through it. */
.mr-topbar {
  position: relative;
  display: flex;
  align-items: center;
  /* TopAppBar: the row has a 4dp horizontal padding. */
  padding: 0 4px;
  min-height: 64px;
  background: var(--mr-background);
  color: var(--mr-content);
}
/* MD3 IconButton: 48dp touch target, 24dp icon, transparent container. */
.mr-topbar-icon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.mr-topbar-icon:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.mr-topbar-icon:disabled { opacity: .38; cursor: default; }
/* AppBar.kt wraps every action in a TooltipBox with a PlainTooltip above the anchor. */
.mr-topbar-btn-wrap {
  position: relative;
  display: inline-flex;
}
.mr-tooltip {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 100ms ease;
}
.mr-topbar-btn-wrap:last-child .mr-tooltip {
  right: 0;
  left: auto;
  transform: none;
}
.mr-topbar-btn-wrap:hover .mr-tooltip,
.mr-topbar-btn-wrap:focus-within .mr-tooltip { opacity: 1; }
/* AppBarTitle: a Column with the title and the subtitle. The title slot of
   TopAppBar starts 4dp after the navigation icon. */
.mr-topbar-title {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  padding-left: 4px;
  color: inherit;
  text-align: start;
  cursor: pointer;
}
.mr-topbar-title:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* TopAppBar provides titleLarge to its title slot, so AppBarTitle's title uses it. */
.mr-topbar-manga {
  max-width: 100%;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mr-topbar-chapter {
  max-width: 100%;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: var(--mr-content);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* basicMarquee(repeatDelayMillis = 2000): the subtitle scrolls when it does not fit. */
.mr-topbar-chapter.mr-marquee {
  overflow: hidden;
  animation: mr-marquee 10s linear 2s infinite;
}
@keyframes mr-marquee {
  0%, 15% { transform: translateX(0); }
  60%, 100% { transform: translateX(var(--mr-marquee-shift, 0)); }
}
.mr-topbar-actions { flex: 0 0 auto; display: flex; align-items: center; }
/* androidx.compose.material3.DropdownMenu: 4dp (extraSmall) shape, surfaceContainer
   container, 3dp elevation, 112dp minimum width. */
.mr-topbar-menu {
  position: absolute;
  top: 64px;
  right: 4px;
  z-index: 30;
  min-width: 112px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  scrollbar-width: none;
  padding: 4px 0;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-container));
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
.mr-topbar-menu::-webkit-scrollbar {
  display: none;
}
/* DropdownMenuItem: 48dp row height, 12dp horizontal padding, bodyLarge text with
   FontWeight.Normal (the reference overrides the default labelLarge weight). */
.mr-topbar-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  text-align: start;
  cursor: pointer;
}
.mr-topbar-menu-item:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
}
</style>
