/**
 * Localized display name of a source language.
 *
 * Mirrors `eu.kanade.tachiyomi.util.system.LocaleHelper.getLocalizedDisplayName`
 * (`mihon/app/src/main/java/eu/kanade/tachiyomi/util/system/LocaleHelper.kt:67`):
 *
 *   val locale = when (lang) {
 *       "" -> LocaleListCompat.getAdjustedDefault()[0]
 *       "zh-CN" -> Locale.forLanguageTag("zh-Hans")
 *       "zh-TW" -> Locale.forLanguageTag("zh-Hant")
 *       else -> Locale.forLanguageTag(lang)
 *   }
 *   return locale!!.getDisplayName(locale).replaceFirstChar { it.uppercase(locale) }
 *
 * `Locale.getDisplayName(locale)` renders the name of the locale *in that locale itself* and
 * spells the variants out as "Language (Variant)":
 *
 *   "en"       -> "English"
 *   "en-US"    -> "English (United States)"
 *   "pt-BR"    -> "Português (Brasil)"
 *   "ja"       -> "日本語"
 *   "zh-Hans"  -> "中文 (简体)"
 *   "es-419"   -> "Español (Latinoamérica)"
 *
 * `Intl.DisplayNames` follows the same CLDR data as the JDK, so the names are resolved with
 * the *source* locale as the display locale and the region / script subtag is appended in
 * parentheses, exactly like the JDK does.
 */

/** Java renders an unknown region subtag "419" as the UN M49 macro area name. */
const REGION_NAMES: Record<string, string> = {
  '419': 'Latinoamérica',
  '150': 'Europa',
  '021': 'América del Norte',
}

function displayName(type: 'language' | 'region' | 'script', code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type }).of(code) || code
  } catch {
    return code
  }
}

/** Kotlin: `replaceFirstChar { it.uppercase(locale) }` — a locale aware upper case of the first char. */
function capitalize(value: string, locale: string): string {
  if (!value) return value
  try {
    return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1)
  } catch {
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
}

/**
 * @param lang the source language tag; an empty tag means the system language.
 */
export function languageName(lang: string | null | undefined): string {
  if (!lang) return ''
  // Suwayomi's local source uses "localsourcelang"; Mihon's LocalSource declares "other".
  // Java's `Locale.forLanguageTag("other").getDisplayName(...)` yields "other", capitalised.
  if (lang === 'localsourcelang' || lang === 'other') return 'Other'
  const tag = lang === 'zh-CN' ? 'zh-Hans' : lang === 'zh-TW' ? 'zh-Hant' : lang
  const parts = tag.split('-')
  const base = (parts[0] ?? tag).toLowerCase()
  // The script and the region subtag never are the first part (that one is the language).
  const script = parts.slice(1).find(part => /^[A-Za-z]{4}$/.test(part))
  const region = parts.slice(1).find(part => /^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part))
  // The locale itself is the display locale (`getDisplayName(locale)`).
  const baseName = displayName('language', base, tag)
  if (script) {
    const scriptName = displayName('script', script, tag)
    return capitalize(`${baseName} (${scriptName})`, tag)
  }
  if (region) {
    const regionName = REGION_NAMES[region] ?? displayName('region', region.toUpperCase(), tag)
    return capitalize(`${baseName} (${regionName})`, tag)
  }
  return capitalize(baseName, tag)
}

/**
 * Mirrors `eu.kanade.tachiyomi.util.system.LocaleHelper.getSourceDisplayName`:
 * - SourcesViewModel.LAST_USED_KEY ("last_used") -> "Last used"
 * - SourcesViewModel.PINNED_KEY ("pinned") -> "Pinned"
 * - "other" / "localsourcelang" -> "Other"
 * - "all" -> "Multi"
 * - otherwise getLocalizedDisplayName(lang)
 */
export function getSourceDisplayName(lang: string | null | undefined): string {
  if (!lang) return ''
  if (lang === 'last_used') return 'Last used'
  if (lang === 'pinned') return 'Pinned'
  if (lang === 'other' || lang === 'localsourcelang') return 'Other'
  if (lang === 'all') return 'Multi'
  return languageName(lang)
}
