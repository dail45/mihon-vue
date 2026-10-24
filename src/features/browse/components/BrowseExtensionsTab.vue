<script setup lang="ts">
/**
 * Extensions — the Browse > Extensions tab.
 *
 * Pixel-parity port of Mihon's Extensions tab (mihon @ 446f6df8):
 *  - `app/src/main/java/eu/kanade/presentation/browse/ExtensionsScreen.kt` (screen, headers, row,
 *    metadata pills, item actions, dialogs)
 *  - `app/src/main/java/eu/kanade/presentation/browse/components/BaseBrowseItem.kt` (row layout)
 *  - `app/src/main/java/eu/kanade/presentation/browse/components/BrowseIcons.kt` (ExtensionIcon)
 *  - `app/src/main/java/eu/kanade/presentation/browse/components/ExtensionPill.kt` (metadata pills)
 *  - `app/src/main/java/eu/kanade/tachiyomi/ui/browse/extension/ExtensionsTab.kt` (app bar actions,
 *    long press, the uninstall confirmation dialog)
 *  - `app/src/main/java/eu/kanade/tachiyomi/ui/browse/extension/ExtensionsViewModel.kt` (grouping,
 *    the search predicate, debounce, sorting)
 *  - `app/src/main/java/eu/kanade/domain/extension/interactor/GetExtensionsByType.kt` (the 4 groups)
 *  - `presentation-core/.../screens/{LoadingScreen,EmptyScreen}.kt`, `.../components/ActionButton.kt`
 *  - `presentation-core/.../components/VerticalFastScroller.kt` (12dp width, 6dp radius, primary thumb)
 *
 * Android-only behaviour (APK install / update / uninstall, the "install apps" permission banner,
 * extension trust, the in-app web view) is reproduced as an honest stub: the row, the dialog and
 * the action look like the reference and explain that the action is unavailable in the web client,
 * which stays a read-only REST client for Suwayomi-Server.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { fetchExtensionList, type ExtensionDto } from '@/core/api/extensions'
import { contentWarningLabel, extensionContentWarning } from '@/core/utils/contentWarning'
import ExtensionPill from '../components/ExtensionPill.vue'
import SearchAppBar from '@/core/components/SearchAppBar.vue'
import Md3CircularProgress from '@/core/components/Md3CircularProgress.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import ExtensionTrustDialog from '../components/ExtensionTrustDialog.vue'
import ExtensionNotLoadedDialog, { type ExtensionNotLoadedReason } from '../components/ExtensionNotLoadedDialog.vue'

const router = useRouter()
const server = useSuwayomiStore()

/**
 * `embedded` renders the screen without its own app bar: the Browse tab owns the single
 * `SearchToolbar` of the `TabbedScreen` (TabbedScreen.kt:44-50) and hoists the query into
 * the parent (`BrowseTab.kt:77-78`). In that case the query is bound through the
 * `query` / `update:query` model and the overflow actions are rendered by the parent
 * (`ExtensionsTab.kt`).
 */
const props = defineProps<{ embedded?: boolean; query?: string | null }>()
const emit = defineEmits<{ (e: 'update:query', value: string): void }>()

// --- state ---------------------------------------------------------------------------------
const extensions = ref<ExtensionDto[]>([])
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const searchQuery = ref(props.query ?? '')

/* The parent drives the query while the screen is embedded in the Browse tab. */
watch(() => props.query, value => {
  if (value === undefined || value === null) return
  if (value !== searchQuery.value) searchQuery.value = value
})
watch(searchQuery, value => {
  if (props.embedded && value !== (props.query ?? '')) emit('update:query', value)
})

// --- Language filters (mihon.sourceLanguages) ------------------------------------------------
const LANGUAGES_KEY = 'mihon.sourceLanguages'

