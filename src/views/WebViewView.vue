<script setup lang="ts">
/**
 * WebView screen.
 *
 * Reference (pixel parity target):
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/webview/WebViewScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/webview/WebViewScreenContent.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/Banners.kt
 *
 * Structure (WebViewScreenContent.kt):
 *   Scaffold(
 *     topBar = {
 *       Box {
 *         Column {
 *           AppBar(
 *             title = currentWindow.state.pageTitle ?: initialTitle,
 *             subtitle = currentUrl,
 *             navigateUp = onNavigateUp,
 *             navigationIcon = MaterialSymbols.Rounded.Close,
 *             actions = AppBarActions(
 *               [Action(back, enabled = navigator.canGoBack),
 *                Action(forward, enabled = navigator.canGoForward),
 *                OverflowAction(refresh),
 *                OverflowAction(share),
 *                OverflowAction(open in browser),
 *                OverflowAction(clear cookies)]
 *               (+ Action(tab close) prepended when a second window is open)
 *             )
 *           )
 *           if (showCloudflareHelp) Surface(padding 8.dp) { WarningBanner(...) }
 *         }
 *         LinearProgressIndicator aligned to bottom center while loading
 *       }
 *     }
 *   ) { contentPadding -> WebView(fillMaxSize().padding(contentPadding)) }
 *
 * The Android in-app WebView (android.webkit.WebView) has no browser equivalent:
 * a web page cannot be embedded in a web page. The screen is therefore rendered
 * with the exact chrome of the reference (app bar, action buttons, overflow menu,
 * banner slot, progress slot) and the content area shows an honest stub that
 * offers the only honest alternative: opening the page in a real browser tab.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

/** WebViewScreen.kt: the screen is created with a url and an optional initial title. */
const url = computed(() => {
  const raw = route.query.url
  return typeof raw === 'string' ? raw : ''
})
const initialTitle = computed(() => {
  const raw = route.query.title
  return typeof raw === 'string' && raw.length ? raw : null
})

/** AppBarTitle: the page title wins over the initial title; without a page the initial one is used. */
const pageTitle = ref<string | null>(null)
const title = computed(() => pageTitle.value ?? initialTitle.value)

/** AppBarTitle subtitle: the current url, shown as a marquee. */
const currentUrl = ref(url.value)

/** AppBarActions: the history of the embedded browser is always empty without a WebView. */
const canGoBack = ref(false)
const canGoForward = ref(false)

/** Accompanist LoadingState: without a WebView the page is never loading. */
const loading = ref(false)

/** Banners.kt WarningBanner is only shown when the page is behind a Cloudflare challenge. */
const showCloudflareHelp = ref(false)

const snackbar = ref<string | null>(null)
let snackbarTimer: ReturnType<typeof setTimeout> | undefined

function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value = null }, 4000)
}

/** WebViewNavigator.reload() — the page is not embedded, so the browser tab is reloaded instead. */
function refresh() {
  if (!url.value) return
  window.open(url.value, '_blank', 'noopener,noreferrer')
}

/** WebViewViewModel.shareWebpage(context, it) — the system share sheet. */
async function share() {
  if (!url.value) return
  const payload = { title: title.value ?? url.value, url: url.value }
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (typeof nav.share === 'function') {
    try {
      await nav.share(payload)
    } catch {
      /* the user dismissed the share sheet */
    }
    return
  }
  try {
    await navigator.clipboard.writeText(url.value)
    showSnackbar('Link copied to clipboard')
  } catch {
    showSnackbar('Sharing is not supported in this browser')
  }
}

/** WebViewViewModel.openInBrowser(context, it) — the only working path in a web build. */
function openInBrowser() {
  if (!url.value) return
  window.open(url.value, '_blank', 'noopener,noreferrer')
}

/** WebViewViewModel.clearCookies — Android-only WebView cookie store. */
function clearCookies() {
  showSnackbar('Clearing WebView cookies is not supported in the web version.')
}

/** WebViewScreenContent.onNavigateUp — the close icon pops the screen. */
function navigateUp() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  void router.push('/more')
}

onMounted(() => {
  document.body.classList.add('webview-screen-active')
  currentUrl.value = url.value
})

onBeforeUnmount(() => {
  document.body.classList.remove('webview-screen-active')
  if (snackbarTimer) clearTimeout(snackbarTimer)
})
</script>

