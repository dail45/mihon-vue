<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Manga } from '@/core/api/types'
import {
  useMangaOverridesStore,
  type MangaMetadataOverride,
  type MangaWithOverrides,
} from '../stores/mangaOverrides'
import {
  useTrackerAutofill,
  type BoundTrackerItem,
} from '../composables/useTrackerAutofill'
import type { Tracker, TrackerRecord } from '@/core/api/trackers'

/**
 * Pixel-parity implementation of TachiyomiSY's EditMangaDialog.
 * Reference: `TachiyomiSY/app/src/main/java/eu/kanade/tachiyomi/ui/manga/EditMangaDialog.kt`
 *
 * Provides local metadata overrides for Manga entries:
 * - Title, Author, Artist, Cover URL, Description, Status, Tags
 * - Tracker autofill (queries bound AniList, MyAnimeList, Kitsu, or Suwayomi tracker)
 * - Individual field reset buttons (restores source values)
 * - Reset all action in header overflow
 * - Persists locally in `localStorage['mihon.manga_overrides']`
 */

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    manga: Manga & Partial<MangaWithOverrides>
    sourceName?: string
    apiUrl?: string
  }>(),
  {
    sourceName: '',
    apiUrl: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'saved': []
  'reset': []
}>()

const { t } = useI18n()
const overridesStore = useMangaOverridesStore()
const trackerAutofill = useTrackerAutofill()

// Original source values
const ogTitle = computed(() => props.manga.ogTitle ?? props.manga.title ?? '')
const ogAuthor = computed(() => props.manga.ogAuthor ?? (props.manga.author || ''))
const ogArtist = computed(() => props.manga.ogArtist ?? (props.manga.artist || ''))
const ogThumbnailUrl = computed(() => props.manga.ogThumbnailUrl ?? (props.manga.thumbnailUrl || ''))
const ogDescription = computed(() => props.manga.ogDescription ?? (props.manga.description || ''))
const ogGenre = computed(() => props.manga.ogGenre ?? (props.manga.genre || []))
const ogStatus = computed(() => props.manga.ogStatus ?? props.manga.status ?? 0)

// Form fields
const title = ref('')
const author = ref('')
const artist = ref('')
const thumbnailUrl = ref('')
const description = ref('')
const statusIndex = ref(0)
const tags = ref<string[]>([])

// Cover preview error fallback
const coverError = ref(false)
const previewCoverUrl = computed(() => {
  if (coverError.value) return ''
  return thumbnailUrl.value.trim() || ogThumbnailUrl.value || ''
})

// Subdialogs & Feedback state
const addTagsDialogOpen = ref(false)
const newTagsInput = ref('')
const trackerSelectDialogOpen = ref(false)
const boundTrackers = ref<BoundTrackerItem[]>([])
const isAutofilling = ref(false)

const snackbar = ref(false)
const snackbarMessage = ref('')

function showSnackbar(msg: string) {
  snackbarMessage.value = msg
  snackbar.value = true
}

// Status conversion helpers
function toStatusIndex(val: number | string | undefined | null): number {
  if (typeof val === 'string') {
    switch (val.toUpperCase()) {
      case 'ONGOING': return 1
      case 'COMPLETED': return 2
      case 'LICENSED': return 3
      case 'PUBLISHING_FINISHED': return 4
      case 'CANCELLED': return 5
      case 'ON_HIATUS': return 6
      default: {
        const num = Number.parseInt(val, 10)
        return isNaN(num) ? 0 : toStatusIndex(num)
      }
    }
  }
  switch (val) {
    case 1: return 1 // ONGOING
    case 2: return 2 // COMPLETED
    case 3: return 3 // LICENSED
    case 4: case 61: return 4 // PUBLISHING_FINISHED
    case 5: case 62: return 5 // CANCELLED
    case 6: case 63: return 6 // ON_HIATUS
    default: return 0 // DEFAULT / UNKNOWN
  }
}

function toStatus(idx: number): number | undefined {
  switch (idx) {
    case 1: return 1
    case 2: return 2
    case 3: return 3
    case 4: return 4
    case 5: return 5
    case 6: return 6
    default: return undefined
  }
}

