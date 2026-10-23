<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's StorageInfo.kt (Settings > Data and storage > Storage usage).
 *
 * Reference (pinned Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/data/StorageInfo.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsDataScreen.kt
 *
 * Reference structure:
 *   Column(verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small)) {   // 8dp
 *       storages.forEach { StorageInfo(it) }
 *   }
 *   // per storage:
 *   Column(verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.extraSmall)) { // 4dp
 *       Text(text = file.absolutePath, style = MaterialTheme.typography.header)
 *       LinearProgressIndicator(
 *           modifier = Modifier.clip(MaterialTheme.shapes.small).fillMaxWidth().height(12.dp),
 *           progress = { if (total > 0) 1 - (available / total.toFloat()) else 0f },
 *       )
 *       Text(text = stringResource(MR.strings.available_disk_space_info, availableText, totalText),
 *            modifier = Modifier.secondaryItemAlpha(), style = MaterialTheme.typography.bodySmall)
 *   }
 *
 * Values taken from the reference:
 *   - MaterialTheme.padding.small      = 8dp  (gap between two storage blocks)
 *   - MaterialTheme.padding.extraSmall = 4dp  (gap between the three children of a block)
 *   - MaterialTheme.shapes.small       = 8dp  (corner radius the progress bar is clipped to)
 *   - MaterialTheme.typography.header  = bodyMedium + FontWeight.SemiBold in onSurfaceVariant
 *                                        (14sp / 20sp, weight 600, letterSpacing 0.25sp)
 *   - MaterialTheme.typography.bodySmall = 12sp / 16sp, weight 400, letterSpacing 0.4sp
 *   - secondaryItemAlpha()             = alpha(SECONDARY_ALPHA), SECONDARY_ALPHA = .78f
 *   - PrefsHorizontalPadding           = 16dp (M3 horizontal padding)
 *   - Container padding                = 12px 16px (M3 preference subcomponent spacing)
 *   - MR.strings.available_disk_space_info = "Available: %1$s / Total: %2$s"
 *
 * MD3 LinearProgressIndicator (androidx compose material3 1.4.x, as pinned by Mihon's
 * androidx-compose-bom 2026.10.00): the indicator is a Canvas whose stroke width equals the height
 * of the canvas (here 12dp) and whose ends are round (ProgressIndicatorDefaults.LinearStrokeCap =
 * StrokeCap.Round). The track is colorScheme.secondaryContainer, the active bar is
 * colorScheme.primary, the two are separated by ProgressIndicatorDefaults
 * .LinearIndicatorTrackGapSize (4dp) plus the stroke width (because the cap is not Butt), and a
 * 4dp stop indicator dot is drawn in the active colour at the end of the track. The whole canvas
 * is clipped to MaterialTheme.shapes.small (8dp).
 *
 * Platform difference (honest stub):
 *   Mihon enumerates Android external storage roots (DiskUtil.getExternalStorages) and reads
 *   free/total space per root with DiskUtil. A browser exposes neither the device storage roots
 *   nor the free space of an arbitrary filesystem path. The only storage figures a web page can
 *   read are the origin quota/usage of the Storage API (navigator.storage.estimate). This
 *   component therefore keeps the reference layout, the exact "Available: X / Total: Y" wording
 *   and the exact progress indicator geometry, and fills it with the browser origin storage.
 *   When the Storage API is unavailable the block still renders with the reference geometry and
 *   states plainly that the figures cannot be read in the web version.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

export interface StorageEntry {
  /** Filesystem-like path shown as the block heading. */
  path: string
  /** Free space in bytes. */
  available: number
  /** Total space in bytes. */
  total: number
}

const props = defineProps<{ entries?: StorageEntry[] }>()

/** The canvas of the reference indicator: Modifier.height(12.dp). */
const INDICATOR_HEIGHT = 12
/** StrokeCap.Round on a 12dp tall line: the cap radius is half the stroke width. */
const CAP_RADIUS = INDICATOR_HEIGHT / 2
/**
 * ProgressIndicatorDefaults.LinearIndicatorTrackGapSize (4dp) plus the stroke width, because the
 * stroke cap is Round and not Butt (see ProgressIndicator.kt: adjustedGapSize).
 */
