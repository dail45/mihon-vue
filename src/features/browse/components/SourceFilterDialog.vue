<script setup lang="ts">
/**
 * Mihon reference (pinned commit 446f6df):
 * mihon/app/src/main/java/eu/kanade/tachiyomi/ui/browse/source/browse/SourceFilterDialog.kt
 *   -> `fun SourceFilterDialog(onDismissRequest, filters, onReset, onFilter, onUpdate)` (lines 33-77)
 *   -> `private fun FilterItem(filter: Filter<*>, onUpdate: () -> Unit)` (lines 79-165)
 *
 * Reference structure:
 *  - AdaptiveSheet(onDismissRequest) { LazyColumn { stickyHeader { Row(background = colorScheme.background,
 *      padding(8.dp)) { TextButton(action_reset, label in primary); Spacer(weight 1f);
 *      Button(action_filter) }; HorizontalDivider() }; items(filters) { FilterItem(it, updateFilters) } } }
 *  - The sheet itself is a Surface(shape = shapes.extraLarge = 28.dp, color = surfaceContainerHigh)
 *    that is bottom aligned on phones (anchoredDraggable, dismiss threshold 56.dp) and centred
 *    with a 460.dp maximum width on tablets
 *    (mihon/presentation-core/.../components/AdaptiveSheet.kt lines 52-205).
 *
 * The filter rows themselves are rendered by SourceFilterItems.vue, which mirrors the
 * `FilterItem` switch (Header / Separator / CheckBox / TriState / Text / Select / Sort / Group)
 * and the presentation-core item components (SettingsItems.kt, CollapsibleBox.kt).
 */
import { ref, watch } from 'vue'
import { VBottomSheet, VDialog } from 'vuetify/components'
import { useTabletUi } from '@/core/composables/useTabletUi'
import SourceFilterItems from './SourceFilterItems.vue'
import type { SourceFilter } from '@/features/browse/utils/sourceFilter'

const props = defineProps<{
  filters: SourceFilter[]
  /**
   * The filter list as the source produces it (its default states).
   * Mihon's `viewModel.resetFilters()` rebuilds the list from `source.getFilterList()`,
   * so "Reset" restores the source defaults rather than the state of the last applied search.
   * When the host cannot supply the defaults, the state the sheet was opened with is used.
   */
  defaults?: SourceFilter[]
}>()
const emit = defineEmits<{
  (event: 'update', filters: SourceFilter[]): void
  (event: 'filter'): void
  (event: 'reset'): void
}>()

const open = defineModel<boolean>({ required: true })
const tablet = useTabletUi()

/**
 * Snapshot of the filter states as they were when the sheet was opened; "Reset" restores it.
 * Mihon resets to `source.getFilterList()` (the source defaults) — when the host passes
 * `defaults`, those are used instead of the opening snapshot.
 */
const snapshot = ref<SourceFilter[]>([])

function cloneFilters(filters: SourceFilter[]): SourceFilter[] {
  return filters.map(filter => ({
    ...filter,
    state: filter.state && typeof filter.state === 'object' ? { ...(filter.state as object) } : filter.state,
    children: filter.children ? cloneFilters(filter.children) : filter.children,
  }))
}

watch(open, value => {
  if (value) snapshot.value = cloneFilters(props.filters)
})

/** Copies the state of `source` onto the matching filter of `target`. */
function applyStates(target: SourceFilter[], source: SourceFilter[]) {
  target.forEach((filter, index) => {
    const from = source[index]
    if (!from) return
    filter.state = from.state && typeof from.state === 'object' ? { ...(from.state as object) } : from.state
    if (filter.children && from.children) applyStates(filter.children, from.children)
  })
}

/** "Reset": restore the source defaults and tell the host to reset as well. */
function reset() {
  const source = props.defaults?.length ? cloneFilters(props.defaults) : cloneFilters(snapshot.value)
  applyStates(props.filters, source)
  emit('reset')
  emit('update', props.filters)
}

/** "Filter": apply the current filters and close the sheet. */
function apply() {
  emit('filter')
  open.value = false
}

/* AdaptiveSheet on phones: the sheet is draggable to dismiss (56.dp positional threshold).
   The reference uses a nested-scroll connection: the sheet only follows the gesture while the
   LazyColumn is at its top (pre-up/post-down), so scrolling the list up never dismisses it. */
