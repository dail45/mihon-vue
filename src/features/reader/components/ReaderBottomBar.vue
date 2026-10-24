<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import {
  READER_MODE_ICONS,
  READER_ORIENTATION_ICONS,
  READER_CROP_ICONS,
  READER_SETTINGS_ICON,
} from '@/features/reader/assets/readerIcons'

/**
 * Mihon reference: eu/kanade/presentation/reader/appbars/ReaderBottomBar.kt
 *
 *   Row(
 *       modifier = modifier
 *           .pointerInput(Unit) {},
 *       horizontalArrangement = Arrangement.SpaceEvenly,
 *       verticalAlignment = Alignment.CenterVertically,
 *   ) {
 *       IconButton(onClick = onClickReadingMode) {
 *           Icon(
 *               imageVector = readingMode.icon,
 *               contentDescription = stringResource(MR.strings.viewer),
 *           )
 *       }
 *
 *       IconButton(onClick = onClickOrientation) {
 *           Icon(
 *               imageVector = orientation.icon,
 *               contentDescription = stringResource(MR.strings.rotation_type),
 *           )
 *       }
 *
 *       IconButton(onClick = onClickCropBorder) {
 *           Icon(
 *               imageVector = if (cropEnabled) MaterialSymbols.Rounded.Crop else CustomMaterialSymbols.Rounded.CropOff,
 *               contentDescription = stringResource(MR.strings.pref_crop_borders),
 *           )
 *       }
 *
 *       IconButton(onClick = onClickSettings) {
 *           Icon(
 *               imageVector = MaterialSymbols.Rounded.Settings,
 *               contentDescription = stringResource(MR.strings.action_settings),
 *           )
 *       }
 *   }
 *
 * In ReaderAppBars.kt:
 *   ReaderBottomBar(
 *       modifier = Modifier
 *           .fillMaxWidth()
 *           .background(backgroundColor)
 *           .padding(horizontal = MaterialTheme.padding.small)
 *           .windowInsetsPadding(WindowInsets.navigationBars),
 *       readingMode = readingMode,
 *       onClickReadingMode = onClickReadingMode,
 *       orientation = orientation,
 *       onClickOrientation = onClickOrientation,
 *       cropEnabled = cropEnabled,
 *       onClickCropBorder = onClickCropBorder,
 *       onClickSettings = onClickSettings,
 *   )
 *
 * Background:
 *   MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp)
 *     .copy(alpha = if (isSystemInDarkTheme()) 0.9f else 0.95f)
 *
 * Material 3 IconButton specification:
 *   - Minimum interactive touch target: 48x48dp
 *   - Visual state layer (ripple circle): 40x40dp centered
 *   - Icon size: 24x24dp
 *   - Color: onSurface
 *   - State layers: hover 0.08, focus-visible 0.12, pressed/active 0.12
 */

export type ReaderBottomBarMode =
  | 'default'
  | 'ltr'
  | 'rtl'
  | 'vertical'
  | 'webtoon'
  | 'continuous'
  | 'continuous_vertical'
  | 'left_to_right'
  | 'right_to_left'

export type ReaderBottomBarOrientation =
  | 'default'
  | 'free'
  | 'portrait'
  | 'landscape'
  | 'locked_portrait'
  | 'lockedPortrait'
  | 'locked_landscape'
  | 'lockedLandscape'
  | 'reverse_portrait'
  | 'reversePortrait'

const props = withDefaults(
  defineProps<{
    /** Current reading mode; drives the first icon (readingMode.icon). */
    readingMode?: ReaderBottomBarMode
    /** Current screen orientation; drives the second icon (orientation.icon). */
    orientation?: ReaderBottomBarOrientation
    /** Whether border cropping is enabled; drives the third icon (Crop / CropOff). */
    cropEnabled?: boolean
  }>(),
  {
    readingMode: 'ltr',
    orientation: 'default',
    cropEnabled: false,
  },
)

const emit = defineEmits<{
  (event: 'reading-mode'): void
  (event: 'orientation'): void
  (event: 'crop'): void
  (event: 'settings'): void
}>()

const theme = useTheme()

/** Kotlin: `readingMode.icon` — ReadingMode.kt enum entry icon. */
const modeIconPath = computed(() => {
  switch (props.readingMode) {
    case 'default':
      return READER_MODE_ICONS.default
    case 'rtl':
    case 'right_to_left':
      return READER_MODE_ICONS.rtl
    case 'vertical':
      return READER_MODE_ICONS.vertical
    case 'webtoon':
      return READER_MODE_ICONS.webtoon
    case 'continuous':
    case 'continuous_vertical':
      return READER_MODE_ICONS.continuous
    case 'ltr':
    case 'left_to_right':
    default:
      return READER_MODE_ICONS.ltr
  }
})

/** Kotlin: `orientation.icon` — ReaderOrientation.kt enum entry icon. */
const orientationIconPath = computed(() => {
  switch (props.orientation) {
    case 'portrait':
    case 'reverse_portrait':
    case 'reversePortrait':
      return READER_ORIENTATION_ICONS.portrait
    case 'landscape':
      return READER_ORIENTATION_ICONS.landscape
    case 'locked_portrait':
    case 'lockedPortrait':
      return READER_ORIENTATION_ICONS.lockedPortrait
    case 'locked_landscape':
    case 'lockedLandscape':
      return READER_ORIENTATION_ICONS.lockedLandscape
    case 'free':
    case 'default':
    default:
      return READER_ORIENTATION_ICONS.default
  }
})

/** Kotlin: `if (cropEnabled) MaterialSymbols.Rounded.Crop else CustomMaterialSymbols.Rounded.CropOff`. */
const cropIconPath = computed(() =>
  props.cropEnabled ? READER_CROP_ICONS.crop : READER_CROP_ICONS.cropOff,
)

