/**
 * Appearance preferences (Mihon `SettingsAppearanceScreen.kt`).
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsAppearanceScreen.kt
 * - Theme group: `pref_app_theme` custom preference (theme mode segmented row + app theme previews),
 *   `pref_dark_theme_pure_black` switch (visible unless the theme mode is LIGHT).
 * - Display group: app language, tablet UI mode, date format, time format,
 *   relative timestamps, images in manga descriptions.
 *
 * Everything here is a harmless UI preference kept in this browser (localStorage),
 * exactly like the rest of the client's preference storage. No server state is touched.
 *
 * Importing this module also applies the stored app theme, so the palette survives a reload.
 * Mihon does the same by recreating the activity with the selected `ColorScheme`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { usePreferencesStore, type ThemeMode } from '../stores/preferences'
import { appThemes, type AppTheme } from '@/core/theme/appThemes'
import { generateDynamicTheme } from '@/core/theme/dynamicTheme'

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
  try { localStorage.setItem(PREFIX + key, value) } catch { /* private mode: session only */ }
}

/** `DateFormats` from SettingsAppearanceScreen.kt. The empty value is the "Default" entry. */
export const dateFormats = ['', 'MM/dd/yy', 'dd/MM/yy', 'yyyy-MM-dd', 'dd MMM yyyy', 'MMM dd, yyyy'] as const
export type DateFormatValue = (typeof dateFormats)[number]
/** `TimeFormat` entries from eu/kanade/domain/ui/model/TimeFormat.kt. */
export const timeFormats = ['followLanguage', 'followSystem', '24h', '12h'] as const
export type TimeFormatValue = (typeof timeFormats)[number]

export const themeModeOptions: { value: ThemeMode; title: string }[] = [
  { value: 'system', title: 'System' },
  { value: 'light', title: 'Light' },
  { value: 'dark', title: 'Dark' },
]

/** `TabletUiMode` entries: AUTOMATIC("Auto"), ALWAYS("Always"), LANDSCAPE("Landscape"), NEVER("Never"). */
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

function getInitialPanorama(): boolean {
  try {
    const raw = localStorage.getItem('mihon.ui.usePanoramaCover') ?? read('usePanoramaCover')
    if (raw !== null) return raw === 'true'
  } catch { /* private mode */ }
  return true
}

function getInitialTopAlign(): boolean {
  try {
    const raw = localStorage.getItem('mihon.ui.topAlignCover') ?? read('topAlignCover')
    if (raw !== null) return raw === 'true'
  } catch { /* private mode */ }
  return false
}

const usePanoramaCover = ref(getInitialPanorama())
const topAlignCover = ref(getInitialTopAlign())

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
})
watch(topAlignCover, v => {
  write('topAlignCover', String(v))
  try { localStorage.setItem('mihon.ui.topAlignCover', String(v)) } catch { /* private mode */ }
})

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

/** AMOLED surfaces from BaseColorScheme.kt (dark scheme only). */
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
  palerSurface: '#000000',
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h *= 60
  }
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0
  if (s === 0) {
    r = g = b = Math.round(l * 255)
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = Math.round(hue2rgb(p, q, (h / 360) + 1 / 3) * 255)
    g = Math.round(hue2rgb(p, q, h / 360) * 255)
    b = Math.round(hue2rgb(p, q, (h / 360) - 1 / 3) * 255)
  }
  return { r, g, b }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

/**
 * SettingsMainScreen.kt getPalerSurface():
 * surface lightness -5% (dark) / +2% (light), clamped to [0, 1].
 * For pure black (#000000), 0 - 0.05 coerced is 0 -> pure black (#000000).
 */
export function calculatePalerSurface(surfaceHex: string, dark: boolean): string {
  const rgb = hexToRgb(surfaceHex)
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const newL = Math.max(0, Math.min(1, dark ? hsl.l - 0.05 : hsl.l + 0.02))
  const newRgb = hslToRgb(hsl.h, hsl.s, newL)
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b)
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(media?.matches ?? false)
if (media) media.addEventListener('change', e => { systemDark.value = e.matches })

/** Mirrors `preferences.themeMode`; kept outside the store so the theme can be applied early. */
const themeMode = ref<ThemeMode>((readPreferenceThemeMode()))

function readPreferenceThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem('mihon.theme')
    return stored === 'dark' || stored === 'light' ? stored : 'system'
  } catch { return 'system' }
}

/** The effective appearance: the theme mode preference wins over the system setting. */
const isDark = computed(() => themeMode.value === 'dark' || (themeMode.value === 'system' && systemDark.value))
const currentTheme = computed(() => {
  if (appThemeId.value === 'custom') {
    return generateDynamicTheme(customSeedColor.value)
  }
  return appThemes.find(t => t.id === appThemeId.value) ?? appThemes[0]!
})

