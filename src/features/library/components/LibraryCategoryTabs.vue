<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * Pixel-parity port of Mihon's `presentation/library/components/LibraryTabs.kt`
 * (mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference:
 *
 * ```kotlin
 * @Composable
 * internal fun LibraryTabs(
 *     categories: List<Category>,
 *     pagerState: PagerState,
 *     getItemCountForCategory: (Category) -> Int?,
 *     onTabItemClick: (Int) -> Unit,
 * ) {
 *     val currentPageIndex = pagerState.currentPage.coerceAtMost(categories.lastIndex)
 *     PrimaryScrollableTabRow(
 *         selectedTabIndex = currentPageIndex,
 *         edgePadding = 0.dp,
 *     ) {
 *         categories.forEachIndexed { index, category ->
 *             Tab(
 *                 selected = currentPageIndex == index,
 *                 onClick = { onTabItemClick(index) },
 *                 text = {
 *                     TabText(
 *                         text = category.visualName,
 *                         badgeCount = getItemCountForCategory(category),
 *                     )
 *                 },
 *                 unselectedContentColor = MaterialTheme.colorScheme.onSurface,
 *             )
 *         }
 *     }
 * }
 * ```
 *
 * Compose Material 3 `PrimaryScrollableTabRow`:
 * - containerColor: surface (48dp height)
 * - edgePadding: 0.dp (tabs start flush with the container start edge)
 * - divider: HorizontalDivider(thickness = 1.dp, color = outlineVariant)
 * - indicator: TabRowDefaults.PrimaryIndicator(height = 3.dp, shape = RoundedCornerShape(3.dp, 3.dp, 0.dp, 0.dp), color = primary)
 * - tab text: MaterialTheme.typography.titleSmall (14sp / 20sp / Medium / 0.1sp)
 * - unselectedContentColor: onSurface
 * - selectedContentColor: primary
 *
 * `TabText` (`presentation-core/.../core/components/material/Tabs.kt`):
 * - Centred Row with Text(maxLines = 1, overflow = Ellipsis)
 * - Optional Pill with count at 10sp.
 *
 * `Pill` (`presentation-core/.../core/components/Pill.kt`):
 * - Surface(shape = MaterialTheme.shapes.extraLarge = 28dp, color = onBackground.copy(alpha), contentColor = onSurface)
 * - padding(start = 4.dp)
 * - inner Box padded 6dp horizontally / 1dp vertically
 * - pillAlpha = if (isDark) 0.12f else 0.08f
 */
export interface LibraryTabCategory {
  id: number
  /** `Category.visualName` — "Default" for the system category, the category name otherwise. */
  visualName: string
  /** `getItemCountForCategory(category)` — null when the count is not shown. */
  count: number | null
}

const props = defineProps<{
  categories: LibraryTabCategory[]
  /** `pagerState.currentPage`. */
  currentPage: number
}>()

const emit = defineEmits<{ 'update:currentPage': [value: number] }>()

/** `pagerState.currentPage.coerceAtMost(categories.lastIndex)`. */
const selectedIndex = computed(() => {
  if (!props.categories.length) return 0
  return Math.min(Math.max(0, props.currentPage), props.categories.length - 1)
})

const listRef = ref<HTMLElement | null>(null)
const tabRefs = ref<HTMLElement[]>([])

function setTabRef(el: unknown, index: number) {
  if (el instanceof HTMLElement) {
    tabRefs.value[index] = el
  }
}

interface IndicatorStyle {
  transform: string
  width: string
  opacity: string
}

const indicatorStyle = ref<IndicatorStyle>({
  transform: 'translateX(0px)',
  width: '0px',
  opacity: '0',
})

function updateIndicator() {
  const index = selectedIndex.value
  const tab = tabRefs.value[index]
  if (!tab) {
    indicatorStyle.value = {
      transform: 'translateX(0px)',
      width: '0px',
      opacity: '0',
    }
    return
  }
  const label = tab.querySelector<HTMLElement>('.library-tab-label')
  const width = label ? label.offsetWidth : tab.offsetWidth
  const left = label ? tab.offsetLeft + label.offsetLeft : tab.offsetLeft
  indicatorStyle.value = {
    transform: `translateX(${left}px)`,
    width: `${width}px`,
    opacity: '1',
  }
}

/**
 * `PrimaryScrollableTabRow` keeps the selected tab centered in the view:
 * `val scroll = (tabPositions[selectedTabIndex].left + tabPositions[selectedTabIndex].width / 2) - (rowWidth / 2)`
 */
function scrollToSelectedTab(smooth = true) {
  const list = listRef.value
  const index = selectedIndex.value
  const tab = tabRefs.value[index]
  if (!list || !tab) return
  const left = tab.offsetLeft - (list.clientWidth - tab.clientWidth) / 2
  list.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' })
}

function onTabClick(event: MouseEvent, index: number) {
  emit('update:currentPage', index)
  ;(event.currentTarget as HTMLElement | null)?.blur()
}

/**
 * WAI-ARIA tab navigation:
 * ArrowLeft / ArrowRight to switch tabs and focus.
 * Home / End to jump to first / last tab.
 */
function onKeydown(event: KeyboardEvent) {
  if (!props.categories.length) return
  const current = selectedIndex.value
  let next = -1

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = (current + 1) % props.categories.length
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = (current - 1 + props.categories.length) % props.categories.length
  } else if (event.key === 'Home') {
    next = 0
  } else if (event.key === 'End') {
    next = props.categories.length - 1
  }

  if (next >= 0 && next !== current) {
    event.preventDefault()
    emit('update:currentPage', next)
    void nextTick(() => {
      tabRefs.value[next]?.focus()
    })
  }
}

