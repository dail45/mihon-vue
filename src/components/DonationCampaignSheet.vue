<script setup lang="ts">
/**
 * Donation campaign sheet — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/main/MainActivity.kt:428-546 (ShowDonationCampaign)
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AdaptiveSheet.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/AdaptiveSheet.kt
 *
 * Reference structure (MainActivity.kt:439-535):
 *   AdaptiveSheet(onDismissRequest = dismissSupportMessage, enableImplicitDismiss = false) {
 *     Column {
 *       Spacer(height = 16.dp)
 *       Column(verticalScroll, padding(16.dp), spacedBy(8.dp)) {
 *         Text(donationCampaign_title, color = primary, style = headlineSmall)
 *         Text(donationCampaign_paragraph1, style = bodyMedium)
 *         Text(donationCampaign_paragraph2, style = bodyMedium)
 *         Text(donationCampaign_paragraph3, style = bodyMedium)
 *       }
 *       HorizontalDivider()
 *       Button(padding(top = 8.dp, horizontal = 16.dp), fillMaxWidth) {
 *         Row(spacedBy(8.dp)) { Icon(VolunteerActivism); Text(label_support_us, color = onPrimary) }
 *       }
 *       Row(spacedBy(8.dp), padding(bottom = 8.dp, horizontal = 16.dp)) {
 *         OutlinedButton(weight 1f) { Row(spacedBy(8.dp)) { Text(donationCampaign_contactPlatform); Icon(OpenInNew) } }
 *         OutlinedButton(weight 1f) { Text(donationCampaign_dismiss) }
 *       }
 *     }
 *   }
 *
 * The sheet itself: a `Dialog` (`usePlatformDefaultWidth = false`) whose content is bottom aligned
 * on a phone and centred on a tablet, with a maximum width of 460dp, the `extraLarge` shape and
 * the `surfaceContainerHigh` colour.
 *
 * Strings: `donationCampaign.title/paragraph1..3/contactPlatform/dismiss` and `label_support_us`
 * (mihon/i18n/src/commonMain/moko-resources/base/strings.xml).
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'dismiss'): void }>()

const router = useRouter()


/** MR.strings.donationCampaign.title */
const title = 'Enjoying the app?'
/** MR.strings.donationCampaign.paragraph1 */
const paragraph1 = 'Hi! I’m the main developer behind Mihon, and I’d like to ask you to consider supporting its development financially. With enough support, I’ll be able to work on Mihon full-time and focus on long-standing issues as well as highly requested features.'
/** MR.strings.donationCampaign.paragraph2 */
const paragraph2 = 'You can donate through either Patreon (preferred) or OpenCollective. If you have questions or would like to support using alternative methods, feel free to reach out to me through Mihon\'s Discord server.'
/** MR.strings.donationCampaign.paragraph3 */
const paragraph3 = 'Regardless, Mihon will continue to be maintained by me and the volunteers, and it will stay open source.'
/** MR.strings.donationCampaign.contactPlatform */
const contactPlatform = 'Discord'
/** MR.strings.donationCampaign.dismiss */
const dismissText = 'Dismiss'
/** MR.strings.label_support_us */
const supportUs = 'Support Us'
/** Constants.kt: URL_DISCORD */
const DISCORD_URL = 'https://discord.gg/mihon'

const opened = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

function close() {
  opened.value = false
  emit('dismiss')
}

function openSupport() {
  // navigator.push(SupportUsScreen()) + dismissSupportMessage()
  close()
  void router.push('/support')
}

