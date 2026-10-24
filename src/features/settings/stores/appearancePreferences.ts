import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { appThemes, type AppTheme } from '@/core/theme/appThemes'
import { generateDynamicTheme } from '@/core/theme/dynamicTheme'
import { usePreferencesStore, type ThemeMode } from './preferences'

const PREFIX = 'mihon.appearance.'

export const ENUM_TO_THEME_ID: Record<string, string> = {
  DEFAULT: 'default',
  CATPPUCCIN: 'catppuccin',
  GREEN_APPLE: 'greenApple',
  LAVENDER: 'lavender',
  MIDNIGHT_DUSK: 'midnightDusk',
  NORD: 'nord',
  STRAWBERRY_DAIQUIRI: 'strawberryDaiquiri',
  TAKO: 'tako',
  TEALTURQUOISE: 'tealTurquoise',
  TIDAL_WAVE: 'tidalWave',
  YINYANG: 'yinYang',
  YOTSUBA: 'yotsuba',
  TOKYONIGHT: 'tokyoNight',
  MONOCHROME: 'monochrome',
  CLOUDFLARE: 'cloudflare',
  COTTONCANDY: 'cottonCandy',
  DOOM: 'doom',
  MATRIX: 'matrix',
  MOCHA: 'mocha',
  SAPPHIRE: 'sapphire',
  CUSTOM: 'custom',
}

export const THEME_ID_TO_ENUM: Record<string, string> = {
  default: 'DEFAULT',
  catppuccin: 'CATPPUCCIN',
  greenApple: 'GREEN_APPLE',
  lavender: 'LAVENDER',
  midnightDusk: 'MIDNIGHT_DUSK',
  nord: 'NORD',
  strawberryDaiquiri: 'STRAWBERRY_DAIQUIRI',
  tako: 'TAKO',
  tealTurquoise: 'TEALTURQUOISE',
  tidalWave: 'TIDAL_WAVE',
  yinYang: 'YINYANG',
  yotsuba: 'YOTSUBA',
  tokyoNight: 'TOKYONIGHT',
  monochrome: 'MONOCHROME',
  cloudflare: 'CLOUDFLARE',
  cottonCandy: 'COTTONCANDY',
  doom: 'DOOM',
  matrix: 'MATRIX',
  mocha: 'MOCHA',
  sapphire: 'SAPPHIRE',
  custom: 'CUSTOM',
}

function read(key: string): string | null {
  try { return localStorage.getItem(PREFIX + key) } catch { return null }
}
function write(key: string, value: string) {
  try { localStorage.setItem(PREFIX + key, value) } catch { /* private mode */ }
}

export const dateFormats = ['', 'MM/dd/yy', 'dd/MM/yy', 'yyyy-MM-dd', 'dd MMM yyyy', 'MMM dd, yyyy'] as const
export type DateFormatValue = (typeof dateFormats)[number]

export const timeFormats = ['followLanguage', 'followSystem', '24h', '12h'] as const
export type TimeFormatValue = (typeof timeFormats)[number]

export const themeModeOptions: { value: ThemeMode; title: string }[] = [
  { value: 'system', title: 'System' },
  { value: 'light', title: 'Light' },
  { value: 'dark', title: 'Dark' },
]

export const tabletUiModeOptions: { value: string; title: string }[] = [
  { value: 'automatic', title: 'Auto' },
  { value: 'always', title: 'Always' },
  { value: 'landscape', title: 'Landscape' },
  { value: 'never', title: 'Never' },
]

export const timeFormatTitles: Record<TimeFormatValue, string> = {
  followLanguage: 'Follow language',
  followSystem: 'Follow system',
  '24h': '24-hour',
  '12h': '12-hour',
}

function getInitialAppTheme(): string {
  const saved = read('appTheme')
  if (saved === 'custom' || (saved && appThemes.some(t => t.id === saved))) return saved
  try {
    const rawLocal = localStorage.getItem('mihon.appTheme')
    if (rawLocal) {
      if (rawLocal === 'custom' || appThemes.some(t => t.id === rawLocal)) return rawLocal
      const mapped = ENUM_TO_THEME_ID[rawLocal]
      if (mapped && (mapped === 'custom' || appThemes.some(t => t.id === mapped))) return mapped
    }
  } catch { /* private mode */ }
  return 'default'
}

function getInitialAmoled(): boolean {
  if (read('amoled') === 'true') return true
  try {
    if (localStorage.getItem('mihon.themeDarkAmoled') === 'true') return true
  } catch { /* private mode */ }
  return false
}

function getInitialCustomSeedColor(): string {
  try {
    const raw = localStorage.getItem('pref_color_theme') ?? read('customSeedColor')
    if (raw) return raw
  } catch { /* private mode */ }
  return '#DF0090'
}

function getInitialThemeCoverBased(): boolean {
  try {
    const raw = localStorage.getItem('pref_theme_cover_based') ?? read('themeCoverBased')
    if (raw !== null) return raw === 'true'
  } catch { /* private mode */ }
  return false
}

function getInitialPanoramaCover(): boolean {
  try {
    const raw = localStorage.getItem('mihon.ui.usePanoramaCover') ?? read('usePanoramaCover')
    if (raw !== null) return raw === 'true'
  } catch { /* private mode */ }
  return true
}