const dragStart = ref<number | null>(null)
const scrollTop = ref(0)
function onTouchStart(event: TouchEvent) {
  if (tablet.value) return
  dragStart.value = event.touches[0]!.clientY
}
function onTouchEnd(event: TouchEvent) {
  const start = dragStart.value
  dragStart.value = null
  if (start === null || tablet.value) return
  const delta = event.changedTouches[0]!.clientY - start
  // Only a downward drag on a list that is already at the top dismisses the sheet.
  if (delta > 56 && scrollTop.value <= 0) open.value = false
}
function onScroll(event: Event) {
  scrollTop.value = (event.target as HTMLElement).scrollTop
}
</script>

<template>
  <component
    :is="tablet ? VDialog : VBottomSheet"
    v-model="open"
    max-width="460"
    content-class="source-filter-sheet-content"
    aria-label="Filters"
  >
    <v-card variant="flat" class="source-filter-sheet" :class="{ 'source-filter-sheet--phone': !tablet }" color="surface-container-high">
      <div class="source-filter-scroll" @touchstart="onTouchStart" @touchend="onTouchEnd" @scroll.passive="onScroll">
        <!-- stickyHeader { Row(background = colorScheme.background, padding(8.dp)) { ... }; HorizontalDivider() } -->
        <div class="source-filter-header">
          <div class="source-filter-header-row">
            <!-- TextButton(action_reset): MD3 TextButton, label = labelLarge in primary. -->
            <button type="button" class="source-filter-text-button" @click="reset">Reset</button>
            <span class="source-filter-header-spacer" />
            <!-- Button(action_filter): presentation-core material Button, container = primary. -->
            <button type="button" class="source-filter-filled-button" @click="apply">Filter</button>
          </div>
          <div class="source-filter-header-divider" />
        </div>

        <!-- items(filters) { FilterItem(it, updateFilters) } -->
        <SourceFilterItems :filters="props.filters" @change="emit('update', props.filters)" />
      </div>
    </v-card>
  </component>
</template>

<style>
/* The phone sheet is flush with the bottom of the viewport (no dialog margin). */
.source-filter-sheet-content.v-bottom-sheet__content { margin: 0 !important; }
</style>

<style scoped>
@layer app-components {
/* AdaptiveSheet Surface: shape = shapes.extraLarge (28.dp), color = surfaceContainerHigh,
   maximum width 460.dp. */
.source-filter-sheet {
  margin: 0 auto;
  max-width: 460px;
  padding: 0;
  border-radius: 28px !important;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: none !important;
  overflow: hidden;
}
/* Tablet: systemBarsPadding() + padding(vertical = 16.dp) around the Surface, so the surface
   itself is inset instead of the content. */
.source-filter-sheet:not(.source-filter-sheet--phone) { margin: 16px auto; }
/* Phone: the sheet sits above the navigation bar (navigationBarsPadding()). */
.source-filter-sheet--phone { margin-bottom: env(safe-area-inset-bottom); }

.source-filter-sheet:not(.source-filter-sheet--phone) .source-filter-scroll { max-height: calc(100dvh - 32px); }
.source-filter-sheet--phone .source-filter-scroll { max-height: calc(100dvh - 24px); }

/* LazyColumn: the content scrolls, the header stays pinned to the top. */
.source-filter-scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 8px;
}

/* stickyHeader: Row(background = MaterialTheme.colorScheme.background, padding(8.dp)). */
.source-filter-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-background));
}
.source-filter-header-row {
  display: flex;
  align-items: center;
  padding: 8px;
}
/* Spacer(modifier = Modifier.weight(1f)). */
.source-filter-header-spacer { flex: 1 1 auto; }

/* HorizontalDivider: 1.dp outlineVariant line. */
.source-filter-header-divider { height: 1px; background: rgb(var(--v-theme-outline-variant)); }

/* MD3 TextButton: height 40.dp, min width 58.dp, content padding 12.dp horizontal,
   shape = CornerFull (20.dp), label = labelLarge (14.sp / 20.sp, weight 500) in primary. */
.source-filter-text-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
}
.source-filter-text-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.source-filter-text-button:hover::after { opacity: 0.08; }
.source-filter-text-button:active::after { opacity: 0.12; }
.source-filter-text-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* presentation-core material Button: container = primary, content = onPrimary, shape =
   M3ButtonDefaults.textShape (CornerFull, 20.dp), min width 58.dp, min height 40.dp,
   content padding = M3ButtonDefaults.ContentPadding (24.dp horizontal / 8.dp vertical),
   label = labelLarge. */
.source-filter-filled-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: 20px;
  background: rgb(var(--v-theme-primary));
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  text-transform: none;
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
  overflow: hidden;
}
.source-filter-filled-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.source-filter-filled-button:hover::after { opacity: 0.08; }
.source-filter-filled-button:active::after { opacity: 0.12; }
.source-filter-filled-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
}
</style>