function readLanguageList(): string[] {
  try {
    const raw = localStorage.getItem(LANGUAGES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}

function defaultLanguages(): string[] {
  const device = (navigator.language || 'en').split('-')[0] || 'en'
  return [...new Set(['all', 'en', device])]
}

const enabledLanguages = ref<string[]>(readLanguageList())
if (!enabledLanguages.value.length) enabledLanguages.value = defaultLanguages()

function reloadFilters() {
  const current = readLanguageList()
  enabledLanguages.value = current.length ? current : defaultLanguages()
}

// --- Fetching ------------------------------------------------------------------------------
async function loadExtensions(isRefresh = false) {
  if (isRefresh) refreshing.value = true
  else loading.value = true
  loadError.value = ''
  try {
    // The source list tells us which sources an installed extension provides.
    if (!server.sources.length) void server.loadSources()
    extensions.value = await fetchExtensionList(server.apiUrl)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Cannot reach Suwayomi.'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(() => {
  reloadFilters()
  window.addEventListener('storage', reloadFilters)
  window.addEventListener('focus', reloadFilters)
  void loadExtensions()
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', reloadFilters)
  window.removeEventListener('focus', reloadFilters)
})

watch(() => server.apiUrl, () => { void loadExtensions() })

/* ExtensionsViewModel: the search query is debounced by 0.25s, but an empty query is not
   delayed at all. */
const debouncedQuery = ref('')
let debounceTimer: number | undefined
watch(searchQuery, value => {
  if (debounceTimer) window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => { debouncedQuery.value = value }, value ? 250 : 0)
})

// --- model ---------------------------------------------------------------------------------
type ExtensionKind = 'available' | 'loaded' | 'not-loaded'
type InstallStepType = 'pending' | 'downloading' | 'installing' | 'error' | null

interface UiExtension {
  key: string
  dto: ExtensionDto
  kind: ExtensionKind
  name: string
  lang: string
  versionName: string
  storeName: string | null
  iconUrl: string
  installed: boolean
  hasUpdate: boolean
  obsolete: boolean
  isShared: boolean
  notLoadedReason?: ExtensionNotLoadedReason | 'untrusted'
  sources: typeof server.sources
  installStep?: InstallStepType
}

interface Header {
  key: string
  title: string
  /** Only the "Updates pending" header carries the "Update all" action. */
  action: 'update-all' | null
  items: UiExtension[]
}

/**
 * LocaleHelper.getSourceDisplayName(lang, context):
 * "all" -> "Multi" (MR.strings.multi_lang), "other" -> "Other" (MR.strings.other_source),
 * otherwise localized native language name with capitalized first letter.
 */
function languageName(lang: string): string {
  if (!lang) return ''
  if (lang === 'all') return 'Multi'
  if (lang === 'other' || lang === 'localsourcelang') return 'Other'
  const normalized = lang === 'zh-CN' ? 'zh-Hans' : lang === 'zh-TW' ? 'zh-Hant' : lang
  try {
    const name = new Intl.DisplayNames([normalized], { type: 'language' }).of(normalized)
    if (name && name !== normalized) return name.charAt(0).toUpperCase() + name.slice(1)
  } catch { /* Intl.DisplayNames cannot resolve this tag */ }
  return normalized.toUpperCase()
}

/**
 * The store a listing belongs to. Mihon shows the store name under the extension name
 * (ExtensionItemContent); the server only reports the repository URL.
 */
function storeName(repo: string | null): string | null {
  if (!repo) return null
  try {
    const url = new URL(repo)
    const owner = url.pathname.split('/').filter(Boolean)[0]
    if (url.hostname === 'github.com' && owner) return owner.charAt(0).toUpperCase() + owner.slice(1)
    return url.hostname
  } catch { return null }
}

const serverBase = computed(() => server.apiUrl.replace(/\/api\/v1\/?$/, ''))

function buildUi(dto: ExtensionDto): UiExtension {
  const serverSources = server.sources.filter(source => source.iconUrl?.includes(dto.pkgName))
  /* Suwayomi's REST payload has no "not loaded" flag. The closest observable equivalent of
     Mihon's `Extension.NotLoaded` is an installed extension the server registers no source
     for: it is on the device but provides nothing. The check only runs once the source list
     itself has been loaded, so an empty catalogue is not a false positive. */
  const notLoaded = dto.installed && server.sources.length > 0 && serverSources.length === 0
  const isShared = !!dto.repo
  return {
    key: `extension-${dto.pkgName}`,
    dto,
    kind: !dto.installed ? 'available' : notLoaded ? 'not-loaded' : 'loaded',
    name: dto.name,
    lang: dto.lang,
    versionName: dto.versionName,
    storeName: storeName(dto.repo),
    iconUrl: dto.iconUrl
      ? (/^https?:\/\//.test(dto.iconUrl) ? dto.iconUrl : `${serverBase.value}${dto.iconUrl}`)
      : '',
    installed: dto.installed,
    hasUpdate: dto.hasUpdate,
    obsolete: dto.obsolete,
    isShared,
    notLoadedReason: notLoaded ? 'failed' : undefined,
    sources: serverSources,
  }
}

/**
 * ExtensionsViewModel.searchQueryPredicate: comma separated subqueries, and a subquery matches
 * the extension name or one of the sources it provides (name, base URL or source id).
 */
function matches(extension: UiExtension, query: string): boolean {
  const subqueries = query.split(',').map(part => part.trim()).filter(Boolean)
  if (!subqueries.length) return true
  return subqueries.some(subquery => {
    const needle = subquery.toLowerCase()
    if (extension.name.toLowerCase().includes(needle)) return true
    return extension.sources.some(source =>
      source.name.toLowerCase().includes(needle) ||
      (source.baseUrl ?? '').toLowerCase().includes(needle) ||
      source.id === subquery,
    )
  })
}

const byName = (a: UiExtension, b: UiExtension) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/**
 * GetExtensionsByType partitions the catalogue and ExtensionsViewModel renders the groups in
 * this exact order:
 *   1. "Updates pending" — installed extensions (loaded or not loaded) with an update
 *   2. "Not loaded"      — installed extensions that provide no source
 *   3. "Installed"       — loaded extensions, non-obsolete first then obsolete last
 *   4. one header per language for available extensions, filtered by enabledLanguages
 */
const headers = computed<Header[]>(() => {
  const all = extensions.value.map(buildUi).filter(extension => matches(extension, debouncedQuery.value))
  const updates = all.filter(extension => extension.installed && extension.hasUpdate).sort(byName)
  const notLoaded = all.filter(extension => extension.kind === 'not-loaded' && !extension.hasUpdate).sort(byName)
  // Loaded extensions are sorted with the non-obsolete ones first.
  const loaded = all
    .filter(extension => extension.installed && !extension.hasUpdate && extension.kind === 'loaded')
    .sort((a, b) => Number(a.obsolete) - Number(b.obsolete) || byName(a, b))

  // Available extensions filtered by enabledLanguages from preferences
  const activeLanguages = new Set(enabledLanguages.value)
  const available = all.filter(extension => {
    if (extension.installed) return false
    if (!activeLanguages.size) return true
    return activeLanguages.has('all') || activeLanguages.has(extension.lang)
  })

  const byLang = new Map<string, UiExtension[]>()
  for (const extension of available) {
    const list = byLang.get(extension.lang) || []
    list.push(extension)
    byLang.set(extension.lang, list)
  }
  // LocaleHelper.comparator keeps "all" first, then compares the localized display names.
  const langKeys = [...byLang.keys()].sort((a, b) => {
    if (a === 'all') return b === 'all' ? 0 : -1
    if (b === 'all') return 1
    return languageName(a).localeCompare(languageName(b), undefined, { sensitivity: 'base' })
  })

  const result: Header[] = []
  if (updates.length) result.push({ key: 'header-updates', title: 'Updates pending', action: 'update-all', items: updates })
  if (notLoaded.length) result.push({ key: 'header-not-loaded', title: 'Not loaded', action: null, items: notLoaded })
  if (loaded.length) result.push({ key: 'header-installed', title: 'Installed', action: null, items: loaded })
  for (const lang of langKeys) {
    result.push({
      key: `header-lang-${lang}`,
      title: languageName(lang),
      action: null,
      items: byLang.get(lang)!.sort(byName),
    })
  }
  return result
})

/** ExtensionItemMetadata "facts": the language of a loaded extension plus the version name. */
function factsFor(extension: UiExtension): string {
  const facts: string[] = []
  if (extension.kind === 'loaded' && extension.lang) facts.push(languageName(extension.lang))
  if (extension.versionName) facts.push(extension.versionName)
  return facts.join(' • ')
}

/** ExtensionItemMetadata "notable": the content warning label (null for SAFE). */
function warningPill(extension: UiExtension) {
  const label = contentWarningLabel(extensionContentWarning(extension.dto))
  return label ? { text: label.title, color: label.color } : null
}

/** The icons that failed to load; the row then shows the error painter of the reference. */
const brokenIcons = ref(new Set<string>())
function onIconError(extension: UiExtension) {
  brokenIcons.value = new Set(brokenIcons.value).add(extension.key)
}

const updatesCount = computed(() => extensions.value.filter(extension => extension.installed && extension.hasUpdate).length)
const isEmpty = computed(() => !loading.value && headers.value.length === 0)

// --- dialogs / snackbar --------------------------------------------------------------------
/** The generic "not available in the web version" dialog. */
const stubDialog = ref<{ title: string; text: string; confirm: string; onConfirm?: () => void } | null>(null)
const stubOpen = computed({ get: () => stubDialog.value !== null, set: (value: boolean) => { if (!value) stubDialog.value = null } })

/** ExtensionNotLoadedDialog (ExtensionsScreen.kt:572-621). */
const notLoadedTarget = ref<UiExtension | null>(null)
const notLoadedOpen = ref(false)

/** ExtensionTrustDialog (ExtensionsScreen.kt:623-648). */
const trustTarget = ref<UiExtension | null>(null)
const trustOpen = ref(false)

/** ExtensionUninstallConfirmation (ExtensionsTab.kt:110-139). */
const uninstallTarget = ref<UiExtension | null>(null)
const uninstallOpen = ref(false)

const snackbar = ref('')
let snackbarTimer: number | undefined
function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 4000)
}