const statusOptions = computed(() => [
  { value: 0, label: t('label_default') },
  { value: 1, label: t('ongoing') },
  { value: 2, label: t('completed') },
  { value: 3, label: t('licensed') },
  { value: 4, label: t('publishing_finished') },
  { value: 5, label: t('cancelled') },
  { value: 6, label: t('on_hiatus') },
])

// Populate form when dialog opens
function initForm() {
  coverError.value = false
  const mangaId = props.manga.id
  const existing = mangaId ? overridesStore.getOverride(mangaId) : undefined

  title.value = existing?.title ?? (props.manga.title !== ogTitle.value ? props.manga.title : '')
  author.value = existing?.author ?? (props.manga.author !== ogAuthor.value ? props.manga.author || '' : '')
  artist.value = existing?.artist ?? (props.manga.artist !== ogArtist.value ? props.manga.artist || '' : '')
  thumbnailUrl.value = existing?.thumbnailUrl ?? (props.manga.thumbnailUrl !== ogThumbnailUrl.value ? props.manga.thumbnailUrl || '' : '')
  description.value = existing?.description ?? (props.manga.description !== ogDescription.value ? props.manga.description || '' : '')
  statusIndex.value = existing?.status !== undefined
    ? toStatusIndex(existing.status)
    : (props.manga.status !== ogStatus.value ? toStatusIndex(props.manga.status ?? 0) : 0)

  tags.value = existing?.genre ? [...existing.genre] : [...(props.manga.genre || ogGenre.value)]
}

watch(
  () => props.modelValue,
  isOpen => {
    if (isOpen) {
      initForm()
    }
  },
  { immediate: true },
)

watch(thumbnailUrl, () => {
  coverError.value = false
})

// Field reset actions
function resetTitle() {
  title.value = ''
}

function resetAuthor() {
  author.value = ''
}

function resetArtist() {
  artist.value = ''
}

function resetThumbnailUrl() {
  thumbnailUrl.value = ''
}

function resetDescription() {
  description.value = ''
}

function resetStatus() {
  statusIndex.value = 0
}

function resetTags() {
  tags.value = [...ogGenre.value]
}

function resetAll() {
  resetTitle()
  resetAuthor()
  resetArtist()
  resetThumbnailUrl()
  resetDescription()
  resetStatus()
  resetTags()
}

// Tag chips manipulation
function removeTag(index: number) {
  tags.value.splice(index, 1)
}

function openAddTagsDialog() {
  newTagsInput.value = ''
  addTagsDialogOpen.value = true
}

function confirmAddTags() {
  const parts = newTagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  if (parts.length > 0) {
    const set = new Set(tags.value)
    for (const tag of parts) {
      if (!set.has(tag)) {
        tags.value.push(tag)
        set.add(tag)
      }
    }
  }
  addTagsDialogOpen.value = false
}

// Tracker Autofill
async function onFillFromTrackerClick() {
  const apiUrl = props.apiUrl
  const mangaId = props.manga.id
  if (!apiUrl || !mangaId) {
    showSnackbar(t('entry_not_tracked'))
    return
  }

  isAutofilling.value = true
  try {
    const list = await trackerAutofill.getBoundTrackers(apiUrl, mangaId)
    boundTrackers.value = list

    if (list.length === 0) {
      showSnackbar(t('entry_not_tracked'))
      return
    }

    if (list.length === 1) {
      await executeAutofill(list[0].tracker, list[0].record)
    } else {
      trackerSelectDialogOpen.value = true
    }
  } catch {
    showSnackbar(t('entry_not_tracked'))
  } finally {
    isAutofilling.value = false
  }
}

async function selectTrackerToAutofill(tracker: Tracker, record: TrackerRecord) {
  trackerSelectDialogOpen.value = false
  isAutofilling.value = true
  try {
    await executeAutofill(tracker, record)
  } finally {
    isAutofilling.value = false
  }
}

