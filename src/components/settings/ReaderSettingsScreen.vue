<script setup lang="ts">
/**
 * Settings — Reader.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsReaderScreen.kt
 * (Mihon 446f6df) and the widgets it renders:
 *   widget/BasePreferenceWidget.kt          — Row(minHeight 56dp), title titleLarge @16sp (max 2 lines),
 *                                              subtitle bodySmall @ .78 alpha (max 10 lines),
 *                                              trailing Box padding(end 16dp), switch start padding 16dp.
 *   widget/PreferenceGroupHeader.kt          — bodyMedium, colorScheme.secondary,
 *                                              padding(top 14dp, bottom 8dp, horizontal 16dp).
 *   widget/ListPreferenceWidget.kt          — row title + subtitle (current entry), AlertDialog with radio rows,
 *                                              confirm button "Cancel".
 *   widget/MultiSelectListPreferenceWidget.kt — row + AlertDialog with LabeledCheckbox rows, "OK" + "Cancel",
 *                                              subtitle = joined labels or "None".
 *   widget/TextPreferenceWidget.kt          — switch rows (title + optional bodySmall subtitle).
 *   PreferenceItem.kt (SliderPreference)    — BaseSliderItem: Column(spacedBy 2dp) { Row(title titleLarge 16sp + Pill),
 *                                              Slider }, padding(horizontal 16dp, vertical 16dp).
 *   PreferenceScreen.kt                      — 12dp spacer after every group except the last.
 *
 * Preference values are stored in localStorage through src/stores/preferences.ts (the shared Pinia
 * store must not be touched by this task). Keys and value formats reuse the ones already written by
 * src/components/reader/ReaderSettingsDialog.vue so both surfaces stay in sync.
 *
 * Android-only reader features (orientation lock, display cutout, e-ink flash, tap zones, volume keys,
 * vertical chapter navigator, long tap actions, folder-per-manga, chapter skip filters, page transitions)
 * have no browser equivalent: the row keeps the reference layout and stays visible, but its control is
 * disabled and an explicit "not supported in the web version" note is shown under the row.
 */
import { computed, ref, watch } from 'vue'
import Md3Slider from '../Md3Slider.vue'
import Md3Switch from '../Md3Switch.vue'
import { readPreference, writePreference } from '../../stores/preferences'
import { useReaderPreferences } from '../../stores/readerPreferences'

const reader = useReaderPreferences()

// --- persistence (same helpers/keys as ReaderSettingsDialog.vue) ----------------------------
function persistedStr(key: string, fallback: string) {
  const stored = readPreference(key)
  const value = ref(stored === null ? fallback : stored)
  watch(value, v => writePreference(key, v))
  return value
}
function persistedInt(key: string, fallback: number) {
  const stored = readPreference(key)
  const parsed = stored === null ? Number.NaN : Number(stored)
  const value = ref(Number.isFinite(parsed) ? parsed : fallback)
  watch(value, v => writePreference(key, String(v)))
  return value
}
function persistedBool(key: string, fallback: boolean) {
  const stored = readPreference(key)
  const value = ref(stored === null ? fallback : stored === 'true')
  watch(value, v => writePreference(key, String(v)))
  return value
}

// --- top level preferences (SettingsReaderScreen.kt lines 30-76) --------------------------
// ReadingMode.entries.drop(1): LEFT_TO_RIGHT, RIGHT_TO_LEFT, VERTICAL, WEBTOON, CONTINUOUS_VERTICAL.
const defaultReadingMode = persistedStr('mihon.reader.modeChoice', reader.mode === 'webtoon' ? 'webtoon' : reader.mode === 'rtl' ? 'rtl' : 'ltr')
// doubleTapAnimSpeed: 1 = No animation, 500 = Normal, 250 = Fast.
const doubleTapAnimSpeed = persistedInt('mihon.reader.doubleTapAnimSpeed', 500)
const showReadingMode = persistedBool('mihon.reader.showReadingMode', true)
const showNavigationOverlayOnStart = persistedBool('mihon.reader.showNavigationOverlayOnStart', false)
const pageTransitions = persistedBool('mihon.reader.pageTransitions', true)
const loadAheadOnlyOverWifi = persistedBool('mihon.reader.loadAheadOnlyOverWifi', true)

