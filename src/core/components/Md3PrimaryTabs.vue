<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface Md3TabItem<V = string | number> {
  value: V
  label: string
  badge?: number | string | null
  badgeColor?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: T
    items: Md3TabItem<T>[]
    ariaLabel?: string
    scrollable?: boolean
    flat?: boolean
    transparent?: boolean
    tabClass?: string
    labelClass?: string
  }>(),
  {
    ariaLabel: 'Navigation tabs',
    scrollable: true,
    flat: false,
    transparent: false,
    tabClass: '',
    labelClass: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: T]
  'tab-click': [item: Md3TabItem<T>, index: number]
}>()

const selectedIndex = computed(() => {
  const index = props.items.findIndex(item => item.value === props.modelValue)
  return index < 0 ? 0 : index
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

function updateIndicator(targetIndex = selectedIndex.value) {
  const index = targetIndex
  const tab = tabRefs.value[index]
  if (!tab) {
    indicatorStyle.value = {
      transform: 'translateX(0px)',
      width: '0px',
      opacity: '0',
    }
    return
  }
  const label = tab.querySelector<HTMLElement>('.library-tab-label') || tab.querySelector<HTMLElement>('.md3-tab-label')
  const width = label ? label.offsetWidth : tab.offsetWidth
  const left = label ? tab.offsetLeft + label.offsetLeft : tab.offsetLeft
  indicatorStyle.value = {
    transform: `translateX(${left}px)`,
    width: `${width}px`,
    opacity: '1',
  }
}

function scrollToSelectedTab(smooth = true) {
  if (!props.scrollable) return
  const list = listRef.value
  const index = selectedIndex.value
  const tab = tabRefs.value[index]
  if (!list || !tab) return
  const left = tab.offsetLeft - (list.clientWidth - tab.clientWidth) / 2
  list.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' })
}

function onTabClick(event: MouseEvent, item: Md3TabItem<T>, index: number) {
  updateIndicator(index)
  emit('update:modelValue', item.value)
  emit('tab-click', item, index)
  ;(event.currentTarget as HTMLElement | null)?.blur()
}

function onKeydown(event: KeyboardEvent) {
  if (!props.items.length) return
  const current = selectedIndex.value
  let next = -1

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = (current + 1) % props.items.length
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = (current - 1 + props.items.length) % props.items.length
  } else if (event.key === 'Home') {
    next = 0
  } else if (event.key === 'End') {
    next = props.items.length - 1
  }

  if (next >= 0 && next !== current) {
    event.preventDefault()
    const targetItem = props.items[next]
    if (targetItem) {
      updateIndicator(next)
      emit('update:modelValue', targetItem.value)
      emit('tab-click', targetItem, next)
      void nextTick(() => {
        tabRefs.value[next]?.focus()
      })
    }
  }
}

let resizeObserver: ResizeObserver | null = null

function onResize() {
  updateIndicator()
  scrollToSelectedTab(false)
}

watch(selectedIndex, (newIndex) => {
  updateIndicator(newIndex)
  scrollToSelectedTab(true)
})

watch(() => props.items, async () => {
  tabRefs.value = tabRefs.value.slice(0, props.items.length)
  await nextTick()
  updateIndicator()
  scrollToSelectedTab(false)
}, { deep: true })

watch(() => props.scrollable, async () => {
  await nextTick()
  updateIndicator()
  scrollToSelectedTab(false)
})

onMounted(async () => {
  await nextTick()
  updateIndicator()
  scrollToSelectedTab(false)
  window.addEventListener('resize', onResize)
  if (typeof ResizeObserver !== 'undefined' && listRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateIndicator()
    })
    resizeObserver.observe(listRef.value)
  }
  if (typeof document !== 'undefined' && 'fonts' in document) {
    void document.fonts.ready.then(() => {
      updateIndicator()
    })
  }
  if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
    requestAnimationFrame(() => {
      updateIndicator()
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div
    ref="listRef"
    class="md3-primary-tabs library-tabs"
    :class="{
      'md3-primary-tabs--scrollable': scrollable,
      'md3-primary-tabs--flat': flat,
      'md3-primary-tabs--transparent': transparent,
    }"
    role="tablist"
    :aria-label="ariaLabel"
    @keydown="onKeydown"
  >
    <div class="md3-primary-tabs-track library-tabs-track">
      <button
        v-for="(item, index) in items"
        :key="String(item.value)"
        :ref="(el) => setTabRef(el, index)"
        type="button"
        role="tab"
        class="md3-primary-tab library-tab"
        :class="[
          {
            'md3-primary-tab--selected': item.value === modelValue,
            'library-tab-selected': item.value === modelValue,
            'v-tab--selected': item.value === modelValue,
          },
          tabClass,
        ]"
        :data-selected="item.value === modelValue"
        :aria-selected="item.value === modelValue"
        :tabindex="item.value === modelValue ? 0 : -1"
        @click="onTabClick($event, item, index)"
      >
        <span
          class="md3-tab-label library-tab-label"
          :class="labelClass"
        >
          <span class="md3-tab-text library-tab-text">{{ item.label }}</span>
          <span
            v-if="item.badge !== undefined && item.badge !== null && item.badge !== '' && item.badge !== 0"
            class="md3-tab-pill library-tab-pill tab-badge"
            :style="item.badgeColor ? { backgroundColor: item.badgeColor } : undefined"
          >
            {{ item.badge }}
          </span>
        </span>
      </button>

      <!-- Animated MD3 Active Indicator -->
      <div
        class="md3-primary-tab-indicator library-tab-indicator"
        :style="indicatorStyle"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
.md3-primary-tabs,
.library-tabs {
  position: relative;
  display: flex;
  width: 100%;
  height: 48px;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
}

.md3-primary-tabs::-webkit-scrollbar,
.library-tabs::-webkit-scrollbar {
  display: none;
}

.md3-primary-tabs-track,
.library-tabs-track {
  position: relative;
  display: inline-flex;
  min-width: 100%;
  height: 100%;
  align-items: stretch;
}

.md3-primary-tab,
.library-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
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
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  box-sizing: border-box;
  outline: none;
  transition: color 150ms ease-in-out;
}

