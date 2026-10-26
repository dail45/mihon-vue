import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { usePwaInstall } from '@/core/composables/usePwaInstall'

describe('PWA Architecture and Configuration', () => {
  it('vite.config.ts configures VitePWA with prompt registerType and workbox caching rules', () => {
    const viteConfig = readFileSync('vite.config.ts', 'utf8')
    expect(viteConfig).toContain("VitePWA(")
    expect(viteConfig).toContain("registerType: 'prompt'")
    expect(viteConfig).toContain("navigateFallback: 'index.html'")
    expect(viteConfig).toContain("navigateFallbackDenylist:")
    expect(viteConfig).toContain("cacheName: 'suwayomi-images-cache'")
    expect(viteConfig).toContain("handler: 'StaleWhileRevalidate'")
    expect(viteConfig).toContain("handler: 'NetworkOnly'")
  })

  it('index.html contains mobile/desktop PWA meta tags and theme color', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain('<meta name="theme-color" content="#121316"')
    expect(html).toContain('apple-mobile-web-app-capable')
    expect(html).toContain('apple-touch-icon')
    expect(html).toContain('viewport-fit=cover')
  })

  it('generated icon assets exist in public directory', () => {
    const expectedAssets = [
      'public/pwa-icon.svg',
      'public/pwa-64x64.png',
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/maskable-icon-512x512.png',
      'public/apple-touch-icon-180x180.png',
      'public/favicon.ico',
    ]
    for (const asset of expectedAssets) {
      expect(existsSync(resolve(asset))).toBe(true)
    }
  })

  it('PwaUpdateSnackbar component exists and uses virtual:pwa-register/vue', () => {
    const snackbar = readFileSync('src/core/components/PwaUpdateSnackbar.vue', 'utf8')
    expect(snackbar).toContain("from 'virtual:pwa-register/vue'")
    expect(snackbar).toContain('useRegisterSW')
    expect(snackbar).toContain('v-snackbar')
  })

  it('MoreView includes Install App row wired to usePwaInstall', () => {
    const moreView = readFileSync('src/features/settings/views/MoreView.vue', 'utf8')
    expect(moreView).toContain('usePwaInstall')
    expect(moreView).toContain('canInstall')
    expect(moreView).toContain('promptInstall')
  })

  it('usePwaInstall detects display mode and exposes reactive install handlers', async () => {
    const { canInstall, isStandalone, promptInstall } = usePwaInstall()
    expect(typeof canInstall.value).toBe('boolean')
    expect(typeof isStandalone.value).toBe('boolean')
    expect(typeof promptInstall).toBe('function')
  })
})