// --- Display group (lines 78-118) ----------------------------------------------------------
// ReaderOrientation.entries.drop(1): FREE, PORTRAIT, LANDSCAPE, LOCKED_PORTRAIT, LOCKED_LANDSCAPE, REVERSE_PORTRAIT.
const defaultOrientationType = persistedStr('mihon.reader.rotation', 'default')
const readerTheme = persistedStr('mihon.reader.theme', reader.background === 'paper' ? 'white' : reader.background === 'gray' ? 'gray' : 'black')
const fullscreen = persistedBool('mihon.reader.fullscreen', true)
const drawUnderCutout = persistedBool('mihon.reader.drawUnderCutout', true)
const keepScreenOn = persistedBool('mihon.reader.keepScreenOn', false)
const showPageNumber = persistedBool('mihon.reader.showPageNumber', true)

// --- E-Ink group (lines 120-161) -----------------------------------------------------------
const flashOnPageChange = persistedBool('mihon.reader.flashOnPageChange', false)
const flashDurationMillis = persistedInt('mihon.reader.flashDuration', 100)
const flashPageInterval = persistedInt('mihon.reader.flashInterval', 1)
// FlashColor: BLACK, WHITE, WHITE_BLACK.
const flashColor = persistedStr('mihon.reader.flashColor', 'black')

// --- Reading group (lines 163-186) ---------------------------------------------------------
const skipRead = persistedBool('mihon.reader.skipRead', false)
const skipFiltered = persistedBool('mihon.reader.skipFiltered', true)
const skipDupe = persistedBool('mihon.reader.skipDupe', false)
const alwaysShowChapterTransition = persistedBool('mihon.reader.alwaysShowChapterTransition', true)

// --- Paged group (lines 188-279) -----------------------------------------------------------
const navigationModePager = persistedStr('mihon.reader.tapZonePager', '0')
const pagerNavInverted = persistedStr('mihon.reader.tapInvertPager', 'none')
const imageScaleType = persistedInt('mihon.reader.scaleType', reader.fit === 'width' ? 3 : 1)
const zoomStart = persistedStr('mihon.reader.zoomStart', '1')
const cropBorders = persistedBool('mihon.reader.cropBorders', false)
const landscapeZoom = persistedBool('mihon.reader.landscapeZoom', true)
const navigateToPan = persistedBool('mihon.reader.navigateToPan', true)
const dualPageSplitPaged = persistedBool('mihon.reader.dualPageSplitPaged', false)
const dualPageInvertPaged = persistedBool('mihon.reader.dualPageInvertPaged', false)
const dualPageRotateToFit = persistedBool('mihon.reader.dualPageRotateToFit', false)
const dualPageRotateToFitInvert = persistedBool('mihon.reader.dualPageRotateToFitInvert', false)
watch(dualPageSplitPaged, v => { if (v) dualPageRotateToFit.value = false })
watch(dualPageRotateToFit, v => { if (v) dualPageSplitPaged.value = false })

// --- Long strip group (lines 281-374) ------------------------------------------------------
const navigationModeWebtoon = persistedStr('mihon.reader.tapZoneWebtoon', '0')
const webtoonNavInverted = persistedStr('mihon.reader.tapInvertWebtoon', 'none')
const webtoonSidePadding = persistedInt('mihon.reader.webtoonPadding', 0)
const readerHideThreshold = persistedStr('mihon.reader.readerHideThreshold', 'low')
const cropBordersWebtoon = persistedBool('mihon.reader.cropBordersWebtoon', false)
const dualPageSplitWebtoon = persistedBool('mihon.reader.dualPageSplitWebtoon', false)
const dualPageInvertWebtoon = persistedBool('mihon.reader.dualPageInvertWebtoon', false)
const dualPageRotateToFitWebtoon = persistedBool('mihon.reader.dualPageRotateToFitWebtoon', false)
const dualPageRotateToFitInvertWebtoon = persistedBool('mihon.reader.dualPageRotateToFitInvertWebtoon', false)
watch(dualPageSplitWebtoon, v => { if (v) dualPageRotateToFitWebtoon.value = false })
watch(dualPageRotateToFitWebtoon, v => { if (v) dualPageSplitWebtoon.value = false })
const webtoonDoubleTapZoomEnabled = persistedBool('mihon.reader.doubleTapZoom', true)
const webtoonDisableZoomOut = persistedBool('mihon.reader.disableZoomOut', false)

