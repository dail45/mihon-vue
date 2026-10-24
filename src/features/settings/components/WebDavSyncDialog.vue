<script setup lang="ts">
/**
 * WebDavSyncDialog.vue
 *
 * Remote WebDAV backup restore browser.
 * Queries remote directory for available backup snapshots, allows inspecting dates and file sizes,
 * and handles restoring client state.
 *
 * Reference: komikku/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsDataScreen.kt
 */
import { ref, watch, computed } from 'vue'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import {
  listWebDavBackups,
  downloadWebDavBackup,
  type WebDavBackupItem,
} from '../services/webdavSync'
import { stringResource, MR } from '@/core/i18n'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'restored'): void
}>()

const prefs = usePreferencesStore()

const loading = ref(false)
const restoring = ref(false)
const error = ref<string | null>(null)
const backups = ref<WebDavBackupItem[]>([])
const selectedHref = ref<string>('')
const confirmDialogOpen = ref(false)

const isConfigured = computed(() => {
  return !!prefs.webdavUrl && prefs.webdavUrl.startsWith('http')
})

const selectedBackup = computed(() => {
  return backups.value.find(b => b.href === selectedHref.value) || null
})

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)
  return `${size} ${units[i]}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return dateStr
  }
}

async function loadBackups() {
  if (!isConfigured.value) {
    error.value = stringResource(MR.strings.pref_webdav_not_configured) || 'WebDAV URL and credentials must be configured first'
    return
  }

  loading.value = true
  error.value = null

  try {
    const list = await listWebDavBackups(
      prefs.webdavUrl,
      prefs.webdavFolder,
      prefs.webdavUsername,
      prefs.webdavPassword
    )
    backups.value = list
    if (list.length > 0 && !selectedHref.value) {
      selectedHref.value = list[0].href
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : String(err)
    backups.value = []
  } finally {
    loading.value = false
  }
}

function handleSelect(item: WebDavBackupItem) {
  selectedHref.value = item.href
}

function promptRestore() {
  if (!selectedHref.value) return
  confirmDialogOpen.value = true
}

async function confirmRestore() {
  if (!selectedHref.value) return
  confirmDialogOpen.value = false
  restoring.value = true
  error.value = null

  try {
    await downloadWebDavBackup(
      selectedHref.value,
      prefs.webdavUrl,
      prefs.webdavUsername,
      prefs.webdavPassword
    )
    emit('restored')
    emit('update:modelValue', false)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    restoring.value = false
  }
}

function closeDialog() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  isOpen => {
    if (isOpen) {
      selectedHref.value = ''
      void loadBackups()
    }
  }
)
</script>

<template>
  <div>
    <!-- Main Remote Backups Browser Dialog -->
    <v-dialog
      :model-value="modelValue"
      max-width="640"
      @update:model-value="closeDialog"
    >
      <v-card class="webdav-dialog-card" rounded="xl">
        <div class="webdav-dialog-header">
          <h3 class="webdav-dialog-title">
            {{ stringResource(MR.strings.pref_webdav_restore_title) || 'Restore from WebDAV' }}
          </h3>
          <p class="webdav-dialog-subtitle">
            {{ stringResource(MR.strings.pref_webdav_restore_select_desc) || 'Select a backup snapshot to restore' }}
          </p>
        </div>

        <div class="webdav-dialog-body">
          <!-- Unconfigured Notice -->
          <div v-if="!isConfigured" class="webdav-status-box webdav-status-box--warning">
            <v-icon icon="warning" size="24" color="warning" />
            <p>{{ stringResource(MR.strings.pref_webdav_not_configured) || 'WebDAV URL and credentials must be configured first.' }}</p>
          </div>

          <!-- Loading State -->
          <div v-else-if="loading" class="webdav-loading-state">
            <v-progress-circular indeterminate color="primary" size="36" />
            <span class="webdav-loading-text">Querying WebDAV snapshots...</span>
          </div>

          <!-- Error Alert -->
          <div v-else-if="error" class="webdav-status-box webdav-status-box--error">
            <v-icon icon="error" size="24" color="error" />
            <div class="webdav-status-content">
              <p class="webdav-status-title">Failed to load snapshots</p>
              <p class="webdav-status-text">{{ error }}</p>
              <v-btn
                variant="outlined"
                color="error"
                size="small"
                class="mt-2"
                @click="loadBackups"
              >
                Retry
              </v-btn>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else-if="backups.length === 0" class="webdav-empty-state">
            <v-icon icon="cloud_off" size="48" class="text-medium-emphasis mb-2" />
            <p class="webdav-empty-title">
              {{ stringResource(MR.strings.pref_webdav_no_backups) || 'No backups found in WebDAV folder' }}
            </p>
            <p class="webdav-empty-hint">
              Target folder: <code>{{ prefs.webdavFolder || 'root' }}</code>
            </p>
            <v-btn
              variant="text"
              color="primary"
              size="small"
              class="mt-2"
              @click="loadBackups"
            >
              Refresh
            </v-btn>
          </div>

          <!-- Backups List -->
          <div v-else class="webdav-backups-list" role="radiogroup">
            <div
              v-for="item in backups"
              :key="item.href"
              class="webdav-backup-row"
              :class="{ 'webdav-backup-row--selected': selectedHref === item.href }"
              role="radio"
              :aria-checked="selectedHref === item.href"
              tabindex="0"
              @click="handleSelect(item)"
              @keydown.enter.prevent="handleSelect(item)"
              @keydown.space.prevent="handleSelect(item)"
            >
              <div class="webdav-radio-icon">
                <span
                  class="pref-radio"
                  :class="{ 'pref-radio--on': selectedHref === item.href }"
                >
                  <i />
                </span>
              </div>
              <div class="webdav-backup-info">
                <span class="webdav-backup-name">{{ item.name }}</span>
                <div class="webdav-backup-meta">
                  <span v-if="item.lastModified" class="webdav-backup-date">
                    {{ formatDate(item.lastModified) }}
                  </span>
                  <span class="webdav-backup-meta-sep">&bull;</span>
                  <span class="webdav-backup-size">{{ formatSize(item.size) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="webdav-dialog-actions">
          <v-btn
            variant="text"
            color="primary"
            class="pref-dialog-button"
            :disabled="restoring"
            @click="closeDialog"
          >
            Cancel
          </v-btn>
          <v-btn
            variant="tonal"
            color="primary"
            class="pref-dialog-button"
            :disabled="!selectedHref || restoring || loading || !isConfigured"
            :loading="restoring"
            @click="promptRestore"
          >
            Restore
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Restore Confirmation Dialog -->
    <v-dialog
      v-model="confirmDialogOpen"
      max-width="480"
    >
      <v-card class="webdav-dialog-card" rounded="xl">
        <h3 class="webdav-dialog-title">
          {{ stringResource(MR.strings.pref_webdav_confirm_restore_title) || 'Restore backup?' }}
        </h3>
        <div class="webdav-dialog-body">
          <p class="mb-2">
            <strong>{{ selectedBackup?.name }}</strong>
          </p>
          <p class="webdav-dialog-warning-text">
            {{
              stringResource(MR.strings.pref_webdav_confirm_restore_warning) ||
              'Restoring will replace current client preferences, manga notes, and metadata overrides.'
            }}
          </p>
        </div>
        <div class="webdav-dialog-actions">
          <v-btn
            variant="text"
            color="primary"
            class="pref-dialog-button"
            @click="confirmDialogOpen = false"
          >
            Cancel
          </v-btn>
          <v-btn
            variant="flat"
            color="primary"
            class="pref-dialog-button"
            @click="confirmRestore"
          >
            Confirm
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@layer app-components {
  .webdav-dialog-card {
    padding: 24px;
    background: rgb(var(--v-theme-surface-container-high));
    color: rgb(var(--v-theme-on-surface));
  }

  .webdav-dialog-header {
    margin-bottom: 16px;
  }

  .webdav-dialog-title {
    margin: 0;
    font-size: 20px;
    line-height: 28px;
    font-weight: 500;
    color: rgb(var(--v-theme-on-surface));
  }

  .webdav-dialog-subtitle {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 20px;
    color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  }

  .webdav-dialog-body {
    max-height: 400px;
    overflow-y: auto;
    margin: 0 -8px;
    padding: 4px 8px;
  }

  .webdav-status-box {
    display: flex;
    gap: 16px;
    padding: 16px;
    border-radius: 12px;
    margin: 8px 0;
  }

  .webdav-status-box--warning {
    background: color-mix(in srgb, rgb(var(--v-theme-warning)) 15%, transparent);
    color: rgb(var(--v-theme-on-surface));
  }

  .webdav-status-box--error {
    background: color-mix(in srgb, rgb(var(--v-theme-error)) 15%, transparent);
    color: rgb(var(--v-theme-on-surface));
  }

  .webdav-status-content {
    flex: 1 1 auto;
  }

  .webdav-status-title {
    font-weight: 600;
    margin: 0 0 4px;
  }

  .webdav-status-text {
    font-size: 13px;
    margin: 0;
    word-break: break-word;
  }

  .webdav-loading-state,
  .webdav-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 16px;
    text-align: center;
  }

  .webdav-loading-text {
    margin-top: 16px;
    font-size: 14px;
    color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  }

  .webdav-empty-title {
    font-size: 15px;
    font-weight: 500;
    margin: 0 0 4px;
  }

  .webdav-empty-hint {
    font-size: 13px;
    color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 70%, transparent);
    margin: 0;
  }

  .webdav-backups-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .webdav-backup-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.15s ease;
    user-select: none;
  }

  .webdav-backup-row:hover {
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 6%, transparent);
  }

  .webdav-backup-row--selected {
    background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
  }

  .webdav-radio-icon {
    flex: 0 0 auto;
    margin-right: 16px;
    display: flex;
    align-items: center;
  }

  .pref-radio {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid color-mix(in srgb, rgb(var(--v-theme-on-surface)) 60%, transparent);
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .pref-radio--on {
    border-color: rgb(var(--v-theme-primary));
  }

  .pref-radio--on i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgb(var(--v-theme-primary));
  }

  .webdav-backup-info {
    flex: 1 1 auto;
    min-width: 0;
  }

  .webdav-backup-name {
    display: block;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    color: rgb(var(--v-theme-on-surface));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .webdav-backup-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 70%, transparent);
    margin-top: 2px;
  }

  .webdav-backup-meta-sep {
    opacity: 0.5;
  }

  .webdav-dialog-warning-text {
    font-size: 14px;
    line-height: 20px;
    color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  }

  .webdav-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }

  .pref-dialog-button {
    font-size: 14px;
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0.1px;
    min-width: 80px;
  }
}
</style>
