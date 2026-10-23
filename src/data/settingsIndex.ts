/**
 * Preference index of the settings tree, mirroring Mihon's
 * `SettingsSearchScreen.kt` (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * The Kotlin screen searches the live `Preference` tree of nine settings screens
 * (`settingScreens` in `SettingsSearchScreen.kt`):
 *
 * ```kotlin
 * private val settingScreens = listOf(
 *     SettingsAppearanceScreen,
 *     SettingsLibraryScreen,
 *     SettingsReaderScreen,
 *     SettingsDownloadScreen,
 *     SettingsTrackingScreen,
 *     SettingsBrowseScreen,
 *     SettingsDataScreen,
 *     SettingsSecurityScreen,
 *     SettingsAdvancedScreen,
 * )
 * ```
 *
 * Every screen contributes its `getPreferences()` list: `PreferenceGroup`s and
 * `PreferenceItem`s. A group is a heading (its own title) and its items carry the group
 * title as the breadcrumb node. `InfoPreference`s are excluded from the search, and so are
 * items whose title is blank (`TrackerPreference` has an empty title by design).
 *
 * The titles and subtitles below are the strings of the pinned reference
 * (`i18n/src/commonMain/moko-resources/base/strings.xml`), so the search behaves like Mihon's.
 */
export interface SettingsIndexItem {
  kind: 'item'
  title: string
  subtitle?: string
  /** Breadcrumb node: the group title, `null` for a top level item. */
  group: string | null
}

export interface SettingsIndexGroup {
  kind: 'group'
  title: string
}

export type SettingsIndexNode = SettingsIndexItem | SettingsIndexGroup

export interface SettingsIndexScreen {
  /** Route of the settings screen, `SettingsSearchScreen` navigates to it. */
  key: string
  /** `getTitleRes()` of the screen, used as the breadcrumb path. */
  title: string
  contents: SettingsIndexNode[]
}

const item = (title: string, group: string | null, subtitle?: string): SettingsIndexNode => ({
  kind: 'item',
  title,
  subtitle,
  group,
})

const group = (title: string, items: SettingsIndexNode[]): SettingsIndexNode[] => [
  { kind: 'group', title },
  ...items,
]

