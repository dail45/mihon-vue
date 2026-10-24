<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's onboarding screen.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/onboarding/OnboardingScreen.kt:27-90
 *   internal steps = listOf(ThemeStep(), StorageStep(), PermissionStep(), GuidesStep(onRestoreBackup))
 *   BackHandler(enabled = currentStep != 0) { currentStep-- }
 *   InfoScreen(
 *       icon = MaterialSymbols.Rounded.RocketLaunch,
 *       headingText = stringResource(MR.strings.onboarding_heading),
 *       subtitleText = stringResource(MR.strings.onboarding_description),
 *       acceptText = if (isLastStep) MR.strings.onboarding_action_finish else MR.strings.onboarding_action_next,
 *       canAccept = steps[currentStep].isComplete,
 *       onAcceptClick = { if (isLastStep) onComplete() else currentStep++ },
 *   ) {
 *       Box(Modifier.padding(vertical = MaterialTheme.padding.small)
 *                  .clip(MaterialTheme.shapes.small)
 *                  .fillMaxSize()
 *                  .background(MaterialTheme.colorScheme.surfaceVariant)) {
 *           AnimatedContent(targetState = currentStep,
 *               transitionSpec = { materialSharedAxisX(forward = targetState > initialState, slideDistance = slideDistance) }) {
 *               steps[it].Content()
 *           }
 *       }
 *   }
 *
 * The InfoScreen shell is reproduced here (presentation-core/.../screens/InfoScreen.kt:38-134):
 *   - scrollable Column, horizontal padding 16dp (MaterialTheme.padding.medium),
 *     top padding 48dp, bottom bar height handled by the page.
 *   - icon 48dp, tint `primary`, bottom padding 8dp (MaterialTheme.padding.small).
 *   - heading = headlineLarge (32sp/40sp) in `onSurface`.
 *   - subtitle = titleSmall (14sp/20sp, weight 500) at SECONDARY_ALPHA (0.78),
 *     vertical padding 8dp.
 *   - content = Box with vertical padding 8dp, clipped to MaterialTheme.shapes.small (8dp radius),
 *     filled with `surfaceVariant`.
 *   - bottom bar: `background` colour, 1dp hairline top border in `outline`,
 *     horizontal padding 16dp, vertical padding 8dp, one full width filled Button
 *     (height 40dp, radius 20dp, container `primary`, content `onPrimary`).
 *
 * Steps reused from the ported step components:
 *   - Theme step: src/components/onboarding/ThemeStep.vue (Mihon's `AppThemeModePreferenceWidget`
 *     segmented row + `AppThemePreferenceWidget` palette list).
 *   - Storage step: src/components/onboarding/StorageStep.vue
 *   - Permission step: src/components/onboarding/PermissionStep.vue
 *   - Guides step: src/components/onboarding/GuidesStep.vue
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import StorageStep from '@/features/onboarding/components/StorageStep.vue'
import PermissionStep from '@/features/onboarding/components/PermissionStep.vue'
import GuidesStep from '@/features/onboarding/components/GuidesStep.vue'
import ThemeStep from '@/features/onboarding/components/ThemeStep.vue'

const router = useRouter()
const preferences = usePreferencesStore()

const emit = defineEmits<{
  (e: 'complete'): void
  (e: 'restoreBackup'): void
}>()

const props = withDefaults(
  defineProps<{
    /** Heading text override. Default is 'Welcome!' (MR.strings.onboarding_heading). */
    headingText?: string
    /** Subtitle text override. Default is 'Let's set some things up first...' (MR.strings.onboarding_description). */
    subtitleText?: string
    /** Called when the last step is accepted ("Get started"). */
    onComplete?: () => void
    /** Called when 'Restore backup' is clicked in GuidesStep (GuidesStep.kt:22). */
    onRestoreBackup?: () => void
  }>(),
  {
    headingText: undefined,
    subtitleText: undefined,
    onComplete: undefined,
    onRestoreBackup: undefined,
  },
)

const currentStep = ref(0)
const steps = ['theme', 'storage', 'permission', 'guides'] as const
const stepTitles = ['Theme', 'Storage', 'Permissions', 'Guides']
const isLastStep = computed(() => currentStep.value === steps.length - 1)

/** Selected app theme (`AppTheme` enum name), owned by the theme step. */
const appTheme = ref('DEFAULT')

/**
 * `canAccept` of the reference is `steps[currentStep].isComplete`; only the storage step can be
 * incomplete (StorageStep.kt:32-35, `storagePref.isSet()`). The web version keeps the same gate:
 * the browser folder picker (File System Access API, `webkitdirectory` fallback) sets the
 * location, and the step reports it through `v-model:complete`.
 */
const storageComplete = ref(
  typeof localStorage !== 'undefined' &&
  !!localStorage.getItem('mihon-vue:onboarding:storage-location'),
)
const canAccept = computed(() => {
  if (steps[currentStep.value] === 'storage') return storageComplete.value
  return true
})