<template>
  <section class="webview-screen">
    <!-- AppBar.kt: TopAppBar, 64dp tall, surface container color, close navigation icon. -->
    <header class="webview-toolbar">
      <button class="webview-icon-button" type="button" aria-label="Navigate up" @click="navigateUp">
        <v-icon icon="close" size="24" />
      </button>

      <!-- AppBarTitle: title + subtitle (bodyMedium, marquee). -->
      <div class="webview-titles">
        <h1 class="webview-title">{{ title ?? '' }}</h1>
        <span class="webview-subtitle">{{ currentUrl }}</span>
      </div>

      <!-- AppBarActions: enabled actions, then the overflow button. -->
      <button class="webview-icon-button" type="button" aria-label="Back" :disabled="!canGoBack">
        <v-icon icon="arrow_back" size="24" />
      </button>
      <button class="webview-icon-button" type="button" aria-label="Forward" :disabled="!canGoForward">
        <v-icon icon="arrow_forward" size="24" />
      </button>
      <v-menu location="bottom end">
        <template #activator="{ props }">
          <button class="webview-icon-button" type="button" aria-label="More options" v-bind="props">
            <v-icon icon="more_vert" size="24" />
          </button>
        </template>
        <v-list density="compact" class="webview-menu-list">
          <v-list-item title="Refresh" @click="refresh" />
          <v-list-item title="Share" @click="share" />
          <v-list-item title="Open in browser" @click="openInBrowser" />
          <v-list-item title="Clear cookies" @click="clearCookies" />
        </v-list>
      </v-menu>
    </header>

    <!-- Banners.kt WarningBanner, wrapped in a Surface with 8.dp padding. -->
    <div v-if="showCloudflareHelp" class="webview-banner-wrap">
      <p class="webview-banner">Tap here for help with Cloudflare</p>
    </div>

    <!-- LinearProgressIndicator aligned to the bottom of the top bar box. -->
    <v-progress-linear v-if="loading" indeterminate color="primary" class="webview-progress" />

    <!-- The embedded WebView itself: not available in a browser. -->
    <div class="webview-body">
      <p class="webview-stub-title">WebView is not available in the browser</p>
      <p class="webview-stub-text">
        Android's in-app WebView cannot be embedded in a web page, so this screen shows no page content.
        Open the address in a real browser tab instead.
      </p>
      <p v-if="url" class="webview-stub-url">{{ url }}</p>
      <v-btn v-if="url" color="primary" variant="tonal" class="webview-stub-action" @click="openInBrowser">
        Open in browser
      </v-btn>
    </div>

    <!-- SnackbarHost.kt -->
    <div v-if="snackbar" class="webview-snackbar" role="status" aria-live="polite">{{ snackbar }}</div>
  </section>
</template>

<style>
/* The shared shell bar is hidden while this screen provides its own top bar (see AppBar.kt). */
body.webview-screen-active .app-toolbar { display: none; }
</style>

<style scoped>
.webview-screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* AppBar.kt / TopAppBar: 64dp tall, container color surfaceColorAtElevation(0dp) = surface. */
.webview-toolbar {
  position: fixed;
  top: 0;
  left: var(--v-layout-left);
  right: var(--v-layout-right);
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* IconButton: 40.dp container with a 24.dp icon. */
.webview-icon-button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0;
  padding: 12px;
  border: none;
  border-radius: 24px;
  background: none;
  color: inherit;
  cursor: pointer;
}

.webview-icon-button:hover:not(:disabled) {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

/* A disabled IconButton keeps the 24dp icon but takes the 38% disabled alpha. */
.webview-icon-button:disabled {
  cursor: default;
  opacity: 0.38;
}

/* AppBarTitle: Column with the title (titleLarge) and the subtitle (bodyMedium). */
.webview-titles {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* TopAppBar title slot: titleLarge (22sp / 28sp, weight 400). */
.webview-title {
  margin: 0;
  padding: 0 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Subtitle: bodyMedium (14sp / 20sp) with the basicMarquee behaviour. */
.webview-subtitle {
  display: block;
  padding: 0 4px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: webview-marquee 12s linear infinite;
}

@keyframes webview-marquee {
  0%, 12% { transform: translateX(0); }
  50%, 62% { transform: translateX(calc(-100% + 48px)); }
  100% { transform: translateX(0); }
}

/* Banners.kt WarningBanner: error container, onError text, bodyMedium, centered, 16.dp padding. */
.webview-banner-wrap {
  padding: 8px;
  background: rgb(var(--v-theme-surface));
}

.webview-banner {
  margin: 0;
  padding: 16px;
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  border-radius: 4px;
  cursor: pointer;
}

/* LinearProgressIndicator.kt: 4.dp track, aligned to the bottom of the top bar box. */
.webview-progress {
  position: fixed;
  top: 64px;
  left: var(--v-layout-left);
  right: var(--v-layout-right);
  z-index: 4;
  height: 4px;
  margin: 0;
}

/* The WebView content area (fillMaxSize with the Scaffold content padding). */
.webview-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 64px);
  padding: 64px 24px 24px;
  text-align: center;
}

.webview-stub-title {
  margin: 0;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}

.webview-stub-text {
  margin: 8px 0 0;
  max-width: 480px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.webview-stub-url {
  margin: 16px 0 0;
  max-width: 480px;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  word-break: break-all;
}

.webview-stub-action {
  margin-top: 24px;
}

/* DropdownMenu.kt: compact list, 16.sp text with a normal weight. */
.webview-menu-list {
  min-width: 196px;
  padding: 0;
  background: rgb(var(--v-theme-surface-container));
}

.webview-menu-list :deep(.v-list-item) {
  min-height: 48px;
  padding: 0 12px 0 16px;
}

.webview-menu-list :deep(.v-list-item-title) {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
}

/* Material 3 snackbar. */
.webview-snackbar {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  z-index: 12;
  max-width: min(560px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
}
</style>
