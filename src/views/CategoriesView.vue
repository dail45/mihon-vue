<script setup lang="ts">
/**
 * Categories screen — "Edit categories".
 *
 * Mihon reference (pinned commit 446f6df8):
 *   mihon/app/src/main/java/eu/kanade/presentation/category/CategoryScreen.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/category/CategoryScreen.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/category/CategoryViewModel.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryListItem.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryFloatingActionButton.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryDialogs.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/EmptyScreen.kt
 *
 * Reference structure:
 *  - `Scaffold(topBar = { AppBar(title = "Edit categories", navigateUp) }, floatingActionButton =
 *    { CategoryFloatingActionButton(lazyListState, onCreate) })`.
 *  - `state.isEmpty` -> `EmptyScreen(information_empty_category)`: a random kaomoji face
 *    (displayMedium) above the message (bodyMedium), both with the secondary item alpha,
 *    centered, 24dp horizontal padding.
 *  - Otherwise `CategoryContent`: a LazyColumn with
 *    `contentPadding = paddingValues + topSmallPaddingValues (8dp) + horizontal medium (16dp)`,
 *    `verticalArrangement = spacedBy(small = 8dp)` and one `CategoryListItem` per category.
 *  - `CategoryListItem` = `ElevatedCard` > `Row` (fillMaxWidth, clickable -> rename, vertical
 *    padding 8dp, start 8dp / end 16dp) with a drag handle icon (24dp inside 16dp padding), the
 *    name (bodyLarge, weight 1f), a rename IconButton and a delete IconButton.
 *  - Reordering is drag & drop on the handle: the item moves inside the local list and the new
 *    index is persisted.
 *  - The system category is filtered out: `categories.filterNot(Category::isSystemCategory)`
 *    (Mihon's UNCATEGORIZED_ID is 0, the same id Suwayomi uses for its default category).
 *
 * The list items are rendered by src/components/category/CategoryListItem.vue, a port of
 * mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryListItem.kt.
 *
 * Web adaptations (honest notes):
 *  - The order is persisted with the Suwayomi GraphQL mutation `updateCategoryOrder`
 *    (id + 1-based position). The legacy REST v1 surface has no category reorder endpoint
 *    (`PATCH /api/v1/category/reorder` is not registered and answers 404).
 *  - Mihon reports failures with an Android toast; the web port uses an MD3 snackbar.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { createSuwayomiApi } from '../api/client'
import { reorderCategory } from '../api/categoryReorder'
import type { Category } from '../api/types'
import CategoryListItem from '../components/category/CategoryListItem.vue'
import CategoryFab from '../components/CategoryFab.vue'
import CategoryCreateDialog from '../components/CategoryCreateDialog.vue'
import CategoryRenameDialog from '../components/CategoryRenameDialog.vue'
import CategoryDeleteDialog from '../components/CategoryDeleteDialog.vue'
import MihonEmptyScreen from '../components/MihonEmptyScreen.vue'
import Md3CircularProgress from '../components/Md3CircularProgress.vue'

const server = useSuwayomiStore()
const router = useRouter()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

/** Mihon hides its system (uncategorized) category; Suwayomi keeps the default category at id 0. */
const SYSTEM_CATEGORY_ID = 0

const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const isScrolled = ref(false)
const dragOverIndex = ref<number | null>(null)
const createOpen = ref(false)

/** `state.categories` of the reference: the system category is filtered out. */
const visibleCategories = computed(() =>
  categories.value.filter(item => item.id !== SYSTEM_CATEGORY_ID),
)
const categoryNames = computed(() => visibleCategories.value.map(item => item.name))
const isEmpty = computed(() => !loading.value && !error.value && visibleCategories.value.length === 0)

/* ------------------------------------------------------------------ *
 * Loading & Scroll
 * ------------------------------------------------------------------ */

function onWindowScroll() {
  isScrolled.value = window.scrollY > 0
}

async function loadCategories() {
  loading.value = true
  error.value = null
  try {
    const fetched = await createSuwayomiApi(server.apiUrl).categories()
    categories.value = [...fetched].sort((a, b) => a.order - b.order)
    server.categories = categories.value
    server.connected = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  onWindowScroll()
  void loadCategories()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
})

/* ------------------------------------------------------------------ *
 * Reorder (Mihon: onChangeOrder -> ReorderCategory -> internal_error)
 * ------------------------------------------------------------------ */

const draggingId = ref<number | null>(null)

function onDragStart(category: Category, event: DragEvent) {
  draggingId.value = category.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(category.id))
  }
}

function onDragEnd() {
  draggingId.value = null
  dragOverIndex.value = null
}