function getInitialTopAlignCover(): boolean {
  try {
    const raw = localStorage.getItem('mihon.ui.topAlignCover') ?? read('topAlignCover')
    if (raw !== null) return raw === 'true'
  } catch { /* private mode */ }
  return false
}

function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r},${g},${b}`
}
function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

const amoledSurfaces: Record<string, string> = {
  background: '#000000',
  onBackground: '#FFFFFF',
  surface: '#000000',
  onSurface: '#FFFFFF',
  surfaceVariant: '#0C0C0C',
  surfaceContainerLowest: '#0C0C0C',
  surfaceContainerLow: '#0C0C0C',
  surfaceContainer: '#0C0C0C',
  surfaceContainerHigh: '#131313',
  surfaceContainerHighest: '#1B1B1B',
}

export const useAppearanceStore = defineStore('appearancePreferences', () => {
  const preferences = usePreferencesStore()

  const appThemeId = ref(getInitialAppTheme())
  const amoled = ref(getInitialAmoled())
  const customSeedColor = ref(getInitialCustomSeedColor())
  const themeCoverBased = ref(getInitialThemeCoverBased())
  const savedDateFormat = read('dateFormat')
  const dateFormat = ref<DateFormatValue>(
    (dateFormats as readonly string[]).includes(savedDateFormat ?? '') ? (savedDateFormat as DateFormatValue) : '',
  )
  const savedTimeFormat = read('timeFormat')
  const timeFormat = ref<TimeFormatValue>(
    (timeFormats as readonly string[]).includes(savedTimeFormat ?? '') ? (savedTimeFormat as TimeFormatValue) : 'followLanguage',
  )
  const relativeTime = ref(read('relativeTime') === 'true')
  const imagesInDescription = ref(read('imagesInDescription') === 'true')
  const language = ref(read('language') ?? '')
  const usePanoramaCover = ref(getInitialPanoramaCover())
  const topAlignCover = ref(getInitialTopAlignCover())

  watch(appThemeId, v => {
    write('appTheme', v)
    try {
      const enumVal = THEME_ID_TO_ENUM[v] || v.toUpperCase()
      localStorage.setItem('mihon.appTheme', enumVal)
    } catch { /* private mode */ }
    applyCurrentTheme()
  })
  watch(amoled, v => {
    write('amoled', String(v))
    try {
      localStorage.setItem('mihon.themeDarkAmoled', String(v))
    } catch { /* private mode */ }
    applyCurrentTheme()
  })
  watch(customSeedColor, v => {
    write('customSeedColor', v)
    try { localStorage.setItem('pref_color_theme', v) } catch { /* private mode */ }
    if (appThemeId.value === 'custom') {
      applyCurrentTheme()
    }
  })
  watch(themeCoverBased, v => {
    write('themeCoverBased', String(v))
    try { localStorage.setItem('pref_theme_cover_based', String(v)) } catch { /* private mode */ }
  })
  watch(dateFormat, v => write('dateFormat', v))
  watch(timeFormat, v => write('timeFormat', v))
  watch(relativeTime, v => write('relativeTime', String(v)))
  watch(imagesInDescription, v => write('imagesInDescription', String(v)))
  watch(language, v => write('language', v))
  watch(usePanoramaCover, v => {
    write('usePanoramaCover', String(v))
    try { localStorage.setItem('mihon.ui.usePanoramaCover', String(v)) } catch { /* private mode */ }
  }, { flush: 'sync' })
  watch(topAlignCover, v => {
    write('topAlignCover', String(v))
    try { localStorage.setItem('mihon.ui.topAlignCover', String(v)) } catch { /* private mode */ }
  }, { flush: 'sync' })

  const currentTheme = computed<AppTheme>(() => {
    if (appThemeId.value === 'custom') {
      return generateDynamicTheme(customSeedColor.value)
    }
    return appThemes.find(t => t.id === appThemeId.value) || appThemes[0]!
  })

  const isDarkActive = computed(() => {
    if (preferences.themeMode === 'dark') return true
    if (preferences.themeMode === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  function applyCurrentTheme() {
    if (typeof document === 'undefined') return
    const theme = currentTheme.value
    const isDark = isDarkActive.value
    const scheme = isDark ? theme.dark : theme.light
    const root = document.documentElement

    root.dataset.theme = isDark ? 'dark' : 'light'
    root.dataset.amoled = (isDark && amoled.value) ? 'true' : 'false'
    root.dataset.appTheme = theme.id

    for (const [key, hex] of Object.entries(scheme)) {
      const effectiveHex = (isDark && amoled.value && key in amoledSurfaces)
        ? amoledSurfaces[key]!
        : hex
      root.style.setProperty(`--v-theme-${kebab(key)}`, hexToRgbTriplet(effectiveHex))
    }

    const paler = isDark
      ? (amoled.value ? '#000000' : '#0f0f11')
      : '#ffffff'
    root.style.setProperty('--v-theme-paler-surface', paler)
  }

  return {
    appThemeId,
    amoled,
    customSeedColor,
    themeCoverBased,
    dateFormat,
    timeFormat,
    relativeTime,
    imagesInDescription,
    language,
    usePanoramaCover,
    topAlignCover,
    currentTheme,
    isDarkActive,
    applyCurrentTheme,
  }
})
