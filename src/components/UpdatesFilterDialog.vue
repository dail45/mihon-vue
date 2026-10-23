<script setup lang="ts">
/**
 * Updates — filter dialog.
 *
 * Pixel-parity port of Mihon's `UpdatesFilterDialog`
 * (mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesFilterDialog.kt,
 * pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference structure:
 *   TabbedDialog(tabTitles = ["Filter", "Categories"]) — a PrimaryTabRow over a
 *   HorizontalPager; the tab row container color is surfaceContainerHigh.
 *     Column(padding(vertical = TabbedDialogPaddings.Vertical) (8.dp).verticalScroll(...)) around the active page.
 *       page 0 — FilterSheet:
 *         TriStateItem("Downloaded"), TriStateItem("Unread"), TriStateItem("Started"),
 *         TriStateItem("Bookmarked"),
 *         HorizontalDivider(padding(MaterialTheme.padding.small) (8.dp)),
 *         Row(clickable, fillMaxWidth, padding(horizontal = SettingsItemsPaddings.Horizontal) (24.dp)):
 *           Text("Filter excluded scanlators", bodyMedium, onSurface) + Switch(...)
 *       page 1 — CategoryFilterSheet:
 *         Text(pref_filter_update_categories_details, fillMaxWidth,
 *              padding(horizontal = 24.dp, vertical = 10.dp), bodyMedium, onSurface),
 *         HorizontalDivider(padding(MaterialTheme.padding.extraSmall) (4.dp)),
 *         either a LoadingScreen(padding(16.dp)) when the categories are not loaded yet,
 *         or one TriStateItem per category, labelled with `category.visualName`.
 *
 * TriStateItem (tachiyomi/presentation-core/.../components/SettingsItems.kt:334-385):
 *   Row(clickable, fillMaxWidth, padding(horizontal = 24.dp, vertical = 10.dp)),
 *   verticalAlignment = CenterVertically, horizontalArrangement = spacedBy(24.dp),
 *   icon = 24.dp on the start (CheckBoxOutlineBlank / CheckBox / DisabledByDefault),
 *   label = bodyMedium (14.sp / 20.sp, weight 400, letter-spacing 0.25px) in onSurface.
 *   Icon tint: onSurfaceVariant when DISABLED, primary otherwise.
 *   The tri-state cycle is DISABLED -> ENABLED_IS -> ENABLED_NOT -> DISABLED.
 *
 * TabbedDialogPaddings: Horizontal = 24.dp, Vertical = 8.dp.
 * SettingsItemsPaddings: Horizontal = 24.dp, Vertical = 10.dp.
 * MaterialTheme.padding: small = 8.dp, extraSmall = 4.dp, large = 24.dp.
 *
 * Suwayomi's REST v1 exposes no updates-filter preferences, so the values live in
 * browser storage (stores/updates.ts) and are applied to the feed in the browser.
 */
import { computed, ref, watch } from 'vue'
import { createSuwayomiApi } from '../api/client'
import type { Category } from '../api/types'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useUpdatesStore } from '../stores/updates'
import type { TriState } from '../utils/library'
import AdaptiveSettingsSheet from './AdaptiveSettingsSheet.vue'
import Md3Switch from './Md3Switch.vue'
import TriStateRow from './TriStateRow.vue'

const open = defineModel<boolean>({ required: true })

const updates = useUpdatesStore()
const server = useSuwayomiStore()

/** The two pages of the reference TabbedDialog (MR.strings.action_filter and MR.strings.categories). */
const tab = ref<'filter' | 'categories'>('filter')

const categories = ref<Category[]>([])
const loadingCategories = ref(false)
const categoriesError = ref<string | null>(null)

// Touch horizontal swipe between tabs mirroring HorizontalPager
const touchStartX = ref<number | null>(null)
const touchStartY = ref<number | null>(null)

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    touchStartX.value = e.touches[0]!.clientX
    touchStartY.value = e.touches[0]!.clientY
  }
}

function onTouchEnd(e: TouchEvent) {
  if (touchStartX.value === null || touchStartY.value === null) return
  const dx = e.changedTouches[0]!.clientX - touchStartX.value
  const dy = e.changedTouches[0]!.clientY - touchStartY.value
  touchStartX.value = null
  touchStartY.value = null

  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0 && tab.value === 'filter') {
      tab.value = 'categories'
    } else if (dx > 0 && tab.value === 'categories') {
      tab.value = 'filter'
    }
  }
}

watch(open, async value => {
  if (!value) return
  // rememberPagerState starts on page 0 whenever the dialog composable opens
  tab.value = 'filter'

  if (server.categories.length) {
    categories.value = [...server.categories].sort((a, b) => a.order - b.order)
    loadingCategories.value = false
  } else {
    loadingCategories.value = true
  }
  categoriesError.value = null

  try {
    const fetched = await createSuwayomiApi(server.apiUrl).categories()
    categories.value = [...fetched].sort((a, b) => a.order - b.order)
    server.categories = categories.value
  } catch (error) {
    if (!categories.value.length) {
      categories.value = server.categories
      categoriesError.value = error instanceof Error ? error.message : 'Cannot reach Suwayomi.'
    }
  } finally {
    loadingCategories.value = false
  }
}, { immediate: true })

