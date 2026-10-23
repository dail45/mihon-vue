import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import en from '../locales/en.json'
import ru from '../locales/ru.json'
import { APP_LOCALE_TAGS, normalizeLocaleTag } from '../utils/appLanguage'
import { MR, type StringResourceKey, type PluralResourceKey } from './MR'

export { MR, type StringResourceKey, type PluralResourceKey }

export const STORAGE_KEY = 'mihon.appLanguage'

/**
 * Lazy loaders for all supported locale JSON files.
 */
const localeLoaders = import.meta.glob('../locales/*.json')

/**
 * Normalizes and checks if a language code matches any of the shipped APP_LOCALE_TAGS.
 */
function matchSupportedLocale(tag: string): string | null {
  if (!tag) return null
  if (APP_LOCALE_TAGS.includes(tag)) return tag
  // Try case-insensitive matching or hyphen normalization
  const normalized = tag.replace('_', '-')
  const found = APP_LOCALE_TAGS.find(t => t.toLowerCase() === normalized.toLowerCase())
  if (found) return found
  // Try primary language subtag (e.g. 'ru-RU' -> 'ru', 'de-DE' -> 'de')
  const base = normalized.split('-')[0]
  const baseFound = APP_LOCALE_TAGS.find(t => t.toLowerCase() === base.toLowerCase())
  if (baseFound) return baseFound
  return null
}

/**
 * Resolves the effective locale to use:
 * 1. If explicit `customTag` is provided (from preference), match it.
 * 2. If not, match browser's `navigator.language`.
 * 3. Fallback to `'en'`.
 */
export function resolveEffectiveLocale(customTag?: string | null): string {
  if (customTag) {
    const match = matchSupportedLocale(customTag)
    if (match) return match
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    const match = matchSupportedLocale(navigator.language)
    if (match) return match
  }
  return 'en'
}

export function getSavedLanguage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

const initialSaved = getSavedLanguage()
const initialEffective = resolveEffectiveLocale(initialSaved)

export const currentLanguage = ref(initialSaved)
export const effectiveLanguage = ref(initialEffective)

export const i18n = createI18n({
  legacy: false,
  locale: initialEffective,
  fallbackLocale: 'en',
  messages: {
    en,
    ru,
  },
})

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('lang', normalizeLocaleTag(initialEffective))
}

/**
 * Load and switch application language.
 * Pass empty string `""` to use device system language.
 */
export async function setAppLanguage(tag: string): Promise<void> {
  currentLanguage.value = tag
  try {
    localStorage.setItem(STORAGE_KEY, tag)
  } catch {
    // Ignore storage issues
  }

  const effective = resolveEffectiveLocale(tag)
  effectiveLanguage.value = effective

  if (!(i18n.global as any).availableLocales.includes(effective)) {
    const loader = localeLoaders[`../locales/${effective}.json`]
    if (loader) {
      try {
        const messages = (await loader()) as { default: Record<string, unknown> }
        ;(i18n.global as any).setLocaleMessage(effective, messages.default)
      } catch (err) {
        console.warn(`Failed to load messages for locale "${effective}":`, err)
      }
    }
  }

  ;(i18n.global.locale as any).value = effective
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', normalizeLocaleTag(effective))
  }
}

// Ensure initial non-prebundled locale is loaded asynchronously if needed
if (initialEffective !== 'en' && initialEffective !== 'ru') {
  void setAppLanguage(initialSaved)
}

/**
 * Formats a string resource, matching Mihon's `stringResource(MR.strings.key, ...args)`.
 */
export function stringResource(key: string, ...args: (string | number)[]): string {
  if (!key) return ''
  try {
    if (args.length > 0) {
      // vue-i18n supports array of params: $t('unlock_app_title', ['Mihon'])
      return i18n.global.t(key, args as unknown as Record<string, unknown>)
    }
    return i18n.global.t(key)
  } catch {
    return key
  }
}

export const t = stringResource

/**
 * Plural string resource, matching Mihon's `pluralStringResource(MR.plurals.key, count, ...args)`.
 */
export function pluralStringResource(pluralKey: string, count: number, ...args: (string | number)[]): string {
  const loc = effectiveLanguage.value || 'en'
  let pr: Intl.PluralRules
  try {
    pr = new Intl.PluralRules(loc)
  } catch {
    pr = new Intl.PluralRules('en')
  }
  const category = pr.select(count) // 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

  const activeLocaleMsg = i18n.global.getLocaleMessage(loc) as Record<string, any>
  const fallbackLocaleMsg = i18n.global.getLocaleMessage('en') as Record<string, any>

  const activePlurals = activeLocaleMsg?._plurals?.[pluralKey]
  const fallbackPlurals = fallbackLocaleMsg?._plurals?.[pluralKey]

  const template: string =
    activePlurals?.[category] ||
    activePlurals?.other ||
    fallbackPlurals?.[category] ||
    fallbackPlurals?.other ||
    ''

  if (!template) return `${count}`

  const formatArgs = args.length > 0 ? args : [count]
  let result = template
  formatArgs.forEach((arg, i) => {
    result = result.replaceAll(`{${i}}`, String(arg))
  })
  return result
}

/**
 * Composable for easy access to i18n in Vue components.
 */
export function useAppI18n() {
  return {
    t: stringResource,
    stringResource,
    pluralStringResource,
    currentLanguage,
    effectiveLanguage,
    setAppLanguage,
    MR,
  }
}
