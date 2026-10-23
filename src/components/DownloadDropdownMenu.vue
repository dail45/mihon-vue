<script lang="ts">
/**
 * Port of `eu.kanade.presentation.components.DownloadDropdownMenu.kt`
 * (Mihon, pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * The Kotlin composable only renders a `DropdownMenu` with six `DropdownMenuItem`s and
 * reports the picked `DownloadAction`; the chapter selection itself lives in the view model
 * (`MangaViewModel.runDownloadAction` / `LibraryViewModel.performDownloadAction`).
 * The web port keeps that split: this component emits the action and the host view maps it
 * onto the Suwayomi download queue.
 *
 * The unqualified `DropdownMenu` call inside the reference file resolves to the same-package
 * wrapper `eu.kanade.presentation.components.DropdownMenu`, which
 *   - pins the width with `sizeIn(minWidth = 196.dp, maxWidth = 196.dp)`,
 *   - offsets the menu with `DpOffset(8.dp, (-56).dp)` by default, and
 *   - opens a focusable popup (`PopupProperties(focusable = true)`).
 * `offset = null` therefore means "the default offset", and an explicit offset (the
 * `MangaBottomActionMenu` call site uses `DpOffset(0.dp, 0.dp)`) replaces it.
 */

/** `eu.kanade.presentation.manga.DownloadAction` (MangaScreenConstants.kt). */
export type DownloadAction =
  | 'NEXT_1_CHAPTER'
  | 'NEXT_5_CHAPTERS'
  | 'NEXT_10_CHAPTERS'
  | 'NEXT_25_CHAPTERS'
  | 'UNREAD_CHAPTERS'
  | 'BOOKMARKED_CHAPTERS'
  | 'TOTAL_CHAPTERS'

export interface DownloadDropdownOption {
  action: DownloadAction
  label: string
}

/**
 * `MR.plurals.download_amount`:
 * `one` -> "Next chapter", `other` -> "Next %d chapters".
 */
export function downloadAmountLabel(amount: number): string {
  return amount === 1 ? 'Next chapter' : `Next ${amount} chapters`
}

/**
 * The option order of `DownloadDropdownMenuItems`: the four "next N chapters" entries,
 * then "Unread" (`download_unread`) and "Bookmarked" (`download_bookmarked`).
 */
export const downloadDropdownOptions: DownloadDropdownOption[] = [
  { action: 'NEXT_1_CHAPTER', label: downloadAmountLabel(1) },
  { action: 'NEXT_5_CHAPTERS', label: downloadAmountLabel(5) },
  { action: 'NEXT_10_CHAPTERS', label: downloadAmountLabel(10) },
  { action: 'NEXT_25_CHAPTERS', label: downloadAmountLabel(25) },
  { action: 'UNREAD_CHAPTERS', label: 'Unread' },
  { action: 'BOOKMARKED_CHAPTERS', label: 'Bookmarked' },
]

/** Optional fallback for legacy/extended "All" download action (`TOTAL_CHAPTERS`). */
export const downloadAllOption: DownloadDropdownOption = {
  action: 'TOTAL_CHAPTERS',
  label: 'All',
}

/**
 * The default offset of the wrapper menu: `DpOffset(8.dp, (-56).dp)`
 * (`presentation/components/DropdownMenu.kt`).
 */
export const defaultDownloadMenuOffset = { x: 8, y: -56 }
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  /** `expanded` of the Kotlin composable. */
  expanded?: boolean
  /**
   * `DpOffset` of the Kotlin composable, in dp. `null` keeps the default offset of the
   * wrapper menu (`DpOffset(8.dp, (-56).dp)`), an explicit value replaces it — the
   * `MangaBottomActionMenu` call site passes `DpOffset(0.dp, 0.dp)`.
   */
  offset?: { x: number, y: number } | null
  /**
   * Optional custom options list. Defaults to the 6 reference items from `DownloadDropdownMenu.kt`.
   */
  options?: DownloadDropdownOption[]
  /**
   * The Suwayomi download queue is reachable over GraphQL (`enqueueChapterDownloads`), but
   * the chapter selection of the reference view model (`runDownloadAction`) is not part of
   * this component. When `downloadUnsupported` is true, picking an action explains the
   * limitation instead of silently doing nothing. Defaults to false so `@download` listeners
   * receive events immediately.
   */
  downloadUnsupported?: boolean
}>(), {
  expanded: false,
  offset: null,
  options: undefined,
  downloadUnsupported: false,
})