const acceptText = computed(() => (isLastStep.value ? 'Get started' : 'Next'))

/** materialSharedAxisX(forward = targetState > initialState). */
const stepDirection = ref<'forward' | 'backward'>('forward')
const stepTransitionName = computed(() => `onboarding-step-${stepDirection.value}`)

let isFinishing = false

function finishOnboarding() {
  isFinishing = true
  pushedStates = 0
  preferences.setOnboardingShown()
  if (props.onComplete) {
    props.onComplete()
  } else {
    void router.replace('/library')
  }
  emit('complete')
}

function handleRestoreBackup() {
  isFinishing = true
  pushedStates = 0
  preferences.setOnboardingShown()
  if (props.onRestoreBackup) {
    props.onRestoreBackup()
  } else {
    if (props.onComplete) props.onComplete()
    void router.replace('/settings/data')
  }
  emit('restoreBackup')
}

function accept() {
  if (!canAccept.value) return
  if (isLastStep.value) {
    finishOnboarding()
  } else {
    stepDirection.value = 'forward'
    currentStep.value++
  }
}

/** BackHandler(enabled = currentStep != 0) { currentStep-- } -> browser back button & key. */
function goBack() {
  if (currentStep.value > 0) {
    stepDirection.value = 'backward'
    currentStep.value -= 1
  }
}

let pushedStates = 0
function onPopState() {
  if (currentStep.value > 0) {
    stepDirection.value = 'backward'
    currentStep.value -= 1
    pushedStates = Math.max(0, pushedStates - 1)
    window.history.pushState({ onboarding: true }, '')
    pushedStates += 1
  }
}
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' || (event.altKey && event.key === 'ArrowLeft')) {
    if (currentStep.value > 0) {
      event.preventDefault()
      stepDirection.value = 'backward'
      currentStep.value -= 1
    }
  }
}
watch(currentStep, (value, previous) => {
  if (value > previous) {
    window.history.pushState({ onboarding: true }, '')
    pushedStates += 1
  }
})
onMounted(() => {
  window.addEventListener('popstate', onPopState)
  window.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState)
  window.removeEventListener('keydown', onKeyDown)
  // Drop the guard states pushed for the steps the user walked through.
  if (!isFinishing) {
    for (let i = 0; i < pushedStates; i += 1) window.history.back()
  }
})
</script>

