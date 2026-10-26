<script setup lang="ts">
import { computed, ref } from 'vue'
import { VDialog, VBottomSheet } from 'vuetify/components'
import { useTabletUi } from '@/core/composables/useTabletUi'
import Md3PrimaryTabs, { type Md3TabItem } from '@/core/components/Md3PrimaryTabs.vue'

const props = defineProps<{
  title: string
  tabs: (string | { value: string; label: string })[]
  cardClass?: string
  flatTabs?: boolean
}>()

const opened = defineModel<boolean>({ required: true })
const tab = defineModel<string>('tab', { required: true })
const tablet = useTabletUi()
const dragStart = ref<number | null>(null)

function endDrag(e: TouchEvent) {
  if (!tablet.value && dragStart.value !== null && e.changedTouches[0]!.clientY - dragStart.value > 72) {
    opened.value = false
  }
  dragStart.value = null
}

const tabItems = computed<Md3TabItem<string>[]>(() => {
  return props.tabs.map(item => {
    if (typeof item === 'string') {
      return {
        value: item.toLowerCase(),
        label: item,
      }
    }
    return {
      value: item.value,
      label: item.label,
    }
  })
})
</script>

<template>
  <component :is="tablet ? VDialog : VBottomSheet" v-model="opened" max-width="460" :aria-label="title" scrollable>
    <v-card class="adaptive-settings-card" :class="[{ 'mobile-settings-card': !tablet }, cardClass]" color="surface-container-high" flat rounded="xxl">
      <h2 class="sr-only">{{ title }}</h2>
      <div
        class="settings-tab-header"
        :class="{ 'settings-tab-header--flat': flatTabs }"
        @touchstart="dragStart = $event.touches[0]!.clientY"
        @touchend="endDrag"
      >
        <Md3PrimaryTabs
          v-model="tab"
          :items="tabItems"
          :scrollable="false"
          :aria-label="`${title} sections`"
          :flat="flatTabs"
          transparent
          class="settings-primary-tabs"
          tab-class="settings-tab"
          label-class="settings-tab-label"
        />
        <slot name="overflow" />
      </div>
      <div class="settings-scroll"><slot /></div>
    </v-card>
  </component>
</template>

<style scoped>
@layer app-components {
.settings-tab-header {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}
/* PrimaryTabRow (TabbedDialog.kt) draws no divider line under the tab row. */
.settings-tab-header--flat {
  border-bottom: 0;
}
.settings-primary-tabs {
  flex: 1;
  min-width: 0;
}
:deep(.v-bottom-sheet__content) {
  display: flex;
  justify-content: center;
}
.settings-scroll {
  scrollbar-width: none;
}
.settings-scroll::-webkit-scrollbar {
  display: none;
}
}
</style>
