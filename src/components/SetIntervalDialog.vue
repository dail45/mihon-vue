<script setup lang="ts">
/**
 * Manga — "Smart update" (fetch interval) dialog.
 *
 * Pixel-parity port of Mihon's SetIntervalDialog:
 *   mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaDialogs.kt:66-153
 *   (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1)
 *
 * Reference structure (androidx.compose.material3.AlertDialog):
 *   - title    : "Smart update"      (MR.strings.pref_library_update_smart_update, L307)
 *   - text     : Column {
 *                   Text(expected-sentence | null-sentence)
 *                   Spacer(Modifier.height(MaterialTheme.padding.small))   // 8dp
 *                   if (onValueChanged != null && !isReleaseBuildType) {
 *                     Text("Custom update frequency:")
 *                     BoxWithConstraints(fillMaxWidth, contentAlignment = Center) {
 *                       val size = DpSize(width = maxWidth / 2, height = 128.dp)
 *                       WheelTextPicker(items = 0..28, size = size, startIndex = selectedInterval)
 *                     }
 *                   }
 *                 }
 *   - dismissButton : "Cancel" (MR.strings.action_cancel)
 *   - confirmButton : "OK"    (MR.strings.action_ok)
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   manga_interval_expected_update      = "New chapters predicted to be released in around %1$s, checking around every %2$s." (L808)
 *   manga_interval_expected_update_null = "This manga is either completed, or there is no predicted release date." (L809)
 *   manga_interval_custom_amount        = "Custom update frequency:" (L811)
 *   plurals.day                         = "1 day" / "%d days" (plurals.xml L38-41)
 *
 * Metrics (androidx.compose.material3.AlertDialog.kt + DialogTokens.kt + Button.kt):
 *   - container : surfaceContainerHigh, CornerExtraLarge (28dp), NO shadow (the AlertDialog
 *                 Surface passes tonalElevation only, so the dialog is flat), padding 24dp,
 *                 min width 280dp / max width 560dp
 *   - title     : HeadlineSmall (24sp / 32sp, w400) in onSurface, 16dp bottom gap
 *   - text      : BodyMedium (14sp / 20sp, w400) in onSurfaceVariant, 24dp bottom gap
 *   - buttons   : TextButton -> 40dp height, 58dp min width, 24dp side padding,
 *                 CornerFull (20dp) shape, LabelLarge (14sp / 20sp, w500) in primary,
 *                 pressed shape CornerSmall (4dp), 8% hover / 10% pressed state layers
 *   - AlertDialogFlowRow flips the layout direction, so the confirm button ("OK") renders
 *     rightmost while staying first in the semantics/a11y order.
 *
 * The wheel mirrors WheelTextPicker
 * (presentation-core/src/main/java/tachiyomi/presentation/core/components/WheelPicker.kt):
 *   - 128dp tall box, ROW_COUNT = 3 visible rows, one centred selection band
 *   - band = primary at 20% alpha, 1dp primary border, 16dp radius (MaterialTheme.padding.medium),
 *     height = 128dp / 3 = 42.667dp
 *   - items use titleMedium (16sp / 24sp, w500); the snapped row is fully opaque, the
 *     others fade to 20% (calculateAnimatedAlpha: 1.2 - distance / rowHeight)
 *   - content padding = 128dp / 3 * ((3 - 1) / 2) = 42.667dp top and bottom
 *   - items are 0..FetchInterval.MAX_INTERVAL (28); index 0 renders as "Default"
 *
 * Mihon stores a custom interval as a negative value, so the `interval` prop keeps that
 * convention: 0 = "Default", -n = check every n days. The `change` event reports the picked
 * index the way Mihon's `onValueChanged` does (0..28, 0 meaning "Default").
 *
 * Web limitation: Suwayomi's REST v1 has no per-manga update-interval field, so the picked
 * value is remembered in this browser only and a short note says so.
 */
import { computed, nextTick, ref, watch } from 'vue'

const open = defineModel<boolean>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Current fetch interval in days; negative means a custom interval (Mihon convention). */
    interval?: number
    /** Epoch milliseconds of the predicted next update, null when there is no prediction. */
    nextUpdate?: number | null
    /**
     * Whether the interval can be changed. Mihon passes `onValueChanged` only when the
     * update interval is enabled; the wheel is hidden and OK only dismisses otherwise.
     */
    editable?: boolean
    /** Manga id used to remember the chosen interval in this browser. */
    mangaId?: number | null
    /** Optional note rendered below the wheel; defaults to the Suwayomi limitation notice. */
    note?: string | null
  }>(),
  { interval: 0, nextUpdate: null, editable: true, mangaId: null, note: null },
)

const emit = defineEmits<{ (event: 'change', interval: number): void }>()

/** FetchInterval.MAX_INTERVAL */
const MAX_INTERVAL = 28
/** WheelPickerDefaults geometry: 128dp box, ROW_COUNT = 3. */
const PICKER_HEIGHT = 128
const ROW_COUNT = 3
const ROW_HEIGHT = PICKER_HEIGHT / ROW_COUNT