function openDiscord() {
  window.open(DISCORD_URL, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <!--
    AdaptiveSheet: a Dialog without the platform default width; the content is bottom aligned on a
    phone and centred on a tablet. `enableImplicitDismiss = false` -> the scrim does not close it.
  -->
  <v-dialog v-model="opened" max-width="460" persistent :scrim="true">
    <v-card class="donation-sheet" color="surface-container-high" rounded="xl">
      <!-- Spacer(height = 16.dp) -->
      <div class="donation-sheet__spacer" />

      <!-- Column(verticalScroll, padding(16.dp), spacedBy(8.dp)) -->
      <div class="donation-sheet__body">
        <!-- Text(headlineSmall, color = primary) -->
        <h2 class="donation-sheet__title">{{ title }}</h2>
        <!-- Text(bodyMedium) -->
        <p class="donation-sheet__paragraph">{{ paragraph1 }}</p>
        <p class="donation-sheet__paragraph">{{ paragraph2 }}</p>
        <p class="donation-sheet__paragraph">{{ paragraph3 }}</p>
      </div>

      <!-- HorizontalDivider() -->
      <v-divider class="donation-sheet__divider" />

      <!-- Button(fillMaxWidth, padding(top = 8.dp, horizontal = 16.dp)) -->
      <v-btn class="donation-sheet__support" color="primary" variant="flat" block @click="openSupport">
        <span class="material-symbols-rounded donation-sheet__support-icon" aria-hidden="true">volunteer_activism</span>
        <span>{{ supportUs }}</span>
      </v-btn>

      <!-- Row(spacedBy(8.dp), padding(bottom = 8.dp, horizontal = 16.dp)) -->
      <div class="donation-sheet__actions">
        <v-btn class="donation-sheet__action" variant="outlined" color="primary" @click="openDiscord">
          <span>{{ contactPlatform }}</span>
          <span class="material-symbols-rounded donation-sheet__action-icon" aria-hidden="true">open_in_new</span>
        </v-btn>
        <v-btn class="donation-sheet__action" variant="outlined" color="primary" @click="close">
          <span>{{ dismissText }}</span>
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
  /*
   * AdaptiveSheetImpl: the content is bottom aligned on a phone (BottmCenter) and centred on a
   * tablet, with a maximum width of 460dp and the `extraLarge` shape (28dp radius).
   */
  .donation-sheet {
    width: min(460px, 100vw);
    border-radius: 28px !important;
    overflow: hidden;
  }

  /* Spacer(height = 16.dp) */
  .donation-sheet__spacer {
    height: 16px;
  }

  /* Column(verticalScroll, padding(16.dp), spacedBy(8.dp)) */
  .donation-sheet__body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 60dvh;
    overflow-y: auto;
    padding: 16px;
  }

  /* headlineSmall: 24sp / 32sp, weight 400, in `primary`. */
  .donation-sheet__title {
    margin: 0;
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    color: rgb(var(--v-theme-primary));
  }

  /* bodyMedium: 14sp / 20sp, weight 400, letterSpacing 0.25sp, onSurface. */
  .donation-sheet__paragraph {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    letter-spacing: 0.25px;
    color: rgb(var(--v-theme-on-surface));
  }

  /* HorizontalDivider() */
  .donation-sheet__divider {
    opacity: 1;
    border-color: rgb(var(--v-theme-outline-variant));
  }

  /* Button(fillMaxWidth, padding(top = 8.dp, horizontal = 16.dp)): 40dp tall, 20dp radius. */
  .donation-sheet__support.v-btn {
    margin: 8px 16px 0;
    width: calc(100% - 32px);
    height: 40px;
    border-radius: 20px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1px;
    text-transform: none;
  }

  /* Icon(VolunteerActivism) in a Row with an 8dp gap. */
  .donation-sheet__support-icon {
    font-size: 24px;
    width: 24px;
    height: 24px;
    line-height: 24px;
    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }

  /* Row(spacedBy(8.dp), padding(bottom = 8.dp, horizontal = 16.dp)) */
  .donation-sheet__actions {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
  }

  /* OutlinedButton(fillMaxWidth, weight 1f): 40dp tall, 20dp radius, 1dp outline. */
  .donation-sheet__action.v-btn {
    flex: 1 1 0;
    min-width: 0;
    height: 40px;
    border-radius: 20px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1px;
    text-transform: none;
  }

  /* Icon(AutoMirroredRounded.OpenInNew) after the label, 8dp gap. */
  .donation-sheet__action-icon {
    font-size: 24px;
    width: 24px;
    height: 24px;
    line-height: 24px;
  }
}
</style>