const emit = defineEmits<{
  (event: 'update:expanded', value: boolean): void
  (event: 'download', action: DownloadAction): void
  (event: 'downloadClicked', action: DownloadAction): void
  (event: 'dismissRequest'): void
}>()

const open = computed({
  get: () => props.expanded,
  set: (value: boolean) => {
    emit('update:expanded', value)
    if (!value) emit('dismissRequest')
  },
})

const currentOptions = computed(() => props.options ?? downloadDropdownOptions)

/**
 * Vuetify applies `offset[0]` on the placement axis (vertical for `bottom start`, positive
 * downwards) and `offset[1]` on the alignment axis (horizontal, positive to the left), while
 * Compose's `DpOffset` is (x, y) with x positive to the right and y positive downwards.
 */
const menuOffset = computed<[number, number]>(() => {
  const offset = props.offset ?? defaultDownloadMenuOffset
  return [offset.y, -offset.x]
})

/**
 * `DropdownMenuItem(onClick = { onDownloadClicked(downloadAction); onDismissRequest() })`.
 */
function select(action: DownloadAction) {
  emit('download', action)
  emit('downloadClicked', action)
  if (props.downloadUnsupported) {
    stubAction.value = action
    stubOpen.value = true
  }
  emit('update:expanded', false)
  emit('dismissRequest')
}

/* ------------------------------------------------------------------ *
 * Stub for the not yet implemented download action
 * ------------------------------------------------------------------ */
const stubOpen = ref(false)
const stubAction = ref<DownloadAction | null>(null)

const stubTitle = computed(() => (stubAction.value
  ? (currentOptions.value.find(option => option.action === stubAction.value)?.label ?? 'Download')
  : 'Download'))

const stubText = computed(() => 'Downloading chapters is not supported in the web version yet: the Suwayomi-Server exposes its download queue over GraphQL only, and the chapter selection of the reference (`runDownloadAction` — next N chapters, unread, bookmarked) is not implemented in the web client.')
</script>

<template>
  <v-menu
    v-model="open"
    location="bottom start"
    :offset="menuOffset"
    :min-width="196"
    :max-width="196"
    :width="196"
    content-class="download-dropdown-menu"
    transition="download-dropdown-transition"
    :open-delay="0"
    :close-delay="0"
  >
    <template #activator="{ props: activatorProps }">
      <slot name="activator" :props="activatorProps">
        <v-btn
          v-bind="activatorProps"
          class="download-dropdown-activator"
          icon="download"
          variant="text"
          aria-label="Download"
        />
      </slot>
    </template>
    <v-list class="download-dropdown-list" density="default">
      <v-list-item
        v-for="option in currentOptions"
        :key="option.action"
        :title="option.label"
        class="download-dropdown-item"
        link
        @click="select(option.action)"
      />
    </v-list>
  </v-menu>

  <!--
    Stub for the not yet implemented download action: the menu itself is complete, only the
    chapter selection of the reference view model is missing.
  -->
  <v-dialog v-model="stubOpen" max-width="440">
    <v-card class="download-dropdown-stub" color="surface-container-high" rounded="28px">
      <h2 class="download-dropdown-stub__title">{{ stubTitle }}</h2>
      <p class="download-dropdown-stub__text">{{ stubText }}</p>
      <div class="download-dropdown-stub__actions">
        <button type="button" class="download-dropdown-stub__button" @click="stubOpen = false">OK</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/*
 * The menu is teleported to the body, so the rules below are global on purpose and are
 * scoped by the `download-dropdown-menu` class instead of a Vue scoped attribute.
 *
 * Reference values:
 *   - `presentation/components/DropdownMenu.kt`: `sizeIn(minWidth = 196.dp, maxWidth = 196.dp)`
 *   - MD3 `MenuTokens.ContainerShape` = corner extra small (4dp), `ContainerElevation` = level 2
 *   - MD3 `MenuTokens.ContainerColor` = surface container
 *   - MD3 `DropdownMenuVerticalPadding` = 8dp (Vuetify's `.v-list` already uses `padding: 8px 0`)
 *   - MD3 `DropdownMenuItemContentPadding` = horizontal 12dp, vertical 0dp, `MenuListItemContainerHeight` = 48dp
 *   - MD3 `MaterialTheme.typography.bodyLarge` = 16sp / 24sp, weight 400, letter spacing 0.5px
 *   - MD3 State layers: hover 8% on-surface, active/pressed 12% on-surface
 */