// --- Navigation group (lines 376-415) ------------------------------------------------------
const readWithVolumeKeys = persistedBool('mihon.reader.readWithVolumeKeys', false)
const readWithVolumeKeysInverted = persistedBool('mihon.reader.readWithVolumeKeysInverted', false)
// MultiSelectListPreference over ReadingMode.entries minus DEFAULT.
const verticalNavigator = persistedStr('mihon.reader.verticalNavigator', '')
const verticalNavigatorOnLeft = persistedBool('mihon.reader.verticalNavigatorOnLeft', false)
const verticalNavigatorHeight = persistedInt('mihon.reader.verticalNavigatorHeight', 65)

// --- Actions group (lines 417-433) ---------------------------------------------------------
const readWithLongTap = persistedBool('mihon.reader.readWithLongTap', true)
const folderPerManga = persistedBool('mihon.reader.folderPerManga', false)

// Web-client addition (not in the reference): reading progress is opt-in here.
const saveProgress = persistedBool('mihon.reader.saveProgress', reader.saveProgress === true)
watch(saveProgress, value => { reader.saveProgress = value })

// --- keep the web reader in sync with the preferences it can honour -------------------------
const modeMap: Record<string, 'ltr' | 'rtl' | 'webtoon'> = { ltr: 'ltr', rtl: 'rtl', webtoon: 'webtoon' }
watch(defaultReadingMode, v => { const m = modeMap[v]; if (m) reader.mode = m })
watch(imageScaleType, v => { reader.fit = v === 3 ? 'width' : 'page' })
watch(readerTheme, v => {
  reader.background = v === 'white' ? 'paper' : v === 'gray' ? 'gray' : v === 'auto' ? (reader.background === 'gray' ? 'gray' : 'black') : 'black'
})

// --- entries --------------------------------------------------------------------------------
type EntryValue = number | string
type Entry = { value: EntryValue; label: string }