function openStub(title: string, text: string, confirm = 'OK', onConfirm?: () => void) {
  stubDialog.value = { title, text, confirm, onConfirm }
}

/* The catalogue fetch failed: ExtensionsViewModel reports MR.strings.extension_api_error. */
watch(loadError, value => { if (value) notify('Failed to fetch available extensions') })

// --- navigation & actions ------------------------------------------------------------------
function openFilter() {
  void router.push('/browse/extensions/filter')
}

function openStores() {
  void router.push('/browse/extensions/stores')
}

function openDetails(extension: UiExtension) {
  void router.push(`/browse/extension/${encodeURIComponent(extension.dto.pkgName)}`)
}

function installExtension(extension: UiExtension) {
  openStub(
    'Install extension',
    `Installing "${extension.name}" is not supported in the web version. Mihon installs extensions as Android packages (APK); manage them on your Suwayomi-Server instead.`,
  )
}

function updateExtension(extension: UiExtension) {
  openStub(
    'Update extension',
    `Updating "${extension.name}" is not supported in the web version. Extension updates are handled by the Mihon app on Android.`,
  )
}

function updateAllExtensions() {
  const count = updatesCount.value
  openStub(
    'Update all',
    `Updating ${count} extension${count === 1 ? '' : 's'} is not supported in the web version. Extension updates are handled by the Mihon app on Android.`,
  )
}

