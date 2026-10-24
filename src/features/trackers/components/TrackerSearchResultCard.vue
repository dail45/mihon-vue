<script setup lang="ts">
import { ref } from 'vue'
import type { TrackerSearchResult } from '@/core/api/trackers'

const props = defineProps<{
  item: TrackerSearchResult
  selected: boolean
  isMenuOpen: boolean
}>()

const emit = defineEmits<{
  (event: 'select', item: TrackerSearchResult): void
  (event: 'toggleMenu', id: number): void
  (event: 'copyTitle', item: TrackerSearchResult): void
  (event: 'openBrowser', item: TrackerSearchResult): void
}>()

const coverBroken = ref(false)
let longPressTimer: ReturnType<typeof setTimeout> | undefined

function startLongPress() {
  cancelLongPress()
  longPressTimer = setTimeout(() => {
    emit('toggleMenu', props.item.id)
  }, 500)
}

function cancelLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
}

function capitalize(value: string): string {
  if (!value) return ''
  const lower = value.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function publishingType(item: TrackerSearchResult): string {
  return capitalize(item.publishingType || '')
}

function publishingStatus(item: TrackerSearchResult): string {
  return capitalize(item.publishingStatus || '')
}

function authorsArtists(item: TrackerSearchResult): string {
  const list = [...(item.authors ?? []), ...(item.artists ?? [])].filter(Boolean)
  return Array.from(new Set(list)).join(', ')
}

function description(item: TrackerSearchResult): string {
  return item.summary?.trim() || ''
}
</script>

<template>
  <div
    class="ts__card"
    :class="{ 'ts__card--selected': selected }"
    role="button"
    tabindex="0"
    @click="emit('select', item)"
    @keydown.enter="emit('select', item)"
    @keydown.space.prevent="emit('select', item)"
    @contextmenu.prevent="emit('toggleMenu', item.id)"
    @pointerdown="startLongPress"
    @pointerup="cancelLongPress"
    @pointerleave="cancelLongPress"
    @pointercancel="cancelLongPress"
  >
    <span
      v-if="selected"
      class="material-symbols-rounded ts__check"
      aria-hidden="true"
    >check_circle</span>

    <button
      v-else
      type="button"
      class="ts__more-btn"
      aria-label="More options"
      @click.stop="emit('toggleMenu', item.id)"
    >
      <span class="material-symbols-rounded ts__more-icon" aria-hidden="true">more_vert</span>
    </button>

    <div class="ts__card-column">
      <div class="ts__card-row">
        <img
          v-if="item.coverUrl && !coverBroken"
          class="ts__cover"
          :src="item.coverUrl"
          :alt="item.title"
          loading="lazy"
          @error="coverBroken = true"
        />
        <div v-else class="ts__cover ts__cover--placeholder" aria-hidden="true" />

        <div class="ts__cover-gap" />

        <div class="ts__info">
          <p class="ts__title">{{ item.title }}</p>
          <p v-if="authorsArtists(item)" class="ts__authors">{{ authorsArtists(item) }}</p>

          <div v-if="publishingType(item)" class="ts__details">
            <span class="ts__details-title">Type</span>
            <span class="ts__details-text">{{ publishingType(item) }}</span>
          </div>
          <div v-if="item.startDate" class="ts__details">
            <span class="ts__details-title">Started</span>
            <span class="ts__details-text">{{ item.startDate }}</span>
          </div>
          <div v-if="publishingStatus(item)" class="ts__details">
            <span class="ts__details-title">Status</span>
            <span class="ts__details-text">{{ publishingStatus(item) }}</span>
          </div>
          <div v-if="item.score !== undefined && item.score !== null && item.score !== -1" class="ts__details">
            <span class="ts__details-title">Score</span>
            <span class="ts__details-text">{{ item.score }}</span>
          </div>
        </div>
      </div>

      <p v-if="description(item)" class="ts__description">{{ description(item) }}</p>
    </div>

    <div v-if="isMenuOpen" class="ts__menu" role="menu">
      <button type="button" class="ts__menu-item" role="menuitem" @click.stop="emit('copyTitle', item)">
        Copy to clipboard
      </button>
      <button
        type="button"
        class="ts__menu-item"
        role="menuitem"
        @click.stop="emit('openBrowser', item)"
      >
        Open in browser
      </button>
    </div>
  </div>
</template>

<style scoped>
.ts__card {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  border-radius: 16px;
  background-color: rgb(var(--v-theme-surface));
  border: 2px solid transparent;
  padding: 12px;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.ts__card:hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, rgb(var(--v-theme-surface)));
}

.ts__card--selected {
  border-color: rgb(var(--v-theme-outline));
}

.ts__card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.ts__check {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  color: rgb(var(--v-theme-primary));
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  pointer-events: none;
}

.ts__more-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.78;
}

.ts__more-btn:hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.ts__more-icon {
  font-size: 20px;
}

.ts__card-column {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.ts__card-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  width: 100%;
}

.ts__cover {
  flex: 0 0 auto;
  width: 64px;
  height: 96px;
  border-radius: 4px;
  object-fit: cover;
  background-color: rgb(var(--v-theme-surface-container-highest));
}

.ts__cover--placeholder {
  display: block;
}

.ts__cover-gap {
  flex: 0 0 auto;
  width: 12px;
}

.ts__info {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}

.ts__title {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-surface));
  padding-right: 28px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ts__authors {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.78;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ts__details {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 4px;
  margin-top: 2px;
}

.ts__details-title {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.78;
}

.ts__details-text {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.78;
}

.ts__description {
  margin: 24px 0 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.78;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ts__menu {
  position: absolute;
  top: 40px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 8px 0;
  border-radius: 4px;
  background-color: rgb(var(--v-theme-surface-container));
  box-shadow: 0 2px 6px 2px rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
}

.ts__menu-item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface));
  text-align: left;
  cursor: pointer;
}

.ts__menu-item:hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
</style>
