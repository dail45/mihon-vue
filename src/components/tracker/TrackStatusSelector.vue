<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

export interface TrackStatusOption {
  key: number
  label: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    options?: TrackStatusOption[]
    selection?: number | null
    title?: string
  }>(),
  {
    options: () => [],
    selection: null,
    title: 'Status',
  },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'confirm', value: number): void
}>()

const statusSelected = ref<number | null>(null)
const statusList = ref<HTMLElement | null>(null)
const statusScrollable = ref({ top: false, bottom: false })
const statusThumb = ref({ top: 0, height: 0, visible: false })

function onStatusScroll() {
  const el = statusList.value
  if (!el) return
  const scrollable = el.scrollHeight > el.clientHeight + 1
  statusScrollable.value = {
    top: el.scrollTop > 0,
    bottom: scrollable && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
  }
  const viewport = el.clientHeight
  const total = el.scrollHeight
  statusThumb.value = {
    top: scrollable ? (el.scrollTop / Math.max(1, total - viewport)) * (viewport - (viewport / total) * viewport) : 0,
    height: (viewport / Math.max(1, total)) * viewport,
    visible: scrollable,
  }
}

function selectStatus(key: number) {
  statusSelected.value = key
}

watch(() => props.open, async isOpen => {
  if (isOpen) {
    statusSelected.value = props.selection ?? null
    await nextTick()
    onStatusScroll()
  }
})

function confirm() {
  if (statusSelected.value != null) {
    emit('confirm', statusSelected.value)
  }
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

      <div class="track-dialog-text track-status">
        <div class="track-status-list" ref="statusList" role="radiogroup" :aria-label="title" @scroll.passive="onStatusScroll">
          <button
            v-for="option in options"
            :key="option.key"
            type="button"
            class="track-status-row"
            role="radio"
            :aria-checked="statusSelected === option.key"
            @click="selectStatus(option.key)"
          >
            <span class="track-radio" :class="{ 'is-selected': statusSelected === option.key }">
              <span v-if="statusSelected === option.key" class="track-radio-dot" />
            </span>
            <span class="track-status-label">{{ option.label }}</span>
          </button>
        </div>
        <div v-if="statusScrollable.top" class="track-divider track-divider-top" aria-hidden="true" />
        <div v-if="statusScrollable.bottom" class="track-divider track-divider-bottom" aria-hidden="true" />
        <div
          v-if="statusThumb.visible"
          class="track-status-thumb"
          aria-hidden="true"
          :style="{ top: `${statusThumb.top}px`, height: `${statusThumb.height}px` }"
        />
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
.track-status { position: relative; }
.track-status-list {
  max-height: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.track-status-list::-webkit-scrollbar { display: none; }
.track-status-thumb {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  border-radius: 2px;
  background: rgb(var(--v-theme-on-surface) / 0.364);
  pointer-events: none;
}
.track-status-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-family: var(--v-font-body, Roboto, sans-serif);
  text-align: left;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
}
.track-status-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 6%, transparent); }
.track-status-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.track-radio {
  position: relative;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.track-radio::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
}
.track-radio.is-selected::before { border-color: rgb(var(--v-theme-primary)); }
.track-radio-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}
.track-status-label {
  margin-left: 24px;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.track-divider {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
  pointer-events: none;
}
.track-divider-top { top: 0; }
.track-divider-bottom { bottom: 0; }
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
