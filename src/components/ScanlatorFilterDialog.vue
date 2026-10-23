<script setup lang="ts">
/**
 * Manga — "Exclude scanlators" dialog.
 *
 * Pixel-parity port of Mihon's `ScanlatorFilterDialog`
 * (mihon/app/src/main/java/eu/kanade/presentation/manga/components/ScanlatorFilterDialog.kt,
 * pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference structure (androidx.compose.material3.AlertDialog):
 *  - title          : "Exclude scanlators"   (MR.strings.exclude_scanlators)
 *  - text           : "No scanlators found"  (MR.strings.no_scanlators_found) when the
 *                      available set is empty, otherwise a LazyColumn of scanlator rows
 *  - row            : Icon(DisabledByDefault | CheckBoxOutlineBlank) + Text(scanlator, bodyMedium,
 *                      start padding 24dp); the whole row toggles the exclusion
 *  - row overlay    : HorizontalDivider on the top edge while the list scrolls backwards and on
 *                      the bottom edge while it scrolls forwards
 *  - confirm buttons: "Select all" (or "Reset" once something is excluded) on the leading side,
 *                      "Cancel" and "OK" on the trailing side; when the available set is empty
 *                      only "Cancel" is shown
 *
 * Material3 AlertDialog metrics used here (compose material3 AlertDialog.kt + DialogTokens.kt):
 *  - container shape = CornerExtraLarge (28dp), container color = surface-container-high,
 *    tonal elevation 0dp (no shadow).
 *  - container padding = 24dp on all sides, title bottom padding = 16dp, text bottom padding = 24dp.
 *  - title = headlineSmall (24sp / 32sp, weight 400) in on-surface.
 *  - supporting text = bodyMedium (14sp / 20sp, letterSpacing 0.0178571429em) in on-surface-variant;
 *    the icons inherit that content colour, the excluded one is tinted with primary.
 *  - action labels = labelLarge (14sp / 20sp, weight 500) in primary, the dialog button flow row
 *    has no extra spacing of its own (each TextButton contributes 12dp of content padding).
 *  - BasicAlertDialog applies sizeIn(minWidth = 280dp, maxWidth = 560dp).
 *  - TextButton (mihon/presentation-core/.../material/Button.kt): height 40dp, min width 58dp,
 *    content padding 12dp horizontal, shape = CornerFull (20dp), transparent container.
 *
 * The excluded set is a Mihon database setting (SetExcludedScanlators); Suwayomi-Server exposes
 * no equivalent field, so the web client keeps the set in browser storage (utils/scanlatorFilter.ts)
 * and applies it to the chapter list of the manga in the browser.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Scanlator names offered by the manga (Mihon's availableScanlators). */
    availableScanlators?: readonly string[]
    /** Scanlator names currently excluded (Mihon's excludedScanlators). */
    excludedScanlators?: readonly string[]
  }>(),
  { availableScanlators: () => [], excludedScanlators: () => [] },
)

const emit = defineEmits<{ (event: 'confirm', excluded: string[]): void }>()

const open = defineModel<boolean>({ required: true })

const titleId = useId()
const textId = useId()

/** `availableScanlators.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it })`. */
const sortedAvailable = computed(() =>
  props.availableScanlators
    .map((value, index) => ({ value, index }))
    .sort((a, b) => {
      const left = a.value.toLowerCase()
      const right = b.value.toLowerCase()
      if (left < right) return -1
      if (left > right) return 1
      return a.index - b.index
    })
    .map(entry => entry.value),
)

/** Working copy of the excluded set, re-created whenever the dialog is opened. */
const excluded = ref<string[]>([...props.excludedScanlators])

watch(open, value => {
  if (value) excluded.value = [...props.excludedScanlators]
})

/* `remember(excludedScanlators) { excludedScanlators.toMutableStateList() }` re-creates the
   working copy whenever the excluded set changes. */
watch(() => props.excludedScanlators, value => {
  excluded.value = [...value]
})

/** `mutableExcludedScanlators.contains(scanlator)` */
function isExcluded(scanlator: string): boolean {
  return excluded.value.includes(scanlator)
}

/** Row click toggles the exclusion of the scanlator. */
function toggle(scanlator: string) {
  excluded.value = isExcluded(scanlator)
    ? excluded.value.filter(name => name !== scanlator)
    : [...excluded.value, scanlator]
}