/**
 * The Vuetify theme class (`.v-theme--mihonLight` / `.v-theme--mihonDark`) is applied to the
 * `.v-application` element, so the app theme colors are written as inline custom properties on
 * that element (inline styles beat the class rule) and on the document element, which also
 * covers overlays teleported outside the application root.
 */
function themeTargets(): HTMLElement[] {
  const targets: HTMLElement[] = []
  if (typeof document === 'undefined') return targets
  targets.push(document.documentElement)
  const app = document.querySelector<HTMLElement>('.v-application')
  if (app) targets.push(app)
  return targets
}

/** The custom properties that were written last, so they can be removed again. */
let appliedKeys: string[] = []

function updateThemeStyleElement(colors: Record<string, string>) {
  if (typeof document === 'undefined') return
  const cssVars = Object.entries(colors)
    .map(([key, val]) => `  --v-theme-${kebab(key)}: ${hexToRgbTriplet(val)};`)
    .join('\n')
  const css = `
:root,
.v-application,
.v-theme--mihonLight,
.v-theme--mihonDark {
${cssVars}
}
`
  let styleEl = document.getElementById('mihon-theme-overrides') as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'mihon-theme-overrides'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = css
}

function removeThemeStyleElement() {
  if (typeof document === 'undefined') return
  const styleEl = document.getElementById('mihon-theme-overrides')
  if (styleEl) styleEl.remove()
}

function applyTheme(theme: AppTheme, dark: boolean, isAmoled: boolean) {
  const colors: Record<string, string> = { ...(dark ? theme.dark : theme.light) }
  if (dark && isAmoled) Object.assign(colors, amoledSurfaces)
  if (!colors.palerSurface) {
    colors.palerSurface = calculatePalerSurface(colors.surface || (dark ? '#1B1B1F' : '#FEFBFF'), dark)
  }
  const keys = Object.keys(colors)
  for (const target of themeTargets()) {
    for (const key of keys) {
      target.style.setProperty(`--v-theme-${kebab(key)}`, hexToRgbTriplet(colors[key]!))
    }
  }
  appliedKeys = keys.map(kebab)
  updateThemeStyleElement(colors)
}
function clearThemeOverrides() {
  for (const target of themeTargets()) {
    for (const key of appliedKeys) target.style.removeProperty(`--v-theme-${key}`)
  }
  appliedKeys = []
  removeThemeStyleElement()
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-amoled')
  }
}

/** Applies the selected app theme to the whole client, like Mihon's activity recreation. */
export function applyCurrentTheme() {
  const dark = isDark.value
  const theme = currentTheme.value
  const isAmoled = amoled.value
  if (theme.id === 'default' && !(dark && isAmoled)) {
    clearThemeOverrides()
    return
  }
  applyTheme(theme, dark, isAmoled)
}

watch(
  [currentTheme, isDark, amoled],
  () => {
    if (typeof document !== 'undefined') {
      if (isDark.value && amoled.value) {
        document.documentElement.setAttribute('data-amoled', 'true')
      } else {
        document.documentElement.removeAttribute('data-amoled')
      }
    }
    applyCurrentTheme()
  },
  { immediate: true },
)

export function useAppearancePreferences() {
  const preferences = usePreferencesStore()
  watch(() => preferences.themeMode, value => { themeMode.value = value }, { immediate: true })

  onMounted(() => {
    applyCurrentTheme()
  })

  /** The sample "now" used by the date/time format entries, like the reference screen. */
  const now = new Date()

  /** `UiPreferences.dateFormat(format, locale)` — the localized short date for the default entry. */
  function formatSampleDate(format: string): string {
    if (!format) {
      // `DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT)` — a two-digit year.
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(now)
    }
    const year = String(now.getFullYear())
    const month2 = String(now.getMonth() + 1).padStart(2, '0')
    const day2 = String(now.getDate()).padStart(2, '0')
    const monthName = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(now)
    switch (format) {
      case 'MM/dd/yy': return `${month2}/${day2}/${year.slice(-2)}`
      case 'dd/MM/yy': return `${day2}/${month2}/${year.slice(-2)}`
      case 'yyyy-MM-dd': return `${year}-${month2}-${day2}`
      case 'dd MMM yyyy': return `${day2} ${monthName} ${year}`
      case 'MMM dd, yyyy': return `${monthName} ${day2}, ${year}`
      default: return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(now)
    }
  }

  /** `UiPreferences.timeFormat(timeFormat, locale, is24HourSystem)`. */
  function formatSampleTime(format: TimeFormatValue): string {
    const systemIs24h = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 === false
    if (format === '24h') return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
    if (format === '12h') return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: true }).format(now)
    if (format === 'followSystem') return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: !systemIs24h }).format(now)
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now)
  }

  /** The absolute date shown in the "Relative timestamps" summary. */
  const formattedDateNow = computed(() => formatSampleDate(dateFormat.value))

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
    isDark,
    appThemes,
    formattedDateNow,
    formatSampleDate,
    formatSampleTime,
    applyCurrentTheme,
  }
}