function onDragOver(index: number) {
  dragOverIndex.value = index
}

function onDragLeave(_event: DragEvent, index: number) {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null
  }
}

async function onDrop(index: number) {
  const sourceId = draggingId.value
  dragOverIndex.value = null
  onDragEnd()
  const list = visibleCategories.value
  const from = list.findIndex(item => item.id === sourceId)
  const to = index
  if (from < 0 || to < 0 || from === to) return
  await moveCategory(from, to)
}

async function moveCategory(from: number, to: number) {
  const list = visibleCategories.value
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return
  // Optimistic reorder, exactly like `categoriesState.removeAt/add` in the reference.
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  categories.value = categories.value
    .map(item => next.find(entry => entry.id === item.id) ?? item)
  await nextTick()
  await persistOrder(moved, to)
}

function onTouchStartHandle(category: Category) {
  draggingId.value = category.id
}

function onTouchMoveHandle(event: TouchEvent) {
  if (draggingId.value === null) return
  const touch = event.touches[0]
  if (!touch) return
  const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.categories-screen__row') as HTMLElement | null
  if (target && target.dataset.index !== undefined) {
    dragOverIndex.value = Number(target.dataset.index)
  }
}

async function onTouchEndHandle() {
  if (draggingId.value === null) return
  const targetIndex = dragOverIndex.value
  const sourceId = draggingId.value
  draggingId.value = null
  dragOverIndex.value = null
  if (targetIndex === null) return
  const list = visibleCategories.value
  const from = list.findIndex(item => item.id === sourceId)
  if (from >= 0 && targetIndex >= 0 && from !== targetIndex) {
    await moveCategory(from, targetIndex)
  }
}

function onTouchCancelHandle() {
  draggingId.value = null
  dragOverIndex.value = null
}

/**
 * Suwayomi moves a category with the GraphQL mutation `updateCategoryOrder`
 * (`Category.moveCategoryToPosition`, 1-based position among the non-default categories).
 */
async function persistOrder(category: Category, index: number) {
  if (!server.apiUrl) {
    await loadCategories()
    return
  }
  try {
    await reorderCategory(server.apiUrl, category.id, index + 1)
    await loadCategories()
  } catch (e) {
    showSnackbar(
      `InternalError: could not change the category order. ${e instanceof Error ? e.message : String(e)}`,
    )
    await loadCategories()
  }
}

/* ------------------------------------------------------------------ *
 * Dialogs
 * ------------------------------------------------------------------ */

const renameTarget = ref<Category | null>(null)
const renameOpen = ref(false)
const deleteTarget = ref<Category | null>(null)
const deleteOpen = ref(false)

function openRename(category: Category) {
  renameTarget.value = category
  renameOpen.value = true
}
function openDelete(category: Category) {
  deleteTarget.value = category
  deleteOpen.value = true
}

/* ------------------------------------------------------------------ *
 * Snackbar (Mihon uses an Android toast)
 * ------------------------------------------------------------------ */

const snackbar = ref('')
let snackbarTimer: number | undefined
function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 4000)
}

function goBack() {
  if (typeof window.history.state?.back === 'string') router.back()
  else void router.push('/more')
}
</script>

