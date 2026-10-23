<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import CategoryCreateDialog from './CategoryCreateDialog.vue'

/**
 * Mihon reference: mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryFloatingActionButton.kt
 *
 *   SmallExtendedFloatingActionButton(
 *       text = { Text(text = stringResource(MR.strings.action_add)) },
 *       icon = { Icon(imageVector = MaterialSymbols.Rounded.Add, contentDescription = null) },
 *       onClick = onCreate,
 *       expanded = lazyListState.shouldExpandFAB(),
 *       modifier = modifier,
 *   )
 *
 * Material3 `SmallExtendedFloatingActionButton` (androidx compose material3, tokens v0_14_0,
 * the `text`/`icon`/`expanded` overload):
 *   ExtendedFabSmallTokens: ContainerHeight 56dp, ContainerShape = CornerLarge (16dp),
 *   IconLabelSpace 8dp, IconSize 24dp, LeadingSpace 16dp, TrailingSpace 16dp.
 *   Label = TypographyKeyTokens.TitleMedium (16sp / 24sp, weight 500, letterSpacing 0.15sp).
 *   Container color = FabPrimaryContainerTokens.ContainerColor = primaryContainer,
 *   content color = onPrimaryContainer.
 *   Elevation: Level3 for default / pressed / focused, Level4 for hovered.
 *   Minimum width and height = ContainerHeight (56dp).
 *
 * The expanded/collapsed geometry of that overload:
 *   - the Row keeps `padding(start = LeadingSpace, end = TrailingSpace)` in BOTH states,
 *   - the icon is always composed (24dp),
 *   - the label Row is only composed while the transition is not fully collapsed and its
 *     alpha follows the transition progress,
 *   - the container width is lerped between the minimum width (56dp) and the measured
 *     intrinsic width of the expanded content.
 *   => Collapsed: 56dp wide, the icon sits 16dp from the leading edge.
 *   => Expanded:  16dp + 24dp icon + 8dp + label + 16dp.
 *
 * Expansion follows tachiyomi.presentation.core.util.shouldExpandFAB()
 * (mihon/presentation-core/.../util/LazyListState.kt:5):
 *   lastScrolledBackward || !canScrollForward || !canScrollBackward
 *
 * `MR.strings.action_add` = "Add" (mihon/i18n/.../base/strings.xml).
 */

const props = withDefaults(
  defineProps<{
    /** Forces the expanded state. When omitted the FAB follows the scroll position of the list. */
    expanded?: boolean | undefined
    /** Scrollable element driving the expand state. Defaults to the nearest scrollable ancestor. */
    scrollContainer?: HTMLElement | null
    /** Existing category names, used by the create dialog for the duplicate check. */
    existingNames?: string[]
    /**
     * When true (default) the built-in create dialog is opened by the FAB itself. When false the
     * parent is notified through the `create` event and owns the dialog.
     */
    manageDialog?: boolean
  }>(),
  { expanded: undefined, scrollContainer: null, existingNames: () => [], manageDialog: true },
)

const emit = defineEmits<{ (event: 'create', name: string): void }>()

const root = ref<HTMLElement | null>(null)
const dialogOpen = ref(false)
/** Height of the bottom navigation bar the FAB has to clear, in CSS pixels. */
const bottomInset = ref(0)

const isExpanded = ref(true)
let lastTop: number | null = null
let lastScrolledBackward = false
let scroller: HTMLElement | null = null

/* ------------------------------------------------------------------ *
 * Expanded / collapsed state
 * ------------------------------------------------------------------ */

function resolveScroller(): HTMLElement | null {
  if (props.scrollContainer) return props.scrollContainer
  let el = root.value?.parentElement ?? null
  while (el) {
    const overflow = getComputedStyle(el).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return el
    el = el.parentElement
  }
  return (document.scrollingElement as HTMLElement | null) ?? null
}

function updateExpandedState(el: HTMLElement) {
  const top = el.scrollTop
  if (lastTop !== null) {
    if (top < lastTop) lastScrolledBackward = true
    else if (top > lastTop) lastScrolledBackward = false
  }
  lastTop = top
  // Compose equivalent of LazyListState.canScrollForward / canScrollBackward.
  const canScrollForward = top + el.clientHeight < el.scrollHeight - 1
  const canScrollBackward = top > 1
  isExpanded.value = lastScrolledBackward || !canScrollForward || !canScrollBackward
}

function onScroll(event: Event) {
  if (props.expanded !== undefined) return
  const target = event.target
  const el =
    target instanceof Element && target.scrollHeight > target.clientHeight
      ? (target as HTMLElement)
      : scroller
  if (!el) return
  updateExpandedState(el)
}

function onResize() {
  if (props.expanded !== undefined) return
  const el = scroller
  if (el) updateExpandedState(el)
  updateBottomInset()
}

