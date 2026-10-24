import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/onboarding/views/OnboardingView.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/onboarding/views/OnboardingView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/onboarding/OnboardingScreen.kt and the
 * InfoScreen shell it builds on
 * (mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/InfoScreen.kt),
 * pinned revision 446f6df82c390ab760802c2fce3b677bce3f31c1.
 */
describe('OnboardingView parity with Mihon', () => {
  it('keeps the four reference steps in order', () => {
    // listOf(ThemeStep(), StorageStep(), PermissionStep(), GuidesStep(onRestoreBackup)).
    expect(source).toContain("const steps = ['theme', 'storage', 'permission', 'guides'] as const")
    expect(source).toContain("import ThemeStep from '@/features/onboarding/components/ThemeStep.vue'")
    expect(source).toContain("import StorageStep from '@/features/onboarding/components/StorageStep.vue'")
    expect(source).toContain("import PermissionStep from '@/features/onboarding/components/PermissionStep.vue'")
    expect(source).toContain("import GuidesStep from '@/features/onboarding/components/GuidesStep.vue'")
  })

  it('reproduces the InfoScreen heading block', () => {
    // Icon(48.dp, tint = primary, padding(bottom = padding.small = 8.dp)).
    expect(source).toMatch(/\.onboarding-icon \{[^}]*font-size: 48px;/s)
    expect(source).toMatch(/\.onboarding-icon \{[^}]*color: rgb\(var\(--v-theme-primary\)\);/s)
    expect(source).toMatch(/\.onboarding-icon \{[^}]*margin-bottom: 8px;/s)
    // Text(headlineLarge) = 32sp / 40sp, weight 400.
    expect(source).toMatch(/\.onboarding-heading \{[^}]*font-size: 32px;/s)
    expect(source).toMatch(/\.onboarding-heading \{[^}]*line-height: 40px;/s)
    // Text(titleSmall) at secondaryItemAlpha (0.78), vertical padding 8dp.
    expect(source).toMatch(/\.onboarding-subtitle \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.onboarding-subtitle \{[^}]*line-height: 20px;/s)
    expect(source).toMatch(/\.onboarding-subtitle \{[^}]*font-weight: 500;/s)
    expect(source).toMatch(/\.onboarding-subtitle \{[^}]*opacity: 0\.78;/s)
    expect(source).toMatch(/\.onboarding-subtitle \{[^}]*margin: 8px 0;/s)
  })

  it('reproduces the content box of the reference', () => {
    // Box(padding(vertical = 8dp), clip(shapes.small = 8dp), fillMaxSize, surfaceVariant).
    expect(source).toMatch(/\.onboarding-box \{[^}]*padding: 8px 0;/s)
    expect(source).toMatch(/\.onboarding-box__surface \{[^}]*border-radius: 8px;/s)
    expect(source).toMatch(/\.onboarding-box__surface \{[^}]*background: rgb\(var\(--v-theme-surface-variant\)\);/s)
    // The scroll column: top padding 48dp, horizontal padding 16dp.
    expect(source).toMatch(/\.onboarding-content \{[^}]*padding: 48px 16px 16px;/s)
  })

  it('reproduces the bottom bar of the reference', () => {
    // drawBehind hairline line in `outline` + padding(horizontal = 16dp, vertical = 8dp).
    expect(source).toContain('border-top: 1px solid rgb(var(--v-theme-outline))')
    expect(source).toMatch(/\.onboarding-bottom \{[^}]*padding: 8px 16px calc\(8px \+ env\(safe-area-inset-bottom\)\);/s)
    expect(source).toMatch(/\.onboarding-bottom \{[^}]*background: rgb\(var\(--v-theme-background\)\);/s)
    // tachiyomi filled Button: container primary, content onPrimary, 40dp height, 20dp radius.
    expect(source).toContain('background: rgb(var(--v-theme-primary))')
    expect(source).toContain('color: rgb(var(--v-theme-on-primary))')
    expect(source).toMatch(/\.onboarding-accept \{[^}]*height: 40px;/s)
    expect(source).toMatch(/\.onboarding-accept \{[^}]*border-radius: 20px;/s)
  })

  it('uses the reference button labels and completion gating', () => {
    // acceptText = isLastStep ? onboarding_action_finish : onboarding_action_next.
    expect(source).toContain("isLastStep.value ? 'Get started' : 'Next'")
    // canAccept = steps[currentStep].isComplete; only the storage step can be incomplete.
    expect(source).toContain('if (steps[currentStep.value] === \'storage\') return storageComplete.value')
    // The button is disabled while the step is incomplete.
    expect(source).toContain(':disabled="!canAccept"')
  })

  it('renders the reference strings', () => {
    expect(source).toContain('Welcome!')
    expect(source).toContain(
      'Let&rsquo;s set some things up first. You can always change these in the settings later too.',
    )
  })

  it('reproduces the step transition and the back handling of the reference', () => {
    // AnimatedContent(targetState = currentStep, materialSharedAxisX(forward = target > initial)).
    expect(source).toContain('<Transition :name="stepTransitionName" mode="out-in">')
    expect(source).toMatch(/\.onboarding-step-forward-enter-from \{[^}]*translateX\(30px\);/s)
    expect(source).toMatch(/\.onboarding-step-forward-leave-to \{[^}]*translateX\(-30px\);/s)
    expect(source).toMatch(/\.onboarding-step-backward-enter-from \{[^}]*translateX\(-30px\);/s)
    expect(source).toMatch(/\.onboarding-step-backward-leave-to \{[^}]*translateX\(30px\);/s)
    // BackHandler(enabled = currentStep != 0) { currentStep-- }.
    expect(source).toContain("window.addEventListener('popstate', onPopState)")
    expect(source).toContain('currentStep.value -= 1')
  })
})
