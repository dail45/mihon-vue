<script setup lang="ts">
/**
 * Pixel-parity port of `GuidesStep` in
 * mihon/app/src/main/java/eu/kanade/presentation/more/onboarding/GuidesStep.kt:21-57
 *
 *   internal class GuidesStep(private val onRestoreBackup: () -> Unit) : OnboardingStep {
 *       override val isComplete: Boolean = true
 *
 *       @Composable
 *       override fun Content() {
 *           val handler = LocalUriHandler.current
 *           Column(
 *               modifier = Modifier.padding(16.dp),
 *               verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small),
 *           ) {
 *               Text(stringResource(MR.strings.onboarding_guides_new_user, stringResource(MR.strings.app_name)))
 *               Button(modifier = Modifier.fillMaxWidth(), onClick = { handler.openUri(GETTING_STARTED_URL) }) {
 *                   Text(stringResource(MR.strings.getting_started_guide))
 *               }
 *               HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp),
 *                   color = MaterialTheme.colorScheme.onPrimaryContainer)
 *               Text(stringResource(MR.strings.onboarding_guides_returning_user, stringResource(MR.strings.app_name)))
 *               Button(modifier = Modifier.fillMaxWidth(), onClick = onRestoreBackup) {
 *                   Text(stringResource(MR.strings.pref_restore_backup))
 *               }
 *           }
 *       }
 *   }
 *
 *   const val GETTING_STARTED_URL = "https://mihon.app/docs/guides/getting-started"
 *
 * Metrics taken from the reference and from the pinned Mihon sources:
 * - Column padding 16dp (GuidesStep.kt:32), vertical arrangement spacedBy
 *   `MaterialTheme.padding.small` = 8dp (Constants.kt:20).
 * - Default Compose `Text` style = MaterialTheme.typography.bodyLarge (16sp/24sp, weight 400,
 *   letterSpacing 0.03125em) in `onSurface`.
 * - `Button` = tachiyomi `Button` (presentation-core/.../material/Button.kt:87-131): filled Surface,
 *   container `primary`, content `onPrimary`, label `labelLarge` (14sp/20sp, weight 500,
 *   letterSpacing 0.0071428571em), minWidth 58dp, minHeight 40dp (M3ButtonDefaults.MinHeight),
 *   contentPadding = M3ButtonDefaults.ContentPadding (24dp horizontal / 8dp vertical),
 *   shape = M3ButtonDefaults.textShape = CornerFull (20dp radius), default elevation 0dp and
 *   hovered elevation 1dp.
 * - `HorizontalDivider` (GuidesStep.kt:43-46): 1dp thickness, vertical padding 8dp on top of the
 *   8dp column gap, color `onPrimaryContainer`.
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 * - onboarding_guides_new_user      = "New to %s? We recommend checking out the getting started guide."  (L204)
 * - onboarding_guides_returning_user = "Reinstalling %s?"  (L205)
 * - getting_started_guide           = "Getting started guide"  (L1025)
 * - pref_restore_backup             = "Restore backup"  (L611)
 * - app_name                        = "Mihon"  (L3)
 *
 * The guide button opens an external URL (fully supported in a browser).
 * "Restore backup" in the reference finishes onboarding and navigates to
 * Settings > Data and storage > Restore backup, which reads a local Mihon `.backup` file
 * (mihon/app/.../tachiyomi/ui/more/OnboardingScreen.kt:42-46). The web client keeps no local
 * database and the Suwayomi REST API exposes no backup restore endpoint, so the action opens an
 * explicit "not supported in the web version" dialog instead of silently doing nothing.
 */
import { computed, ref } from 'vue'

const emit = defineEmits<{
  (e: 'restoreBackup'): void
}>()

const props = withDefaults(
  defineProps<{
    /** App name used in the info texts (%s). */
    appName?: string
    /** Callback when user clicks 'Restore backup' (GuidesStep.kt:22, onRestoreBackup: () -> Unit). */
    onRestoreBackup?: () => void
  }>(),
  { appName: 'Mihon', onRestoreBackup: undefined },
)

/** `isComplete` of the reference step (GuidesStep.kt:25) is always true, so the step never
 *  blocks the onboarding flow and no completion model is needed here. */

/** Getting started guide URL, `GETTING_STARTED_URL` (GuidesStep.kt:59). */
const GETTING_STARTED_URL = 'https://mihon.app/docs/guides/getting-started'

const stubOpen = ref(false)

const newUserText = computed(
  () => `New to ${props.appName}? We recommend checking out the getting started guide.`,
)
const returningUserText = computed(() => `Reinstalling ${props.appName}?`)

function openGuide() {
  window.open(GETTING_STARTED_URL, '_blank', 'noopener,noreferrer')
}

function handleRestoreBackup() {
  if (props.onRestoreBackup) {
    props.onRestoreBackup()
    emit('restoreBackup')
  } else {
    stubOpen.value = true
  }
}

