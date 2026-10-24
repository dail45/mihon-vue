import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'src/features/reader/components/ReaderPageActionsDialog.vue'),
  'utf8',
)

/**
 * Parity test verifying `src/features/reader/components/ReaderPageActionsDialog.vue` against
 * `eu/kanade/presentation/reader/ReaderPageActionsDialog.kt`, `ActionButton.kt`,
 * and `AdaptiveSheet.kt`.
 */
describe('ReaderPageActionsDialog parity with Mihon', () => {
  it('implements AdaptiveSheet structure and Material 3 tokens', () => {
    // MaterialTheme.shapes.extraLarge = 28dp radius
    expect(source).toContain('border-radius: 28px;')
    // surfaceContainerHigh container background
    expect(source).toContain('background: rgb(var(--v-theme-surface-container-high))')
    // Flat without drop shadow
    expect(source).toContain('box-shadow: none;')
    // Sized by AdaptiveSheet to max 460dp
    expect(source).toContain('max-width: 460px;')
    // 350ms tween for dismissal & appearance transitions
    expect(source).toContain('350ms')
  })

  it('implements AdaptiveSheet phone and tablet positioning', () => {
    // Tablet: centered Surface, margin 16px 0
    expect(source).toContain('.reader-page-actions-sheet--tablet')
    expect(source).toContain('align-items: center;')
    expect(source).toContain('margin: 16px 0;')

    // Phone: bottom anchored Surface with safe-area navigation bar padding
    expect(source).toContain('.reader-page-actions-sheet--phone')
    expect(source).toContain('align-items: flex-end;')
    expect(source).toContain('margin-bottom: env(safe-area-inset-bottom);')

    // Phone gesture: 56dp positional threshold matching AnchoredDraggable
    expect(source).toContain('dragOffset.value > 56')
  })

  it('dismisses on outside scrim click for both tablet and phone', () => {
    expect(source).toContain('function onScrimClick()')
    expect(source).toContain('dismissNow()')
    expect(source).toContain('dismissAnimated()')
  })

  it('implements Row layout with padding and spacing matching reference', () => {
    // Row(modifier = Modifier.padding(vertical = 16.dp))
    expect(source).toContain('padding: 16px 0;')
    // horizontalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small) = 8dp
    expect(source).toContain('gap: 8px;')
  })

  it('renders all four action buttons with Modifier.weight(1f) and exact Mihon strings and icons', () => {
    // Modifier.weight(1f) distribution
    expect(source).toContain('flex: 1 1 0;')
    expect(source).toContain('min-width: 0;')

    // 1) MR.strings.set_as_cover + MaterialSymbols.Rounded.Photo
    expect(source).toContain("key: 'cover', label: 'Set as cover', icon: 'photo'")
    // 2) MR.strings.action_copy_to_clipboard + MaterialSymbols.Rounded.ContentCopy
    expect(source).toContain("key: 'copy', label: 'Copy to clipboard', icon: 'content_copy'")
    // 3) MR.strings.action_share + MaterialSymbols.Rounded.Share
    expect(source).toContain("key: 'share', label: 'Share', icon: 'share'")
    // 4) MR.strings.action_save + MaterialSymbols.Rounded.Save
    expect(source).toContain("key: 'save', label: 'Save', icon: 'save'")
  })

  it('implements ActionButton Column layout, typography, and ripple', () => {
    // Column with spacedBy(MaterialTheme.padding.extraSmall) = 4dp gap
    expect(source).toContain('flex-direction: column;')
    expect(source).toContain('gap: 4px;')

    // Icon size: 24dp
    expect(source).toContain('font-size: 24px;')
    expect(source).toContain('width: 24px;')
    expect(source).toContain('height: 24px;')

    // labelMedium typography: 12sp / 16sp w500, letter-spacing 0.5px
    expect(source).toContain('font-size: 12px;')
    expect(source).toContain('line-height: 16px;')
    expect(source).toContain('font-weight: 500;')
    expect(source).toContain('letter-spacing: 0.5px;')

    // Single-line text with ellipsis (maxLines = 1, TextOverflow.Ellipsis)
    expect(source).toContain('white-space: nowrap;')
    expect(source).toContain('text-overflow: ellipsis;')

    // MD3 ripple on click
    expect(source).toContain('v-ripple')
    expect(source).toContain('border-radius: 20px;')
  })

  it('supports composable props and emits matching ReaderPageActionsDialog.kt', () => {
    expect(source).toContain('onSetAsCover?: () => void')
    expect(source).toContain('onShare?: (toClipboard: boolean) => void')
    expect(source).toContain('onSave?: () => void')
    expect(source).toContain("(e: 'set-as-cover'): void")
    expect(source).toContain("(e: 'share', toClipboard: boolean): void")
    expect(source).toContain("(e: 'save'): void")
  })

  it('integrates SetCoverDialog and preserves sheet dismissal behaviour', () => {
    // SetCoverDialog is invoked from cover action
    expect(source).toContain('<SetCoverDialog')
    expect(source).toContain('@confirm="handleSetAsCoverConfirm"')
    // Copy, Share, Save trigger onDismissRequest() / dismissNow()
    expect(source).toContain('dismissNow()')
  })
})