const DEFAULT_NOTE =
  'Suwayomi does not expose a per-manga update interval, so this value is remembered in this browser only. ' +
  'The server keeps its own update schedule.'

const items = computed(() => ['Default', ...Array.from({ length: MAX_INTERVAL }, (_, i) => String(i + 1))])

const selected = ref(0)
const scrollTop = ref(0)
const listEl = ref<HTMLElement | null>(null)

/** MR.plurals.day: "1 day" / "%d days". */
function pluralDays(count: number) {
  return count === 1 ? '1 day' : `${count} days`
}

/** Calendar days from today to the predicted update, never negative (kotlinx daysUntil). */
function daysUntil(timestamp: number) {
  const now = new Date(), target = new Date(timestamp)
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const to = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  return Math.max(0, Math.round((to - from) / 86400000))
}

/**
 * Mihon shows the predicted sentence only when a next update is known and the interval
 * is not a custom (negative) one; otherwise it shows the fallback text.
 */
const statusText = computed(() => {
  const days = props.nextUpdate == null ? null : daysUntil(props.nextUpdate)
  if (days != null && days >= 0 && props.interval >= 0) {
    return `New chapters predicted to be released in around ${pluralDays(days)}, checking around every ${pluralDays(
      Math.abs(props.interval),
    )}.`
  }
  return 'This manga is either completed, or there is no predicted release date.'
})

const noteText = computed(() => {
  if (props.note !== null && props.note !== undefined) return props.note
  return props.mangaId != null ? DEFAULT_NOTE : null
})

/** Client-side persistence: Suwayomi has no per-manga update interval field. */
const STORAGE_KEY = 'mihon-vue:manga-interval'

