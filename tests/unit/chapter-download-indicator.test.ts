import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/ChapterDownloadIndicator.vue', 'utf8')

/**
 * Parity guards for ChapterDownloadIndicator.vue with
 * mihon/app/src/main/java/eu/kanade/presentation/manga/components/ChapterDownloadIndicator.kt
 */
describe('ChapterDownloadIndicator parity with Mihon', () => {
  it('adheres to Material 3 icon button and indicator dimensions', () => {
    // IconButtonTokens.StateLayerSize = 40.dp
    expect(source).toContain('width: 40px')
    expect(source).toContain('height: 40px')
    // Touch target: minimumInteractiveComponentSize = 48.dp
    expect(source).toContain('width: 48px')
    expect(source).toContain('height: 48px')
    // IndicatorSize = 26.dp
    expect(source).toContain('const INDICATOR = 26')
    // IndicatorStrokeWidth = 2.dp
    expect(source).toContain('const STROKE = 2')
    // IndicatorPadding = 1.dp
    expect(source).toContain('const PADDING = 1')
    // IndicatorWavelength = 7.dp
    expect(source).toContain('const WAVELENGTH = 7')
    // INDICATOR_AMPLITUDE = 0.6f
    expect(source).toContain('const AMPLITUDE = 0.6')
  })

  it('applies exact M3 opacity and color tokens', () => {
    // SECONDARY_ALPHA = 0.78f for not-downloaded state
    expect(source).toMatch(/\.chapter-download\.is-not-downloaded\s*\{\s*opacity:\s*0\.78;/)
    // TRACK_ALPHA = 0.25f for the download progress track
    expect(source).toMatch(/\.chapter-download-track\s*\{[^}]*opacity:\s*0\.25;/)
    // Error state uses colorScheme.error
    expect(source).toContain('rgb(var(--v-theme-error))')
    // Default tint uses onSurfaceVariant
    expect(source).toContain('rgb(var(--v-theme-on-surface-variant))')
  })

  it('embeds exact Mihon vector paths for custom and filled symbols', () => {
    // CustomMaterialSymbols.Rounded.DownloadCircle
    expect(source).toContain('M479 -680Q462 -680 450.5 -668.5Q439 -657 439 -640L439 -435L364 -511Q352 -523 335.5 -523Q319 -523 307 -511Q295 -499 294.5 -482.5Q294 -466 306 -454L451 -308Q462 -297 479 -297Q496 -297 507 -308L650 -451Q662 -463 662.5 -480Q663 -497 651 -509Q639 -521 622 -521Q605 -521 593 -509L519 -435L519 -640Q519 -657 507.5 -668.5Q496 -680 479 -680ZM480 -810C662.3 -810 810 -662.3 810 -480C810 -297.7 662.3 -150 480 -150C297.7 -150 150 -297.7 150 -480C150 -662.3 297.7 -810 480 -810ZM480 -880Q397 -880 324 -848.5Q251 -817 197 -763Q143 -709 111.5 -636Q80 -563 80 -480Q80 -397 111.5 -324Q143 -251 197 -197Q251 -143 324 -111.5Q397 -80 480 -80Q563 -80 636 -111.5Q709 -143 763 -197Q817 -251 848.5 -324Q880 -397 880 -480Q880 -563 848.5 -636Q817 -709 763 -763Q709 -817 636 -848.5Q563 -880 480 -880Z')
    // CustomMaterialSymbols.Rounded.DownloadArrow
    expect(source).toContain('M479 -680Q462 -680 450.5 -668.5Q439 -657 439 -640L439 -435L364 -511Q352 -523 335.5 -523Q319 -523 307 -511Q295 -499 294.5 -482.5Q294 -466 306 -454L451 -308Q462 -297 479 -297Q496 -297 507 -308L650 -451Q662 -463 662.5 -480Q663 -497 651 -509Q639 -521 622 -521Q605 -521 593 -509L519 -435L519 -640Q519 -657 507.5 -668.5Q496 -680 479 -680Z')
    // MaterialSymbols.RoundedFilled.CheckCircle
    expect(source).toContain('m424-408-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-408Zm56 328q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z')
    // MaterialSymbols.Rounded.Error
    expect(source).toContain('M508.5-291.5Q520-303 520-320t-11.5-28.5Q497-360 480-360t-28.5 11.5Q440-337 440-320t11.5 28.5Q463-280 480-280t28.5-11.5Zm0-160Q520-463 520-480v-160q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v160q0 17 11.5 28.5T480-440q17 0 28.5-11.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z')
  })

  it('configures DropdownMenu with Mihon constraints and exact string resources', () => {
    // Mihon DropdownMenu width: minWidth = 196.dp, maxWidth = 196.dp
    expect(source).toContain('min-width="196"')
    expect(source).toContain('max-width="196"')
    expect(source).toMatch(/\.chapter-download-menu\s*\{[^}]*width:\s*196px;/s)
    // Shape: CornerExtraSmall = 4px
    expect(source).toContain('border-radius: 4px;')
    // Surface: surfaceContainer
    expect(source).toContain('rgb(var(--v-theme-surface-container))')
    // DropdownMenuItem min-height: 48px
    expect(source).toMatch(/\.v-list-item\s*\{[^}]*min-height:\s*48px;/s)
    // Typography: bodyLarge (16sp, line-height 24sp, 400 weight)
    expect(source).toMatch(/\.v-list-item-title\s*\{[^}]*font-size:\s*16px;/s)
    expect(source).toMatch(/\.v-list-item-title\s*\{[^}]*line-height:\s*24px;/s)
    expect(source).toMatch(/\.v-list-item-title\s*\{[^}]*font-weight:\s*400;/s)

    // String resources: MR.strings.action_start_downloading_now, MR.strings.action_cancel, MR.strings.action_delete
    expect(source).toContain('title="Start downloading now"')
    expect(source).toContain('title="Cancel"')
    expect(source).toContain('title="Delete"')
  })

  it('implements state-based click and long-press actions', () => {
    // NOT_DOWNLOADED: click -> start, long click -> start-now
    // QUEUE / DOWNLOADING: click -> menu, long click -> cancel
    // DOWNLOADED: click -> menu, long click -> menu
    // ERROR: click -> start, long click -> start
    expect(source).toContain("emit('action', 'start-now')")
    expect(source).toContain("emit('action', 'cancel')")
    expect(source).toContain("onMenuAction('delete')")
    expect(source).toContain("emit('action', 'start')")
  })

  it('supports periodic circular wavy progress animation', () => {
    // Indeterminate QUEUE has amplitude 0 (smooth circle arc)
    // Indeterminate DOWNLOADING has amplitude 0.6
    // Determinate DOWNLOADING has amplitude 0.6 and wave period N_WAVES = 10
    expect(source).toContain('const N_WAVES = 10')
    expect(source).toContain('amplitude * Math.sin(angleRad * N_WAVES + phase)')
    expect(source).toContain('amplitude = normalizedState.value === \'downloading\' ? AMPLITUDE : 0')
  })

  it('normalizes download progress whether passed as fraction (0..1) or percentage (0..100)', () => {
    expect(source).toContain('const normalizedProgress = computed')
    expect(source).toContain('if (p <= 1) return Math.round(p * 100)')
    expect(source).toContain('return Math.min(100, Math.round(p))')
    expect(source).toContain(':title="isDownloading && !indeterminate ? `${normalizedProgress}%` : undefined"')
  })
})
