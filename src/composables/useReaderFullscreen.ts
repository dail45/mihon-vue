import { watch } from 'vue'

export interface UseReaderFullscreenOptions {
  fullscreen: () => boolean
  hostSelector?: string
  onError?: (message: string) => void
}

/**
 * GeneralSettingsPage.kt pref_fullscreen: Mihon keeps the reader in an immersive full screen
 * activity. The browser equivalent is the Fullscreen API on the reader element, which needs a
 * user gesture, so the request is made right after the preference is toggled.
 */
export function useReaderFullscreen(options: UseReaderFullscreenOptions) {
  const hostSelector = options.hostSelector ?? '.reader'

  async function applyFullscreen(enabled: boolean) {
    const host = document.querySelector(hostSelector) as HTMLElement | null
    try {
      if (enabled && host && !document.fullscreenElement) {
        await host.requestFullscreen()
      } else if (!enabled && document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      options.onError?.('Fullscreen is not available in this browser')
    }
  }

  watch(options.fullscreen, value => {
    void applyFullscreen(value)
  })

  return {
    applyFullscreen,
  }
}