.md3-primary-tab::before,
.library-tab::before {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-in-out;
}

@media (hover: hover) and (pointer: fine) {
  .md3-primary-tab:hover::before,
  .library-tab:hover::before {
    opacity: 0.08;
  }
}

.md3-primary-tab:active::before,
.library-tab:active::before {
  opacity: 0.12;
}

.md3-primary-tab:focus-visible::before,
.library-tab:focus-visible::before {
  opacity: 0.12;
}

@media (hover: none) {
  .md3-primary-tab:not(:active):not(:focus-visible)::before,
  .library-tab:not(:active):not(:focus-visible)::before {
    opacity: 0 !important;
  }
}

.md3-primary-tab--selected,
.library-tab-selected {
  color: rgb(var(--v-theme-primary));
}

.md3-tab-label,
.library-tab-label {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.md3-tab-text,
.library-tab-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Scrollable Mode: tabs expand to full label width, never truncate into ellipses */
.md3-primary-tabs.md3-primary-tabs--scrollable,
.library-tabs.md3-primary-tabs--scrollable {
  overflow-x: auto;
  overflow-y: hidden;
}

.md3-primary-tabs--scrollable .md3-primary-tabs-track,
.md3-primary-tabs--scrollable .library-tabs-track {
  display: inline-flex;
  width: max-content;
  min-width: 100%;
}

.md3-primary-tabs--scrollable .md3-primary-tab,
.md3-primary-tabs--scrollable .library-tab {
  flex: 0 0 auto !important;
  width: max-content !important;
  white-space: nowrap !important;
  min-width: auto;
  padding: 0 16px;
}

.md3-primary-tabs--scrollable .md3-tab-label,
.md3-primary-tabs--scrollable .library-tab-label {
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
}

.md3-primary-tabs--scrollable .md3-tab-text,
.md3-primary-tabs--scrollable .library-tab-text {
  white-space: nowrap !important;
  overflow: visible !important;
  text-overflow: clip !important;
}

/* Non-scrollable Mode: compact / equal-width distribution, truncates with ellipsis if narrow */
.md3-primary-tabs:not(.md3-primary-tabs--scrollable),
.library-tabs:not(.md3-primary-tabs--scrollable) {
  overflow-x: hidden;
}

.md3-primary-tabs:not(.md3-primary-tabs--scrollable) .md3-primary-tabs-track,
.library-tabs:not(.md3-primary-tabs--scrollable) .library-tabs-track {
  display: flex;
  width: 100%;
  min-width: 100%;
}

.md3-primary-tabs:not(.md3-primary-tabs--scrollable) .md3-primary-tab,
.library-tabs:not(.md3-primary-tabs--scrollable) .library-tab {
  flex: 1 1 0;
  min-width: 0;
  padding: 0 16px;
}

.md3-primary-tabs:not(.md3-primary-tabs--scrollable) .md3-tab-label,
.library-tabs:not(.md3-primary-tabs--scrollable) .library-tab-label {
  min-width: 0;
  max-width: 100%;
}

.md3-primary-tabs:not(.md3-primary-tabs--scrollable) .md3-tab-text,
.library-tabs:not(.md3-primary-tabs--scrollable) .library-tab-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.md3-primary-tabs--flat,
.library-tabs.md3-primary-tabs--flat {
  border-bottom: 0 !important;
}

.md3-primary-tabs--transparent,
.library-tabs.md3-primary-tabs--transparent {
  background: transparent !important;
}

.settings-tab-label {
  position: relative;
}

.v-tab--selected .settings-tab-label::after {
  content: '';
  position: absolute;
  height: 3px;
  width: calc(100% - 4px);
  left: 2px;
  bottom: 0;
  background: transparent;
  pointer-events: none;
}

.md3-primary-tab-indicator,
.library-tab-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: rgb(var(--v-theme-primary));
  pointer-events: none;
  z-index: 1;
  transition: transform 250ms cubic-bezier(0.2, 0, 0, 1),
              width 250ms cubic-bezier(0.2, 0, 0, 1),
              opacity 150ms ease-in-out;
  will-change: transform, width;
}

.md3-tab-pill,
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
