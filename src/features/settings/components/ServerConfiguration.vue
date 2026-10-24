<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { readServerSettings, saveServerSettings, serverSettingFields, validateServerSettings, type ServerSettings } from '@/core/api/serverSettings'
const props = defineProps<{ apiUrl: string }>()
const values = ref<ServerSettings | null>(null), original = ref<ServerSettings | null>(null), loading = ref(false), saving = ref(false), error = ref(''), message = ref(''), confirm = ref(false)
let generation = 0
watch(() => props.apiUrl, () => { generation++; loading.value = false; saving.value = false; confirm.value = false; values.value = null; original.value = null; error.value = ''; message.value = '' })
const changes = computed(() => Object.fromEntries(Object.entries(values.value || {}).filter(([k, v]) => v !== original.value?.[k])))
async function load() {
  const own = ++generation, url = props.apiUrl; loading.value = true; error.value = ''; message.value = ''
  try { const data = await readServerSettings(url); if (own === generation) { original.value = data; values.value = { ...data } } }
  catch (e) { if (own === generation) error.value = e instanceof Error ? e.message : 'Could not read server settings.' }
  finally { if (own === generation) loading.value = false }
}
async function save() {
  if (!values.value || saving.value) return
  confirm.value = false; error.value = ''; message.value = ''
  try { validateServerSettings(values.value) } catch (e) { error.value = String(e); return }
  const own = ++generation, url = props.apiUrl, patch = { ...changes.value }; saving.value = true
  try { const data = await saveServerSettings(url, patch); if (own === generation) { original.value = data; values.value = { ...data }; message.value = 'Server settings saved and returned by the server.' } }
  catch { if (own === generation) error.value = 'Save was not confirmed. Reload server settings before retrying; the request may have reached the server.' }
  finally { if (own === generation) saving.value = false }
}
</script>
<template>
  <h2 class="settings-heading">Server configuration</h2>
  <p class="settings-note">These settings belong to Suwayomi, not this browser. Edits are drafts until you confirm Save. Only download and library-update options are exposed; credentials and networking configuration are never fetched.</p>
  <div class="px-6 py-2"><v-btn variant="tonal" color="primary" :loading="loading" :disabled="saving" @click="load">{{ values ? 'Reload server settings' : 'Load server settings' }}</v-btn></div>
  <v-alert v-if="error" role="alert" type="error" variant="tonal" class="ma-6">{{ error }}</v-alert><p v-if="message" role="status" class="settings-note">{{ message }}</p>
  <template v-if="values"><template v-for="group in ['Downloads', 'Library updates']" :key="group"><h3 class="settings-heading">{{ group }}</h3><template v-for="field in serverSettingFields.filter(f => f.group === group)" :key="field.key"><v-switch v-if="field.type === 'boolean'" v-model="values[field.key]" :label="field.title" :disabled="saving" color="primary" hide-details class="px-6" /><v-text-field v-else :model-value="values[field.key]" :label="field.title" type="number" :min="field.min" :step="field.type === 'integer' ? 1 : 'any'" :disabled="saving" class="mx-6 my-3" hide-details @update:model-value="values[field.key] = Number($event)" /></template></template>
  <div class="px-6 py-4 d-flex ga-2"><v-btn :disabled="saving || !Object.keys(changes).length" @click="values = { ...original! }">Discard changes</v-btn><v-btn color="primary" :loading="saving" :disabled="loading || !!error || !Object.keys(changes).length" @click="confirm = true">Save</v-btn></div></template>
  <v-dialog v-model="confirm" max-width="460" aria-label="Save server settings"><v-card rounded="xl" title="Save server settings?"><v-card-text>This affects Suwayomi's download or update jobs, and may affect other clients. {{ Object.keys(changes).length }} setting(s) will be changed.</v-card-text><v-card-actions><v-spacer /><v-btn @click="confirm = false">Cancel</v-btn><v-btn color="primary" @click="save">Save to server</v-btn></v-card-actions></v-card></v-dialog>
</template>
