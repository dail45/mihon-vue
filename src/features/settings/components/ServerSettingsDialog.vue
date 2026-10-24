<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
const open = defineModel<boolean>({ required: true }), server = useSuwayomiStore()
const address = ref(server.apiUrl), validationError = ref(''), saving = ref(false)
watch(open, value => { if (value) { address.value = server.apiUrl; validationError.value = '' } })
async function save() {
  validationError.value = ''
  try { server.setApiUrl(address.value) } catch (e) { validationError.value = (e as Error).message; return }
  saving.value = true
  await server.loadLibrary()
  saving.value = false
  if (server.libraryError) validationError.value = `Address saved. ${server.libraryError}`
  else open.value = false
}
</script>
<template>
  <v-dialog v-model="open" max-width="520" :persistent="saving">
    <v-card rounded="xl" color="surface-container-high" title="Connect to Suwayomi">
      <v-card-text>
        <p class="mb-6 text-body-medium text-on-surface-variant">All manga data stays on your server. This app only displays it.</p>
        <v-form @submit.prevent="save">
          <v-text-field v-model="address" label="REST API URL" placeholder="http://localhost:4567/api/v1" :error-messages="validationError" :disabled="saving" autocomplete="url" />
          <p class="text-body-medium text-on-surface-variant mt-4">Localhost refers to the device running your browser. For a phone, use your server’s LAN address. HTTPS pages need an HTTPS API or same-origin proxy.</p>
          <v-card-actions class="px-0 mt-4">
            <v-spacer/><v-btn :disabled="saving" @click="open = false">Cancel</v-btn><v-btn color="primary" type="submit" :loading="saving">Save &amp; connect</v-btn>
          </v-card-actions>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
