import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readPreference, writePreference } from './preferences'

export type ReadingMode = 'ltr' | 'rtl' | 'webtoon'
export type ReaderBackground = 'black' | 'paper' | 'gray' | 'white'

function resolveInitialReaderTheme(): number {
  const prefKey = readPreference('pref_reader_theme_key')
  if (prefKey !== null) {
    const num = Number(prefKey)
    if ([0, 1, 2, 3].includes(num)) return num
  }
  const mihonTheme = readPreference('mihon.reader.theme')
  if (mihonTheme !== null) {
    if (mihonTheme === 'white' || mihonTheme === '0') return 0
    if (mihonTheme === 'gray' || mihonTheme === '2') return 2
    if (mihonTheme === 'auto' || mihonTheme === '3') return 3
    if (mihonTheme === 'black' || mihonTheme === '1') return 1
  }
  const bg = readPreference('mihon.reader.background')
  if (bg === 'paper' || bg === 'white') return 0
  if (bg === 'gray') return 2
  return 1 // Default Black (1)
}

function themeToBackground(theme: number): ReaderBackground {
  switch (theme) {
    case 0: return 'white'
    case 2: return 'gray'
    case 3: {
      const isDark = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
      return isDark ? 'gray' : 'white'
    }
    case 1:
    default:
      return 'black'
  }
}

export const useReaderPreferences = defineStore('readerPreferences', () => {
  const savedMode = readPreference('mihon.reader.mode')
  const mode = ref<ReadingMode>(savedMode === 'rtl' || savedMode === 'webtoon' ? savedMode : 'ltr')

  const readerTheme = ref<number>(resolveInitialReaderTheme())
  const background = ref<ReaderBackground>(themeToBackground(readerTheme.value))

  const fit = ref<'page' | 'width'>(readPreference('mihon.reader.fit') === 'width' ? 'width' : 'page')
  // Opt-in: some legacy REST versions return default lastPageRead values.
  const saveProgress = ref(readPreference('mihon.reader.saveProgress') === 'true')
  // ReaderPreferences.cropBorders / cropBordersWebtoon: toggled from the reader bottom bar
  // (ReaderBottomBar.kt -> onClickCropBorder).
  const crop = ref(readPreference('mihon.reader.cropBorders') === 'true')
  // GeneralSettingsPage.kt preferences that the reader itself has to honour:
  //   flashOnPageChange / flashDurationMillis / flashPageInterval / flashColor (DisplayRefreshHost.kt),
  //   pageTransitions (pager page change animation), readWithLongTap (long tap opens the page actions).
  const flashOnPageChange = ref(readPreference('mihon.reader.flashOnPageChange') === 'true')
  const flashDuration = ref(Number(readPreference('mihon.reader.flashDuration')) || 100)
  const flashInterval = ref(Number(readPreference('mihon.reader.flashInterval')) || 1)
  const flashColor = ref(readPreference('mihon.reader.flashColor') || 'black')
  const pageTransitions = ref(readPreference('mihon.reader.pageTransitions') !== 'false')
  const readWithLongTap = ref(readPreference('mihon.reader.readWithLongTap') !== 'false')
  // GeneralSettingsPage.kt: pref_fullscreen, pref_keep_screen_on and pref_show_page_number.
  const fullscreen = ref(readPreference('mihon.reader.fullscreen') !== 'false')
  const keepScreenOn = ref(readPreference('mihon.reader.keepScreenOn') === 'true')
  const showPageNumber = ref(readPreference('mihon.reader.showPageNumber') !== 'false')
  // GeneralSettingsPage.kt: pref_cutout_short (drawUnderCutout).
  const drawUnderCutout = ref(readPreference('cutout_short') !== 'false' && readPreference('mihon.reader.cutoutShort') !== 'false')
  // GeneralSettingsPage.kt: pref_always_show_chapter_transition.
  const alwaysShowChapterTransition = ref(readPreference('always_show_chapter_transition') !== 'false' && readPreference('mihon.reader.alwaysShowChapterTransition') !== 'false')
  // GeneralSettingsPage.kt: pref_vertical_navigator is a set of reading modes in which the vertical
  // chapter navigator is used, pref_vertical_navigator_on_left places it on the left side and
  // pref_vertical_navigator_height is its height in percent of the screen.
  const verticalNavigator = ref(readPreference('mihon.reader.verticalNavigator') ?? '')
  const verticalNavigatorOnLeft = ref(readPreference('mihon.reader.verticalNavigatorOnLeft') === 'true')
  const verticalNavigatorHeight = ref(Number(readPreference('mihon.reader.verticalNavigatorHeight')) || 65)

  watch(readerTheme, v => {
    writePreference('pref_reader_theme_key', String(v))
    writePreference('mihon.reader.theme', v === 0 ? 'white' : v === 2 ? 'gray' : v === 3 ? 'auto' : 'black')
    background.value = themeToBackground(v)
  })
  watch(background, v => {
    writePreference('mihon.reader.background', v)
  })
  watch(drawUnderCutout, v => {
    writePreference('cutout_short', String(v))
    writePreference('mihon.reader.cutoutShort', String(v))
  })
  watch(alwaysShowChapterTransition, v => {
    writePreference('always_show_chapter_transition', String(v))
    writePreference('mihon.reader.alwaysShowChapterTransition', String(v))
  })
  watch(verticalNavigator, v => writePreference('mihon.reader.verticalNavigator', v))
  watch(verticalNavigatorOnLeft, v => writePreference('mihon.reader.verticalNavigatorOnLeft', String(v)))
  watch(verticalNavigatorHeight, v => writePreference('mihon.reader.verticalNavigatorHeight', String(v)))
  watch(fullscreen, v => writePreference('mihon.reader.fullscreen', String(v)))
  watch(keepScreenOn, v => writePreference('mihon.reader.keepScreenOn', String(v)))
  watch(showPageNumber, v => writePreference('mihon.reader.showPageNumber', String(v)))
  watch(flashOnPageChange, v => writePreference('mihon.reader.flashOnPageChange', String(v)))
  watch(flashDuration, v => writePreference('mihon.reader.flashDuration', String(v)))
  watch(flashInterval, v => writePreference('mihon.reader.flashInterval', String(v)))
  watch(flashColor, v => writePreference('mihon.reader.flashColor', v))
  watch(pageTransitions, v => writePreference('mihon.reader.pageTransitions', String(v)))
  watch(readWithLongTap, v => writePreference('mihon.reader.readWithLongTap', String(v)))
  watch(mode, v => writePreference('mihon.reader.mode', v))
  watch(crop, v => writePreference('mihon.reader.cropBorders', String(v)))
  watch(fit, v => writePreference('mihon.reader.fit', v))
  watch(saveProgress, v => writePreference('mihon.reader.saveProgress', String(v)))

  return {
    mode, background, readerTheme, fit, saveProgress, crop,
    flashOnPageChange, flashDuration, flashInterval, flashColor, pageTransitions, readWithLongTap,
    fullscreen, keepScreenOn, showPageNumber,
    verticalNavigator, verticalNavigatorOnLeft, verticalNavigatorHeight,
    drawUnderCutout, alwaysShowChapterTransition,
  }
})
