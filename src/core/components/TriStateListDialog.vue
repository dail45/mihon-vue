<script setup lang="ts">
/**
 * Core — tri-state list dialog (reusable multi-purpose tri-state selection modal).
 *
 * Pixel-parity port of Mihon's `TriStateListDialog`
 * (mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TriStateListDialog.kt,
 * pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference structure (androidx.compose.material3.AlertDialog):
 *  - title    : `title` (headlineSmall, 24sp / 32sp, weight 400, on-surface), 16dp bottom padding.
 *  - text     : optional `message` (bodyMedium, on-surface-variant, 8dp bottom padding) followed
 *               by a Box that holds a LazyColumn of the items.
 *  - row      : Row(verticalAlignment = CenterVertically) with
 *               clip(shapes.small = 4dp) → clickable → defaultMinSize(minHeight = 48dp) →
 *               fillMaxWidth. The row has NO horizontal padding.
 *  - row icon : Icon(padding(end = 20dp), 24dp)
 *                 UNCHECKED → MaterialSymbols.Rounded.CheckBoxOutlineBlank  (FILL 0, content colour)
 *                 CHECKED   → MaterialSymbols.RoundedFilled.CheckBox        (FILL 1, primary)
 *                 INVERSED  → MaterialSymbols.RoundedFilled.DisabledByDefault (FILL 1, primary)
 *               contentDescription = "Not selected" / "Selected" / "Disabled".
 *  - row text : Text(itemLabel(item)) with the default text style of the dialog text slot
 *               (bodyMedium, 14sp / 20sp, letterSpacing 0.0178571429em, on-surface-variant).
 *  - overlay  : HorizontalDivider on the top edge while the list scrolls backwards and on the
 *               bottom edge while it scrolls forwards.
 *  - buttons  : confirmButton = "OK", dismissButton = "Cancel" (both MD3 TextButtons). The
 *               AlertDialog flow row flips the layout direction, so the visual order is
 *               "Cancel" then "OK", right aligned, 8dp apart.
 *
 * Material3 AlertDialog metrics used here (compose material3 AlertDialog.kt + DialogTokens.kt):
 *  - container shape = CornerExtraLarge (28dp), container color = surface-container-high,
 *    tonal elevation 0dp (no shadow).
 *  - container padding = 24dp on all sides, title bottom padding = 16dp, text bottom padding = 24dp.
 *  - title = headlineSmall (24sp / 32sp, weight 400) in on-surface.
 *  - supporting text = bodyMedium (14sp / 20sp, letterSpacing 0.0178571429em) in on-surface-variant.
 *  - action labels = labelLarge (14sp / 20sp, weight 500) in primary, button spacing 8dp.
 *  - BasicAlertDialog applies sizeIn(minWidth = 280dp, maxWidth = 560dp).
 *  - TextButton (mihon/presentation-core/.../material/Button.kt): height 40dp, min width 58dp,
 *    content padding 12dp horizontal, shape = CornerFull (20dp), transparent container.
 */
import { nextTick, onMounted, ref, watch } from 'vue'

/** Tri-state of a row, mirroring the private `State` enum of the reference. */
export type TriStateValue = 'unchecked' | 'checked' | 'inversed'

const props = defineProps<{
  /** Dialog title (`title` of the reference). */
  title: string
  /** Optional supporting message shown above the list. */
  message?: string | null
  /** Items offered by the dialog. */
  items: readonly unknown[]
  /** Items that start in the CHECKED state. */
  initialChecked?: readonly unknown[]
  /** Items that start in the INVERSED state. */
  initialInversed?: readonly unknown[]
  /** Label renderer for an item (`itemLabel` of the reference). */
  itemLabel: (item: any) => string
  /** Optional identity extractor used to compare items (defaults to reference equality). */
  itemKey?: (item: any) => string | number
}>()

const emit = defineEmits<{
  (event: 'value-changed', included: any[], excluded: any[]): void
  (event: 'confirm', included: any[], excluded: any[]): void
  (event: 'dismiss'): void
}>()