function confirmStub() {
  stubOpen.value = false
  emit('restoreBackup')
}
</script>

<template>
  <div class="guides-step">
    <!-- Text(bodyLarge, onSurface): onboarding_guides_new_user -->
    <p class="guides-step-text">{{ newUserText }}</p>

    <!-- Button(fillMaxWidth): getting_started_guide, opens GETTING_STARTED_URL -->
    <button type="button" class="guides-step-button" @click="openGuide">
      Getting started guide
    </button>

    <!-- HorizontalDivider: 1dp line, onPrimaryContainer, 8dp vertical padding (8dp column gap
         + 8dp divider padding on each side). -->
    <hr class="guides-step-divider" />

    <!-- Text(bodyLarge, onSurface): onboarding_guides_returning_user -->
    <p class="guides-step-text">{{ returningUserText }}</p>

    <!-- Button(fillMaxWidth): pref_restore_backup, triggers onRestoreBackup or opens the stub dialog. -->
    <button type="button" class="guides-step-button" @click="handleRestoreBackup">
      Restore backup
    </button>
  </div>

  <!-- Stub for the Android-only backup restore flow (Mihon reads a local .backup file). -->
  <v-dialog v-model="stubOpen" max-width="560">
    <div class="guides-step-dialog">
      <h2 class="guides-step-dialog-title">Restore backup</h2>
      <div class="guides-step-dialog-text">
        <p class="guides-step-text">
          Restoring a backup is not supported in the web version: Mihon restores the library from a
          local <code>.backup</code> file, while this client keeps no local database and the
          Suwayomi REST API exposes no backup restore endpoint.
        </p>
      </div>
      <div class="guides-step-dialog-actions">
        <button type="button" class="guides-step-dialog-button" @click="confirmStub">OK</button>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
  /* Column(padding = 16dp) + Arrangement.spacedBy(MaterialTheme.padding.small = 8dp). */
  .guides-step {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
  }

  /* Compose `Text` default style: MaterialTheme.typography.bodyLarge (16sp/24sp, weight 400,
     letterSpacing 0.03125em) in the local content color `onSurface`. */
  .guides-step-text {
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    letter-spacing: 0.03125em;
    color: rgb(var(--v-theme-on-surface));
  }

  /* tachiyomi `Button`: filled Surface, container `primary`, content `onPrimary`,
     label labelLarge (14sp/20sp, weight 500, letterSpacing 0.0071428571em),
     minWidth 58dp / minHeight 40dp, contentPadding 24dp horizontal,
     shape = M3ButtonDefaults.textShape = CornerFull (20dp),
     default elevation 0dp, hovered elevation 1dp. */
  .guides-step-button {
    box-sizing: border-box;
    display: flex;
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
    letter-spacing: 0.0071428571em;
    cursor: pointer;
    transition: box-shadow 0.15s ease-in-out;
  }
  @media (hover: hover) {
    .guides-step-button:hover { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
  }
  .guides-step-button:active { box-shadow: none; }
  .guides-step-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

  /* HorizontalDivider: 1dp thickness, color onPrimaryContainer, 8dp vertical padding. */
  .guides-step-divider {
    margin: 8px 0;
    border: 0;
    border-top: 1px solid rgb(var(--v-theme-on-primary-container));
  }

  /* MD3 AlertDialog: surface-container-high, CornerExtraLarge (28dp), container padding 24dp,
     title headlineSmall (24sp/32sp) in on-surface, text bodyMedium (14sp/20sp) in on-surface-variant,
     actions right aligned, button labelLarge (14sp/20sp, weight 500) in primary, shape CornerFull. */
  .guides-step-dialog {
    box-sizing: border-box;
    width: fit-content;
    min-width: min(280px, calc(100vw - 48px));
    max-width: min(560px, calc(100vw - 48px));
    margin: 0 auto;
    padding: 24px;
    border-radius: 28px;
    background: rgb(var(--v-theme-surface-container-high));
    color: rgb(var(--v-theme-on-surface));
    box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  }
  .guides-step-dialog-title {
    margin: 0 0 16px;
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    color: rgb(var(--v-theme-on-surface));
  }
  .guides-step-dialog-text { margin-bottom: 24px; }
  .guides-step-dialog-text .guides-step-text {
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0.0071428571em;
    color: rgb(var(--v-theme-on-surface-variant));
  }
  .guides-step-dialog-actions { display: flex; justify-content: flex-end; }
  .guides-step-dialog-button {
    height: 40px;
    min-width: 58px;
    padding: 0 12px;
    border: 0;
    border-radius: 20px;
    background: transparent;
    color: rgb(var(--v-theme-primary));
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.0071428571em;
    cursor: pointer;
  }
  .guides-step-dialog-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
  .guides-step-dialog-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
}
</style>