/** "Select all" excludes every available scanlator (`mutableExcludedScanlators.addAll(availableScanlators)`). */
function selectAll() {
  excluded.value = Array.from(new Set([...excluded.value, ...props.availableScanlators]))
}

/** "Reset" clears the excluded set (`mutableExcludedScanlators::clear`). */
function reset() {
  excluded.value = []
}

/** OK confirms the working copy and dismisses the dialog. */
function confirm() {
  emit('confirm', [...excluded.value])
  open.value = false
}

/* Scroll shadows: the reference draws a divider on the top edge while the list can scroll
   backwards and on the bottom edge while it can scroll forwards. */
const listEl = ref<HTMLElement | null>(null)
const canScrollBackward = ref(false)
const canScrollForward = ref(false)

function updateScrollState() {
  const element = listEl.value
  if (!element) {
    canScrollBackward.value = false
    canScrollForward.value = false
    return
  }
  canScrollBackward.value = element.scrollTop > 1
  canScrollForward.value = element.scrollHeight - element.scrollTop - element.clientHeight > 1
}

watch(open, async value => {
  if (!value) return
  canScrollBackward.value = false
  canScrollForward.value = false
  await nextTick()
  updateScrollState()
})

/* The list is measured after the dialog transition, so its scroll state is refreshed whenever
   it is resized (the reference recomputes it from the LazyListState on every layout). */
let resizeObserver: ResizeObserver | null = null

watch(listEl, element => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!element) return
  resizeObserver = new ResizeObserver(() => updateScrollState())
  resizeObserver.observe(element)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <v-dialog
    v-model="open"
    content-class="scanlator-dialog-overlay"
    :content-props="{ 'aria-labelledby': titleId, 'aria-describedby': textId }"
  >
    <v-card class="scanlator-dialog-card" rounded="28px" color="surface-container-high">
      <h2 :id="titleId" class="scanlator-dialog-title">Exclude scanlators</h2>

      <div :id="textId" class="scanlator-dialog-text">
        <p v-if="!sortedAvailable.length" class="scanlator-dialog-empty">No scanlators found</p>
        <div v-else class="scanlator-dialog-list-wrap">
          <div ref="listEl" class="scanlator-dialog-list" @scroll.passive="updateScrollState">
            <button
              v-for="scanlator in sortedAvailable"
              :key="scanlator"
              type="button"
              role="checkbox"
              :aria-checked="isExcluded(scanlator)"
              class="scanlator-dialog-row"
              @click="toggle(scanlator)"
            >
              <!-- MaterialSymbols.RoundedFilled.DisabledByDefault is the filled variant, so it
                   carries FILL 1; MaterialSymbols.Rounded.CheckBoxOutlineBlank is the outline
                   variant (FILL 0). -->
              <span
                class="material-symbols-rounded scanlator-dialog-icon"
                :class="{ 'filled-symbol': isExcluded(scanlator) }"
                aria-hidden="true"
              >{{ isExcluded(scanlator) ? 'disabled_by_default' : 'check_box_outline_blank' }}</span>
              <span class="scanlator-dialog-label">{{ scanlator }}</span>
            </button>
          </div>
          <div v-if="canScrollBackward" class="scanlator-dialog-divider is-top" aria-hidden="true" />
          <div v-if="canScrollForward" class="scanlator-dialog-divider is-bottom" aria-hidden="true" />
        </div>
      </div>

      <div class="scanlator-dialog-actions">
        <template v-if="sortedAvailable.length">
          <button v-if="!excluded.length" type="button" class="scanlator-dialog-button" @click="selectAll">
            Select all
          </button>
          <button v-else type="button" class="scanlator-dialog-button" @click="reset">Reset</button>
        </template>
        <span class="scanlator-dialog-spacer" />
        <button type="button" class="scanlator-dialog-button" @click="open = false">Cancel</button>
        <button v-if="sortedAvailable.length" type="button" class="scanlator-dialog-button" @click="confirm">
          OK
        </button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here. */
.v-dialog > .v-overlay__content.scanlator-dialog-overlay,
.v-dialog > .scanlator-dialog-overlay {
  width: fit-content !important;
  min-width: min(280px, calc(100% - 48px)) !important;
  max-width: min(560px, calc(100% - 48px)) !important;
}
/* Compose draws the alert dialog surface with tonalElevation = 0.dp and without a shadow
   elevation, so the dialog has no drop shadow. */