function openWebView(extension: UiExtension) {
  const source = extension.sources.find(item => item.baseUrl)
  if (source?.baseUrl) {
    openStub(
      'Open in WebView',
      'Opening a source in an in-app web view is not supported in the web version. The source website opens in your browser instead.',
      'Open website',
      () => { window.open(source.baseUrl!, '_blank', 'noopener,noreferrer') },
    )
    return
  }
  if (extension.dto.repo) {
    openStub(
      'Open in WebView',
      'Opening a source in an in-app web view is not supported in the web version. The extension repository opens in your browser instead.',
      'Open repository',
      () => { window.open(extension.dto.repo!, '_blank', 'noopener,noreferrer') },
    )
    return
  }
  openStub(
    'Open in WebView',
    'Opening a source in an in-app web view is not supported in the web version, and this extension provides no source on your server.',
  )
}

function uninstallExtension(extension: UiExtension) {
  notify(`Removing "${extension.name}" is not supported in the web version. Manage extensions on your Suwayomi-Server.`)
}

/* ExtensionsTab: long click on available installs it; on installed one opens the uninstall
   confirmation dialog. */
let pressTimer: number | undefined
let longPressed = false
function pressStart(extension: UiExtension) {
  longPressed = false
  if (pressTimer) window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressTimer = undefined
    longPressed = true
    if (extension.kind === 'available') {
      installExtension(extension)
    } else {
      uninstallTarget.value = extension
      uninstallOpen.value = true
    }
  }, 500)
}
function pressEnd() {
  if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = undefined }
}

/** ExtensionsScreen.onClickItem: available -> install, loaded -> details, not loaded -> dialog. */
function onRowClick(extension: UiExtension) {
  if (longPressed) { longPressed = false; return }
  if (extension.kind === 'available') { installExtension(extension); return }
  if (extension.kind === 'loaded') { openDetails(extension); return }
  if (extension.notLoadedReason === 'untrusted') {
    trustTarget.value = extension
    trustOpen.value = true
  } else {
    notLoadedTarget.value = extension
    notLoadedOpen.value = true
  }
}

/** ExtensionsScreen.onClickItemAction: primary action button. */
function onPrimaryAction(extension: UiExtension) {
  if (extension.kind === 'available') { installExtension(extension); return }
  if (extension.hasUpdate) { updateExtension(extension); return }
  if (extension.kind === 'loaded') { openDetails(extension); return }
  if (extension.notLoadedReason === 'untrusted') {
    trustTarget.value = extension
    trustOpen.value = true
  } else {
    notLoadedTarget.value = extension
    notLoadedOpen.value = true
  }
}

/** ExtensionsScreen.onClickItemSecondaryAction. */
function onSecondaryAction(extension: UiExtension) {
  if (extension.kind === 'available') { openWebView(extension); return }
  if (extension.kind === 'loaded') { openDetails(extension); return }
  if (extension.notLoadedReason === 'untrusted') {
    trustTarget.value = extension
    trustOpen.value = true
  } else {
    notLoadedTarget.value = extension
    notLoadedOpen.value = true
  }
}

// --- pull to refresh (PullRefresh) ----------------------------------------------------------
const listEl = ref<HTMLElement | null>(null)
const pullOffset = ref(0)
let pullStartY = 0
let pulling = false

function onTouchStart(event: TouchEvent) {
  const el = listEl.value
  if (!el || el.scrollTop > 0) return
  pullStartY = event.touches[0].clientY
  pulling = true
}

