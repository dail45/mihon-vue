import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/manga/components/MangaCoverDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/manga/components/MangaCoverDialog.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaCoverDialog.kt
 * (MangaCoverDialog). The reference is Kotlin Compose, so the invariants are asserted on the ported
 * Material 3 metrics of Dialog, Scaffold, ActionsPill, IconButton, DropdownMenu, PlainTooltip, and SnackbarHost.
 */
describe('MangaCoverDialog parity with Mihon', () => {
  it('uses the Material3 ActionsPill metrics (28dp shape, background with alpha 0.95)', () => {
    // ActionsPill: clip(MaterialTheme.shapes.extraLarge = 28dp), background(colorScheme.background.copy(alpha = 0.95f))
    expect(source).toMatch(/\.cover-pill \{[^}]*border-radius:\s*28px;/s)
    expect(source).toContain('background: rgb(var(--v-theme-background) / 0.95)')
  })

  it('uses 48dp IconButtons with 24dp icons and M3 state layers', () => {
    // 48dp touch target, 24dp icon
    expect(source).toMatch(/\.cover-icon-button \{[^}]*width:\s*48px;/s)
    expect(source).toMatch(/\.cover-icon-button \{[^}]*height:\s*48px;/s)
    expect(source).toMatch(/\.cover-icon-button \.material-symbols-rounded \{[^}]*font-size:\s*24px;/s)
    // Hover (8%) and active (12%) state layers
    expect(source).toContain('background: rgb(var(--v-theme-on-surface) / 0.08)')
    expect(source).toContain('background: rgb(var(--v-theme-on-surface) / 0.12)')
  })

  it('uses Mihon DropdownMenu tokens (fixed 196dp width, 4dp shape, surfaceContainer)', () => {
    // eu.kanade.presentation.components.DropdownMenu: fixed 196dp width
    expect(source).toMatch(/\.cover-menu \{[^}]*width:\s*196px;/s)
    expect(source).toMatch(/\.cover-menu \{[^}]*border-radius:\s*4px;/s)
    expect(source).toContain('background: rgb(var(--v-theme-surface-container))')
    // Items: 48dp height, 16px font-size, 24px line-height (bodyLarge)
    expect(source).toMatch(/\.cover-menu-item \{[^}]*height:\s*48px;/s)
    expect(source).toMatch(/\.cover-menu-item \{[^}]*font-size:\s*16px;/s)
    expect(source).toMatch(/\.cover-menu-item \{[^}]*line-height:\s*24px;/s)
  })

  it('anchors the DropdownMenu above the bottom bar pill to prevent viewport overflow', () => {
    expect(source).toMatch(/\.cover-menu \{[^}]*bottom:\s*calc\(100% \+ 8px\);/s)
    expect(source).toMatch(/\.cover-menu \{[^}]*right:\s*0;/s)
  })

  it('uses PlainTooltip tokens for Share and Save (inverseSurface, 4dp shape, 12sp)', () => {
    expect(source).toContain('background: rgb(var(--v-theme-inverse-surface))')
    expect(source).toContain('color: rgb(var(--v-theme-inverse-on-surface))')
    expect(source).toMatch(/\.cover-tooltip \{[^}]*font-size:\s*12px;/s)
    expect(source).toMatch(/\.cover-tooltip \{[^}]*line-height:\s*16px;/s)
    expect(source).toMatch(/\.cover-tooltip \{[^}]*border-radius:\s*4px;/s)
  })

  it('uses M3 SnackbarHost tokens (inverseSurface, 4dp shape, bodyMedium, inversePrimary Dismiss)', () => {
    expect(source).toMatch(/\.cover-snackbar \{[^}]*background:\s*rgb\(var\(--v-theme-inverse-surface\)\);/s)
    expect(source).toMatch(/\.cover-snackbar \{[^}]*color:\s*rgb\(var\(--v-theme-inverse-on-surface\)\);/s)
    expect(source).toMatch(/\.cover-snackbar \{[^}]*border-radius:\s*4px;/s)
    expect(source).toMatch(/\.cover-snackbar-action \{[^}]*color:\s*rgb\(var\(--v-theme-inverse-primary\)\);/s)
    expect(source).toMatch(/min-width:\s*288px;/)
    expect(source).toMatch(/max-width:\s*min\(560px,\s*calc\(100vw\s*-\s*32px\)\);/)
    expect(source).toContain('Dismiss')
  })

  it('implements Android Dialog dim scrim (0.6 opacity)', () => {
    expect(source).toMatch(/\.cover-dialog \{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.6\);/s)
  })

  it('implements ReaderPageImageView 500ms zoom animation parity', () => {
    // ReaderPageImageView.Config(zoomDuration = 500)
    expect(source).toMatch(/transition:\s*transform 500ms cubic-bezier\(0\.2,\s*0,\s*0,\s*1\);/)
  })

  it('contains the reference strings from Mihon MR.strings', () => {
    // Strings in MangaCoverDialog.kt and MangaCoverViewModel.kt
    expect(source).toContain('Close') // MR.strings.action_close
    expect(source).toContain('Share') // MR.strings.action_share
    expect(source).toContain('Save') // MR.strings.action_save
    expect(source).toContain('Edit cover') // MR.strings.action_edit_cover
    expect(source).toContain('Edit') // MR.strings.action_edit
    expect(source).toContain('Delete') // MR.strings.action_delete
    expect(source).toContain('Cover saved') // MR.strings.cover_saved
    expect(source).toContain('Error saving cover') // MR.strings.error_saving_cover
    expect(source).toContain('Error sharing cover') // MR.strings.error_sharing_cover
    expect(source).toContain('Please add the entry to your library before doing this') // MR.strings.notification_first_add_to_library
  })

  it('handles Edit button branch logic: ADD_TO_LIBRARY warning, isCustomCover menu, else edit', () => {
    expect(source).toContain('!props.inLibrary && !props.isLocal')
    expect(source).toContain('props.isCustomCover')
    expect(source).toContain('menuOpen.value = true')
  })

  it('provides click outside interceptor for DropdownMenu', () => {
    expect(source).toContain('cover-menu-scrim')
    expect(source).toContain('@click.stop="menuOpen = false"')
  })
})
