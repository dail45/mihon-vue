import type { ExtensionDto } from '../api/extensions'

/**
 * Mirrors Mihon's `mihon.domain.extension.model.ContentWarning` enum
 * (mihon/domain/src/main/java/mihon/domain/extension/model/ContentWarning.kt):
 * SAFE, MIXED, NSFW.
 */
export type ContentWarningLevel = 'safe' | 'mixed' | 'nsfw'

/**
 * Mirrors `eu.kanade.presentation.browse.components.ContentWarningLabel`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/components/ContentWarningLabel.kt):
 * a title, a description and a colour taken from the Material 3 colour scheme.
 */
export interface ContentWarningLabel {
  /** MR.strings.ext_content_warning_mixed / ext_content_warning_nsfw */
  title: string
  /** MR.strings.ext_content_warning_mixed_description / ext_content_warning_nsfw_description */
  description: string
  /** MaterialTheme.colorScheme.primary for MIXED, colorScheme.error for NSFW. */
  color: 'primary' | 'error'
}

/** MR.strings.ext_content_warning_safe */
export const contentWarningTitles: Record<ContentWarningLevel, string> = {
  safe: 'Safe',
  mixed: 'Mixed',
  nsfw: '18+',
}

const labels: Record<Exclude<ContentWarningLevel, 'safe'>, ContentWarningLabel> = {
  mixed: {
    title: contentWarningTitles.mixed,
    description: 'Sources from this extension might contain both safe and 18+ content.',
    color: 'primary',
  },
  nsfw: {
    title: contentWarningTitles.nsfw,
    description: 'Sources from this extension are primarily focused on 18+ content.',
    color: 'error',
  },
}

/**
 * `ContentWarning.label` returns null for SAFE and a label for MIXED / NSFW.
 * A SAFE extension has no warning entry and opens no warning dialog.
 */
export function contentWarningLabel(level: ContentWarningLevel): ContentWarningLabel | null {
  return level === 'safe' ? null : labels[level]
}

/**
 * Suwayomi's `GET /extension/list` payload only carries a boolean `isNsfw` flag,
 * so the wire can express SAFE (false) and NSFW (true) but not the MIXED state
 * Mihon derives from the extension manifest. MIXED therefore falls back to SAFE.
 */
export function extensionContentWarning(extension: Pick<ExtensionDto, 'isNsfw'>): ContentWarningLevel {
  return extension.isNsfw ? 'nsfw' : 'safe'
}
