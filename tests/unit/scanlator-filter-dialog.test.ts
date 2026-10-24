import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const vueSource = readFileSync('src/features/manga/components/ScanlatorFilterDialog.vue', 'utf8')

describe('ScanlatorFilterDialog (CHECKLIST #78) - Parity with Mihon Compose', () => {
  describe('Reference Structure & Tokens', () => {
    it('sets dialog title to "Exclude scanlators" matching MR.strings.exclude_scanlators', () => {
      expect(vueSource).toContain('Exclude scanlators')
      expect(vueSource).toContain('MR.strings.exclude_scanlators')
    })

    it('sets empty text to "No scanlators found" matching MR.strings.no_scanlators_found', () => {
      expect(vueSource).toContain('No scanlators found')
      expect(vueSource).toContain('MR.strings.no_scanlators_found')
    })

    it('uses Material 3 AlertDialog metrics: 28dp radius, 24dp padding, surface-container-high', () => {
      expect(vueSource).toContain('rounded="28px"')
      expect(vueSource).toContain('color="surface-container-high"')
      expect(vueSource).toContain('border-radius: 28px !important')
      expect(vueSource).toContain('padding: 24px')
      expect(vueSource).toContain('min-width: min(280px, calc(100% - 48px))')
      expect(vueSource).toContain('max-width: min(560px, calc(100% - 48px))')
    })

    it('uses headlineSmall (24sp / 32sp w400) with 16dp bottom padding for title', () => {
      expect(vueSource).toContain('font-size: 24px')
      expect(vueSource).toContain('line-height: 32px')
      expect(vueSource).toContain('margin: 0 0 16px')
    })

    it('uses bodyMedium (14sp / 20sp w400) with 24dp bottom padding for text area', () => {
      expect(vueSource).toContain('padding-bottom: 24px')
      expect(vueSource).toContain('font-size: 14px')
      expect(vueSource).toContain('line-height: 20px')
    })
  })

  describe('Scanlator Rows & Icons', () => {
    it('uses 48dp minimum interactive height, 8dp padding and shapes.small 8dp radius', () => {
      expect(vueSource).toContain('min-height: 48px')
      expect(vueSource).toContain('padding: 0 8px')
      expect(vueSource).toContain('border-radius: 8px')
    })

    it('renders disabled_by_default (filled, primary) when excluded and check_box_outline_blank when unexcluded', () => {
      expect(vueSource).toContain("isExcluded(scanlator) ? 'disabled_by_default' : 'check_box_outline_blank'")
      expect(vueSource).toContain(":class=\"{ 'filled-symbol': isExcluded(scanlator) }\"")
      expect(vueSource).toContain('.scanlator-dialog-icon.filled-symbol { color: rgb(var(--v-theme-primary)); }')
    })

    it('spaces the scanlator label by 24dp from the icon slot', () => {
      expect(vueSource).toContain('padding-inline-start: 24px')
    })

    it('includes ARIA accessibility attributes: role="checkbox" and :aria-checked', () => {
      expect(vueSource).toContain('role="checkbox"')
      expect(vueSource).toContain(':aria-checked="isExcluded(scanlator)"')
      expect(vueSource).toContain(":content-props=\"{ 'aria-labelledby': titleId, 'aria-describedby': textId }\"")
    })
  })

  describe('Dividers & Scrolling', () => {
    it('draws HorizontalDivider at top when canScrollBackward and at bottom when canScrollForward', () => {
      expect(vueSource).toContain('v-if="canScrollBackward" class="scanlator-dialog-divider is-top"')
      expect(vueSource).toContain('v-if="canScrollForward" class="scanlator-dialog-divider is-bottom"')
      expect(vueSource).toContain('rgb(var(--v-theme-outline-variant))')
      expect(vueSource).toContain('height: 1px')
    })

    it('observes list size changes and scroll position with sub-pixel safety threshold', () => {
      expect(vueSource).toContain('canScrollBackward.value = element.scrollTop > 1')
      expect(vueSource).toContain('canScrollForward.value = element.scrollHeight - element.scrollTop - element.clientHeight > 1')
      expect(vueSource).toContain('new ResizeObserver')
    })
  })

  describe('Action Buttons', () => {
    it('displays Select all when no scanlators are excluded and Reset once any are excluded', () => {
      expect(vueSource).toContain('v-if="!excluded.length"')
      expect(vueSource).toContain('Select all')
      expect(vueSource).toContain('Reset')
    })

    it('hides Select all / Reset and OK when available scanlators is empty, showing only Cancel', () => {
      expect(vueSource).toContain('v-if="sortedAvailable.length"')
      expect(vueSource).toContain('Cancel')
    })

    it('formats TextButton to MD3 specifications (height 40dp, min-width 58dp, 20dp pill, 8dp pressed)', () => {
      expect(vueSource).toContain('min-width: 58px')
      expect(vueSource).toContain('height: 40px')
      expect(vueSource).toContain('padding: 0 12px')
      expect(vueSource).toContain('border-radius: 20px')
      expect(vueSource).toContain('.scanlator-dialog-button:active {\n  border-radius: 8px;')
    })

    it('pushes Cancel and OK to trailing edge via spacer with flex 1', () => {
      expect(vueSource).toContain('.scanlator-dialog-spacer { flex: 1 1 0; min-width: 0; }')
    })
  })

  describe('Data Ordering & State Flow', () => {
    it('sorts available scanlators case-insensitively using String.CASE_INSENSITIVE_ORDER logic', () => {
      expect(vueSource).toContain('a.value.toLowerCase()')
      expect(vueSource).toContain('b.value.toLowerCase()')
      expect(vueSource).toContain('a.index - b.index')
    })

    it('emits confirm event with excluded scanlators set before closing dialog', () => {
      expect(vueSource).toContain("emit('confirm', [...excluded.value])")
      expect(vueSource).toContain('open.value = false')
    })
  })
})