/** Kotlin: `MaterialSymbols.Rounded.Settings`. */
const settingsIconPath = READER_SETTINGS_ICON

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '').trim()
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const int = Number.parseInt(full.slice(0, 6), 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/**
 * Kotlin:
 *   MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp)
 *     .copy(alpha = if (isSystemInDarkTheme()) 0.9f else 0.95f)
 * `surfaceColorAtElevation` composites the surface tint over the surface with
 * `alpha = ((4.5 * ln(elevation + 1)) + 2) / 100` = 8.238 % for 3.dp.
 */
const palette = computed(() => {
  const colors = theme.current.value.colors as Record<string, string>
  const surface = hexToRgb(colors.surface ?? '#1B1B1F')
  const tint = hexToRgb(colors['surface-tint'] ?? colors.primary ?? '#B0C6FF')
  const alpha = ((4.5 * Math.log(4)) + 2) / 100
  const mixed = surface.map((channel, index) => Math.round(tint[index] * alpha + channel * (1 - alpha)))
  const dark = theme.current.value.dark
  return {
    background: `rgba(${mixed.join(', ')}, ${dark ? 0.9 : 0.95})`,
    content: colors['on-surface'] ?? colors['on-background'] ?? '#E3E2E6',
  }
})
</script>

<template>
  <!--
    Row(
      modifier = modifier.pointerInput(Unit) {},
      horizontalArrangement = Arrangement.SpaceEvenly,
      verticalAlignment = Alignment.CenterVertically,
    )
  -->
  <div
    class="reader-bottom-bar"
    role="toolbar"
    aria-label="Reader options"
    :style="{ '--rbb-background': palette.background, '--rbb-content': palette.content }"
    @pointerdown.stop
    @mousedown.stop
    @touchstart.stop
    @click.stop
  >
    <!-- IconButton(onClick = onClickReadingMode): Icon(readingMode.icon, contentDescription = stringResource(MR.strings.viewer)) -->
    <button
      type="button"
      class="reader-bottom-bar__button"
      aria-label="Reading mode"
      title="Reading mode"
      @click="emit('reading-mode')"
    >
      <svg class="reader-bottom-bar__icon" viewBox="0 -960 960 960" width="24" height="24" aria-hidden="true">
        <path :d="modeIconPath" fill="currentColor" />
      </svg>
    </button>

    <!-- IconButton(onClick = onClickOrientation): Icon(orientation.icon, contentDescription = stringResource(MR.strings.rotation_type)) -->
    <button
      type="button"
      class="reader-bottom-bar__button"
      aria-label="Rotation"
      title="Rotation"
      @click="emit('orientation')"
    >
      <svg class="reader-bottom-bar__icon" viewBox="0 -960 960 960" width="24" height="24" aria-hidden="true">
        <path :d="orientationIconPath" fill="currentColor" />
      </svg>
    </button>

    <!-- IconButton(onClick = onClickCropBorder): Icon(if (cropEnabled) Crop else CropOff, contentDescription = stringResource(MR.strings.pref_crop_borders)) -->
    <button
      type="button"
      class="reader-bottom-bar__button"
      aria-label="Crop borders"
      title="Crop borders"
      @click="emit('crop')"
    >
      <svg class="reader-bottom-bar__icon" viewBox="0 -960 960 960" width="24" height="24" aria-hidden="true">
        <path :d="cropIconPath" fill="currentColor" />
      </svg>
    </button>

    <!-- IconButton(onClick = onClickSettings): Icon(MaterialSymbols.Rounded.Settings, contentDescription = stringResource(MR.strings.action_settings)) -->
    <button
      type="button"
      class="reader-bottom-bar__button"
      aria-label="Settings"
      title="Settings"
      @click="emit('settings')"
    >
      <svg class="reader-bottom-bar__icon" viewBox="0 -960 960 960" width="24" height="24" aria-hidden="true">
        <path :d="settingsIconPath" fill="currentColor" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
@layer app-components {
/*
 * ReaderAppBars.kt:
 *   ReaderBottomBar(Modifier.fillMaxWidth().background(backgroundColor)
 *       .padding(horizontal = MaterialTheme.padding.small).windowInsetsPadding(navigationBars))
 * MaterialTheme.padding.small = 8.dp.
 * Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically.
 */
.reader-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  width: 100%;
  box-sizing: border-box;
  padding-inline: 8px;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--rbb-background);
  color: var(--rbb-content);
  user-select: none;
}

/*
 * Compose Material 3 IconButton:
 * - Touch target: minimumInteractiveComponentSize() = 48.dp
 * - Visual container / state layer size: 40.dp x 40.dp centered (IconButtonTokens.StateLayerSize)
 * - Shape: CornerFull (circle)
 * - Icon size: 24.dp x 24.dp
 * - Color: onSurface
 * - State layers (StateTokens):
 *     hover: 0.08
 *     focus-visible: 0.12
 *     pressed (active): 0.12
 */
.reader-bottom-bar__button {
  position: relative;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  outline: none;
  overflow: visible;
  -webkit-tap-highlight-color: transparent;
}

.reader-bottom-bar__icon {
  position: relative;
  z-index: 1;
  display: block;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

/* Compose M3 40.dp circular state layer centered inside the 48.dp touch target */
.reader-bottom-bar__button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  transition: opacity 120ms ease;
  pointer-events: none;
}

.reader-bottom-bar__button:hover::after {
  opacity: 0.08;
}

.reader-bottom-bar__button:focus-visible::after {
  opacity: 0.12;
}

.reader-bottom-bar__button:active::after {
  opacity: 0.12;
}

.reader-bottom-bar__button:focus-visible {
  outline: 2px solid var(--rbb-content);
  outline-offset: 2px;
}
}
</style>