<template>
  <div class="onboarding">
    <!-- InfoScreen content column -->
    <div class="onboarding-scroll">
      <div class="onboarding-content">
        <!-- icon: 48dp, tint primary, bottom padding 8dp -->
        <span class="material-symbols-rounded onboarding-icon" aria-hidden="true">rocket_launch</span>

        <!-- Step indicator stepper -->
        <div class="onboarding-stepper" role="tablist" aria-label="Onboarding steps">
          <div
            v-for="(stepName, index) in steps"
            :key="stepName"
            class="onboarding-step-indicator"
            :class="{
              'is-active': index === currentStep,
              'is-complete': index < currentStep,
            }"
            :aria-label="`Step ${index + 1} of ${steps.length}: ${stepTitles[index]}`"
            :aria-current="index === currentStep ? 'step' : undefined"
          />
        </div>

        <!-- heading: headlineLarge -->
        <h1 class="onboarding-heading">{{ props.headingText || 'Welcome!' }}</h1>

        <!-- subtitle: titleSmall at 0.78 alpha, vertical padding 8dp -->
        <p class="onboarding-subtitle">
          <template v-if="props.subtitleText">{{ props.subtitleText }}</template>
          <template v-else>
            Let&rsquo;s set some things up first. You can always change these in the settings later too.
          </template>
        </p>

        <!-- content box: vertical padding 8dp, shapes.small (8dp), surfaceVariant -->
        <div class="onboarding-box">
          <div class="onboarding-box__surface">
            <Transition :name="stepTransitionName" mode="out-in">
              <!-- Theme step -->
              <ThemeStep
                v-if="steps[currentStep] === 'theme'"
                key="theme"
                v-model:app-theme="appTheme"
              />

              <!-- Storage step -->
              <StorageStep
                v-else-if="steps[currentStep] === 'storage'"
                key="storage"
                v-model:complete="storageComplete"
              />

              <!-- Permission step -->
              <PermissionStep
                v-else-if="steps[currentStep] === 'permission'"
                key="permission"
              />

              <!-- Guides step -->
              <GuidesStep
                v-else
                key="guides"
                :on-restore-backup="handleRestoreBackup"
                @restore-backup="handleRestoreBackup"
              />
            </Transition>
          </div>
        </div>
      </div>
    </div>

    <!-- bottom bar: background colour, 1dp hairline top border in `outline` -->
    <div class="onboarding-bottom">
      <div class="onboarding-actions">
        <button
          v-if="currentStep > 0"
          type="button"
          class="onboarding-back"
          aria-label="Previous step"
          @click="goBack"
        >
          Back
        </button>
        <button type="button" class="onboarding-accept" :disabled="!canAccept" @click="accept">
        {{ acceptText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
  .onboarding {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    background: rgb(var(--v-theme-background));
  }

  .onboarding-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
  }
  .onboarding-back {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 84px;
    height: 40px;
    padding: 8px 20px;
    border: 1px solid rgb(var(--v-theme-outline));
    border-radius: 20px;
    background: transparent;
    color: rgb(var(--v-theme-primary));
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1px;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;
  }
  @media (hover: hover) {
    .onboarding-back:hover {
      background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
    }
  }
  .onboarding-back:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }

  /* InfoScreen: scrollable Column with horizontal padding 16dp and top padding 48dp. */
  .onboarding-scroll {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .onboarding-content {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    min-width: 0;
    padding: 48px 16px 16px;
  }

  /* Icon: 48dp, tint primary, bottom padding 8dp. */
  .onboarding-icon {
    display: block;
    font-size: 48px;
    line-height: 48px;
    width: 48px;
    height: 48px;
    color: rgb(var(--v-theme-primary));
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
    margin-bottom: 8px;
  }

  /* MD3 Step Indicator Stepper */
  .onboarding-stepper {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .onboarding-step-indicator {
    height: 4px;
    width: 20px;
    border-radius: 2px;
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 20%, transparent);
    transition: width 0.3s cubic-bezier(0.2, 0, 0, 1), background-color 0.3s ease;
  }
  .onboarding-step-indicator.is-complete {
    width: 20px;
    background: color-mix(in srgb, rgb(var(--v-theme-primary)) 60%, transparent);
  }
  .onboarding-step-indicator.is-active {
    width: 36px;
    background: rgb(var(--v-theme-primary));
  }

  /* headlineLarge: 32sp / 40sp, weight 400. */
  .onboarding-heading {
    margin: 0;
    font-size: 32px;
    line-height: 40px;
    font-weight: 400;
    letter-spacing: 0;
    color: rgb(var(--v-theme-on-surface));
  }

  /* titleSmall: 14sp / 20sp, weight 500, secondaryItemAlpha (0.78), vertical padding 8dp. */
  .onboarding-subtitle {
    margin: 8px 0;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1px;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.78;
  }

  /* content Box: vertical padding 8dp, shapes.small (8dp radius), surfaceVariant.
     The reference modifier order is padding -> clip -> fillMaxSize -> background, so the 8dp
     vertical padding sits *outside* the clipped, filled surfaceVariant area. */
  .onboarding-box {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 8px 0;
  }
  .onboarding-box__surface {
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    border-radius: 8px;
    background: rgb(var(--v-theme-surface-variant));
    overflow: hidden;
  }

  /* materialSharedAxisX: forward = targetState > initialState. Forward slides the new content in
     from the right and the old one out to the left; backward mirrors it. */
  .onboarding-step-forward-enter-active,
  .onboarding-step-forward-leave-active,
  .onboarding-step-backward-enter-active,
  .onboarding-step-backward-leave-active {
    transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s linear;
  }
  .onboarding-step-forward-enter-from {
    transform: translateX(30px);
    opacity: 0;
  }
  .onboarding-step-forward-leave-to {
    transform: translateX(-30px);
    opacity: 0;
  }
  .onboarding-step-backward-enter-from {
    transform: translateX(-30px);
    opacity: 0;
  }
  .onboarding-step-backward-leave-to {
    transform: translateX(30px);
    opacity: 0;
  }

  /* bottom bar: background colour, 1dp hairline (outline) on top, padding 16dp / 8dp.
     The reference also applies windowInsetsPadding(NavigationBarDefaults.windowInsets). */
  .onboarding-bottom {
    box-sizing: border-box;
    border-top: 1px solid rgb(var(--v-theme-outline));
    padding: 8px 16px calc(8px + env(safe-area-inset-bottom));
    background: rgb(var(--v-theme-background));
  }

  /* MD3 filled Button: 40dp height, 20dp radius, container primary, content onPrimary,
     labelLarge 14sp/20sp weight 500. */
  .onboarding-accept {
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 58px;
    height: 40px;
    padding: 8px 24px;
    border: 0;
    border-radius: 20px;
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1px;
    cursor: pointer;
    transition: box-shadow 0.15s ease-in-out;
  }
  @media (hover: hover) {
    .onboarding-accept:hover:not(:disabled) { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
  }
  .onboarding-accept:active:not(:disabled) { box-shadow: none; }
  .onboarding-accept:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
  .onboarding-accept:disabled {
    cursor: default;
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
    color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 38%, transparent);
  }

}
</style>
