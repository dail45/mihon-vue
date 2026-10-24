<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's
 * `eu/kanade/presentation/manga/components/ChapterHeader.kt`
 * (Mihon revision 446f6df82c390ab760802c2fce3b677bce3f31c1 / modern Compose).
 *
 * Reference:
 *   Column(
 *     modifier = modifier
 *       .fillMaxWidth()
 *       .clickable(
 *         enabled = enabled,
 *         onClick = onClick,
 *       )
 *       .padding(horizontal = 16.dp, vertical = 4.dp),
 *     verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.extraSmall),
 *   ) {
 *     Text(
 *       text = if (chapterCount == null) stringResource(MR.strings.chapters)
 *              else pluralStringResource(MR.plurals.manga_num_chapters, count = chapterCount, chapterCount),
 *       style = MaterialTheme.typography.titleMedium,
 *       color = MaterialTheme.colorScheme.onBackground,
 *     )
 *     MissingChaptersWarning(missingChapterCount)
 *   }
 *
 * MissingChaptersWarning:
 *   if (count == 0) return
 *   Text(
 *     text = pluralStringResource(MR.plurals.missing_chapters, count = count, count),
 *     maxLines = 1,
 *     overflow = TextOverflow.Ellipsis,
 *     style = MaterialTheme.typography.bodySmall,
 *     color = MaterialTheme.colorScheme.error.copy(alpha = SECONDARY_ALPHA), // 0.78f
 *   )
 *
 * Optional filter button (Row variant matching Compose IconButton spec):
 *   Row(fillMaxWidth(), verticalAlignment = Alignment.CenterVertically)
 *   padding(start = 16.dp, top = 4.dp, end = 4.dp, bottom = 4.dp)
 *   IconButton(48x48dp, 24dp icon filter_list, onSurfaceVariant / primary)
 */
import { computed, useSlots } from 'vue'

const props = withDefaults(defineProps<{
  /** Total number of chapters; null/undefined renders generic "Chapters". */
  chapterCount?: number | null
  /** Count of missing chapter numbers in the sequence; 0 hides the warning. */
  missingChapterCount?: number
  /** Whether clicking the header is enabled (disabled during multi-select action mode). */
  enabled?: boolean
  /** Whether to render an explicit filter IconButton on the end of the header row. */
  showFilterButton?: boolean
  /** Whether chapter filters are actively applied (tints filter icon with primary). */
  hasFilters?: boolean
  /** Accessible description for the filter button. */
  filterContentDescription?: string
}>(), {
  chapterCount: null,
  missingChapterCount: 0,
  enabled: true,
  showFilterButton: false,
  hasFilters: false,
  filterContentDescription: 'Filter',
})

const emit = defineEmits<{
  (event: 'click', e?: MouseEvent | KeyboardEvent): void
  (event: 'click:filter', e: MouseEvent | KeyboardEvent): void
}>()

const slots = useSlots()

const hasFilterSlotOrButton = computed(() => props.showFilterButton || !!slots.filter)

const chaptersLabel = computed(() => {
  if (props.chapterCount === null || props.chapterCount === undefined) return 'Chapters'
  return `${props.chapterCount} ${props.chapterCount === 1 ? 'chapter' : 'chapters'}`
})

const missingLabel = computed(() => {
  const count = props.missingChapterCount ?? 0
  if (count <= 0) return ''
  return `Missing ${count} ${count === 1 ? 'chapter' : 'chapters'}`
})

function onHeaderClick(e?: MouseEvent | KeyboardEvent) {
  if (!props.enabled) return
  emit('click', e)
}

function onHeaderKeydown(e: KeyboardEvent) {
  if (!props.enabled) return
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('click', e)
  }
}

function onFilterClick(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation()
  emit('click:filter', e)
  if (props.enabled) {
    emit('click', e)
  }
}
</script>

