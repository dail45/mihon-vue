<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { t, MR } from '@/core/i18n'

const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisterError(error) {
    console.error('Service worker registration failed:', error)
  },
})

function reload() {
  void updateServiceWorker(true)
}

function close() {
  needRefresh.value = false
}
</script>

<template>
  <v-snackbar
    v-model="needRefresh"
    :timeout="-1"
    location="bottom"
    elevation="3"
    rounded="lg"
    class="pwa-update-snackbar"
    role="alert"
    aria-live="polite"
  >
    <div class="d-flex align-center gap-2">
      <v-icon icon="system_update" color="primary" class="mr-2" />
      <span class="text-body-medium">{{ t(MR.strings.pwa_update_available) || 'New version available' }}</span>
    </div>

    <template #actions>
      <v-btn
        variant="text"
        color="primary"
        class="font-weight-medium text-label-large"
        @click="reload"
      >
        {{ t(MR.strings.pwa_update_reload) || 'Reload' }}
      </v-btn>
      <v-btn
        variant="text"
        color="outline"
        class="text-label-large"
        @click="close"
      >
        {{ t(MR.strings.pwa_update_close) || 'Close' }}
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.pwa-update-snackbar {
  /* Floating above bottom navigation (80px) and safe area on mobile devices */
  margin-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  z-index: 2000;
}

@media (min-width: 960px) {
  .pwa-update-snackbar {
    margin-bottom: 24px;
  }
}
</style>