function onResize() {
  updateIndicator()
  scrollToSelectedTab(false)
}

watch(selectedIndex, async () => {
  await nextTick()
  updateIndicator()
  scrollToSelectedTab(true)
})

watch(() => props.categories, async () => {
  await nextTick()
  updateIndicator()
  scrollToSelectedTab(false)
}, { deep: true })

onMounted(async () => {
  await nextTick()
  updateIndicator()
  scrollToSelectedTab(false)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div
    ref="listRef"
    class="library-tabs"
    role="tablist"
    aria-label="Library categories"
    @keydown="onKeydown"
  >
    <div class="library-tabs-track">
      <button
        v-for="(category, index) in categories"
        :key="category.id"
        :ref="(el) => setTabRef(el, index)"
        type="button"
        role="tab"
        class="library-tab"
        :class="{ 'library-tab-selected': index === selectedIndex }"
        :data-selected="index === selectedIndex"
        :aria-selected="index === selectedIndex"
        :tabindex="index === selectedIndex ? 0 : -1"
        @click="onTabClick($event, index)"
      >
        <span class="library-tab-label">
          <span class="library-tab-text">{{ category.visualName }}</span>
          <!-- `TabText`: Pill(text = "$badgeCount", color = onBackground.copy(alpha), fontSize = 10.sp) -->
          <span v-if="category.count !== null" class="library-tab-pill">{{ category.count }}</span>
        </span>
      </button>

      <!--
        Material 3 PrimaryScrollableTabRow PrimaryIndicator:
        3dp height, RoundedCornerShape(3.dp, 3.dp, 0.dp, 0.dp), colorScheme.primary.
        Transitions smoothly across tabs with cubic-bezier easing.
      -->
      <div
        class="library-tab-indicator"
        :style="indicatorStyle"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
/*
 * `PrimaryScrollableTabRow(edgePadding = 0.dp)`:
 * Scrollable row of tabs with 48dp container height, no edge padding,
 * surface background, 1dp outlineVariant bottom divider.
 */
.library-tabs {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 48px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
  -webkit-overflow-scrolling: touch;
  user-select: none;
}
.library-tabs::-webkit-scrollbar {
  display: none;
}

.library-tabs-track {
  position: relative;
  display: flex;
  align-items: stretch;
  min-width: 100%;
  height: 100%;
}

/*
 * Compose Material 3 `Tab`:
 * min-height: 48dp, min-width: 48dp, horizontal padding: 16dp.
 * Typography: titleSmall (14sp / 20sp / 500 / 0.1sp).
 * unselectedContentColor: onSurface
 * selectedContentColor: primary
 */
.library-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 48px;
  height: 48px;
  padding: 0 16px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.15s ease-in-out;
}

/* M3 state layer: hover 8%, active/focus 12% */
.library-tab::before {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
  pointer-events: none;
}
@media (hover: hover) and (pointer: fine) {
  .library-tab:hover::before {
    opacity: 0.08;
  }
}
.library-tab:active::before {
  opacity: 0.12;
}
.library-tab:focus-visible::before {
  opacity: 0.12;
}
.library-tab:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
@media (hover: none) {
  .library-tab:not(:active):not(:focus-visible)::before {
    opacity: 0 !important;
  }
}

.library-tab-selected {
  color: rgb(var(--v-theme-primary));
}

.library-tab-label {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.library-tab-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * Compose M3 TabRowDefaults.PrimaryIndicator:
 * 3dp bar, top corners rounded 3dp, primary color, sits on top of 1dp divider (z-index: 1).
 */
.library-tab-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: rgb(var(--v-theme-primary));
  pointer-events: none;
  z-index: 1;
  transition: transform 250ms cubic-bezier(0.2, 0, 0, 1), width 250ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms ease-in-out;
}

/*
 * `Pill` (Pill.kt + Tabs.kt):
 * Surface(shape = shapes.extraLarge = 28dp, color = onBackground.copy(alpha), contentColor = onSurface)
 * with padding(start = 4.dp), inner box padded 6dp horizontally / 1dp vertically.
 * fontSize = 10.sp, lineHeight = 14px, fontWeight = 500.
 * pillAlpha is 0.12 in dark theme and 0.08 in light theme.
 */
.library-tab-pill {
  --pill-alpha: 0.08;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 28px;
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) calc(var(--pill-alpha) * 100%), transparent);
  color: rgb(var(--v-theme-on-surface));
  font-size: 10px;
  line-height: 14px;
  font-weight: 500;
  letter-spacing: 0.1px;
  white-space: nowrap;
}


}
</style>