function onTouchMove(event: TouchEvent) {
  if (!pulling) return
  const el = listEl.value
  if (!el) return
  const delta = event.touches[0].clientY - pullStartY
  if (delta <= 0 || el.scrollTop > 0) { pullOffset.value = 0; return }
  event.preventDefault()
  pullOffset.value = Math.min(delta * 0.5, 96)
}

function onTouchEnd() {
  if (!pulling) return
  pulling = false
  if (pullOffset.value >= 64) void loadExtensions(true)
  pullOffset.value = 0
}

// --- fast scroll (FastScrollLazyColumn -> VerticalFastScroller) -----------------------------
const fastScrollVisible = ref(false)
const fastScrollTop = ref(0)
const THUMB_LENGTH = 48
let hideTimer: number | undefined
let dragging = false

function updateFastScroll() {
  const el = listEl.value
  if (!el) { fastScrollVisible.value = false; return }
  const height = el.getBoundingClientRect().height
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  if (height < 120 || max < 8) { fastScrollVisible.value = false; return }
  const ratio = Math.min(1, Math.max(0, el.scrollTop / max))
  fastScrollTop.value = ratio * (height - THUMB_LENGTH)
  fastScrollVisible.value = true
}
function onListScroll() {
  updateFastScroll()
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => { if (!dragging) fastScrollVisible.value = false }, 2000)
}
function startFastScrollDrag(event: PointerEvent) {
  const el = listEl.value
  if (!el) return
  dragging = true
  window.clearTimeout(hideTimer)
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  const move = (moveEvent: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (moveEvent.clientY - rect.top) / Math.max(1, rect.height - THUMB_LENGTH)))
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
    updateFastScroll()
  }
  const up = () => {
    dragging = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    onListScroll()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

onMounted(() => { window.addEventListener('resize', onListScroll) })
onBeforeUnmount(() => {
  window.removeEventListener('resize', onListScroll)
  if (hideTimer) window.clearTimeout(hideTimer)
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  if (debounceTimer) window.clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="extensions-screen" :class="{ 'is-embedded': props.embedded }">
    <!-- TabContent: title + search + the overflow actions (Filter, Extension stores).
         When the screen is embedded in the Browse tab the parent owns the app bar
         (TabbedScreen.kt:44-50) and renders the very same overflow actions. -->
    <SearchAppBar
      v-if="!props.embedded"
      v-model="searchQuery"
      title="Extensions"
      label="Search extensions"
      open-label="Search extensions"
    >
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            icon="more_vert"
            variant="text"
            class="extensions-app-bar-action"
            aria-label="Extensions options"
          />
        </template>
        <v-list>
          <v-list-item title="Filter" @click="openFilter" />
          <v-list-item title="Extension stores" @click="openStores" />
        </v-list>
      </v-menu>
    </SearchAppBar>

    <!-- LoadingScreen: Box(fillMaxSize, Alignment.Center) { CircularProgressIndicator() } (40dp, 4dp stroke). -->
    <div v-if="loading" class="extensions-loading" role="status" aria-label="Loading extensions">
      <Md3CircularProgress label="Loading extensions" />
    </div>

    <!-- EmptyScreen: kaomoji face, bodyMedium message, ActionButton("Extension stores"). -->
    <div v-else-if="isEmpty" class="extensions-empty-container">
      <MihonEmptyScreen :message="searchQuery ? 'No results found' : 'Well, this is awkward'">
        <button
          type="button"
          class="empty-action-button"
          @click="openStores"
        >
          <span class="material-symbols-rounded empty-action-icon" aria-hidden="true">settings</span>
          <span class="empty-action-label">Extension stores</span>
        </button>
      </MihonEmptyScreen>
    </div>

    <!-- ExtensionContent: FastScrollLazyColumn with topSmallPaddingValues (8dp). -->
    <div
      v-else
      ref="listEl"
      class="extensions-list"
      @scroll.passive="onListScroll"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend.passive="onTouchEnd"
    >
      <div class="extensions-list-inner" :style="{ transform: `translateY(${pullOffset}px)` }">
        <div v-if="refreshing || pullOffset > 0" class="pull-refresh" aria-hidden="true">
          <Md3CircularProgress :size="24" :stroke="3" label="Refreshing" />
        </div>

        <template v-for="header in headers" :key="header.key">
          <!-- ExtensionHeader: 16dp horizontal padding, text with 8dp vertical padding. -->
          <div class="extension-header">
            <h2 class="extension-header-text">{{ header.title }}</h2>
            <!-- Only "Updates pending" carries the "Update all" Button. -->
            <button
              v-if="header.action === 'update-all'"
              type="button"
              class="extension-header-action"
              @click="updateAllExtensions"
            >Update all</button>
          </div>

          <!-- ExtensionItem: BaseBrowseItem row (16dp horizontal / 8dp vertical padding). -->
          <div
            v-for="extension in header.items"
            :key="extension.key"
            class="extension-row"
            role="button"
            tabindex="0"
            :aria-label="extension.name"
            @click="onRowClick(extension)"
            @keydown.enter="onRowClick(extension)"
            @pointerdown="pressStart(extension)"
            @pointerup="pressEnd"
            @pointerleave="pressEnd"
            @pointercancel="pressEnd"
            @contextmenu.prevent="extension.kind === 'available' ? installExtension(extension) : (uninstallTarget = extension, uninstallOpen = true)"
          >
            <!-- ExtensionItemIcon: 48dp box. -->
            <div class="extension-icon-wrap">
              <!-- Extension.NotLoaded: filled dangerous symbol, 40dp, error tint. -->
              <span
                v-if="extension.kind === 'not-loaded'"
                class="material-symbols-rounded filled-symbol extension-icon-danger"
                aria-hidden="true"
              >dangerous</span>
              <template v-else>
                <img
                  v-if="extension.iconUrl && !brokenIcons.has(extension.key)"
                  class="extension-icon"
                  :class="{ 'extension-icon--available': extension.kind === 'available' }"
                  :src="extension.iconUrl"
                  alt=""
                  loading="lazy"
                  @error="onIconError(extension)"
                />
                <!-- Error painter: default source icon for Loaded; placeholder box for Available. -->
                <span
                  v-else-if="extension.kind === 'loaded'"
                  class="material-symbols-rounded extension-icon-default"
                  aria-hidden="true"
                >extension</span>
                <span v-else class="extension-icon-placeholder" aria-hidden="true" />
              </template>
            </div>

            <!-- ExtensionItemContent: 16dp start padding, name, store, metadata. -->
            <div class="extension-content">
              <p class="extension-name">{{ extension.name }}</p>
              <p v-if="extension.storeName" class="extension-store">{{ extension.storeName }}</p>
              <!-- ExtensionItemMetadata: FlowRow with 4dp horizontal / 2dp vertical spacing. -->
              <div class="extension-metadata">
                <span v-if="factsFor(extension)" class="extension-facts">{{ factsFor(extension) }}</span>
                <!-- Pills in exact Mihon notable order: installStep, notLoadedReason / obsolete, warning, private -->
                <ExtensionPill
                  v-if="extension.kind === 'not-loaded' && extension.notLoadedReason === 'untrusted'"
                  text="Untrusted"
                  color="error"
                />
                <ExtensionPill
                  v-else-if="extension.kind === 'not-loaded' && extension.notLoadedReason === 'filtered'"
                  text="Filtered"
                  color="error"
                />
                <ExtensionPill
                  v-else-if="extension.obsolete"
                  text="Orphaned"
                  color="error"
                />
                <ExtensionPill
                  v-if="warningPill(extension)"
                  :text="warningPill(extension)!.text"
                  :color="warningPill(extension)!.color"
                />
                <ExtensionPill
                  v-if="extension.kind === 'loaded' && !extension.isShared"
                  text="Private"
                  color="on-surface-variant"
                />
              </div>
            </div>

            <!-- ExtensionItemActions: secondary action, then primary action, 8dp apart. -->
            <div class="extension-actions">
              <!-- Secondary action -->
              <button
                v-if="extension.kind === 'available' && (extension.sources.length > 0 || extension.dto.repo)"
                type="button"
                class="extension-action-btn"
                aria-label="Open in WebView"
                @click.stop="onSecondaryAction(extension)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">public</span>
              </button>
              <button
                v-else-if="extension.kind === 'loaded'"
                type="button"
                class="extension-action-btn"
                aria-label="Settings"
                @click.stop="onSecondaryAction(extension)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">settings</span>
              </button>
              <button
                v-else-if="extension.kind === 'not-loaded' && extension.notLoadedReason === 'untrusted'"
                type="button"
                class="extension-action-btn"
                aria-label="Trust"
                @click.stop="onSecondaryAction(extension)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">verified_user</span>
              </button>
              <button
                v-else-if="extension.kind === 'not-loaded'"
                type="button"
                class="extension-action-btn"
                aria-label="Why it isn't loaded"
                @click.stop="onSecondaryAction(extension)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">info</span>
              </button>

              <!-- Primary action -->
              <button
                v-if="extension.kind === 'available'"
                type="button"
                class="extension-action-btn"
                aria-label="Install"
                @click.stop="onPrimaryAction(extension)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">download</span>
              </button>
              <button
                v-else-if="extension.hasUpdate"
                type="button"
                class="extension-action-btn"
                aria-label="Update"
                @click.stop="onPrimaryAction(extension)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">download</span>
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- VerticalFastScroller: 48dp length, 12dp width, 6dp radius, primary thumb. -->
      <div v-if="fastScrollVisible" class="extensions-fast-scroll" @pointerdown="startFastScrollDrag">
        <span class="extensions-fast-scroll-thumb" :style="{ transform: `translateY(${fastScrollTop}px)` }" />
      </div>
    </div>

    <!-- Web limitation stub dialog (M3 AlertDialog). -->
    <v-dialog v-model="stubOpen" content-class="ext-dialog-overlay">
      <div class="ext-m3-dialog">
        <h2 class="ext-m3-dialog-title">{{ stubDialog?.title }}</h2>
        <div class="ext-m3-dialog-content">
          <p class="ext-m3-dialog-text">{{ stubDialog?.text }}</p>
        </div>
        <div class="ext-m3-dialog-actions">
          <button type="button" class="ext-m3-dialog-button" @click="stubOpen = false">Cancel</button>
          <button
            type="button"
            class="ext-m3-dialog-button"
            @click="stubDialog?.onConfirm?.(); stubOpen = false"
          >{{ stubDialog?.confirm }}</button>
        </div>
      </div>
    </v-dialog>

    <!-- ExtensionNotLoadedDialog (item 49). -->
    <ExtensionNotLoadedDialog
      v-model="notLoadedOpen"
      :reason="notLoadedTarget?.notLoadedReason === 'untrusted' ? undefined : notLoadedTarget?.notLoadedReason"
      :message="notLoadedTarget?.name"
      @uninstall="uninstallExtension(notLoadedTarget!)"
    />

    <!-- ExtensionTrustDialog (item 48). -->
    <ExtensionTrustDialog
      v-model="trustOpen"
      :extension-name="trustTarget?.name"
      @uninstall="uninstallExtension(trustTarget!)"
    />

    <!-- ExtensionUninstallConfirmation (ExtensionsTab.kt:110-139). -->
    <v-dialog v-model="uninstallOpen" content-class="ext-dialog-overlay">
      <div class="ext-m3-dialog">
        <h2 class="ext-m3-dialog-title">Remove Extension?</h2>
        <div class="ext-m3-dialog-content">
          <p class="ext-m3-dialog-text">Do you really want to remove "{{ uninstallTarget?.name }}" extension?</p>
        </div>
        <div class="ext-m3-dialog-actions">
          <button type="button" class="ext-m3-dialog-button" @click="uninstallOpen = false">Cancel</button>
          <button
            type="button"
            class="ext-m3-dialog-button"
            @click="uninstallExtension(uninstallTarget!); uninstallOpen = false"
          >Remove</button>
        </div>
      </div>
    </v-dialog>

    <div v-if="snackbar" class="extensions-snackbar" role="status" aria-live="polite">
      <span class="snackbar-text">{{ snackbar }}</span>
    </div>
  </div>
</template>

<style>
/* Material3 BasicAlertDialog constraints (min 280dp, max 560dp, content sized). */
.v-dialog > .ext-dialog-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
.v-dialog > .ext-dialog-overlay > .ext-m3-dialog { box-shadow: none; }
</style>

<style scoped>
@layer app-components {
.extensions-screen {
  position: relative;
  height: calc(100dvh - var(--v-layout-top, 0px));
  background: rgb(var(--v-theme-background));
}

/* Embedded in the Browse tab: list fills remaining height minus tab row (48px). */
.extensions-screen.is-embedded {
  height: calc(100dvh - var(--v-layout-top, 0px) - 48px);
}

/* IconButton of material3: 48dp touch target with 24dp icon. */
.extensions-app-bar-action {
  width: 48px;
  height: 48px;
}

/* ExtensionContent: FastScrollLazyColumn with topSmallPaddingValues (8dp). */
.extensions-list {
  position: relative;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.extensions-list-inner {
  padding-top: 8px;
  padding-bottom: 96px;
}

.pull-refresh {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 36px;
}

/* VerticalFastScroller: 48dp length, 12dp width, 6dp radius (ThumbThickness / 2), primary color. */
.extensions-fast-scroll {
  position: absolute;
  top: 0;
  right: 2px;
  bottom: 0;
  width: 12px;
  z-index: 2;
  touch-action: none;
}
.extensions-fast-scroll-thumb {
  display: block;
  width: 12px;
  height: 48px;
  border-radius: 6px;
  background: rgb(var(--v-theme-primary));
}

/* ExtensionHeader: Row with 16dp horizontal padding, text with 8dp vertical padding,
   typography.header (bodyMedium, onSurfaceVariant, SemiBold 14/20 w600). */
.extension-header {
  display: flex;
  align-items: center;
  padding: 0 16px;
  min-height: 48px;
  gap: 8px;
}
.extension-header-text {
  margin: 0;
  flex: 1 1 0;
  min-width: 0;
  padding: 8px 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* M3 Button: 40dp height, 24dp content padding, full radius (20dp) and labelLarge (14/20 w500). */
.extension-header-action {
  height: 40px;
  min-width: 64px;
  padding: 0 24px;
  border: 0;
  border-radius: 20px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.extension-header-action:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 92%, white);
}
.extension-header-action:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 88%, white);
}
.extension-header-action:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* BaseBrowseItem: 16dp horizontal / 8dp vertical padding, vertically centered content. */
.extension-row {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.extension-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.extension-row:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.extension-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

/* ExtensionItemIcon: 48dp box. */
.extension-icon-wrap {
  position: relative;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
}
.extension-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  display: block;
}
/* ExtensionIcon for Extension.Available clips to MaterialTheme.shapes.extraSmall (4px)
   and paints placeholder Color(0x1F888888) behind it. */
.extension-icon--available { border-radius: 4px; background: #1f888888; }
/* Loaded extension is not clipped. */
.extension-icon-default {
  font-size: 48px;
  line-height: 48px;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* R.drawable.cover_error: flat placeholder box. */
.extension-icon-placeholder {
  display: block;
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background: #1f888888;
}
/* ExtensionIcon for Extension.NotLoaded: filled dangerous symbol, 40dp, error tint. */
.extension-icon-danger { font-size: 40px; line-height: 40px; color: rgb(var(--v-theme-error)); }

/* ExtensionItemContent: 16dp start padding, name (bodyMedium) + store (bodySmall). */
.extension-content {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  padding-left: 16px;
}
.extension-name {
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.extension-store {
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ExtensionItemMetadata: FlowRow, 4dp horizontal / 2dp vertical spacing. */
.extension-metadata {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 4px;
  row-gap: 2px;
}
.extension-facts {
  min-width: 0;
  max-width: 100%;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ExtensionItemActions: 8dp spacing between the icon buttons.
   Compose IconButton is a 48dp touch target with a 24dp icon. */
.extension-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.extension-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  padding: 0;
  border: 0;
  border-radius: 24px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.extension-action-btn:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 8%, transparent);
}
.extension-action-btn:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 12%, transparent);
}
.extension-action-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.extension-action-btn .material-symbols-rounded {
  font-size: 24px;
  line-height: 24px;
}

/* LoadingScreen: centered CircularProgressIndicator. */
.extensions-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 320px);
}

/* EmptyScreen container */
.extensions-empty-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 320px);
}