/**
 * The Scaffold places the FAB 16dp (FabSpacing) above the bottom layout item, which is the
 * bottom navigation bar on the phone layout. The bar is 80dp tall plus the safe area inset.
 */
function updateBottomInset() {
  const nav = document.querySelector<HTMLElement>('.v-bottom-navigation')
  if (!nav) {
    bottomInset.value = 0
    return
  }
  const rect = nav.getBoundingClientRect()
  bottomInset.value = Math.max(0, window.innerHeight - rect.top)
}

/**
 * The Scaffold places the FAB 16dp (FabSpacing) above the bottom layout item, which is the
 * bottom navigation bar on the phone layout.
 */
const fabBottom = computed(
  () => `calc(${bottomInset.value}px + 16px + env(safe-area-inset-bottom))`,
)

watch(
  () => props.expanded,
  value => {
    if (value !== undefined) isExpanded.value = value
  },
  { immediate: true },
)

onMounted(() => {
  scroller = resolveScroller()
  if (scroller) updateExpandedState(scroller)
  updateBottomInset()
  // Scroll events do not bubble, so listen on the document in the capture phase.
  document.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onResize)
})

/* ------------------------------------------------------------------ *
 * Create action
 * ------------------------------------------------------------------ */

function onClickFab() {
  if (props.manageDialog) {
    dialogOpen.value = true
    return
  }
  // The parent owns the create flow (Mihon's CategoryCreateDialog).
  emit('create', '')
}

function onCreated(name: string) {
  emit('create', name)
}
</script>

<template>
  <div ref="root" class="category-fab-root">
    <button
      type="button"
      class="category-fab"
      :class="{ 'is-expanded': isExpanded }"
      :style="{ bottom: fabBottom }"
      aria-label="Add"
      @click="onClickFab"
    >
      <!-- MaterialSymbols.Rounded.Add, contentDescription = null (decorative). -->
      <span class="material-symbols-rounded category-fab-icon" aria-hidden="true">add</span>
      <span class="category-fab-label">Add</span>
    </button>

    <!-- Mihon's CategoryCreateDialog is a separate composable; the web port reuses its
         pixel-parity implementation, which performs the real Suwayomi REST create call. -->
    <CategoryCreateDialog
      v-if="manageDialog"
      v-model="dialogOpen"
      :categories="existingNames.length ? existingNames : undefined"
      @created="onCreated"
    />
  </div>
</template>

<style scoped>
@layer app-components {
/* Material3 SmallExtendedFloatingActionButton.
   container height 56dp, minimum width 56dp, shape = CornerLarge (16dp),
   container color = primaryContainer, content color = onPrimaryContainer,
   elevation level 3 (default, pressed, focused) and level 4 (hovered). */
.category-fab-root { position: relative; }

.category-fab {
  position: fixed;
  right: 16px;
  /* FabSpacing (16dp) above the bottom layout item (bottom navigation) or the screen edge.
     The real offset is computed from the bottom navigation bar and set inline. */
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 5;
  display: inline-flex;
  align-items: center;
  height: 56px;
  min-width: 56px;
  /* LeadingSpace 16dp on the start side, TrailingSpace 16dp on the end side, in BOTH states:
     collapsed the row is 16 + 24 (icon) + 16 = 56dp, so the icon stays centred. */
  padding: 0 16px;
  border: none;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  font-family: inherit;
  cursor: pointer;
  /* MD3 elevation level 3: 0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px 0 rgba(0,0,0,0.15). */
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s ease-in-out;
  -webkit-tap-highlight-color: transparent;
}

@media (hover: hover) {
  /* MD3 elevation level 4 (hovered): 0 6px 10px 4px rgba(0,0,0,0.15), 0 2px 3px 0 rgba(0,0,0,0.15). */
  .category-fab:hover { box-shadow: 0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px 0 rgba(0, 0, 0, 0.15); }
}
.category-fab:active { box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.15); }
.category-fab:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Material3 state layer on the content color. */
.category-fab::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
@media (hover: hover) {
  .category-fab:hover::after { opacity: 0.08; }
}
.category-fab:active::after { opacity: 0.12; }
.category-fab:focus-visible::after { opacity: 0.1; }

/* Icon size 24dp (the leading space comes from the container padding). */
.category-fab-icon {
  flex: 0 0 auto;
  font-size: 24px;
  line-height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Label = titleMedium (16sp / 24sp, weight 500, letter spacing 0.15sp).
   Icon/label space 8dp (IconLabelSpace); the trailing space is the container padding. The label
   is only present while the FAB is not fully collapsed; its alpha and the container width follow
   the expand transition. */
.category-fab-label {
  max-width: 0;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  transition: max-width 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s linear, margin 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.category-fab.is-expanded .category-fab-label {
  max-width: 200px;
  margin: 0 0 0 8px;
  opacity: 1;
}
}
</style>
