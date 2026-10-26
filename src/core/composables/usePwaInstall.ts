import { ref, onMounted, getCurrentInstance } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

// Global reactive singletons so all components share the same PWA install state
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const isStandalone = ref(false)
const canInstall = ref(false)

export function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const isStandaloneMedia = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false
  const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return isStandaloneMedia || isNavigatorStandalone
}

// Capture the beforeinstallprompt event immediately at the window level
if (typeof window !== 'undefined') {
  isStandalone.value = checkIsStandalone()

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt.value = e as BeforeInstallPromptEvent
    if (!checkIsStandalone()) {
      canInstall.value = true
    }
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    canInstall.value = false
    isStandalone.value = true
  })
}

export function usePwaInstall() {
  if (getCurrentInstance()) {
    onMounted(() => {
      isStandalone.value = checkIsStandalone()
      if (isStandalone.value) {
        canInstall.value = false
      }
    })
  } else {
    isStandalone.value = checkIsStandalone()
  }

  async function promptInstall(): Promise<boolean> {
    if (!deferredPrompt.value) return false
    try {
      await deferredPrompt.value.prompt()
      const choice = await deferredPrompt.value.userChoice
      if (choice.outcome === 'accepted') {
        canInstall.value = false
        deferredPrompt.value = null
        return true
      }
      return false
    } catch (err) {
      console.warn('PWA install prompt error:', err)
      return false
    }
  }

  return {
    canInstall,
    isStandalone,
    promptInstall,
  }
}
