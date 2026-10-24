import { type Ref } from 'vue'
import type { ReadingMode } from '@/features/reader/stores/readerPreferences'

export interface UseReaderKeybindingsOptions {
  isDialogActive: () => boolean
  chaptersOpen: Ref<boolean>
  controls: Ref<boolean>
  modeIsWebtoon: () => boolean
  readingMode: () => ReadingMode
  animatePages: () => boolean
  viewport: Ref<HTMLElement | null>
  pageCount: () => number
  hasNextChapter: () => boolean
  hasPreviousChapter: () => boolean
  onNextChapter: () => void
  onPreviousChapter: () => void
  onTurn: (delta: number) => void
  onGoPage: (page: number) => void
}

/**
 * Reader key bindings:
 * - Arrow Left / Right, A / D: turn page or scroll. Ctrl+Arrow: jump chapter.
 * - Arrow Up / Down, PageUp / PageDown: turn page or scroll.
 * - Space, Shift+Space: toggle controls or turn/scroll.
 * - N / P: next / previous chapter.
 * - Home / End: first / last page.
 * - M: toggle controls (KEYCODE_MENU).
 * - Escape: close dialogs or toggle controls.
 */
export function useReaderKeybindings(options: UseReaderKeybindingsOptions) {
  function scrollDown() {
    if (!options.viewport.value) return
    const distance = Math.round(options.viewport.value.clientHeight * 0.75)
    options.viewport.value.scrollBy({ top: distance, behavior: options.animatePages() ? 'smooth' : 'auto' })
  }

  function scrollUp() {
    if (!options.viewport.value) return
    const distance = Math.round(options.viewport.value.clientHeight * 0.75)
    options.viewport.value.scrollBy({ top: -distance, behavior: options.animatePages() ? 'smooth' : 'auto' })
  }

  function onKey(event: KeyboardEvent) {
    if (options.isDialogActive()) return
    if ((event.target as HTMLElement)?.closest('input, textarea, select, [role="slider"], [role="menu"]')) return

    if (event.key === 'Escape') {
      if (options.chaptersOpen.value) {
        options.chaptersOpen.value = false
        return
      }
      options.controls.value = !options.controls.value
      return
    }
    if (event.key === ' ' && !(event.target as HTMLElement)?.closest('button, a')) {
      event.preventDefault()
      if (event.shiftKey) {
        if (options.modeIsWebtoon()) scrollUp()
        else options.onTurn(options.readingMode() === 'rtl' ? 1 : -1)
      } else {
        options.controls.value = !options.controls.value
      }
      return
    }
    if (event.key === 'm' || event.key === 'M') {
      options.controls.value = !options.controls.value
      return
    }
    if (event.key === 'n' || event.key === 'N') {
      if (options.hasNextChapter()) options.onNextChapter()
      return
    }
    if (event.key === 'p' || event.key === 'P') {
      if (options.hasPreviousChapter()) options.onPreviousChapter()
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      if (options.modeIsWebtoon()) {
        options.viewport.value?.scrollTo({ top: 0, behavior: options.animatePages() ? 'smooth' : 'auto' })
      } else {
        options.onGoPage(0)
      }
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      if (options.modeIsWebtoon()) {
        const vp = options.viewport.value
        vp?.scrollTo({ top: vp.scrollHeight, behavior: options.animatePages() ? 'smooth' : 'auto' })
      } else {
        options.onGoPage(options.pageCount() - 1)
      }
      return
    }

    // Webtoon viewer keys (WebtoonViewer.kt:304-336)
    if (options.modeIsWebtoon()) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === 's' ||
        event.key === 'S' ||
        event.key === 'd' ||
        event.key === 'D' ||
        event.key === 'ArrowRight'
      ) {
        event.preventDefault()
        scrollDown()
        return
      }
      if (
        event.key === 'ArrowUp' ||
        event.key === 'PageUp' ||
        event.key === 'w' ||
        event.key === 'W' ||
        event.key === 'a' ||
        event.key === 'A' ||
        event.key === 'ArrowLeft'
      ) {
        event.preventDefault()
        scrollUp()
        return
      }
      return
    }

    // Pager viewer keys (PagerViewer.kt:387-424)
    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      event.preventDefault()
      if (event.ctrlKey) {
        if (options.readingMode() === 'rtl') {
          if (options.hasPreviousChapter()) options.onPreviousChapter()
        } else {
          if (options.hasNextChapter()) options.onNextChapter()
        }
      } else {
        options.onTurn(options.readingMode() === 'rtl' ? -1 : 1)
      }
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      event.preventDefault()
      if (event.ctrlKey) {
        if (options.readingMode() === 'rtl') {
          if (options.hasNextChapter()) options.onNextChapter()
        } else {
          if (options.hasPreviousChapter()) options.onPreviousChapter()
        }
      } else {
        options.onTurn(options.readingMode() === 'rtl' ? 1 : -1)
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault()
      options.onTurn(options.readingMode() === 'rtl' ? -1 : 1)
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault()
      options.onTurn(options.readingMode() === 'rtl' ? 1 : -1)
      return
    }
  }

  return {
    onKey,
    scrollDown,
    scrollUp,
  }
}