<template>
  <div class="categories-screen">
    <!-- LoadingScreen.kt: shown instead of the whole screen, without an app bar. -->
    <div v-if="loading" class="categories-screen__loading" role="status" aria-label="Loading categories">
      <Md3CircularProgress />
    </div>

    <template v-else>
      <!--
        AppBar.kt: TopAppBar, 64dp tall, container = surfaceColorAtElevation(0dp) = surface.
        The navigation slot holds an IconButton (48dp container, 24dp icon) with the up arrow
        (MaterialSymbols.AutoMirroredRounded.ArrowBack) and the title slot holds AppBarTitle,
        which uses the TopAppBar title style (titleLarge) and is inset by 4dp.
      -->
      <header v-if="!embedded" class="categories-screen__toolbar" :class="{ 'is-scrolled': isScrolled }">
        <button
          type="button"
          class="categories-screen__nav"
          icon="arrow_back"
          aria-label="Back"
          title="Navigate up"
          @click="goBack"
        >
          <span class="material-symbols-rounded categories-screen__nav-icon" aria-hidden="true">arrow_back</span>
        </button>
        <h1 class="categories-screen__title">Edit categories</h1>
      </header>

      <!-- EmptyScreen(stringRes = MR.strings.information_empty_category) -->
      <MihonEmptyScreen
        v-if="isEmpty"
        class="categories-screen__empty"
        message="You have no categories. Tap the plus button to create one for organizing your library."
      />

      <!-- The reference has no error state (the categories come from the local database); the web
           port reports a failed request with the same empty screen and a readable message. -->
      <MihonEmptyScreen
        v-else-if="error"
        class="categories-screen__empty"
        :message="error"
      />

      <!--
        LazyColumn(
            contentPadding = paddingValues + topSmallPaddingValues (top = 8dp)
                + PaddingValues(horizontal = 16dp),
            verticalArrangement = Arrangement.spacedBy(8dp),
        )
      -->
      <TransitionGroup
        v-else
        name="category-row"
        tag="div"
        class="categories-screen__list"
      >
        <div
          v-for="(category, index) in visibleCategories"
          :key="category.id"
          class="categories-screen__row"
          :class="{
            'is-dragging': draggingId === category.id,
            'is-drag-over': dragOverIndex === index,
          }"
          :data-index="index"
          @dragover.prevent="onDragOver(index)"
          @dragleave="onDragLeave($event, index)"
          @drop.prevent="onDrop(index)"
        >
          <CategoryListItem
            :name="category.name"
            :dragging="draggingId === category.id"
            @rename="openRename(category)"
            @delete="openDelete(category)"
            @dragstart="onDragStart(category, $event)"
            @dragend="onDragEnd"
            @move-up="moveCategory(index, index - 1)"
            @move-down="moveCategory(index, index + 1)"
            @touch-start="onTouchStartHandle(category)"
            @touch-move="onTouchMoveHandle"
            @touch-end="onTouchEndHandle"
            @touch-cancel="onTouchCancelHandle"
          />
        </div>
      </TransitionGroup>

      <!-- CategoryFloatingActionButton(lazyListState, onCreate): the FAB follows the scroll
           position of the screen, so the scroll container is resolved automatically. -->
      <CategoryFab
        :existing-names="categoryNames"
        :manage-dialog="false"
        @create="createOpen = true"
      />
    </template>

    <CategoryCreateDialog
      v-model="createOpen"
      :categories="categoryNames"
      @created="loadCategories()"
    />

    <CategoryRenameDialog
      v-if="renameTarget"
      v-model="renameOpen"
      :category-id="renameTarget.id"
      :category-name="renameTarget.name"
      :categories="categoryNames"
      @rename="loadCategories()"
    />

    <CategoryDeleteDialog
      v-if="deleteTarget"
      v-model="deleteOpen"
      :category="deleteTarget"
      @deleted="loadCategories()"
    />

    <div v-if="snackbar" class="categories-screen__snackbar" role="status" aria-live="polite">
      {{ snackbar }}
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
.categories-screen {
  position: relative;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

/* AppBar.kt / TopAppBar: 64dp tall, container = surface, flat. */
.categories-screen__toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
.categories-screen__toolbar.is-scrolled {
  background: rgb(var(--v-theme-surface-container));
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

/* IconButton of the navigation slot: 48dp container (40dp state layer), 24dp icon,
   content color = onSurfaceVariant, fully rounded state layer. */
.categories-screen__nav {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.categories-screen__nav::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: currentColor;
  opacity: 0;
  pointer-events: none;
}
@media (hover: hover) {
  .categories-screen__nav:hover::before { opacity: 0.08; }
}
.categories-screen__nav:active::before { opacity: 0.12; }
.categories-screen__nav:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.categories-screen__nav-icon {
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* TopAppBar title = titleLarge (22sp / 28sp, weight 400), one line with an ellipsis.
   The title slot of the reference TopAppBar is inset by 4dp on both sides. */
.categories-screen__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 4px;
  font-family: Roboto, sans-serif;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* LoadingScreen.kt: Box(fillMaxSize, contentAlignment = Center). */
.categories-screen__loading {
  flex: 1 1 auto;
  display: grid;
  place-items: center;
  min-height: 0;
}

/* LazyColumn content padding: top 8dp (topSmallPaddingValues) + horizontal 16dp + bottom 96dp (FAB 56dp + margin 16dp + spacing 24dp). */
.categories-screen__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px 96px;
  padding-bottom: max(96px, calc(96px + env(safe-area-inset-bottom)));
}
/* `Modifier.animateItem()` — the item animates when the list order changes. */
.categories-screen__row {
  display: block;
  border-radius: 12px;
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, outline 0.15s ease;
}
.categories-screen__row.is-drag-over {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.category-row-move {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.categories-screen__empty {
  flex: 1 1 auto;
  min-height: 0;
}

/* MD3 snackbar. */
.categories-screen__snackbar {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  z-index: 2600;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(560px, calc(100vw - 32px));
  min-width: 288px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2);
}
}
</style>