/** `Category.visualName`: isSystemCategory (id == 0) returns MR.strings.label_default ("Default"). */
function categoryName(category: Category) {
  return category.id === 0 || category.default || category.isDefaultCategory ? 'Default' : category.name
}

const categoryStateMap = computed(() => {
  const map = new Map<number, TriState>()
  for (const cat of categories.value) {
    if (updates.filters.includedCategories.includes(cat.id)) {
      map.set(cat.id, 'include')
    } else if (updates.filters.excludedCategories.includes(cat.id)) {
      map.set(cat.id, 'exclude')
    } else {
      map.set(cat.id, 'all')
    }
  }
  return map
})

const filterRows = computed(() => [
  { key: 'downloaded' as const, label: 'Downloaded' },
  { key: 'unread' as const, label: 'Unread' },
  { key: 'started' as const, label: 'Started' },
  { key: 'bookmarked' as const, label: 'Bookmarked' },
])
</script>

<template>
  <AdaptiveSettingsSheet
    v-model="open"
    v-model:tab="tab"
    title="Filter"
    :tabs="['Filter', 'Categories']"
  >
    <div
      class="updates-filter-container"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <!-- page 0: FilterSheet (UpdatesFilterDialog.kt:66-122) -->
      <div v-if="tab === 'filter'" class="updates-filter-page">
        <TriStateRow
          v-for="row in filterRows"
          :key="row.key"
          v-model="updates.filters[row.key]"
          :label="row.label"
        />

        <!-- HorizontalDivider(modifier = Modifier.padding(MaterialTheme.padding.small)) (8.dp) -->
        <hr class="updates-filter-divider is-small" />

        <button
          type="button"
          class="updates-switch-row"
          role="switch"
          :aria-checked="updates.filters.excludedScanlators"
          @click="updates.toggleExcludedScanlators()"
        >
          <span class="updates-switch-label">Filter excluded scanlators</span>
          <Md3Switch
            :model-value="updates.filters.excludedScanlators"
            tabindex="-1"
            aria-hidden="true"
          />
        </button>
      </div>

      <!-- page 1: CategoryFilterSheet (UpdatesFilterDialog.kt:125-174) -->
      <div v-else class="updates-filter-page">
        <p class="updates-filter-description">
          Updates in excluded categories will not be shown even if they are also in any included categories.
        </p>

        <!-- HorizontalDivider(modifier = Modifier.padding(MaterialTheme.padding.extraSmall)) (4.dp) -->
        <hr class="updates-filter-divider is-extra-small" />

        <div
          v-if="loadingCategories || (!categories.length && !categoriesError)"
          class="updates-filter-loading"
          aria-label="Loading categories"
        >
          <v-progress-circular indeterminate color="primary" size="40" width="4" />
        </div>

        <p v-else-if="categoriesError" class="updates-filter-error">
          {{ categoriesError }}
        </p>

        <div v-else class="updates-categories-list">
          <TriStateRow
            v-for="category in categories"
            :key="category.id"
            :model-value="categoryStateMap.get(category.id) ?? 'all'"
            :label="categoryName(category)"
            @update:model-value="updates.cycleCategory(category.id)"
          />
        </div>
      </div>
    </div>
  </AdaptiveSettingsSheet>
</template>

<style scoped>
@layer app-components {
.updates-filter-container {
  width: 100%;
}

/* TabbedDialogPaddings.Vertical = 8.dp is the padding of the scrolling column
   (`.settings-scroll`), so the page itself adds no extra padding. */
.updates-filter-page {
  padding: 0;
}

/* HorizontalDivider: 1.dp outlineVariant line. */
.updates-filter-divider {
  border: 0;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
  margin: 0;
}
.updates-filter-divider.is-small {
  margin: 8px;
}
.updates-filter-divider.is-extra-small {
  margin: 4px;
}

/* The scanlator switch row: clickable Row with 24.dp horizontal padding and SpaceBetween. */
.updates-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 48px;
  padding: 0 24px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  text-align: start;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.updates-switch-row:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.updates-switch-row:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.updates-switch-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.updates-switch-label {
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
/* Trailing edge switch: no extra start padding, click handled by the row button */
.updates-switch-row :deep(.md3-switch) {
  padding-inline-start: 0;
  pointer-events: none;
}

/* The category page description: MaterialTheme.typography.bodyMedium with 24/10.dp padding. */
.updates-filter-description {
  margin: 0;
  padding: 10px 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
}

.updates-filter-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  min-height: 120px;
}

.updates-filter-error {
  margin: 0;
  padding: 16px 24px;
  color: rgb(var(--v-theme-error));
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

.updates-categories-list {
  display: flex;
  flex-direction: column;
}
}
</style>