<template>
  <div
    class="chapter-header"
    :class="{
      'chapter-header--with-filter': hasFilterSlotOrButton,
      'chapter-header--disabled': !enabled,
    }"
    :role="!hasFilterSlotOrButton ? 'button' : undefined"
    :tabindex="!hasFilterSlotOrButton ? (enabled ? 0 : -1) : undefined"
    :aria-disabled="!hasFilterSlotOrButton ? (!enabled || undefined) : undefined"
    @click="!hasFilterSlotOrButton ? onHeaderClick($event) : undefined"
    @keydown="!hasFilterSlotOrButton ? onHeaderKeydown($event) : undefined"
  >
    <!-- Content column: weight 1f, spacedBy extraSmall 4dp -->
    <div
      class="chapter-header__content"
      :role="hasFilterSlotOrButton ? 'button' : undefined"
      :tabindex="hasFilterSlotOrButton ? (enabled ? 0 : -1) : undefined"
      :aria-disabled="hasFilterSlotOrButton ? (!enabled || undefined) : undefined"
      @click="hasFilterSlotOrButton ? onHeaderClick($event) : undefined"
      @keydown="hasFilterSlotOrButton ? onHeaderKeydown($event) : undefined"
    >
      <span class="chapter-header__title">{{ chaptersLabel }}</span>
      <span v-if="missingLabel" class="chapter-header__missing">{{ missingLabel }}</span>
    </div>

    <!-- Optional filter action (slot or MD3 IconButton) -->
    <div v-if="hasFilterSlotOrButton" class="chapter-header__action">
      <slot name="filter" :has-filters="hasFilters" :on-click="onFilterClick">
        <button
          type="button"
          class="chapter-header__filter-btn"
          :class="{ 'chapter-header__filter-btn--active': hasFilters }"
          :aria-label="filterContentDescription"
          :title="filterContentDescription"
          @click="onFilterClick"
        >
          <!-- Material Symbols Rounded: filter_list (24dp) -->
          <svg
            class="chapter-header__filter-icon"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M10 18h4c.55 0 1-.45 1-1s-.45-1-1-1h-4c-.55 0-1 .45-1 1s.45 1 1 1zM3 7c0 .55.45 1 1 1h16c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1zm3 6h12c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1z"
              fill="currentColor"
            />
          </svg>
        </button>
      </slot>
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
.chapter-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  /* Compose: padding(horizontal = 16.dp, vertical = 4.dp) */
  padding: 4px 16px;
  background: none;
  border: 0;
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  text-align: start;
  color: inherit;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  outline: none;
  transition: background-color 150ms cubic-bezier(0.2, 0, 0, 1);
}

/* Padding when end IconButton is present: padding(start = 16.dp, top = 4.dp, end = 4.dp, bottom = 4.dp) */
.chapter-header--with-filter {
  padding: 4px 4px 4px 16px;
  cursor: default;
}

/* Disabled clickable state */
.chapter-header--disabled {
  cursor: default;
}

/* MD3 state layers when entire container is clickable */
.chapter-header:not(.chapter-header--with-filter):not(.chapter-header--disabled):hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.chapter-header:not(.chapter-header--with-filter):not(.chapter-header--disabled):active {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.chapter-header:not(.chapter-header--with-filter):focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Content column: Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(extraSmall 4.dp) */
.chapter-header__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
  outline: none;
}

/* Content state layer when row has filter button and content is individually clickable */
.chapter-header--with-filter .chapter-header__content:not([aria-disabled='true']) {
  cursor: pointer;
  border-radius: 4px;
}
.chapter-header--with-filter .chapter-header__content:not([aria-disabled='true']):hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.chapter-header--with-filter .chapter-header__content:not([aria-disabled='true']):active {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.chapter-header--with-filter .chapter-header__content:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* MaterialTheme.typography.titleMedium: 16sp / 24sp, weight 500, letter-spacing 0.15sp */
.chapter-header__title {
  display: block;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-background));
}

/* MissingChaptersWarning: bodySmall 12sp / 16sp, weight 400, letter-spacing 0.4sp */
/* colorScheme.error.copy(alpha = SECONDARY_ALPHA = 0.78f) */
.chapter-header__missing {
  display: block;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: color-mix(in srgb, rgb(var(--v-theme-error)) 78%, transparent);
}

/* Filter action container */
.chapter-header__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* MD3 IconButton: 48x48dp touch target, 40dp state layer, 24dp icon */
.chapter-header__filter-btn {
  position: relative;
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface-variant));
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: color 150ms cubic-bezier(0.2, 0, 0, 1);
}

/* Filter icon active state: MaterialTheme.colorScheme.primary */
.chapter-header__filter-btn--active {
  color: rgb(var(--v-theme-primary));
}

/* 40x40dp MD3 state layer circle */
.chapter-header__filter-btn::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background-color: transparent;
  transition: background-color 150ms cubic-bezier(0.2, 0, 0, 1);
}

.chapter-header__filter-btn:hover::before {
  background-color: color-mix(in srgb, currentColor 8%, transparent);
}

.chapter-header__filter-btn:active::before {
  background-color: color-mix(in srgb, currentColor 12%, transparent);
}

.chapter-header__filter-btn:focus-visible::before {
  background-color: color-mix(in srgb, currentColor 10%, transparent);
}

.chapter-header__filter-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.chapter-header__filter-icon {
  position: relative;
  width: 24px;
  height: 24px;
  display: block;
}
}
</style>
