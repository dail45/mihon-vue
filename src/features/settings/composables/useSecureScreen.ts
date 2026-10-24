/**
 * Web counterpart of Mihon's "Secure screen" behaviour.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/tachiyomi/ui/base/delegate/SecureActivityDelegate.kt
 * applies WindowManager.LayoutParams.FLAG_SECURE, which hides the app preview in the
 * task switcher and blocks screenshots.
 *
 * The web platform has no FLAG_SECURE equivalent, so only the "hides app contents when
 * switching apps" half is reproducible: an opaque layer covers the document while the
 * tab is in the background. Screenshot blocking is not possible in a browser.
 *
 * The guard installs itself on import (module side effect) so it keeps working after
 * the settings screen is closed, and it reads the current mode from localStorage on
 * every visibility change.
 */
import { readSecureScreenMode } from './useSecurityPreferences'

let overlay: HTMLElement | null = null

function isReaderRoute() {
  // Reader route: /manga/:id/read/:chapterIndex
  return typeof location !== 'undefined' && /\/read\/\d+/.test(location.pathname)
}

function shouldHide() {
  const mode = readSecureScreenMode()
  if (mode === 'never') return false
  if (mode === 'always') return true
  // Incognito: only while the reader is open (Mihon hides the preview in incognito mode).
  return isReaderRoute()
}

function show() {
  if (overlay || !shouldHide()) return
  overlay = document.createElement('div')
  overlay.setAttribute('data-secure-screen', 'true')
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2999',
    'background:rgb(var(--v-theme-surface))',
    'backdrop-filter:blur(24px)', '-webkit-backdrop-filter:blur(24px)',
    'pointer-events:auto',
  ].join(';')
  document.body.appendChild(overlay)
}

function hide() {
  overlay?.remove()
  overlay = null
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') show()
    else hide()
  })
  window.addEventListener('focus', hide)
  window.addEventListener('blur', show)
}