export const settingsIndex: SettingsIndexScreen[] = [
  {
    key: 'appearance',
    title: 'Appearance',
    contents: [
      ...group('Theme', [item('App theme', 'Theme'), item('Pure black dark mode', 'Theme')]),
      ...group('Display', [
        item('App language', 'Display'),
        item('Tablet UI', 'Display'),
        item('Date format', 'Display'),
        item('Time format', 'Display'),
        item('Relative timestamps', 'Display'),
        item('Render images in manga descriptions', 'Display'),
      ]),
    ],
  },
  {
    key: 'library',
    title: 'Library',
    contents: [
      ...group('Categories', [
        item('Edit categories', 'Categories'),
        item('Default category', 'Categories'),
        item('Per-category settings for sort', 'Categories'),
      ]),
      ...group('Global update', [
        item('Automatic updates', 'Global update'),
        item('Automatic updates device restrictions', 'Global update', 'Restrictions: %s'),
        item('Categories', 'Global update'),
        item('Automatically refresh metadata', 'Global update', 'Check for new cover and details when updating library'),
        item('Smart update', 'Global update'),
        item('Show unread count on Updates icon', 'Global update'),
      ]),
      ...group('Behavior', [
        item('Chapter on swipe to left', 'Behavior'),
        item('Chapter on swipe to right', 'Behavior'),
        item('Mark duplicate read chapter as read', 'Behavior'),
        item('Hide missing chapter indicators', 'Behavior'),
      ]),
    ],
  },
  {
    key: 'reader',
    title: 'Reader',
    contents: [
      item('Default reading mode', null),
      item('Double tap animation speed', null),
      item('Show reading mode', null, 'Briefly show current mode when reader is opened'),
      item('Show tap zones overlay', null, 'Briefly show when reader is opened'),
      item('Animate page transitions', null),
      item('Load ahead only on Wi-Fi', null, 'Saves mobile data by loading only the pages near the one you\'re reading'),
      ...group('Display', [
        item('Default rotation', 'Display'),
        item('Background color', 'Display'),
        item('Fullscreen', 'Display'),
        item('Show content in cutout area', 'Display'),
        item('Keep screen on', 'Display'),
        item('Show page number', 'Display'),
      ]),
      ...group('E-Ink', [
        item('Flash on page change', 'E-Ink', 'Reduces ghosting on e-ink displays'),
        item('Flash duration', 'E-Ink'),
        item('Flash every', 'E-Ink'),
        item('Flash with', 'E-Ink'),
      ]),
      ...group('Reading', [
        item('Skip chapters marked read', 'Reading'),
        item('Skip filtered chapters', 'Reading'),
        item('Skip duplicate chapters', 'Reading'),
        item('Always show chapter transition', 'Reading'),
      ]),
      ...group('Paged', [
        item('Tap zones', 'Paged'),
        item('Invert tap zones', 'Paged'),
        item('Scale type', 'Paged'),
        item('Zoom start position', 'Paged'),
        item('Crop borders', 'Paged'),
        item('Automatically zoom into wide images', 'Paged'),
        item('Pan wide images', 'Paged'),
        item('Split wide pages', 'Paged'),
        item('Invert split page placement', 'Paged', "If the placement of the split wide pages don't match reading direction"),
        item('Rotate wide pages to fit', 'Paged'),
        item('Flip orientation of rotated wide pages', 'Paged'),
      ]),
      ...group('Long strip', [
        item('Tap zones', 'Long strip'),
        item('Invert tap zones', 'Long strip'),
        item('Side padding', 'Long strip'),
        item('Sensitivity for hiding menu on scroll', 'Long strip'),
        item('Crop borders', 'Long strip'),
        item('Split wide pages', 'Long strip'),
        item('Invert split page placement', 'Long strip', "If the placement of the split wide pages don't match reading direction"),
        item('Rotate wide pages to fit', 'Long strip'),
        item('Flip orientation of rotated wide pages', 'Long strip'),
        item('Double tap to zoom', 'Long strip'),
        item('Disable zoom out', 'Long strip'),
      ]),
      ...group('Navigation', [
        item('Volume keys', 'Navigation'),
        item('Invert volume keys', 'Navigation'),
        item('Use vertical chapter navigator in', 'Navigation'),
        item('Place vertical navigator on the left side', 'Navigation'),
        item('Vertical navigator height', 'Navigation'),
      ]),
      ...group('Actions', [
        item('Show actions on long tap', 'Actions'),
        item('Save pages into separate folders', 'Actions', "Creates folders according to entries' title"),
      ]),
    ],
  },
  {
    key: 'downloads',
    title: 'Downloads',
    contents: [
      item('Only on Wi-Fi', null),
      item('Save as CBZ archive', null),
      item('Concurrent source downloads', null),
      item('Concurrent page downloads', null, 'Pages downloaded simultaneously per source'),
      ...group('Delete chapters', [
        item('After manually marked as read', 'Delete chapters'),
        item('After reading automatically delete', 'Delete chapters'),
        item('Allow deleting bookmarked chapters', 'Delete chapters'),
        item('Excluded categories', 'Delete chapters'),
      ]),
      ...group('Auto-download', [
        item('Download new chapters', 'Auto-download'),
        item('Skip downloading duplicate read chapters', 'Auto-download'),
        item('Categories', 'Auto-download'),
      ]),
      ...group('Download ahead', [item('Auto download while reading', 'Download ahead')]),
    ],
  },
  {
    key: 'tracking',
    title: 'Tracking',
    contents: [
      item('Update progress after reading', null),
      item('Update progress when marked as read', null),
      // The tracker preferences have a blank title, so Mihon's search skips them; the group
      // headings stay searchable.
      ...group('Trackers', []),
      ...group('Enhanced trackers', []),
    ],
  },
  {
    key: 'browse',
    title: 'Browse',
    contents: [
      ...group('Sources', [item('Hide entries already in library', 'Sources'), item('Extension stores', 'Sources')]),
      ...group('Extensions', [
        item('Allowed content warnings', 'Extensions'),
        item(
          'Also apply to installed extensions',
          'Extensions',
          'When off, extensions you already installed keep loading and updating regardless of their warning',
        ),
      ]),
    ],
  },
  {
    key: 'data',
    title: 'Data and storage',
    contents: [
      item('Storage location', null),
      ...group('Backup and restore', [
        item('Backup and restore', 'Backup and restore'),
        item('Automatic backup frequency', 'Backup and restore'),
      ]),
      ...group('Storage usage', [
        item('Storage usage', 'Storage usage'),
        item('Clear chapter cache', 'Storage usage'),
        item('Clear chapter cache on app launch', 'Storage usage'),
      ]),
      ...group('Export', [item('Library List', 'Export')]),
    ],
  },
  {
    key: 'security',
    title: 'Security and privacy',
    contents: [
      ...group('Security', [
        item('Require unlock', 'Security'),
        item('Lock when idle', 'Security'),
        item('Hide notification content', 'Security'),
        item('Secure screen', 'Security'),
      ]),
      ...group('Analytics and Crash logs', [
        item('Send crash logs', 'Analytics and Crash logs', 'Send anonymized crash logs to the developers.'),
        item('Allow analytics', 'Analytics and Crash logs', 'Send anonymized usage data to improve app features.'),
      ]),
    ],
  },
  {
    key: 'advanced',
    title: 'Advanced',
    contents: [
      item('Share crash logs', null, 'Saves error logs to a file for sharing with the developers'),
      item('Verbose logging', null, 'Print verbose logs to system log (reduces app performance)'),
      item(
        'Redact sensitive headers',
        null,
        'Redacts certain sensitive values in the logs. Keep enabled for your security when sharing logs with other people.',
      ),
      item('Debug info', null),
      item('Onboarding guide', null),
      item('Manage notifications', null),
      ...group('Background activity', [
        item('Disable battery optimization', 'Background activity', 'Helps with background library updates and backups'),
        item(
          "Don't kill my app!",
          'Background activity',
          'Some manufacturers have additional app restrictions that kill background services. This website has more info on how to fix it.',
        ),
      ]),
      ...group('Data', [
        item('Reindex downloads', 'Data', 'Force app to recheck downloaded chapters'),
        item('Clear database', 'Data', 'Delete history for entries that are not saved in your library'),
      ]),
      ...group('Networking', [
        item('Clear cookies', 'Networking'),
        item('Clear WebView data', 'Networking'),
        item('DNS over HTTPS (DoH)', 'Networking'),
        item('Default user agent string', 'Networking'),
        item('Reset default user agent string', 'Networking'),
      ]),
      ...group('Library', [
        item('Refresh library covers', 'Library'),
        item('Reset per-series reader settings', 'Library', 'Resets reading mode and orientation of all series'),
        item(
          'Update library manga titles to match source',
          'Library',
          'Warning: if a manga is renamed, it will be removed from the download queue (if present).',
        ),
        item(
          'Disallow non-ASCII filenames',
          'Library',
          "Ensures compatibility with certain storage media that don't support Unicode. When this is enabled, you'll need to manually rename source and manga folders by replacing non-ASCII characters with their lowercase UTF-8 hexadecimal representations. Chapter files don't need to be renamed.",
        ),
        item(
          'Enable chapter name hash suffix',
          'Library',
          'Ensures a unique hash suffix is added to chapter names to prevent naming conflicts. If disabled, chapters with identical names cannot be downloaded.',
        ),
      ]),
      ...group('Reader', [item('Use high quality renderer', 'Reader')]),
      ...group('Extensions', [item('Installer', 'Extensions'), item('Revoke trusted unknown extensions', 'Extensions')]),
    ],
  },
]