const TRACK_GAP = 4 + INDICATOR_HEIGHT
/** ProgressIndicatorDefaults.LinearTrackStopIndicatorSize (4dp). */
const STOP_SIZE = 4
/** StopIndicatorTrailingSpace (6dp) limited by (height - stopSize) / 2 = 4dp. */
const STOP_TRAILING = 4

/** The storages known so far; the reference fills this list asynchronously. */
const storages = ref<StorageEntry[]>([])
/** False when the platform exposes no way to read any storage figure at all. */
const supported = ref(true)
/** True when the figures come from the browser origin instead of a device volume. */
const originBased = ref(false)

/** Measured width of every indicator canvas in px, keyed by storage path. */
const widths = reactive<Record<string, number>>({})
const indicatorEls = new Map<string, HTMLElement>()
let observer: ResizeObserver | null = null

/**
 * Formats file sizes like Android Formatter.formatFileSize:
 * SI labels, decimal ladder kB / MB / GB / TB / PB (after bytes < 900),
 * one decimal below 10, otherwise integer value.
 */
function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 900) return `${Math.round(bytes)} B`
  const units = ['kB', 'MB', 'GB', 'TB', 'PB']
  let value = bytes / 1000
  let unitIndex = 0
  while (value > 900 && unitIndex < units.length - 1) {
    value /= 1000
    unitIndex++
  }
  const decimals = value < 10 ? 1 : 0
  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}

const items = computed(() => storages.value.map(storage => {
  const progress = storage.total > 0 ? 1 - storage.available / storage.total : 0
  return {
    storage,
    progress,
    percent: Math.round(progress * 100),
    ...geometry(progress, widths[storage.path] ?? 0),
  }
}))

/**
 * Geometry of the Compose canvas, mirrored 1:1 (all values in px):
 *   - drawLinearIndicator(0f, progress): the line runs from x = 0 to x = progress * width; the
 *     round caps are clamped to [strokeWidth / 2, width - strokeWidth / 2], so the visible bar
 *     spans [0, clampedEnd + strokeWidth / 2];
 *   - the track is drawn with drawLinearIndicator(trackStartFraction, 1f) where
 *     trackStartFraction = progress + min(progress, gapSizeFraction); its visible span is
 *     [clampedStart - strokeWidth / 2, width];
 *   - the stop indicator is a 4dp dot whose centre sits 4dp + 2dp from the right edge.
 */
function geometry(progress: number, width: number) {
  const cap = CAP_RADIUS

  // Active bar.
  let barWidth = 0
  if (width > 0 && progress > 0) {
    const end = Math.min(Math.max(progress * width, cap), width - cap)
    barWidth = Math.min(end + cap, width)
  }

  // Track.
  let trackLeft = 0
  let trackWidth = 0
  if (width > 0) {
    const start = progress + Math.min(progress, TRACK_GAP / width)
    if (start <= 1) {
      const clamped = Math.min(Math.max(start * width, cap), width - cap)
      trackLeft = Math.max(clamped - cap, 0)
      trackWidth = width - trackLeft
    }
  }

  return { barWidth, trackLeft, trackWidth }
}

function measure(path: string) {
  const el = indicatorEls.get(path)
  if (el) widths[path] = el.clientWidth || 0
}

function setIndicatorEl(path: string, el: Element | null) {
  if (!el) {
    indicatorEls.delete(path)
    return
  }
  indicatorEls.set(path, el as HTMLElement)
  measure(path)
  observer?.observe(el as HTMLElement)
}

watch(
  () => storages.value.map(s => s.path).join('|'),
  () => {
    if (typeof ResizeObserver === 'undefined') return
    if (!observer) {
      observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          const path = (entry.target as HTMLElement).dataset.storagePath
          if (path) widths[path] = (entry.target as HTMLElement).clientWidth || 0
        }
      })
    }
    for (const el of indicatorEls.values()) observer.observe(el)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  indicatorEls.clear()
})

watch(
  () => props.entries,
  entries => {
    if (entries?.length) storages.value = entries
  },
)

onMounted(async () => {
  if (props.entries?.length) {
    storages.value = props.entries
    return
  }

  const path = typeof location !== 'undefined' ? location.origin : '/'
  const estimate = (navigator as Navigator & {
    storage?: { estimate?: () => Promise<{ quota?: number, usage?: number }> }
  }).storage?.estimate

  if (!estimate) {
    // Nothing can be read in the web version: keep the reference geometry and say so.
    supported.value = false
    storages.value = [{ path, available: 0, total: 0 }]
    return
  }

  // The reference renders nothing until the storage list has been produced, so the block stays
  // empty while the figures are read.
  originBased.value = true

  try {
    const result = await estimate()
    const quota = Number(result.quota ?? 0)
    const usage = Number(result.usage ?? 0)
    storages.value = [{ path, available: Math.max(quota - usage, 0), total: quota }]
  } catch {
    supported.value = false
  }
})
</script>