const open = defineModel<boolean>({ required: true })

/** Working copy of the per-item state, re-created whenever the dialog is opened. */
const selected = ref<TriStateValue[]>([])

function keyOf(item: unknown): unknown {
  return props.itemKey ? props.itemKey(item) : (item as any)?.id ?? item
}

function contains(list: readonly unknown[] | undefined, item: unknown): boolean {
  if (!list?.length) return false
  const key = keyOf(item)
  return list.some(entry => keyOf(entry) === key)
}

function initialState(item: unknown): TriStateValue {
  if (contains(props.initialChecked, item)) return 'checked'
  if (contains(props.initialInversed, item)) return 'inversed'
  return 'unchecked'
}

function resetSelection() {
  selected.value = props.items.map(initialState)
}

watch(open, value => {
  if (value) resetSelection()
})

onMounted(() => {
  if (open.value) resetSelection()
})

/** UNCHECKED → CHECKED → INVERSED → UNCHECKED, exactly as in the reference. */
function advance(index: number) {
  const current = selected.value[index]
  selected.value[index] = current === 'unchecked' ? 'checked' : current === 'checked' ? 'inversed' : 'unchecked'
}

/**
 * MaterialSymbols.Rounded.CheckBoxOutlineBlank (outline, FILL 0),
 * MaterialSymbols.RoundedFilled.CheckBox and
 * MaterialSymbols.RoundedFilled.DisabledByDefault (both filled, FILL 1).
 */
function iconFor(state: TriStateValue): string {
  if (state === 'checked') return 'check_box'
  if (state === 'inversed') return 'disabled_by_default'
  return 'check_box_outline_blank'
}

function isFilled(state: TriStateValue): boolean {
  return state !== 'unchecked'
}

function iconLabel(state: TriStateValue): string {
  if (state === 'checked') return 'Selected'
  if (state === 'inversed') return 'Disabled'
  return 'Not selected'
}

function ariaChecked(state: TriStateValue): 'true' | 'false' | 'mixed' {
  if (state === 'checked') return 'true'
  if (state === 'inversed') return 'mixed'
  return 'false'
}

/** OK confirms the working copy: CHECKED items are included, INVERSED items are excluded. */
function confirm() {
  const included = props.items.filter((_, index) => selected.value[index] === 'checked')
  const excluded = props.items.filter((_, index) => selected.value[index] === 'inversed')
  emit('value-changed', included, excluded)
  emit('confirm', included, excluded)
  open.value = false
}

function cancel() {
  emit('dismiss')
  open.value = false
}

/* Scroll overlays: the reference draws a divider on the top edge while the list can scroll
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
  canScrollBackward.value = element.scrollTop > 0
  canScrollForward.value = element.scrollHeight - element.scrollTop - element.clientHeight > 0
}

watch(open, async value => {
  if (!value) return
  canScrollBackward.value = false
  canScrollForward.value = false
  await nextTick()
  updateScrollState()
})
</script>

<template>
  <v-dialog
    v-model="open"
    content-class="tri-state-list-overlay"
    aria-labelledby="tri-state-list-title"
  >
    <v-card class="tri-state-list-card" rounded="28px" color="surface-container-high">
      <h2 id="tri-state-list-title" class="tri-state-list-title">{{ title }}</h2>

      <div class="tri-state-list-text">
        <p v-if="message" class="tri-state-list-message">{{ message }}</p>

        <div class="tri-state-list-wrap">
          <div
            ref="listEl"
            class="tri-state-list"
            role="group"
            :aria-label="title"
            @scroll.passive="updateScrollState"
          >
            <button
              v-for="(item, index) in items"
              :key="index"
              type="button"
              class="tri-state-list-row"
              role="checkbox"
              :aria-checked="ariaChecked(selected[index] ?? 'unchecked')"
              @click="advance(index)"
            >
              <span
                class="tri-state-list-icon"
                :class="{ 'is-filled': isFilled(selected[index] ?? 'unchecked') }"
                role="img"
                :aria-label="iconLabel(selected[index] ?? 'unchecked')"
              >
                <span class="material-symbols-rounded" aria-hidden="true">{{ iconFor(selected[index] ?? 'unchecked') }}</span>
              </span>
              <span class="tri-state-list-label">{{ itemLabel(item) }}</span>
            </button>
          </div>
          <div v-if="canScrollBackward" class="tri-state-list-divider is-top" aria-hidden="true" />
          <div v-if="canScrollForward" class="tri-state-list-divider is-bottom" aria-hidden="true" />
        </div>
      </div>

      <div class="tri-state-list-actions">
        <button type="button" class="tri-state-list-button" @click="cancel">Cancel</button>
        <button type="button" class="tri-state-list-button" @click="confirm">OK</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here. */
