<script setup lang="ts">
/**
 * Pixel-parity port of
 * mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryListItem.kt
 *
 *   ElevatedCard(modifier = modifier) {
 *     Row(
 *       modifier = Modifier
 *         .fillMaxWidth()
 *         .clickable(onClick = onRename)
 *         .padding(vertical = MaterialTheme.padding.small)
 *         .padding(start = MaterialTheme.padding.small, end = MaterialTheme.padding.medium),
 *       verticalAlignment = Alignment.CenterVertically,
 *     ) {
 *       Icon(MaterialSymbols.Rounded.DragHandle, modifier = Modifier.padding(MaterialTheme.padding.medium).draggableHandle())
 *       Text(category.name, modifier = Modifier.weight(1f))
 *       IconButton(onClick = onRename) { Icon(MaterialSymbols.Rounded.Edit) }
 *       IconButton(onClick = onDelete) { Icon(MaterialSymbols.Rounded.Delete) }
 *     }
 *   }
 *
 * Metrics (MaterialTheme.padding, presentation-core/.../material/Constants.kt:12-23):
 *   extraSmall 4dp, small 8dp, medium 16dp, large 24dp, extraLarge 32dp.
 *
 * Material3 tokens:
 *   ElevatedCard: container = surfaceContainerLow, shape = CardDefaults.shape (12dp),
 *   elevation = level 1 (0 1dp 2dp 0 / 0 1dp 3dp 1dp), hover = level 2 (3dp), dragged = level 4 (8dp).
 *   Card content color = onSurface.
 *   Text: default typography = bodyLarge (16sp / 24sp, weight 400, letterSpacing 0.03125em).
 *   Icon (drag handle): 24dp, tint = LocalContentColor = onSurface, 16dp padding all around (56dp footprint).
 *   IconButton: state layer 40dp, 48dp minimum interactive touch target, 8dp gap between buttons,
 *   icon 24dp, content color = onSurfaceVariant (contentColorFor(transparent)), fully rounded state layer.
 */
import { computed } from 'vue'

interface CategoryLike {
  id?: number | string
  name: string
  hidden?: boolean
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  name?: string
  category?: CategoryLike
  hidden?: boolean
  /** True while this row is being dragged by its handle. */
  dragging?: boolean
}>(), {
  name: undefined,
  category: undefined,
  hidden: false,
  dragging: false,
})

const emit = defineEmits<{
  (event: 'rename'): void
  (event: 'delete'): void
  (event: 'hide'): void
  (event: 'dragstart', dragEvent: DragEvent): void
  (event: 'dragend'): void
  (event: 'move-up'): void
  (event: 'move-down'): void
  (event: 'touch-start', touchEvent: TouchEvent): void
  (event: 'touch-move', touchEvent: TouchEvent): void
  (event: 'touch-end', touchEvent: TouchEvent): void
  (event: 'touch-cancel', touchEvent: TouchEvent): void
}>()

const displayName = computed(() => props.category?.name ?? props.name ?? '')
const isHidden = computed(() => Boolean(props.hidden || props.category?.hidden))

function onCardClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('.category-list-item__action') || target?.closest('.category-list-item__handle')) {
    return
  }
  emit('rename')
}

function onCardKeyDown(event: KeyboardEvent) {
  if (event.target !== event.currentTarget) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('rename')
  } else if ((event.altKey || event.ctrlKey) && event.key === 'ArrowUp') {
    event.preventDefault()
    emit('move-up')
  } else if ((event.altKey || event.ctrlKey) && event.key === 'ArrowDown') {
    event.preventDefault()
    emit('move-down')
  }
}
</script>

