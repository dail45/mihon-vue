import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'

const storage: Record<string, string> = {}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = String(v) },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: (i: number) => Object.keys(storage)[i] ?? null,
    length: 0,
  } as Storage
}

describe('6.4 Dynamic Navbar Tab Customization & Hidden Tab Relocation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('initializes showNavUpdates, showNavHistory, and bottomBarLabels with default true', () => {
    const prefs = usePreferencesStore()
    expect(prefs.showNavUpdates).toBe(true)
    expect(prefs.showNavHistory).toBe(true)
    expect(prefs.bottomBarLabels).toBe(true)
  })

  it('persists preferences under the correct Komikku/SY storage keys', () => {
    const prefs = usePreferencesStore()

    prefs.showNavUpdates = false
    expect(localStorage.getItem('pref_show_updates_button')).toBe('false')

    prefs.showNavHistory = false
    expect(localStorage.getItem('pref_show_history_button')).toBe('false')

    prefs.bottomBarLabels = false
    expect(localStorage.getItem('pref_show_bottom_bar_labels')).toBe('false')

    // Restores from localStorage
    const newPrefs = usePreferencesStore()
    expect(newPrefs.showNavUpdates).toBe(false)
    expect(newPrefs.showNavHistory).toBe(false)
    expect(newPrefs.bottomBarLabels).toBe(false)
  })

  it('SettingsAppearanceView includes Navigation header and switches for nav preferences', () => {
    const view = readFileSync('src/features/settings/views/SettingsAppearanceView.vue', 'utf8')

    // Navigation header
    expect(view).toContain('pref_category_navbar')

    // Switches bound to preferences
    expect(view).toContain('preferences.showNavUpdates')
    expect(view).toContain('pref_hide_updates_button')

    expect(view).toContain('preferences.showNavHistory')
    expect(view).toContain('pref_hide_history_button')

    expect(view).toContain('preferences.bottomBarLabels')
    expect(view).toContain('pref_show_bottom_bar_labels')
  })

  it('DefaultLayout dynamically filters navItems based on preferences and manages activeNav', () => {
    const layout = readFileSync('src/app/layouts/DefaultLayout.vue', 'utf8')

    // Dynamic navItems checks
    expect(layout).toMatch(/if\s*\(preferences\.showNavUpdates\)\s*\{\s*items\.push\(/)
    expect(layout).toMatch(/if\s*\(preferences\.showNavHistory\)\s*\{\s*items\.push\(/)

    // activeNav redirects to /more when hidden
    expect(layout).toContain('preferences.showNavUpdates')
    expect(layout).toContain('preferences.showNavHistory')
    expect(layout).toContain("return '/more'")

    // Bottom navigation toggles label visibility and applies no-labels class
    expect(layout).toContain("mihon-navigation--no-labels': !preferences.bottomBarLabels")
    expect(layout).toContain('v-if="preferences.bottomBarLabels"')
  })

  it('MoreView conditionally renders Updates and History when hidden from navbar', () => {
    const more = readFileSync('src/features/settings/views/MoreView.vue', 'utf8')

    expect(more).toContain('v-if="!preferences.showNavUpdates"')
    expect(more).toContain("router.push('/updates')")

    expect(more).toContain('v-if="!preferences.showNavHistory"')
    expect(more).toContain("router.push('/history')")
  })

  it('has required i18n keys in both English and Russian', () => {
    const requiredKeys = [
      'pref_category_navbar',
      'pref_hide_updates_button',
      'pref_hide_history_button',
      'pref_show_bottom_bar_labels',
    ]

    const enDict = en as unknown as Record<string, string>
    const ruDict = ru as unknown as Record<string, string>

    for (const key of requiredKeys) {
      expect(en).toHaveProperty(key)
      expect(typeof enDict[key]).toBe('string')
      expect(enDict[key].length).toBeGreaterThan(0)

      expect(ru).toHaveProperty(key)
      expect(typeof ruDict[key]).toBe('string')
      expect(ruDict[key].length).toBeGreaterThan(0)
    }
  })
})