.v-dialog > .v-overlay__content.scanlator-dialog-overlay > .v-card,
.v-dialog > .scanlator-dialog-overlay > .v-card {
  box-shadow: none !important;
  /* Compose sizes the dialog surface to its content (the LazyColumn scrolls, not the surface). */
  flex: 0 1 auto !important;
  overflow: hidden !important;
}
</style>

<style scoped>
/* Material3 AlertDialog container: shape = CornerExtraLarge (28dp), container color =
   surface-container-high, container padding = 24dp. */
.scanlator-dialog-card {
  border-radius: 28px !important;
  padding: 24px;
  min-width: 280px;
  max-height: calc(100dvh - 48px);
  /* Compose scrolls the LazyColumn, not the dialog surface. */
  display: flex;
  flex-direction: column;
  /* Vuetify stretches the dialog card to the overlay height; Compose sizes it to its content. */
  flex: 0 1 auto;
  overflow: hidden;
  color: rgb(var(--v-theme-on-surface));
}

/* Title: headlineSmall (24sp / 32sp, weight 400) in on-surface, 16dp bottom padding. */
.scanlator-dialog-title {
  margin: 0 0 16px;
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  user-select: none;
}

/* Supporting text block: bodyMedium in on-surface-variant, 24dp bottom padding. */
.scanlator-dialog-text {
  padding-bottom: 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
  /* The text slot carries the remaining height of the dialog (Compose: Modifier.weight(1f)). */
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.scanlator-dialog-empty {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* The Box around the LazyColumn; the dividers are aligned to its top and bottom edges. */
.scanlator-dialog-list-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
/* The list takes the remaining height of the dialog and scrolls when it does not fit. */
.scanlator-dialog-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 24%, transparent) transparent;
}
.scanlator-dialog-list::-webkit-scrollbar {
  width: 4px;
}
.scanlator-dialog-list::-webkit-scrollbar-track {
  background: transparent;
}
.scanlator-dialog-list::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 24%, transparent);
  border-radius: 4px;
}

/* Row: clickable, minimumInteractiveComponentSize (48dp), clipped to shapes.small (8dp),
   horizontal padding = MaterialTheme.padding.small (8dp). */
.scanlator-dialog-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
  text-align: start;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.15s ease-out;
}
.scanlator-dialog-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 8%, transparent); }
.scanlator-dialog-row:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 12%, transparent); }
.scanlator-dialog-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

/* Icon slot: 24dp, content colour of the text block, primary when the scanlator is excluded. */
.scanlator-dialog-icon {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  font-size: 24px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-on-surface-variant));
  user-select: none;
}
.scanlator-dialog-icon.filled-symbol { color: rgb(var(--v-theme-primary)); }

/* Text slot: bodyMedium with a 24dp start padding after the icon. */
.scanlator-dialog-label {
  padding-inline-start: 24px;
  min-width: 0;
  overflow-wrap: break-word;
}

/* HorizontalDivider: 1dp outlineVariant line. */
.scanlator-dialog-divider {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
  pointer-events: none;
}
.scanlator-dialog-divider.is-top { top: 0; }
.scanlator-dialog-divider.is-bottom { bottom: 0; }

/* Confirm area: Mihon's FlowRow keeps "Select all"/"Reset" on the leading side (Spacer with
   weight(1f)) and "Cancel"/"OK" on the trailing side. The FlowRow itself adds no spacing, the
   8dp visible distance comes from the TextButton content padding. */
.scanlator-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0;
}
.scanlator-dialog-spacer { flex: 1 1 0; min-width: 0; }

/* MD3 TextButton: defaultMinSize(minWidth = 58dp, minHeight = 40dp) with TextButtonContentPadding
   (12dp horizontal). shape = CornerFull (20dp), label = labelLarge in primary.
   ButtonSmallTokens.PressedContainerShape = CornerSmall (8dp) while pressed. */
.scanlator-dialog-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 58px;
  height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 20px;
  background: transparent;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  text-transform: none;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  overflow: hidden;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: border-radius 0.1s ease-in-out;
}
.scanlator-dialog-button:active {
  border-radius: 8px;
}
.scanlator-dialog-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.scanlator-dialog-button:hover::after { opacity: 0.08; }
.scanlator-dialog-button:active::after { opacity: 0.1; }
.scanlator-dialog-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