.v-overlay__content.download-dropdown-menu {
  width: 196px;
  min-width: 196px;
  max-width: 196px;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-container));
  box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.v-overlay__content.download-dropdown-menu > .v-list.download-dropdown-list {
  width: 196px;
  min-width: 196px;
  max-width: 196px;
  padding: 8px 0;
  background: rgb(var(--v-theme-surface-container));
  color: rgb(var(--v-theme-on-surface));
  border-radius: 4px;
  box-shadow: none;
  /* MD3 hover state layer: 8% on-surface. */
  --v-hover-opacity: 0.08;
}

/*
 * MD3 `DropdownMenuItem`: content padding horizontal 12dp, vertical 0dp, container height
 * 48dp; the item itself has no shape (the menu surface owns the 4dp shape).
 */
.v-overlay__content.download-dropdown-menu .v-list-item.download-dropdown-item {
  min-height: 48px;
  height: 48px;
  padding: 0 12px;
  border-radius: 0;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 150ms cubic-bezier(0.2, 0, 0, 1);
}

.v-overlay__content.download-dropdown-menu .v-list-item.download-dropdown-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.v-overlay__content.download-dropdown-menu .v-list-item.download-dropdown-item:active {
  background-color: rgba(var(--v-theme-on-surface), 0.12);
}

.v-overlay__content.download-dropdown-menu .v-list-item.download-dropdown-item:focus-visible {
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  outline: none;
}

.v-overlay__content.download-dropdown-menu .v-list-item .v-list-item-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  color: rgb(var(--v-theme-on-surface));
}

/* The activator mirrors MD3's icon button: 48x48 with a 24dp icon. */
.download-dropdown-activator {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 9999px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/*
 * Menu open/close animation: MD3 scales the surface from 0.8 while fading it in
 * (fast spatial for the scale, fast effects for the alpha). The transform origin is the
 * top left corner of the menu, like the `calculateTransformOrigin` of the reference.
 */
.download-dropdown-transition-enter-active {
  transition: opacity 150ms cubic-bezier(0.2, 0, 0, 1), transform 300ms cubic-bezier(0.2, 0, 0, 1);
  transform-origin: top left;
}
.download-dropdown-transition-leave-active {
  transition: opacity 100ms linear, transform 100ms linear;
  transform-origin: top left;
}
.download-dropdown-transition-enter-from,
.download-dropdown-transition-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/*
 * Stub dialog: MD3 `AlertDialogContent` — surfaceContainerHigh, CornerExtraLarge (28dp),
 * 24dp content padding, headlineSmall title, bodyMedium text and a text button at the end.
 */
.download-dropdown-stub {
  box-sizing: border-box;
  padding: 24px;
  color: rgb(var(--v-theme-on-surface));
}

.download-dropdown-stub__title {
  margin: 0 0 16px;
  /* MaterialTheme.typography.headlineSmall: 24sp / 32sp, weight 400. */
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}

.download-dropdown-stub__text {
  margin: 0;
  /* MaterialTheme.typography.bodyMedium: 14sp / 20sp, weight 400. */
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.download-dropdown-stub__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

.download-dropdown-stub__button {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  /* MaterialTheme.typography.labelLarge: 14sp / 20sp, weight 500. */
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
}
</style>