async function executeAutofill(tracker: Tracker, record: TrackerRecord) {
  try {
    const meta = await trackerAutofill.fetchTrackerMetadata(
      props.apiUrl,
      tracker,
      record,
      ogTitle.value,
    )

    if (!meta) {
      showSnackbar(`${t('entry_not_tracked')} (${tracker.name})`)
      return
    }

    if (meta.title) title.value = meta.title
    if (meta.authors) author.value = meta.authors
    if (meta.artists) artist.value = meta.artists
    if (meta.thumbnailUrl) thumbnailUrl.value = meta.thumbnailUrl
    if (meta.description) description.value = meta.description
    if (meta.status !== undefined) statusIndex.value = toStatusIndex(meta.status)
    if (meta.tags && meta.tags.length > 0) {
      tags.value = Array.from(new Set([...tags.value, ...meta.tags]))
    }

    showSnackbar(`${t('fill_from_tracker')}: ${tracker.name}`)
  } catch (err: any) {
    showSnackbar(`Error: ${err?.message || 'Autofill failed'}`)
  }
}

// Save & Confirm
function onSave() {
  const mangaId = props.manga.id
  if (!mangaId) return

  const patch: Partial<MangaMetadataOverride> = {}

  const trimmedTitle = title.value.trim()
  if (trimmedTitle && trimmedTitle !== ogTitle.value) {
    patch.title = trimmedTitle
  }

  const trimmedAuthor = author.value.trim()
  if (trimmedAuthor && trimmedAuthor !== ogAuthor.value) {
    patch.author = trimmedAuthor
  }

  const trimmedArtist = artist.value.trim()
  if (trimmedArtist && trimmedArtist !== ogArtist.value) {
    patch.artist = trimmedArtist
  }

  const trimmedCover = thumbnailUrl.value.trim()
  if (trimmedCover && trimmedCover !== ogThumbnailUrl.value) {
    patch.thumbnailUrl = trimmedCover
  }

  const trimmedDesc = description.value.trim()
  if (trimmedDesc && trimmedDesc !== ogDescription.value) {
    patch.description = trimmedDesc
  }

  const chosenStatus = toStatus(statusIndex.value)
  if (chosenStatus !== undefined && chosenStatus !== ogStatus.value) {
    patch.status = chosenStatus
  }

  const origTags = ogGenre.value || []
  const curTags = tags.value || []
  const tagsChanged =
    curTags.length !== origTags.length || curTags.some((tag, i) => tag !== origTags[i])

  if (tagsChanged) {
    patch.genre = [...curTags]
  }

  if (Object.keys(patch).length === 0) {
    overridesStore.resetOverride(mangaId)
    emit('reset')
  } else {
    overridesStore.setOverride(mangaId, patch)
    emit('saved')
  }

  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="edit-manga-card" color="surface-container-high" rounded="xl">
      <!-- Header -->
      <v-card-title class="edit-manga-card-title d-flex align-center justify-space-between pt-4 px-6 pb-2">
        <span class="text-title-large font-weight-medium">{{ t('action_edit_info') }}</span>
        <div class="d-flex align-center ga-1">
          <v-btn
            variant="text"
            icon="sync"
            density="comfortable"
            :loading="isAutofilling"
            :title="t('fill_from_tracker')"
            @click="onFillFromTrackerClick"
          />
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                variant="text"
                icon="more_vert"
                density="comfortable"
                :title="t('action_menu_overflow_description')"
              />
            </template>
            <v-list density="compact" rounded="lg">
              <v-list-item
                prepend-icon="sync"
                :title="t('fill_from_tracker')"
                @click="onFillFromTrackerClick"
              />
              <v-list-item
                prepend-icon="history"
                :title="t('reset_info')"
                @click="resetAll"
              />
            </v-list>
          </v-menu>
        </div>
      </v-card-title>

      <!-- Scrollable Form Content -->
      <v-card-text class="px-6 py-2">
        <div class="d-flex flex-column ga-4">
          <!-- Top Row: Cover Preview, Origin and Status -->
          <div class="d-flex ga-4 align-start pt-1">
            <div class="edit-manga-cover-wrap">
              <img
                v-if="previewCoverUrl"
                :src="previewCoverUrl"
                :alt="title || ogTitle"
                class="edit-manga-cover-img"
                @error="coverError = true"
              />
              <div v-else class="edit-manga-cover-placeholder d-flex align-center justify-center">
                <v-icon icon="image" size="32" color="medium-emphasis" />
              </div>
            </div>

            <div class="d-flex flex-column ga-2 flex-1-1">
              <div class="text-label-small text-medium-emphasis text-truncate-2">
                {{ [sourceName, ogTitle].filter(Boolean).join(' · ') }}
              </div>

              <v-select
                v-model="statusIndex"
                :items="statusOptions"
                item-title="label"
                item-value="value"
                :label="t('status')"
                variant="outlined"
                density="compact"
                hide-details
                class="edit-manga-status-select"
              />
            </div>
          </div>

          <!-- Title Field -->
          <v-text-field
            v-model="title"
            :label="t('title')"
            :placeholder="ogTitle"
            persistent-placeholder
            :hint="title.trim() && ogTitle ? t('source_value_hint', [ogTitle]) : ''"
            :persistent-hint="Boolean(title.trim() && ogTitle)"
            variant="outlined"
            density="compact"
            hide-details="auto"
          >
            <template #append-inner>
              <v-btn
                v-if="title.trim()"
                icon="close"
                variant="text"
                size="x-small"
                density="compact"
                :title="t('action_reset')"
                @click="resetTitle"
              />
            </template>
          </v-text-field>

          <!-- Author and Artist Row -->
          <div class="d-flex flex-column flex-sm-row ga-3">
            <v-text-field
              v-model="author"
              :label="t('author')"
              :placeholder="ogAuthor"
              persistent-placeholder
              :hint="author.trim() && ogAuthor ? t('source_value_hint', [ogAuthor]) : ''"
              :persistent-hint="Boolean(author.trim() && ogAuthor)"
              variant="outlined"
              density="compact"
              hide-details="auto"
              class="flex-1-1"
            >
              <template #append-inner>
                <v-btn
                  v-if="author.trim()"
                  icon="close"
                  variant="text"
                  size="x-small"
                  density="compact"
                  :title="t('action_reset')"
                  @click="resetAuthor"
                />
              </template>
            </v-text-field>

            <v-text-field
              v-model="artist"
              :label="t('artist')"
              :placeholder="ogArtist"
              persistent-placeholder
              :hint="artist.trim() && ogArtist ? t('source_value_hint', [ogArtist]) : ''"
              :persistent-hint="Boolean(artist.trim() && ogArtist)"
              variant="outlined"
              density="compact"
              hide-details="auto"
              class="flex-1-1"
            >
              <template #append-inner>
                <v-btn
                  v-if="artist.trim()"
                  icon="close"
                  variant="text"
                  size="x-small"
                  density="compact"
                  :title="t('action_reset')"
                  @click="resetArtist"
                />
              </template>
            </v-text-field>
          </div>

          <!-- Cover URL Field -->
          <v-text-field
            v-model="thumbnailUrl"
            :label="t('thumbnail_url')"
            :placeholder="ogThumbnailUrl"
            persistent-placeholder
            :hint="thumbnailUrl.trim() && ogThumbnailUrl ? t('source_value_hint', [ogThumbnailUrl]) : ''"
            :persistent-hint="Boolean(thumbnailUrl.trim() && ogThumbnailUrl)"
            variant="outlined"
            density="compact"
            hide-details="auto"
          >
            <template #append-inner>
              <v-btn
                v-if="thumbnailUrl.trim()"
                icon="close"
                variant="text"
                size="x-small"
                density="compact"
                :title="t('action_reset')"
                @click="resetThumbnailUrl"
              />
            </template>
          </v-text-field>

          <!-- Description Field -->
          <v-textarea
            v-model="description"
            :label="t('entry_description')"
            :placeholder="ogDescription"
            persistent-placeholder
            :hint="description.trim() && ogDescription ? t('source_value_hint', [ogDescription.slice(0, 60)]) : ''"
            :persistent-hint="Boolean(description.trim() && ogDescription)"
            variant="outlined"
            density="compact"
            auto-grow
            rows="3"
            max-rows="8"
            hide-details="auto"
          >
            <template #append-inner>
              <v-btn
                v-if="description.trim()"
                icon="close"
                variant="text"
                size="x-small"
                density="compact"
                :title="t('action_reset')"
                @click="resetDescription"
              />
            </template>
          </v-textarea>

          <!-- Tags Section -->
          <div class="edit-manga-tags-section">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-title-small font-weight-medium text-primary">{{ t('entry_tags') }}</span>
              <v-btn
                variant="text"
                size="small"
                density="compact"
                color="primary"
                @click="resetTags"
              >
                {{ t('reset_tags') }}
              </v-btn>
            </div>

            <div class="d-flex flex-wrap ga-2 align-center">
              <v-chip
                v-for="(tag, index) in tags"
                :key="tag"
                closable
                variant="tonal"
                size="small"
                class="edit-manga-tag-chip"
                @click:close="removeTag(index)"
              >
                {{ tag }}
              </v-chip>

              <v-chip
                variant="outlined"
                color="primary"
                size="small"
                prepend-icon="add"
                class="edit-manga-add-tag-chip"
                @click="openAddTagsDialog"
              >
                {{ t('add_tag') }}
              </v-chip>
            </div>
          </div>
        </div>
      </v-card-text>

      <!-- Bottom Actions -->
      <v-card-actions class="d-flex px-6 py-3 border-t">
        <v-btn
          variant="outlined"
          class="flex-1-1"
          rounded="pill"
          @click="emit('update:modelValue', false)"
        >
          {{ t('action_cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          class="flex-1-1"
          rounded="pill"
          @click="onSave"
        >
          {{ t('action_save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Add Tags Subdialog -->
  <v-dialog v-model="addTagsDialogOpen" max-width="440">
    <v-card rounded="xl" color="surface-container-high" class="pa-4">
      <v-card-title class="text-title-large font-weight-medium pa-0 mb-2">
        {{ t('add_tags') }}
      </v-card-title>
      <div class="text-body-medium text-medium-emphasis mb-3">
        {{ t('multi_tags_comma_separated') }}
      </div>
      <v-text-field
        v-model="newTagsInput"
        variant="outlined"
        density="compact"
        autofocus
        placeholder="Action, Fantasy, Comedy"
        @keydown.enter.prevent="confirmAddTags"
      />
      <v-card-actions class="pa-0 mt-2 justify-end">
        <v-btn variant="text" @click="addTagsDialogOpen = false">
          {{ t('action_cancel') }}
        </v-btn>
        <v-btn color="primary" variant="flat" @click="confirmAddTags">
          {{ t('action_ok') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Tracker Selection Subdialog -->
  <v-dialog v-model="trackerSelectDialogOpen" max-width="420">
    <v-card rounded="xl" color="surface-container-high" class="pa-4">
      <v-card-title class="text-title-large font-weight-medium pa-0 mb-3">
        {{ t('select_tracker') }}
      </v-card-title>
      <v-list class="bg-transparent pa-0">
        <v-list-item
          v-for="item in boundTrackers"
          :key="item.record.id"
          class="rounded-lg mb-1"
          @click="selectTrackerToAutofill(item.tracker, item.record)"
        >
          <template #prepend>
            <v-avatar size="32" class="me-3" color="surface-container-highest">
              <v-img
                v-if="trackerAutofill.trackerIconUrl(apiUrl, item.tracker)"
                :src="trackerAutofill.trackerIconUrl(apiUrl, item.tracker)"
              />
              <v-icon v-else icon="sync" size="20" />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium">{{ item.tracker.name }}</v-list-item-title>
          <v-list-item-subtitle v-if="item.record.title">{{ item.record.title }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
      <v-card-actions class="pa-0 mt-2 justify-end">
        <v-btn variant="text" @click="trackerSelectDialogOpen = false">
          {{ t('action_cancel') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Notification Snackbar -->
  <v-snackbar
    v-model="snackbar"
    :timeout="3500"
    location="bottom center"
    rounded="pill"
  >
    {{ snackbarMessage }}
    <template #actions>
      <v-btn variant="text" color="primary" @click="snackbar = false">
        {{ t('action_cancel') }}
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.edit-manga-card {
  max-height: 90vh;
}

.edit-manga-cover-wrap {
  width: 76px;
  height: 114px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.edit-manga-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.edit-manga-cover-placeholder {
  width: 100%;
  height: 100%;
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
}

.edit-manga-tags-section {
  padding-top: 4px;
}

.edit-manga-tag-chip {
  max-width: 100%;
}
</style>