function storedInterval(): number | null {
  if (props.mangaId == null) return null
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${props.mangaId}`)
    if (raw == null) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function persistInterval(index: number) {
  if (props.mangaId == null) return
  try {
    // Mihon stores custom intervals as negative values (MangaViewModel.setFetchInterval).
    window.localStorage.setItem(`${STORAGE_KEY}:${props.mangaId}`, String(index === 0 ? 0 : -index))
  } catch {
    /* storage unavailable: the value simply is not remembered */
  }
}

/**
 * `rememberSaveable { mutableIntStateOf(if (interval < 0) -interval else 0) }`
 * — the wheel starts on the manga's current interval. The browser-side value is only
 * used when the server does not provide one (Suwayomi has no such field).
 */
function initialIndex() {
  const fromProp = props.interval < 0 ? -props.interval : 0
  const stored = storedInterval()
  const source = props.interval !== 0 ? fromProp : stored != null ? Math.abs(stored) : fromProp
  return Math.min(MAX_INTERVAL, Math.max(0, source))
}

function scrollToIndex(index: number) {
  const element = listEl.value
  if (element) element.scrollTop = index * ROW_HEIGHT
}

function onScroll() {
  const element = listEl.value
  if (!element) return
  scrollTop.value = element.scrollTop
  const index = Math.min(items.value.length - 1, Math.max(0, Math.round(element.scrollTop / ROW_HEIGHT)))
  if (index !== selected.value) selected.value = index
}

/** WheelPickerDefaults.calculateAnimatedAlpha: 1.2 at the snapped row, 0.2 off row. */
function rowAlpha(index: number) {
  const distance = Math.abs(index * ROW_HEIGHT - scrollTop.value)
  return Math.min(1, Math.max(0.2, 1.2 - distance / ROW_HEIGHT))
}

function selectIndex(index: number) {
  const next = Math.min(items.value.length - 1, Math.max(0, index))
  selected.value = next
  scrollToIndex(next)
}

function onKeydown(event: KeyboardEvent) {
  const keys: Record<string, number> = {
    ArrowUp: selected.value - 1,
    ArrowDown: selected.value + 1,
    PageUp: selected.value - 5,
    PageDown: selected.value + 5,
    Home: 0,
    End: items.value.length - 1,
  }
  const target = keys[event.key]
  if (target == null) return
  event.preventDefault()
  selectIndex(target)
}

/** Snap to the closest row once the wheel settles. */
function onScrollEnd() {
  selectIndex(Math.round(scrollTop.value / ROW_HEIGHT))
}

watch(open, async value => {
  if (!value) return
  selected.value = initialIndex()
  scrollTop.value = selected.value * ROW_HEIGHT
  await nextTick()
  scrollToIndex(selected.value)
})

function confirm() {
  if (props.editable) {
    persistInterval(selected.value)
    emit('change', selected.value)
  }
  open.value = false
}
</script>

<template>
  <v-dialog
    v-model="open"
    max-width="560"
    aria-labelledby="interval-dialog-title"
    aria-describedby="interval-dialog-text"
  >
    <v-card class="interval-dialog" :class="{ 'interval-dialog--editable': editable }" color="surface-container-high">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400); DialogTokens.HeadlineColor = OnSurface. -->
      <h2 id="interval-dialog-title" class="interval-dialog-title">Smart update</h2>
      <!-- DialogTokens.SupportingTextFont = BodyMedium (14/20, w400); SupportingTextColor = OnSurfaceVariant. -->
      <p id="interval-dialog-text" class="interval-dialog-text">{{ statusText }}</p>
      <!-- Spacer(Modifier.height(MaterialTheme.padding.small)) = 8dp between the two texts. -->
      <div v-if="editable" class="interval-dialog-custom">
        <p class="interval-dialog-text">Custom update frequency:</p>
        <!-- BoxWithConstraints(fillMaxWidth, contentAlignment = Center): size = DpSize(maxWidth / 2, 128.dp). -->
        <div class="interval-picker">
          <div class="interval-picker-band" aria-hidden="true" />
          <ul
            ref="listEl"
            class="interval-picker-list"
            role="listbox"
            tabindex="0"
            :aria-activedescendant="`interval-option-${selected}`"
            aria-label="Custom update frequency"
            @scroll.passive="onScroll"
            @scrollend="onScrollEnd"
            @keydown="onKeydown"
          >
            <li
              v-for="(item, index) in items"
              :id="`interval-option-${index}`"
              :key="index"
              class="interval-picker-item"
              role="option"
              :aria-selected="index === selected"
              :style="{ opacity: rowAlpha(index) }"
              @click="selectIndex(index)"
            >
              {{ item }}
            </li>
          </ul>
        </div>
        <p v-if="noteText" class="interval-dialog-note" role="status">{{ noteText }}</p>
      </div>
      <!-- AlertDialogFlowRow: confirm button first (semantics order), rendered rightmost. -->
      <div class="interval-dialog-actions">
        <button type="button" class="interval-dialog-button" @click="confirm">OK</button>
        <button type="button" class="interval-dialog-button" @click="open = false">Cancel</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
/* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge (28dp).
   The AlertDialog Surface passes tonalElevation only (0.dp), so there is NO shadow elevation.
   Container padding = 24dp, min width 280dp / max width 560dp. */
.interval-dialog {
  box-sizing: border-box;
  /* v-card sets flex: 1 1 var(--v-card-height, 100%), which would stretch the dialog to the
     full overlay height; Compose measures the alert to its content. */
  flex: 0 1 auto;
  align-self: center;
  /* BasicAlertDialog sizeIn(minWidth = 280dp, maxWidth = 560dp) with propagateMinConstraints:
     without the wheel the alert content Column is at least 280dp wide (280 - 2 * 24 = 232dp body). */
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 24px;
  border-radius: 28px !important;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: none !important;
  color: rgb(var(--v-theme-on-surface));
}
/* BoxWithConstraints(Modifier.fillMaxWidth()) sits in the text Column, so the Column takes the
   full max width: 560dp - 2 * 24dp = 512dp, and the dialog measures 560dp in total.
   The wheel then gets maxWidth / 2 = 256dp. */
.interval-dialog--editable {
  width: min(560px, calc(100% - 48px));
}
/* Title: DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, w400) in on-surface,
   DialogTokens.TitlePadding = 16dp bottom. */
.interval-dialog-title {
  margin: 0 0 16px;
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}
/* Supporting text: DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp, w400) in on-surface-variant. */
.interval-dialog-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* Spacer(Modifier.height(MaterialTheme.padding.small)) = 8dp between the two texts. */
.interval-dialog-custom { margin-top: 8px; }
.interval-dialog-note {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.0333333333em;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* AlertDialogDefaults.textPadding = 24dp bottom between the text block and the buttons. */
.interval-dialog-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 8px;
  margin-top: 24px;
}
/* MD3 TextButton: 40dp height (ButtonSmallTokens.ContainerHeight), 58dp min width,
   24dp side padding (ButtonDefaults.TextButtonContentPadding), CornerFull shape,
   LabelLarge (14sp / 20sp, w500) in primary. */
.interval-dialog-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-width: 58px;
  padding: 0 24px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  cursor: pointer;
  transition: border-radius 0.1s ease-in-out;
}
/* MD3 state layer: 8% on hover, 10% while pressed; the pressed shape morphs pill -> CornerSmall (4dp). */
.interval-dialog-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.interval-dialog-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); border-radius: 4px; }
.interval-dialog-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* WheelPickerDefaults.Background: primary at 20% alpha, 1dp primary border, 16dp radius
   (MaterialTheme.padding.medium), size = (width, height / ROW_COUNT). */
.interval-picker {
  position: relative;
  width: 50%;
  height: 128px;
  margin: 0 auto;
}
.interval-picker-band {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 42.6667px;
  transform: translateY(-50%);
  border-radius: 16px;
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 20%, transparent);
  border: 1px solid rgb(var(--v-theme-primary));
  pointer-events: none;
}
/* LazyColumn contentPadding = height / ROW_COUNT * ((ROW_COUNT - 1) / 2) = 42.667dp. */
.interval-picker-list {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 42.6667px 0;
  list-style: none;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.interval-picker-list::-webkit-scrollbar { display: none; }
/* WheelPickerDefaults.Item = titleMedium (16sp / 24sp, w500), maxLines = 1, centered.
   The Text has no explicit colour, so it inherits the Surface content colour (on-surface). */
.interval-picker-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42.6667px;
  scroll-snap-align: center;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.009375em;
  color: rgb(var(--v-theme-on-surface));
}
}
</style>
