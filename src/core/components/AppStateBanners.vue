<script setup lang="ts">
/**
 * App state banners — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/components/Banners.kt
 *
 * Reference (Banners.kt:62-187):
 *   - `AppStateBanners(downloadedOnlyMode, incognitoMode, indexing)` stacks banners with
 *     `AnimatedVisibility(expandVertically / shrinkVertically)`:
 *       1. `IndexingDownloadBanner`  — `secondary` background, `onSecondary` text
 *          "Checking downloads" (`download_notifier_cache_renewal`), a `CircularProgressIndicator`
 *          sized like the text with `strokeWidth = textHeight / 8` and an 8dp gap.
 *       2. `UpdatingBanner` (Komikku / Banners.kt:109-125) — `tertiary` background, `onTertiary` text
 *          "Updating library (X%)" (`notification_updating_progress`) or "Updating library" (`updating_library`).
 *       3. `DownloadedOnlyModeBanner` — `tertiary` background, `onTertiary` text
 *          "Downloaded only" (`label_downloaded_only`), 4dp padding, centered.
 *       4. `IncognitoModeBanner` — `primary` background, `onPrimary` text
 *          "Incognito mode" (`pref_incognito_mode`), 4dp padding, centered.
 *   - The order is fixed by the `SubcomposeLayout` of the reference: indexing/updating, downloaded only,
 *     incognito.
 *
 * `labelMedium` = 12sp / 16sp, weight 500, letterSpacing 0.5sp.
 *
 * The banners are the `topBar` slot of the reference `Scaffold` (MainActivity.kt:260-267), so they
 * sit above the screen content and above the screen's own app bar. The web shell therefore renders
 * them pinned to the top of the window and offsets the app bar / content by their height.
 */
import { computed } from 'vue'
import { stringResource, MR } from '@/core/i18n'
import { useLibraryUpdateErrorsStore } from '@/features/updates/stores/libraryUpdateErrors'

const props = defineProps<{
  /** `downloadedOnlyMode`: the "Downloaded only" preference of the More tab. */
  downloadedOnly?: boolean
  /** `incognitoMode`: the "Incognito mode" preference of the More tab. */
  incognito?: boolean
  /** `indexing`: the download cache is being renewed ("Checking downloads"). */
  indexing?: boolean
  /** `updating`: an active library update is in progress. */
  updating?: boolean
  /** `progress`: library update progress (0..100). */
  progress?: number | null
}>()

const updateStore = useLibraryUpdateErrorsStore()

const isUpdating = computed(() => props.updating ?? updateStore.updating)
const currentProgress = computed(() => (props.progress !== undefined ? props.progress : updateStore.progress))

const updatingLabel = computed(() => {
  if (currentProgress.value !== null && currentProgress.value !== undefined) {
    const pct = `${Math.round(currentProgress.value)}%`
    return stringResource(MR.strings.notification_updating_progress, pct) || `Updating library (${pct})`
  }
  return stringResource(MR.strings.updating_library) || 'Updating library'
})
</script>

<template>
  <div class="app-state-banners" role="status" aria-live="polite">
    <!-- IndexingDownloadBanner: Row(background = secondary, padding 8dp) with the spinner. -->
    <div v-if="indexing" class="banner banner--indexing">
      <span class="banner__spinner" aria-hidden="true" />
      <span class="banner__text">Checking downloads</span>
    </div>

    <!-- UpdatingDownloadBanner: Row(background = tertiary, padding 8dp) with the spinner. -->
    <div v-if="isUpdating" class="banner banner--updating">
      <span class="banner__spinner" aria-hidden="true" />
      <span class="banner__text">{{ updatingLabel }}</span>
    </div>

    <!-- DownloadedOnlyModeBanner: Text(background = tertiary, padding 4dp, labelMedium). -->
    <div v-if="downloadedOnly" class="banner banner--downloaded-only">Downloaded only</div>

    <!-- IncognitoModeBanner: Text(background = primary, padding 4dp, labelMedium). -->
    <div v-if="incognito" class="banner banner--incognito">Incognito mode</div>
  </div>
</template>

<style scoped>
@layer app-components {
  .app-state-banners {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 8;
    display: flex;
    flex-direction: column;
  }

  /* Text/Span with `MaterialTheme.typography.labelMedium` (12sp / 16sp, weight 500). */
  .banner {
    box-sizing: border-box;
    width: 100%;
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    letter-spacing: 0.5px;
    text-align: center;
  }

  /* DownloadedOnlyModeBanner: `background(tertiary)`, `padding(4.dp)`, `onTertiary`. */
  .banner--downloaded-only {
    padding: 4px;
    background: rgb(var(--v-theme-tertiary));
    color: rgb(var(--v-theme-on-tertiary));
  }

  /* IncognitoModeBanner: `background(primary)`, `padding(4.dp)`, `onPrimary`. */
  .banner--incognito {
    padding: 4px;
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
  }

  /* IndexingDownloadBanner: `Row(background = secondary, padding 8dp)` centred. */
  .banner--indexing {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px;
    background: rgb(var(--v-theme-secondary));
    color: rgb(var(--v-theme-on-secondary));
  }

  /* UpdatingDownloadBanner: `Row(background = tertiary, padding 8dp)` centred with circular spinner. */
  .banner--updating {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px;
    background: rgb(var(--v-theme-tertiary));
    color: rgb(var(--v-theme-on-tertiary));
  }

  /*
   * CircularProgressIndicator: `requiredSize(textHeight)` with `strokeWidth = textHeight / 8`.
   * The labelMedium line height is 16px, so the indicator is 16px wide with a 2px stroke.
   */
  .banner__spinner {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    box-sizing: border-box;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: banner-spin 1s linear infinite;
  }

  @keyframes banner-spin {
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .banner__spinner { animation: none; }
  }
}
</style>