.v-dialog > .tri-state-list-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the alert dialog surface with tonalElevation = 0.dp and without a shadow
   elevation, so the dialog has no drop shadow. */
.v-dialog > .tri-state-list-overlay > .v-card { box-shadow: none; }
</style>

<style scoped>
/* Material3 AlertDialog container: shape = CornerExtraLarge (28dp), container color =
   surface-container-high, container padding = 24dp. */
.tri-state-list-card {
  border-radius: 28px !important;
  padding: 24px;
  min-width: 280px;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 48px);
}

/* Title: headlineSmall (24sp / 32sp, weight 400) in on-surface, 16dp bottom padding. */
.tri-state-list-title {
  margin: 0;
  padding: 0 0 16px;
  font-family: inherit;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}

.tri-state-list-text {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}

/* Supporting text: bodyMedium (14sp / 20sp, letterSpacing 0.017857em) in on-surface-variant. */
.tri-state-list-message {
  margin: 0;
  padding: 0 0 8px;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

.tri-state-list-wrap {
  position: relative;
  min-height: 0;
  flex: 1 1 auto;
}

/* LazyColumn: fillMaxWidth, scroll container. */
.tri-state-list {
  max-height: min(400px, 50dvh);
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

/* Row: defaultMinSize(minHeight = 48dp), fillMaxWidth, CenterVertically, clip(shapes.small = 4dp). */
.tri-state-list-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  text-align: start;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
@media (hover: hover) {
  .tri-state-list-row:hover {
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
  }
}
.tri-state-list-row:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.tri-state-list-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Icon: 24dp, padding(end = 20dp). Outline = onSurface (LocalContentColor), filled = primary. */
.tri-state-list-icon {
  flex: 0 0 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-inline-end: 20px;
  color: rgb(var(--v-theme-on-surface));
}
.tri-state-list-icon.is-filled {
  color: rgb(var(--v-theme-primary));
}
.tri-state-list-icon .material-symbols-rounded {
  font-size: 24px;
  line-height: 24px;
  display: block;
}
.tri-state-list-icon.is-filled .material-symbols-rounded {
  font-variation-settings: 'FILL' 1;
}

/* Text: itemLabel with the default text style of the dialog text slot (bodyMedium). */
.tri-state-list-label {
  flex: 1 1 auto;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* HorizontalDivider on scroll backwards / forwards. */
.tri-state-list-divider {
  position: absolute;
  inset-inline: 0;
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
  pointer-events: none;
}
.tri-state-list-divider.is-top { top: 0; }
.tri-state-list-divider.is-bottom { bottom: 0; }

/* Buttons: 24dp top padding, 8dp spacing, right aligned, order "Cancel" then "OK". */
.tri-state-list-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 24px;
}

/* MD3 TextButton tokens: height 40dp, min-width 58dp, content padding 12dp horizontal, shape 20dp. */
.tri-state-list-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
@media (hover: hover) {
  .tri-state-list-button:hover {
    background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
  }
}
.tri-state-list-button:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}
.tri-state-list-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