const readingModeEntries: Entry[] = [
  { value: 'ltr', label: 'Paged (left to right)' },
  { value: 'rtl', label: 'Paged (right to left)' },
  { value: 'vertical', label: 'Paged (vertical)' },
  { value: 'webtoon', label: 'Long strip' },
  { value: 'continuous', label: 'Long strip with gaps' },
]
const doubleTapAnimSpeedEntries: Entry[] = [
  { value: 1, label: 'No animation' },
  { value: 500, label: 'Normal' },
  { value: 250, label: 'Fast' },
]
const orientationEntries: Entry[] = [
  { value: 'free', label: 'Free' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'locked_portrait', label: 'Locked portrait' },
  { value: 'locked_landscape', label: 'Locked landscape' },
  { value: 'reverse_portrait', label: 'Reverse portrait' },
]
const themeEntries: Entry[] = [
  { value: 'black', label: 'Black' },
  { value: 'gray', label: 'Gray' },
  { value: 'white', label: 'White' },
  { value: 'auto', label: 'Auto' },
]
const flashColorEntries: Entry[] = [
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'white_black', label: 'White and Black' },
]
// ReaderPreferences.TapZones
const tapZoneEntries: Entry[] = [
  { value: '0', label: 'Default' },
  { value: '1', label: 'L shaped' },
  { value: '2', label: 'Kindle-ish' },
  { value: '3', label: 'Edge' },
  { value: '4', label: 'Right and Left' },
  { value: '5', label: 'Disabled' },
]
// TappingInvertMode
const invertEntries: Entry[] = [
  { value: 'none', label: 'None' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'both', label: 'Both' },
]
// ImageScaleType
const scaleTypeEntries: Entry[] = [
  { value: 1, label: 'Fit screen' },
  { value: 2, label: 'Stretch' },
  { value: 3, label: 'Fit width' },
  { value: 4, label: 'Fit height' },
  { value: 5, label: 'Original size' },
  { value: 6, label: 'Smart fit' },
]
// ZoomStart
const zoomStartEntries: Entry[] = [
  { value: '1', label: 'Automatic' },
  { value: '2', label: 'Left' },
  { value: '3', label: 'Right' },
  { value: '4', label: 'Center' },
]
// ReaderHideThreshold
const hideThresholdEntries: Entry[] = [
  { value: 'highest', label: 'Highest' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' },
]

// --- item model ------------------------------------------------------------------------------
type SwitchItem = { kind: 'switch'; key: string; title: string; subtitle?: string; model: { value: boolean }; supported: boolean; note?: string }
type ListItem = { kind: 'list'; key: string; title: string; entries: Entry[]; model: { value: EntryValue }; supported: boolean; note?: string }
type MultiItem = { kind: 'multi'; key: string; title: string; entries: Entry[]; model: { value: string }; supported: boolean; note?: string }
type SliderItem = { kind: 'slider'; key: string; title: string; model: { value: number }; min: number; max: number; step: number; valueText: string; supported: boolean; note?: string }
type Item = SwitchItem | ListItem | MultiItem | SliderItem
type Group = { header: string | null; items: Item[] }

const unsupported = 'Not supported in the web version: this is an Android reader feature.'

const groups = computed<Group[]>(() => {
  const result: Group[] = []

  // Top level items have no group header in the reference.
  const top: Item[] = [
    {
      kind: 'list', key: 'defaultReadingMode', title: 'Default reading mode', entries: readingModeEntries,
      model: defaultReadingMode, supported: true,
      note: 'The web reader renders paged (left to right / right to left) and long strip modes. Paged vertical and long strip with gaps are not implemented.',
    },
    { kind: 'list', key: 'doubleTapAnimSpeed', title: 'Double tap animation speed', entries: doubleTapAnimSpeedEntries, model: doubleTapAnimSpeed, supported: false, note: unsupported },
    { kind: 'switch', key: 'showReadingMode', title: 'Show reading mode', subtitle: 'Briefly show current mode when reader is opened', model: showReadingMode, supported: false, note: unsupported },
    { kind: 'switch', key: 'showNavigationOverlayOnStart', title: 'Show tap zones overlay', subtitle: 'Briefly show when reader is opened', model: showNavigationOverlayOnStart, supported: false, note: unsupported },
    { kind: 'switch', key: 'pageTransitions', title: 'Animate page transitions', model: pageTransitions, supported: false, note: unsupported },
    { kind: 'switch', key: 'loadAheadOnlyOverWifi', title: 'Load ahead only on Wi-Fi', subtitle: "Saves mobile data by loading only the pages near the one you're reading", model: loadAheadOnlyOverWifi, supported: false, note: unsupported },
  ]
  result.push({ header: null, items: top })

  // Display
  const display: Item[] = [
    { kind: 'list', key: 'defaultOrientationType', title: 'Default rotation', entries: orientationEntries, model: defaultOrientationType, supported: false, note: unsupported },
    { kind: 'list', key: 'readerTheme', title: 'Background color', entries: themeEntries, model: readerTheme, supported: true },
    { kind: 'switch', key: 'fullscreen', title: 'Fullscreen', model: fullscreen, supported: false, note: unsupported },
  ]
  // drawUnderCutout is only visible on devices with a display cutout, and only while fullscreen is on.
  if (fullscreen.value) display.push({ kind: 'switch', key: 'drawUnderCutout', title: 'Show content in cutout area', model: drawUnderCutout, supported: false, note: unsupported })
  display.push(
    { kind: 'switch', key: 'keepScreenOn', title: 'Keep screen on', model: keepScreenOn, supported: true },
    { kind: 'switch', key: 'showPageNumber', title: 'Show page number', model: showPageNumber, supported: true },
  )
  result.push({ header: 'Display', items: display })

  // E-Ink
  const eink: Item[] = [
    { kind: 'switch', key: 'flashOnPageChange', title: 'Flash on page change', subtitle: 'Reduces ghosting on e-ink displays', model: flashOnPageChange, supported: false, note: unsupported },
  ]
  if (flashOnPageChange.value) {
    eink.push(
      { kind: 'slider', key: 'flashDurationMillis', title: 'Flash duration', model: flashDurationMillis, min: 100, max: 1500, step: 100, valueText: `${flashDurationMillis.value} ms`, supported: false, note: unsupported },
      { kind: 'slider', key: 'flashPageInterval', title: 'Flash every', model: flashPageInterval, min: 1, max: 10, step: 1, valueText: flashPageInterval.value === 1 ? '1 page' : `${flashPageInterval.value} pages`, supported: false, note: unsupported },
      { kind: 'list', key: 'flashColor', title: 'Flash with', entries: flashColorEntries, model: flashColor, supported: false, note: unsupported },
    )
  }
  result.push({ header: 'E-Ink', items: eink })

  // Reading
  result.push({
    header: 'Reading',
    items: [
      { kind: 'switch', key: 'skipRead', title: 'Skip chapters marked read', model: skipRead, supported: false, note: unsupported },
      { kind: 'switch', key: 'skipFiltered', title: 'Skip filtered chapters', model: skipFiltered, supported: false, note: unsupported },
      { kind: 'switch', key: 'skipDupe', title: 'Skip duplicate chapters', model: skipDupe, supported: false, note: unsupported },
      { kind: 'switch', key: 'alwaysShowChapterTransition', title: 'Always show chapter transition', model: alwaysShowChapterTransition, supported: false, note: unsupported },
      // Web-client addition: Mihon always stores reading progress, this client opts in because
      // legacy REST versions may return default lastPageRead values.
      { kind: 'switch', key: 'saveProgress', title: 'Automatically save reading progress', model: saveProgress, supported: true, note: 'Web client addition: only displayed, loaded pages are saved to Suwayomi, and the final page marks the chapter as read.' },
    ],
  })

  // Paged
  const paged: Item[] = [
    { kind: 'list', key: 'navigationModePager', title: 'Tap zones', entries: tapZoneEntries, model: navigationModePager, supported: false, note: unsupported },
  ]
  if (navigationModePager.value !== '5') paged.push({ kind: 'list', key: 'pagerNavInverted', title: 'Invert tap zones', entries: invertEntries, model: pagerNavInverted, supported: false, note: unsupported })
  paged.push(
    { kind: 'list', key: 'imageScaleType', title: 'Scale type', entries: scaleTypeEntries, model: imageScaleType, supported: true },
    { kind: 'list', key: 'zoomStart', title: 'Zoom start position', entries: zoomStartEntries, model: zoomStart, supported: false, note: unsupported },
    { kind: 'switch', key: 'cropBorders', title: 'Crop borders', model: cropBorders, supported: false, note: unsupported },
  )
  if (imageScaleType.value === 1) paged.push({ kind: 'switch', key: 'landscapeZoom', title: 'Automatically zoom into wide images', model: landscapeZoom, supported: false, note: unsupported })
  if (navigationModePager.value !== '5') paged.push({ kind: 'switch', key: 'navigateToPan', title: 'Pan wide images', model: navigateToPan, supported: false, note: unsupported })
  paged.push({ kind: 'switch', key: 'dualPageSplitPaged', title: 'Split wide pages', model: dualPageSplitPaged, supported: false, note: unsupported })
  if (dualPageSplitPaged.value) paged.push({ kind: 'switch', key: 'dualPageInvertPaged', title: 'Invert split page placement', subtitle: "If the placement of the split wide pages don't match reading direction", model: dualPageInvertPaged, supported: false, note: unsupported })
  paged.push({ kind: 'switch', key: 'dualPageRotateToFit', title: 'Rotate wide pages to fit', model: dualPageRotateToFit, supported: false, note: unsupported })
  if (dualPageRotateToFit.value) paged.push({ kind: 'switch', key: 'dualPageRotateToFitInvert', title: 'Flip orientation of rotated wide pages', model: dualPageRotateToFitInvert, supported: false, note: unsupported })
  result.push({ header: 'Paged', items: paged })

  // Long strip
  const webtoon: Item[] = [
    { kind: 'list', key: 'navigationModeWebtoon', title: 'Tap zones', entries: tapZoneEntries, model: navigationModeWebtoon, supported: false, note: unsupported },
  ]
  if (navigationModeWebtoon.value !== '5') webtoon.push({ kind: 'list', key: 'webtoonNavInverted', title: 'Invert tap zones', entries: invertEntries, model: webtoonNavInverted, supported: false, note: unsupported })
  webtoon.push(
    { kind: 'slider', key: 'webtoonSidePadding', title: 'Side padding', model: webtoonSidePadding, min: 0, max: 25, step: 1, valueText: `${webtoonSidePadding.value}%`, supported: true },
    { kind: 'list', key: 'readerHideThreshold', title: 'Sensitivity for hiding menu on scroll', entries: hideThresholdEntries, model: readerHideThreshold, supported: false, note: unsupported },
    { kind: 'switch', key: 'cropBordersWebtoon', title: 'Crop borders', model: cropBordersWebtoon, supported: false, note: unsupported },
    { kind: 'switch', key: 'dualPageSplitWebtoon', title: 'Split wide pages', model: dualPageSplitWebtoon, supported: false, note: unsupported },
  )
  if (dualPageSplitWebtoon.value) webtoon.push({ kind: 'switch', key: 'dualPageInvertWebtoon', title: 'Invert split page placement', subtitle: "If the placement of the split wide pages don't match reading direction", model: dualPageInvertWebtoon, supported: false, note: unsupported })
  webtoon.push({ kind: 'switch', key: 'dualPageRotateToFitWebtoon', title: 'Rotate wide pages to fit', model: dualPageRotateToFitWebtoon, supported: false, note: unsupported })
  if (dualPageRotateToFitWebtoon.value) webtoon.push({ kind: 'switch', key: 'dualPageRotateToFitInvertWebtoon', title: 'Flip orientation of rotated wide pages', model: dualPageRotateToFitInvertWebtoon, supported: false, note: unsupported })
  webtoon.push(
    { kind: 'switch', key: 'webtoonDoubleTapZoomEnabled', title: 'Double tap to zoom', model: webtoonDoubleTapZoomEnabled, supported: false, note: unsupported },
    { kind: 'switch', key: 'webtoonDisableZoomOut', title: 'Disable zoom out', model: webtoonDisableZoomOut, supported: false, note: unsupported },
  )
  result.push({ header: 'Long strip', items: webtoon })

  // Navigation
  const navigation: Item[] = [
    { kind: 'switch', key: 'readWithVolumeKeys', title: 'Volume keys', model: readWithVolumeKeys, supported: false, note: unsupported },
  ]
  if (readWithVolumeKeys.value) navigation.push({ kind: 'switch', key: 'readWithVolumeKeysInverted', title: 'Invert volume keys', model: readWithVolumeKeysInverted, supported: false, note: unsupported })
  navigation.push({ kind: 'multi', key: 'verticalNavigator', title: 'Use vertical chapter navigator in', entries: readingModeEntries, model: verticalNavigator, supported: false, note: unsupported })
  if (verticalNavigator.value) {
    navigation.push(
      { kind: 'switch', key: 'verticalNavigatorOnLeft', title: 'Place vertical navigator on the left side', model: verticalNavigatorOnLeft, supported: false, note: unsupported },
      { kind: 'slider', key: 'verticalNavigatorHeight', title: 'Vertical navigator height', model: verticalNavigatorHeight, min: 65, max: 100, step: 5, valueText: String(verticalNavigatorHeight.value), supported: false, note: unsupported },
    )
  }
  result.push({ header: 'Navigation', items: navigation })

  // Actions
  result.push({
    header: 'Actions',
    items: [
      { kind: 'switch', key: 'readWithLongTap', title: 'Show actions on long tap', model: readWithLongTap, supported: false, note: unsupported },
      { kind: 'switch', key: 'folderPerManga', title: 'Save pages into separate folders', subtitle: "Creates folders according to entries' title", model: folderPerManga, supported: false, note: unsupported },
    ],
  })

  return result
})

// --- dialogs --------------------------------------------------------------------------------
type DialogState =
  | { kind: 'list'; title: string; entries: Entry[]; selected: EntryValue; model: { value: EntryValue } }
  | { kind: 'multi'; title: string; entries: Entry[]; selected: EntryValue[] }
  | null

const dialog = ref<DialogState>(null)
const multiDraft = ref<EntryValue[]>([])

function openList(item: ListItem) {
  dialog.value = { kind: 'list', title: item.title, entries: item.entries, selected: item.model.value, model: item.model }
}
function openMulti(item: MultiItem) {
  multiDraft.value = verticalNavigator.value ? verticalNavigator.value.split(',').filter(Boolean) : []
  dialog.value = { kind: 'multi', title: item.title, entries: item.entries, selected: multiDraft.value }
}
function pickList(value: EntryValue) {
  const current = dialog.value
  if (!current || current.kind !== 'list') return
  current.model.value = value
  dialog.value = null
}
function toggleMulti(value: EntryValue) {
  multiDraft.value = multiDraft.value.includes(value)
    ? multiDraft.value.filter(v => v !== value)
    : [...multiDraft.value, value]
}
function confirmMulti() {
  verticalNavigator.value = multiDraft.value.join(',')
  dialog.value = null
}
function listSubtitle(item: ListItem) {
  return item.entries.find(e => e.value === item.model.value)?.label ?? ''
}
function multiSubtitle(item: MultiItem) {
  const labels = (verticalNavigator.value ? verticalNavigator.value.split(',').filter(Boolean) : [])
    .map(v => item.entries.find(e => e.value === v)?.label).filter((l): l is string => Boolean(l))
  return labels.length ? labels.join(', ') : 'None'
}
</script>

<template>
  <div class="reader-settings" role="group" aria-label="Reader settings">
    <section v-for="(group, groupIndex) in groups" :key="group.header ?? 'top'" class="reader-settings-group">
      <!-- PreferenceGroupHeader.kt: bodyMedium, secondary, padding(top 14dp, bottom 8dp, horizontal 16dp). -->
      <h2 v-if="group.header" class="pref-group-header">{{ group.header }}</h2>

      <template v-for="item in group.items" :key="`${item.kind}-${item.key}`">
        <!-- TextPreferenceWidget.kt: switch row, title + optional bodySmall subtitle. Entire row is clickable. -->
        <div
          v-if="item.kind === 'switch'"
          class="pref-row"
          :class="{ 'pref-row--interactive': item.supported, 'pref-row--disabled': !item.supported }"
          @click="item.supported && ((item.model as { value: boolean }).value = !(item.model as { value: boolean }).value)"
        >
          <span class="pref-text">
            <span class="pref-title">{{ item.title }}</span>
            <span v-if="item.subtitle" class="pref-subtitle">{{ item.subtitle }}</span>
          </span>
          <span class="pref-trailing">
            <Md3Switch
              :model-value="item.model.value"
              :disabled="!item.supported"
              :label="item.title"
              @update:model-value="(value: boolean) => (item.model as { value: boolean }).value = value"
            />
          </span>
        </div>

        <!-- ListPreferenceWidget.kt: title + subtitle = current entry, opens a radio dialog. -->
        <button v-else-if="item.kind === 'list'" type="button" class="pref-row pref-row--button" @click="openList(item)">
          <span class="pref-text">
            <span class="pref-title">{{ item.title }}</span>
            <span class="pref-subtitle">{{ listSubtitle(item) }}</span>
          </span>
        </button>

        <!-- MultiSelectListPreferenceWidget.kt: title + subtitle = joined labels, opens a checkbox dialog. -->
        <button v-else-if="item.kind === 'multi'" type="button" class="pref-row pref-row--button" @click="openMulti(item)">
          <span class="pref-text">
            <span class="pref-title">{{ item.title }}</span>
            <span class="pref-subtitle">{{ multiSubtitle(item) }}</span>
          </span>
        </button>

        <!-- BaseSliderItem.kt: Column(spacedBy 2dp) { Row(title + Pill), Slider }, padding 16dp. -->
        <div v-else class="pref-slider">
          <div class="pref-slider-header">
            <span class="pref-slider-title">{{ item.title }}</span>
            <span class="pref-pill">{{ item.valueText }}</span>
          </div>
          <Md3Slider
            :model-value="item.model.value"
            :min="item.min"
            :max="item.max"
            :step="item.step"
            :disabled="!item.supported"
            :label="item.title"
            :value-text="item.valueText"
            @update:model-value="(value: number) => (item.model as { value: number }).value = value"
          />
        </div>

        <p v-if="item.note" class="pref-note">{{ item.note }}</p>
      </template>

      <!-- PreferenceScreen.kt: Spacer(12.dp) after every group except the last one. -->
      <div v-if="groupIndex < groups.length - 1" class="pref-group-spacer" />
    </section>

    <!-- ListPreferenceWidget.kt: AlertDialog with radio rows and a "Cancel" confirm button. -->
    <v-dialog
      :model-value="dialog?.kind === 'list'"
      max-width="560"
      @update:model-value="value => { if (!value) dialog = null }"
    >
      <v-card v-if="dialog?.kind === 'list'" class="pref-dialog" rounded="xl">
        <h3 class="pref-dialog-title">{{ dialog.title }}</h3>
        <div class="pref-dialog-body">
          <button
            v-for="entry in dialog.entries"
            :key="entry.value"
            type="button"
            class="pref-dialog-row"
            role="radio"
            :aria-checked="dialog.selected === entry.value"
            @click="pickList(entry.value)"
          >
            <span class="pref-radio" :class="{ 'pref-radio--on': dialog.selected === entry.value }" aria-hidden="true"><i /></span>
            <span class="pref-dialog-label">{{ entry.label }}</span>
          </button>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="dialog = null">Cancel</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- MultiSelectListPreferenceWidget.kt: AlertDialog with labeled checkboxes, "OK" and "Cancel". -->
    <v-dialog
      :model-value="dialog?.kind === 'multi'"
      max-width="560"
      @update:model-value="value => { if (!value) dialog = null }"
    >
      <v-card v-if="dialog?.kind === 'multi'" class="pref-dialog" rounded="xl">
        <h3 class="pref-dialog-title">{{ dialog.title }}</h3>
        <div class="pref-dialog-body">
          <button
            v-for="entry in dialog.entries"
            :key="entry.value"
            type="button"
            class="pref-dialog-row"
            role="checkbox"
            :aria-checked="multiDraft.includes(entry.value)"
            @click="toggleMulti(entry.value)"
          >
            <span class="pref-checkbox" :class="{ 'pref-checkbox--on': multiDraft.includes(entry.value) }" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            </span>
            <span class="pref-dialog-label">{{ entry.label }}</span>
          </button>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="dialog = null">Cancel</v-btn>
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="confirmMulti">OK</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@layer app-components {
.reader-settings { display: block; }
.reader-settings-group { display: block; }

/* PreferenceGroupHeader.kt: bodyMedium (14/20), colorScheme.secondary, padding 14dp/8dp/16dp. */
.pref-group-header {
  margin: 0;
  padding: 14px 16px 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: rgb(var(--v-theme-secondary));
}
/* PreferenceScreen.kt: Spacer(12.dp) between groups. */
.pref-group-spacer { height: 12px; }

/* BasePreferenceWidget.kt: sizeIn(minHeight = 56dp), horizontal padding 16dp. */
.pref-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 16px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
}
.pref-row--button,
.pref-row--interactive {
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.pref-row--button:hover,
.pref-row--interactive:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.pref-row--interactive:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.pref-row--disabled {
  cursor: default;
}
.pref-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
.pref-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
/* TextPreferenceWidget.kt: subtitle bodySmall with secondaryItemAlpha (.78), max 10 lines. */
.pref-subtitle {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
}
/* BasePreferenceWidget.kt: trailing widget Box padding(end = PrefsHorizontalPadding). */
.pref-trailing { padding-inline-end: 16px; }

/* BaseSliderItem.kt: padding(horizontal 16dp, vertical 16dp), Column spacedBy 2dp. */
.pref-slider { display: flex; flex-direction: column; gap: 2px; padding: 16px; }
.pref-slider-header { display: flex; align-items: center; gap: 8px; }
.pref-slider-title { flex: 1 1 auto; font-size: 16px; line-height: 24px; font-weight: 500; color: rgb(var(--v-theme-on-surface)); }
/* Pill.kt: surfaceContainerHigh, extraLarge shape, padding(6dp, 1dp), start padding 4dp, bodyMedium. */
.pref-pill {
  flex: 0 0 auto;
  margin-inline-start: 4px;
  padding: 1px 6px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
}

.pref-note {
  margin: 0;
  padding: 0 16px 8px;
  font-size: 12px;
  line-height: 18px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* ListPreferenceWidget.kt / MultiSelectListPreferenceWidget.kt: MD3 AlertDialog. */
.pref-dialog { padding: 24px; background: rgb(var(--v-theme-surface-container-high)); color: rgb(var(--v-theme-on-surface)); }
.pref-dialog-title { margin: 0 0 16px; font-size: 24px; line-height: 32px; font-weight: 400; }
.pref-dialog-body { display: flex; flex-direction: column; max-height: 320px; overflow-y: auto; }
/* DialogRow.kt: clip(small) + selectable + minimumInteractiveComponentSize (48dp). */
.pref-dialog-row {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.pref-dialog-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
/* MD3 RadioButton: 20dp outer circle, 10dp inner dot. */
.pref-radio {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
}
.pref-radio--on { border-color: rgb(var(--v-theme-primary)); }
.pref-radio i { display: none; width: 10px; height: 10px; border-radius: 50%; background: rgb(var(--v-theme-primary)); }
.pref-radio--on i { display: block; }
/* MD3 Checkbox: 18dp box, 2dp radius, 2dp outline. */
.pref-checkbox {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
}
.pref-checkbox--on { background: rgb(var(--v-theme-primary)); border-color: rgb(var(--v-theme-primary)); }
.pref-checkbox svg { width: 14px; height: 14px; fill: rgb(var(--v-theme-on-primary)); opacity: 0; }
.pref-checkbox--on svg { opacity: 1; }
/* Text(bodyLarge) with start padding 24dp. */
.pref-dialog-label { margin-inline-start: 24px; font-size: 16px; line-height: 24px; }
.pref-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.pref-dialog-button { min-width: 64px; }
}
</style>