<template>
  <div
    class="category-list-item"
    :class="{ 'is-dragging': props.dragging, 'is-hidden': isHidden }"
    role="button"
    tabindex="0"
    :aria-label="`Rename category ${displayName}`"
    @click="onCardClick"
    @keydown="onCardKeyDown"
  >
    <span
      class="category-list-item__handle"
      role="button"
      tabindex="-1"
      draggable="true"
      aria-label="Reorder category"
      title="Drag to reorder"
      @click.stop
      @dragstart="emit('dragstart', $event)"
      @dragend="emit('dragend')"
      @touchstart.passive="emit('touch-start', $event)"
      @touchmove="emit('touch-move', $event)"
      @touchend="emit('touch-end', $event)"
      @touchcancel="emit('touch-cancel', $event)"
    >
      <span class="material-symbols-rounded category-list-item__handle-icon" aria-hidden="true">drag_handle</span>
    </span>

    <span
      class="category-list-item__name"
      :class="{ 'is-hidden': isHidden }"
    >{{ displayName }}</span>

    <button
      type="button"
      class="category-list-item__action"
      aria-label="Rename category"
      title="Rename category"
      @click.stop="emit('rename')"
      @keydown.stop
    >
      <span class="material-symbols-rounded category-list-item__action-icon" aria-hidden="true">edit</span>
    </button>

    <button
      type="button"
      class="category-list-item__action category-list-item__action--hide"
      :aria-label="isHidden ? 'Unhide category' : 'Hide category'"
      :title="isHidden ? 'Unhide category' : 'Hide category'"
      @click.stop="emit('hide')"
      @keydown.stop
    >
      <span class="material-symbols-rounded category-list-item__action-icon" aria-hidden="true">{{ isHidden ? 'visibility' : 'visibility_off' }}</span>
    </button>

    <button
      type="button"
      class="category-list-item__action"
      aria-label="Delete"
      title="Delete"
      @click.stop="emit('delete')"
      @keydown.stop
    >
      <span class="material-symbols-rounded category-list-item__action-icon" aria-hidden="true">delete</span>
    </button>
  </div>
</template>

<style scoped>
@layer app-components {
/* ElevatedCard: container = surfaceContainerLow, shape = 12dp, elevation level 1 (1dp).
   Height: 56dp (DragHandle) + 16dp (padding vertical 8dp) = 72dp. */
.category-list-item {
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 72px;
  padding: 8px 16px 8px 8px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-container-low));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
}
@media (hover: hover) {
  .category-list-item:hover:not(.is-dragging) {
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
  }
}
/* Dragged item is lifted (elevation level 4 = 8dp) matching ReorderableItem. */
.category-list-item.is-dragging {
  box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.3), 0 6px 10px 4px rgba(0, 0, 0, 0.15);
  z-index: 2;
}

/* Modifier.clickable ripple: a press state layer in the content colour. */
.category-list-item::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgb(var(--v-theme-on-surface));
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1);
}
@media (hover: hover) {
  .category-list-item:hover::after { opacity: 0.08; }
  .category-list-item:has(.category-list-item__action:hover)::after { opacity: 0; }
}
.category-list-item:active::after { opacity: 0.12; }
.category-list-item:has(.category-list-item__action:active)::after { opacity: 0; }
.category-list-item:has(.category-list-item__handle:active)::after { opacity: 0; }
.category-list-item:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Icon(DragHandle).padding(16.dp): a 24dp icon inside a 16dp padding on every side (56x56dp). */
.category-list-item__handle {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  padding: 16px;
  color: rgb(var(--v-theme-on-surface));
  cursor: grab;
  touch-action: none;
}
.category-list-item__handle:active { cursor: grabbing; }
.category-list-item__handle-icon {
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Text(category.name).weight(1f): bodyLarge (16sp / 24sp, letterSpacing 0.03125em). */
.category-list-item__name {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: Roboto, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  color: rgb(var(--v-theme-on-surface));
}

/* Hidden category styling: 60% opacity and strikethrough (Komikku CategoryListItem.kt:60-64) */
.category-list-item.is-hidden .category-list-item__name,
.category-list-item__name.is-hidden {
  opacity: 0.6;
  text-decoration: line-through;
}

/* MD3 IconButton: the state layer is 40dp with a 48dp interactive touch target.
   Content color is IconButtonDefaults.contentColor = onSurfaceVariant. */
.category-list-item__action {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
/* 8dp visual gap between consecutive 40dp action buttons, matching 48dp slot spacing in Compose. */
.category-list-item__action + .category-list-item__action {
  margin-inline-start: 8px;
}
/* Touch target expansion for mobile: 48dp minimum interactive component size. */
.category-list-item__action::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 24px;
}
.category-list-item__action::before {
  content: '';
  position: absolute;
  inset: 0;
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: currentColor;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1);
}
@media (hover: hover) {
  .category-list-item__action:hover::before { opacity: 0.08; }
}
.category-list-item__action:active::before { opacity: 0.12; }
.category-list-item__action:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.category-list-item__action-icon {
  position: relative;
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
}
</style>