/* ActionButton (ActionButton.kt): TextButton with Column(4dp spacing) holding the 24dp Icon and the title. */
.empty-action-button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 64px;
  min-height: 48px;
  padding: 8px 16px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.empty-action-button:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}
.empty-action-button:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}
.empty-action-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.empty-action-icon {
  font-size: 24px;
  line-height: 24px;
}
.empty-action-label {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
}

/* Material 3 AlertDialog: Surface(shape = CornerExtraLarge 28dp, color = surfaceContainerHigh),
   Column(padding 24dp), title Box(bottom 16dp), text Box(bottom 24dp), buttons Box(align = End). */
.ext-m3-dialog {
  box-sizing: border-box;
  align-self: center;
  width: fit-content;
  min-width: min(280px, calc(100vw - 48px));
  max-width: 560px;
  max-height: calc(100dvh - 48px);
  margin: 0 auto;
  overflow-y: auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}
/* DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400), DialogTokens.HeadlineColor = OnSurface. */
.ext-m3-dialog-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}
/* AlertDialogDefaults.textPadding = 24dp bottom. */
.ext-m3-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 24px;
}
/* DialogTokens.SupportingTextFont = BodyMedium (14/20, w400), color = OnSurfaceVariant. */
.ext-m3-dialog-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: pre-line;
}
/* Material3 AlertDialog lays buttons at end of row: dismiss (left) first, confirm (right) last, 8dp apart. */
.ext-m3-dialog-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  row-gap: 8px;
}
/* MD3 TextButton: 40dp height, 58dp min width, 20dp shape, LabelLarge (14/20, w500), primary. */
.ext-m3-dialog-button {
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.ext-m3-dialog-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.ext-m3-dialog-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent); }
.ext-m3-dialog-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* MD3 snackbar: inverseSurface container, inverseOnSurface text, 4dp radius, 48dp min height. */
.extensions-snackbar {
  position: fixed;
  left: calc((100% + var(--v-layout-left, 0px) - var(--v-layout-right, 0px)) / 2);
  bottom: calc(var(--v-layout-bottom, 0px) + 16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(560px, calc(100vw - 32px));
  min-width: min(344px, calc(100vw - 32px));
  min-height: 48px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
.snackbar-text { flex: 1 1 auto; }
}
</style>