export interface SettingsSearchResult {
  /** Route of the screen the result belongs to. */
  route: string
  /** Result title, the preference title or the group title. */
  title: string
  /** `getLocalizedBreadcrumb(path, node, isLtr)`. */
  breadcrumbs: string
  /** `SearchableSettings.highlightKey`. */
  highlightKey: string
}

/**
 * Mihon: `search(index, searchKey, isLtr)` of `SettingsSearchScreen.kt`.
 *
 * - the query is matched case insensitively against the title and the subtitle of a preference,
 * - a matching group title produces a heading result for the group itself,
 * - a group item carries the group title as the breadcrumb node,
 * - the whole result list is capped at ten entries.
 */
export function searchSettings(query: string): SettingsSearchResult[] {
  const key = query.toLowerCase()
  if (!key) return []
  const results: SettingsSearchResult[] = []
  for (const screen of settingsIndex) {
    for (const node of screen.contents) {
      if (node.kind === 'group') {
        if (node.title.toLowerCase().includes(key)) {
          results.push({
            route: screen.key,
            title: node.title,
            breadcrumbs: screen.title,
            highlightKey: node.title,
          })
          if (results.length >= 10) return results
        }
        continue
      }
      const inTitle = node.title.toLowerCase().includes(key)
      const inSubtitle = node.subtitle?.toLowerCase().includes(key) ?? false
      if (!inTitle && !inSubtitle) continue
      results.push({
        route: screen.key,
        title: node.title,
        breadcrumbs: node.group ? `${screen.title} > ${node.group}` : screen.title,
        highlightKey: node.title,
      })
      if (results.length >= 10) return results
    }
  }
  return results
}