<template>
  <div class="storage-info">
    <!-- The reference renders nothing until the storage list has been produced. -->
    <div v-for="item in items" :key="item.storage.path" class="storage-info__item">
      <!-- Text(text = file.absolutePath, style = MaterialTheme.typography.header) -->
      <p class="storage-info__path">{{ item.storage.path }}</p>

      <!-- LinearProgressIndicator(clip(shapes.small).fillMaxWidth().height(12.dp)) -->
      <div
        :ref="el => setIndicatorEl(item.storage.path, el as Element | null)"
        class="storage-info__progress"
        role="progressbar"
        :data-storage-path="item.storage.path"
        :aria-valuenow="item.percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span
          class="storage-info__track"
          :style="{ left: `${item.trackLeft}px`, width: `${item.trackWidth}px` }"
        />
        <span class="storage-info__bar" :style="{ width: `${item.barWidth}px` }" />
        <span
          class="storage-info__stop"
          :style="{
            width: `${STOP_SIZE}px`,
            height: `${STOP_SIZE}px`,
            right: `${STOP_TRAILING}px`,
          }"
        />
      </div>

      <!-- Text(stringResource(MR.strings.available_disk_space_info, availableText, totalText),
               modifier = Modifier.secondaryItemAlpha(), style = MaterialTheme.typography.bodySmall) -->
      <p class="storage-info__caption">
        Available: {{ formatFileSize(item.storage.available) }} / Total: {{ formatFileSize(item.storage.total) }}
      </p>
    </div>

    <!-- Platform notice: the reference reads the Android external storage volumes, which a browser
         cannot expose. The notice sits within the container with M3 bodySmall typography. -->
    <p v-if="!supported" class="storage-info__note">
      Device storage volumes are not exposed to the web version, so free and total space cannot be
      read here.
    </p>
    <p v-else-if="originBased" class="storage-info__note">
      The web version can only read the storage quota of this site origin, not the device volumes.
    </p>
  </div>
</template>

<style scoped>
/* Column(verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small)) = 8dp.
   M3 container padding: horizontal 16dp, vertical 12dp. */
.storage-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  box-sizing: border-box;
}

/* Column(verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.extraSmall)) = 4dp */
.storage-info__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* MaterialTheme.typography.header = bodyMedium + SemiBold in onSurfaceVariant.
   MD3 bodyMedium: 14sp / 20sp, letterSpacing 0.25sp. */
.storage-info__path {
  margin: 0;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow-wrap: anywhere;
}

/* LinearProgressIndicator canvas: 12dp tall, clipped to MaterialTheme.shapes.small (8dp). */
.storage-info__progress {
  position: relative;
  width: 100%;
  height: 12px;
  border-radius: 8px;
  overflow: hidden;
}

/* MD3 track: colorScheme.secondaryContainer, drawn as a round-capped line of the full
   stroke width (12dp), so the cap radius is 6dp. */
.storage-info__track {
  position: absolute;
  top: 0;
  left: 0;
  height: 12px;
  border-radius: 6px;
  background: rgb(var(--v-theme-secondary-container));
}

/* MD3 active indicator: colorScheme.primary, drawn as a round-capped line of the full
   stroke width (12dp). */
.storage-info__bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 12px;
  border-radius: 6px;
  background: rgb(var(--v-theme-primary));
}

/* The stop indicator: a 4dp dot in the active colour at the end of the track.
   Size and trailing offset come from the Compose tokens and are set inline. */
.storage-info__stop {
  position: absolute;
  top: 50%;
  border-radius: 50%;
  transform: translateY(-50%);
  background: rgb(var(--v-theme-primary));
}

/* MaterialTheme.typography.bodySmall = 12sp / 16sp, w400, letterSpacing 0.4sp,
   color = onSurfaceVariant with secondaryItemAlpha() = 0.78. */
.storage-info__caption {
  margin: 0;
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.78;
}

.storage-info__note {
  margin: 0;
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.78;
}
</style>
