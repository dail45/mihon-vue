<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    options?: number[]
    selection?: number
    title?: string
  }>(),
  {
    options: () => [],
    selection: 0,
    title: 'Chapters',
  },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'confirm', value: number): void
}>()

const PICKER_HEIGHT = 128
const ROW_COUNT = 3
const ROW_HEIGHT = PICKER_HEIGHT / ROW_COUNT

const wheelSelected = ref(0)
const wheelScrollTop = ref(0)
const wheelEl = ref<HTMLElement | null>(null)
const manualInput = ref(false)
const manualText = ref('')
const manualInputRef = ref<HTMLInputElement | null>(null)

const effectiveOptions = computed<number[]>(() => {
  if (props.options.length > 1) return props.options
  return Array.from({ length: 10001 }, (_, index) => index)
})

const wheelItems = computed<string[]>(() => {
  return effectiveOptions.value.map(value => String(value))
})

function wheelStartIndex(): number {
  const index = effectiveOptions.value.indexOf(props.selection)
  return index >= 0 ? index : 0
}

function scrollWheelTo(index: number) {
  const el = wheelEl.value
  if (el) el.scrollTop = index * ROW_HEIGHT
}

function onWheelScroll() {
  const el = wheelEl.value
  if (!el) return
  wheelScrollTop.value = el.scrollTop
  const index = Math.min(wheelItems.value.length - 1, Math.max(0, Math.round(el.scrollTop / ROW_HEIGHT)))
  if (index !== wheelSelected.value) wheelSelected.value = index
}

function wheelRowAlpha(index: number) {
  const distance = Math.abs(index * ROW_HEIGHT - wheelScrollTop.value)
  return Math.min(1, Math.max(0.2, 1.2 - distance / ROW_HEIGHT))
}

function selectWheelIndex(index: number) {
  const next = Math.min(wheelItems.value.length - 1, Math.max(0, index))
  wheelSelected.value = next
  scrollWheelTo(next)
}

function onWheelKeydown(event: KeyboardEvent) {
  const keys: Record<string, number> = {
    ArrowUp: wheelSelected.value - 1,
    ArrowDown: wheelSelected.value + 1,
    PageUp: wheelSelected.value - 5,
    PageDown: wheelSelected.value + 5,
    Home: 0,
    End: wheelItems.value.length - 1,
  }
  const target = keys[event.key]
  if (target == null) return
  event.preventDefault()
  selectWheelIndex(target)
}

function onWheelScrollEnd() {
  selectWheelIndex(Math.round(wheelScrollTop.value / ROW_HEIGHT))
}

function openManualInput() {
  manualText.value = wheelItems.value[wheelSelected.value] ?? ''
  manualInput.value = true
  nextTick(() => {
    manualInputRef.value?.focus()
    manualInputRef.value?.select()
  })
}

function commitManualInput() {
  const index = wheelItems.value.indexOf(manualText.value.trim())
  if (index >= 0) {
    selectWheelIndex(index)
  }
  manualInput.value = false
}

watch(() => props.open, async isOpen => {
  if (isOpen) {
    manualInput.value = false
    wheelSelected.value = wheelStartIndex()
    wheelScrollTop.value = wheelSelected.value * ROW_HEIGHT
    await nextTick()
    scrollWheelTo(wheelSelected.value)
  }
})

function confirm() {
  const value = Number(wheelItems.value[wheelSelected.value] ?? props.selection)
  emit('confirm', value)
  emit('update:open', false)
}

function cancel() {
  emit('update:open', false)
}
</script>

<template>
  <v-dialog :model-value="open" width="320" max-width="560" :aria-label="title" @update:model-value="emit('update:open', $event)">
    <v-card class="track-dialog" rounded="28px" color="surface-container-high">
      <h2 class="track-dialog-title">{{ title }}</h2>

      <div class="track-dialog-text track-wheel-wrap">
        <div class="track-wheel">
          <div class="track-wheel-band" aria-hidden="true" />
          <input
            v-if="manualInput"
            ref="manualInputRef"
            v-model="manualText"
            class="track-wheel-input"
            type="number"
            inputmode="numeric"
            :aria-label="title"
            @keydown.enter.prevent="commitManualInput"
            @keydown.esc.prevent="manualInput = false"
            @blur="commitManualInput"
          >
          <ul
            v-else
            ref="wheelEl"
            class="track-wheel-list"
            role="listbox"
            tabindex="0"
            :aria-activedescendant="`track-wheel-option-${wheelSelected}`"
            :aria-label="title"
            @scroll.passive="onWheelScroll"
            @scrollend="onWheelScrollEnd"
            @keydown="onWheelKeydown"
            @click="openManualInput"
          >
            <li
              v-for="(item, index) in wheelItems"
              :id="`track-wheel-option-${index}`"
              :key="index"
              class="track-wheel-item"
              role="option"
              :aria-selected="index === wheelSelected"
              :style="{ opacity: wheelRowAlpha(index) }"
            >
              {{ item }}
            </li>
          </ul>
        </div>
      </div>

      <div class="track-dialog-actions">
        <button type="button" class="track-dialog-button" @click="cancel">Cancel</button>
        <button type="button" class="track-dialog-button" @click="confirm">OK</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.track-dialog {
  border-radius: 28px !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15) !important;
  padding: 0;
  min-width: 280px;
  max-width: 560px;
  width: 100%;
  background-color: rgb(var(--v-theme-surface-container-high)) !important;
  color: rgb(var(--v-theme-on-surface));
}
.track-dialog-title {
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  margin: 24px 24px 16px;
}
.track-dialog-text {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0 24px 24px;
}
.track-wheel-wrap { display: flex; justify-content: center; }
.track-wheel { position: relative; width: 128px; height: 128px; }
.track-wheel-band {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 42.6667px;
  transform: translateY(-50%);
  border-radius: 16px;
  background: rgba(var(--v-theme-primary), 0.2);
  border: 1px solid rgb(var(--v-theme-primary));
  pointer-events: none;
}
.track-wheel-list {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 42.6667px 0;
  list-style: none;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
  scrollbar-width: none;
  cursor: pointer;
}
.track-wheel-list::-webkit-scrollbar { display: none; }
.track-wheel-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42.6667px;
  scroll-snap-align: center;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.009375em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.track-wheel-input::-webkit-outer-spin-button,
.track-wheel-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.track-wheel-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  text-align: center;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  caret-color: rgb(var(--v-theme-primary));
  -moz-appearance: textfield;
  appearance: textfield;
}
.track-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin: 0 24px 24px;
}
.track-dialog-button {
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
.track-dialog-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.track-dialog-button:hover::after { opacity: 0.08; }
.track-dialog-button:active::after { opacity: 0.12; }
.track-dialog-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
