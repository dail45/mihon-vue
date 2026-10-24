import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/core/components/StorageInfoItem.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/core/components/StorageInfoItem.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/data/StorageInfo.kt.
 * The reference is Kotlin, so the invariants are asserted on the ported metrics.
 */
describe('StorageInfoItem parity with Mihon', () => {
  it('uses the reference column arrangement spacings and padding', () => {
    // Outer Column(Arrangement.spacedBy(MaterialTheme.padding.small)) with small = 8dp.
    expect(source).toMatch(/\.storage-info \{[^}]*gap: 8px;/s)
    // Container padding horizontal 16dp, vertical 12dp.
    expect(source).toMatch(/\.storage-info \{[^}]*padding: 12px 16px;/s)
    // Inner Column(Arrangement.spacedBy(MaterialTheme.padding.extraSmall)) with extraSmall = 4dp.
    expect(source).toMatch(/\.storage-info__item \{[^}]*gap: 4px;/s)
  })

  it('uses the reference typography', () => {
    // header = bodyMedium.copy(onSurfaceVariant, SemiBold): 14sp / 20sp, w600, 0.25sp.
    expect(source).toMatch(/\.storage-info__path \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.storage-info__path \{[^}]*line-height: 20px;/s)
    expect(source).toMatch(/\.storage-info__path \{[^}]*font-weight: 600;/s)
    expect(source).toMatch(/\.storage-info__path \{[^}]*letter-spacing: 0.25px;/s)
    expect(source).toMatch(/\.storage-info__path \{[^}]*color: rgb\(var\(--v-theme-on-surface-variant\)\);/s)
    // bodySmall: 12sp / 16sp, w400, 0.4sp, onSurfaceVariant drawn with secondaryItemAlpha() = 0.78.
    expect(source).toMatch(/\.storage-info__caption \{[^}]*font-size: 12px;/s)
    expect(source).toMatch(/\.storage-info__caption \{[^}]*line-height: 16px;/s)
    expect(source).toMatch(/\.storage-info__caption \{[^}]*font-weight: 400;/s)
    expect(source).toMatch(/\.storage-info__caption \{[^}]*letter-spacing: 0.4px;/s)
    expect(source).toMatch(/\.storage-info__caption \{[^}]*color: rgb\(var\(--v-theme-on-surface-variant\)\);/s)
    expect(source).toMatch(/\.storage-info__caption \{[^}]*opacity: 0.78;/s)
  })

  it('uses the Material3 linear progress indicator metrics', () => {
    // Modifier.height(12.dp) and Modifier.clip(MaterialTheme.shapes.small) with small = 8dp.
    expect(source).toMatch(/\.storage-info__progress \{[^}]*height: 12px;/s)
    expect(source).toMatch(/\.storage-info__progress \{[^}]*border-radius: 8px;/s)
    // ActiveIndicatorColor = Primary, TrackColor = SecondaryContainer.
    expect(source).toMatch(/\.storage-info__bar \{[^}]*background: rgb\(var\(--v-theme-primary\)\);/s)
    expect(source).toMatch(/\.storage-info__track \{[^}]*background: rgb\(var\(--v-theme-secondary-container\)\);/s)
    // LinearStrokeCap = Round on a 12dp stroke.
    expect(source).toMatch(/\.storage-info__bar \{[^}]*border-radius: 6px;/s)
    // LinearTrackStopIndicatorSize = 4dp, StopIndicatorTrailingSpace limited to 4dp.
    expect(source).toContain('const STOP_SIZE = 4')
    expect(source).toContain('const STOP_TRAILING = 4')
    // LinearIndicatorTrackGapSize (4dp) plus the stroke width, because the cap is Round.
    expect(source).toContain('const TRACK_GAP = 4 + INDICATOR_HEIGHT')
  })

  it('keeps the reference progress formula and the reference string', () => {
    // progress = { if (total > 0) 1 - (available / total.toFloat()) else 0f }
    expect(source).toContain('storage.total > 0 ? 1 - storage.available / storage.total : 0')
    // MR.strings.available_disk_space_info = "Available: %1$s / Total: %2$s".
    expect(source).toContain('Available: {{ formatFileSize(item.storage.available) }} /')
    expect(source).toContain('Total: {{ formatFileSize(item.storage.total) }}')
  })

  it('formats sizes like Android Formatter.formatFileSize', () => {
    // SI labels, decimal ladder, one decimal below 10.
    expect(source).toContain("const units = ['kB', 'MB', 'GB', 'TB', 'PB']")
    expect(source).toContain('const decimals = value < 10 ? 1 : 0')
  })

  it('stubs the unsupported device storage honestly instead of hiding the feature', () => {
    // The browser exposes no device volumes: the block still renders and says so.
    expect(source).toContain('Device storage volumes are not exposed to the web version')
    expect(source).toContain('supported.value = false')
  })
})
