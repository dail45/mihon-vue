<script setup lang="ts">
/**
 * Extension stores screen.
 *
 * Implements the Container/Panel pattern:
 * Serves as the routed page scaffold with the top app bar and wraps `ExtensionStoresPanel.vue`.
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ExtensionStoresPanel from '@/features/browse/components/ExtensionStoresPanel.vue'

const router = useRouter()
const route = useRoute()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const panelRef = ref<InstanceType<typeof ExtensionStoresPanel> | null>(null)

function goBack() {
  if (route.query.from === 'settings') {
    void router.push('/settings/browse')
    return
  }
  const backState = typeof window.history.state?.back === 'string' ? window.history.state.back : ''
  if (backState.startsWith('/settings')) {
    void router.push('/settings/browse')
    return
  }
  if (backState) {
    router.back()
    return
  }
  void router.push('/browse')
}

defineExpose({
  onRefresh: () => panelRef.value?.onRefresh(),
  refreshing: panelRef.value?.refreshing,
})
</script>

<template>
  <div class="extension-stores" :class="{ 'extension-stores--embedded': embedded }">
    <v-app-bar v-if="!embedded" flat height="64" color="surface" class="stores-toolbar">
      <v-btn icon="arrow_back" aria-label="Back" @click="goBack" />
      <v-app-bar-title class="text-title-large font-weight-regular">Extension stores</v-app-bar-title>
      <v-btn
        icon="refresh"
        variant="text"
        aria-label="Refresh"
        :class="{ 'is-refreshing': panelRef?.refreshing }"
        @click="panelRef?.onRefresh()"
      />
    </v-app-bar>

    <ExtensionStoresPanel ref="panelRef" />
  </div>
</template>

<style scoped>
@layer app-components {
.extension-stores {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: rgb(var(--v-theme-surface));
}

.extension-stores--embedded {
  min-height: auto;
  background: transparent;
}

.stores-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
}

.is-refreshing {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
}
</style>
