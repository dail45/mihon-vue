<script setup lang="ts">
import { ref } from 'vue'
import { VDialog, VBottomSheet } from 'vuetify/components'
import { useTabletUi } from '../composables/useTabletUi'
defineProps<{ title: string; tabs: string[]; cardClass?: string; flatTabs?: boolean }>()
const opened = defineModel<boolean>({ required: true }), tab = defineModel<string>('tab', { required: true })
const tablet = useTabletUi(), dragStart = ref<number | null>(null)
function endDrag(e: TouchEvent) {
  if (!tablet.value && dragStart.value !== null && e.changedTouches[0]!.clientY - dragStart.value > 72) opened.value = false
  dragStart.value = null
}
</script>
<template>
  <component :is="tablet ? VDialog : VBottomSheet" v-model="opened" max-width="460" :aria-label="title" scrollable>
    <v-card class="adaptive-settings-card" :class="[{ 'mobile-settings-card': !tablet }, cardClass]" color="surface-container-high" flat rounded="xxl">
      <h2 class="sr-only">{{ title }}</h2>
      <div class="settings-tab-header" :class="{ 'settings-tab-header--flat': flatTabs }" @touchstart="dragStart = $event.touches[0]!.clientY" @touchend="endDrag">
        <v-tabs v-model="tab" class="settings-primary-tabs" grow color="primary" height="48" :aria-label="`${title} sections`"><v-tab v-for="name in tabs" :key="name" :value="name.toLowerCase()" hide-slider><span class="settings-tab-label">{{ name }}</span></v-tab></v-tabs>
        <slot name="overflow" />
      </div>
      <div class="settings-scroll"><slot /></div>
    </v-card>
  </component>
</template>
<style scoped>
@layer app-components {
.settings-tab-header { display: flex; align-items: center; flex-shrink: 0; border-bottom: 1px solid rgb(var(--v-theme-outline-variant)); }
/* PrimaryTabRow (TabbedDialog.kt) draws no divider line under the tab row. */
.settings-tab-header--flat { border-bottom: 0; }
.settings-primary-tabs { flex: 1; min-width: 0; }
.settings-primary-tabs :deep(.v-tab) { min-width: 0; color: rgb(var(--v-theme-on-surface)); }
.settings-primary-tabs :deep(.v-tab--selected) { color: rgb(var(--v-theme-primary)); }
.settings-tab-label { position: relative; display: inline-block; }
.settings-primary-tabs :deep(.v-tab--selected) .settings-tab-label::after { content: ''; position: absolute; height: 3px; min-width: 24px; width: calc(100% - 4px); left: 50%; transform: translateX(-50%); bottom: -14px; background: rgb(var(--v-theme-primary)); border-radius: 3px 3px 0 0; }
:deep(.v-bottom-sheet__content) { display: flex; justify-content: center; }
@media (hover: none) {
  .settings-primary-tabs :deep(.v-tab:not(:active):not(:focus-visible) .v-btn__overlay) {
    opacity: 0 !important;
  }
}
/* PrimaryTabRow draws its indicator across the full tab width. */
.settings-tab-header--flat .settings-primary-tabs :deep(.v-tab--selected) .settings-tab-label::after { width: 100%; min-width: 0; }
.settings-scroll { scrollbar-width: none; }
.settings-scroll::-webkit-scrollbar { display: none; }
}
</style>
