/**
 * Application language list.
 *
 * Mirrors `AppLanguageScreen.getLangs()` in
 * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/appearance/AppLanguageScreen.kt`
 * (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *  - the list of shipped translations is the `res/xml/locales_config.xml` that
 *    `mihon/gradle/build-logic/src/main/kotlin/mihon/gradle/tasks/GenerateLocalesConfigTask.kt`
 *    generates from the non-empty `mihon/i18n/src/commonMain/moko-resources/*` folders
 *    (`base` -> `en`, `-r` -> `-`, `+` -> `-`);
 *  - the headline is `LocaleHelper.getLocalizedDisplayName(langTag)`, the language name in the
 *    language itself with the first character upper-cased;
 *  - the supporting content is `LocaleHelper.getDisplayName(langTag)`, the language name in the
 *    device locale;
 *  - the list is sorted by the headline and the "Default" entry is inserted at index 0.
 */

/** The shipped translations, i.e. the non-empty `moko-resources` folders of the Mihon i18n module. */
export const APP_LOCALE_TAGS = [
  'am', 'ar', 'as', 'be', 'bg', 'bn', 'ca', 'ceb', 'cs', 'cv', 'da', 'de', 'el', 'en', 'eo', 'es',
  'eu', 'fa', 'fi', 'fil', 'fr', 'gl', 'he', 'hi', 'hr', 'hu', 'in', 'it', 'ja', 'jv', 'ka-GE', 'kk',
  'km', 'kmr', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'ms', 'my', 'nb-NO', 'ne', 'nl', 'nn', 'pl', 'pt',
  'pt-BR', 'ro', 'ru', 'sa', 'sah', 'sc', 'sdh', 'sk', 'sq', 'sr', 'sv', 'ta', 'te', 'th', 'tr', 'uk',
  'uz', 'vi', 'zh-CN', 'zh-TW',
]

export interface AppLanguage {
  /** BCP-47 tag, empty for the "Default" entry. */
  tag: string
  /** Headline: the language name in the language itself. */
  displayName: string
  /** Supporting content: the language name in the device locale, null for "Default". */
  localizedDisplayName: string | null
}

/** `LocaleHelper.getLocalizedDisplayName` / `getDisplayName`: zh-CN/zh-TW map to their scripts. */
export function normalizeLocaleTag(tag: string): string {
  if (tag === 'zh-CN') return 'zh-Hans'
  if (tag === 'zh-TW') return 'zh-Hant'
  return tag
}

/** Own-language names that the CLDR "language names" data of Intl words differently than Java. */
const JAVA_OWN_DISPLAY_NAMES: Record<string, string> = {
  // `Locale.forLanguageTag("in")` is the legacy Indonesian code; Java names it "Bahasa Indonesia".
  in: 'Bahasa Indonesia',
}

/**
 * The display name of a language in its own locale, with the first character upper-cased
 * (`LocaleHelper.getLocalizedDisplayName`).
 */
export function localizedDisplayName(tag: string): string {
  const normalized = normalizeLocaleTag(tag)
  if (JAVA_OWN_DISPLAY_NAMES[normalized]) return JAVA_OWN_DISPLAY_NAMES[normalized]!
  try {
    const names = new Intl.DisplayNames([normalized], { type: 'language' })
    const display = names.of(normalized)
    if (!display || display === normalized) return normalized.toUpperCase()
    return display.charAt(0).toLocaleUpperCase(normalized) + display.slice(1)
  } catch {
    return normalized.toUpperCase()
  }
}

/**
 * The display name of a language in the device locale (`LocaleHelper.getDisplayName`, which uses
 * `Locale.forLanguageTag(lang).displayName`). Java uses the CLDR language data, so
 * `Intl.DisplayNames` gives the same wording, except for a few tags spelled out here.
 */
const JAVA_DEVICE_DISPLAY_NAMES: Record<string, string> = {
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  'pt-BR': 'Portuguese (Brazil)',
  kmr: 'Kurdish (Kurmancî)',
}

export function deviceDisplayName(tag: string, deviceLocale: string): string {
  const normalized = normalizeLocaleTag(tag)
  const english = deviceLocale.toLowerCase() === 'en' || deviceLocale.toLowerCase().startsWith('en-')
  if (english && JAVA_DEVICE_DISPLAY_NAMES[normalized]) return JAVA_DEVICE_DISPLAY_NAMES[normalized]!
  try {
    const names = new Intl.DisplayNames([deviceLocale], { type: 'language' })
    const display = names.of(normalized)
    return display || normalized
  } catch {
    return normalized
  }
}

/** `sortBy { it.displayName }` compares the strings by their UTF-16 code units. */
function compareByDisplayName(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * The list of the screen: the shipped translations sorted by their headline, with the "Default"
 * entry (`MR.strings.label_default`) at index 0.
 */
export function appLanguages(deviceLocale: string): AppLanguage[] {
  const entries: AppLanguage[] = APP_LOCALE_TAGS.map(tag => ({
    tag,
    displayName: localizedDisplayName(tag),
    localizedDisplayName: deviceDisplayName(tag, deviceLocale),
  }))
  entries.sort((a, b) => compareByDisplayName(a.displayName, b.displayName))
  // `add(0, Language("", context.stringResource(MR.strings.label_default), null))`
  entries.unshift({ tag: '', displayName: 'Default', localizedDisplayName: null })
  return entries
}
