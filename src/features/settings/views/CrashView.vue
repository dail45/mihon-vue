<script setup lang="ts">
/**
 * Crash screen.
 *
 * Reference (Mihon, pinned commit 446f6df):
 *   eu.kanade.tachiyomi.crash.CrashActivity
 *     - WindowCompat.setDecorFitsSystemWindows(window, false): the content is drawn
 *       edge to edge, under the status bar.
 *     - setComposeContent { CrashScreen(exception, onRestartClick = { finishAffinity();
 *       startActivity(MainActivity) }) }
 *   eu.kanade.presentation.crash.CrashScreen
 *     - InfoScreen(icon = MaterialSymbols.Rounded.BugReport,
 *                  headingText = crash_screen_title,
 *                  subtitleText = crash_screen_description % app_name,
 *                  acceptText = pref_dump_crash_logs,
 *                  onAcceptClick = { crashLogUtil.dumpLogs(exception) },
 *                  rejectText = crash_screen_restart_application,
 *                  onRejectClick = onRestartClick) {
 *         Box(padding(vertical = 8.dp).clip(shapes.small).fillMaxSize()
 *               .background(surfaceVariant)) {
 *           Text(exception.toString(), padding(all = 8.dp), color = onSurfaceVariant)
 *         }
 *       }
 *   tachiyomi.presentation.core.screens.InfoScreen
 *     - Scaffold(bottomBar = { Column(background = background, hairline top rule of
 *         `outline`, windowInsetsPadding(NavigationBarDefaults.windowInsets),
 *         padding(horizontal = 16.dp, vertical = 8.dp)) {
 *             Button(fillMaxWidth, enabled = canAccept) { Text(acceptText) }
 *             Row(spacedBy(4.dp)) { OutlinedButton(weight(1f)) { Text(rejectText) } }
 *           } })
 *     - Content: Column(verticalScroll, fillMaxWidth, padding(paddingValues),
 *         padding(top = 48.dp), padding(horizontal = 16.dp)) {
 *           Icon(icon, padding(bottom = 8.dp), size = 48.dp, tint = primary)
 *           Text(headingText, typography.headlineLarge)
 *           Text(subtitleText, secondaryItemAlpha(), padding(vertical = 8.dp),
 *                typography.titleSmall)
 *           content()
 *         }
 *     - A status bar scrim (background at secondary alpha) covers the top inset.
 *
 * Strings (i18n/base/strings.xml):
 *   crash_screen_title            = "Whoops!"
 *   crash_screen_description       = "%s ran into an unexpected error. We suggest you
 *                                     share the crash logs in our support channel on Discord."
 *   crash_screen_restart_application = "Restart the application"
 *   pref_dump_crash_logs           = "Share crash logs"
 *   app_name                       = "Mihon" (this web client is "Mihon Vue")
 *
 * Constants (tachiyomi.presentation.core.components.material.Constants):
 *   SECONDARY_ALPHA = 0.78, padding.small = 8.dp, medium = 16.dp, extraSmall = 4.dp
 *   MD3 shapes.small = 8.dp corner radius
 *
 * Web limitations:
 *   - "Share crash logs" dumps the on-device Android log files to a share sheet
 *     (crashLogUtil.dumpLogs). The browser has no access to the Android log
 *     directory and no share sheet for arbitrary files, so the action opens a
 *     dialog stating that crash log sharing is unavailable in the web version.
 *   - "Restart the application" restarts the whole app task; in the browser the
 *     closest equivalent is a reload of the current document.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** MR.strings.app_name */
const defaultAppName = 'Mihon'

const props = withDefaults(
  defineProps<{
    /** The exception text shown in the surfaceVariant box (exception.toString()). */
    exception?: string | null
    appName?: string
  }>(),
  { exception: null, appName: defaultAppName },
)

const router = useRouter()
let routeQueryException: string | null = null
try {
  const route = useRoute()
  if (route && typeof route.query?.exception === 'string') {
    routeQueryException = route.query.exception
  }
} catch {
  // outside router context
}

const shareDialog = ref(false)
const snackbar = ref(false)
const snackbarMessage = ref('')

/** crash_screen_description = "%s ran into an unexpected error. ..." */
const subtitle = computed(
  () => `${props.appName} ran into an unexpected error. We suggest you share the crash logs in our support channel on Discord.`,
)

/** Kotlin renders `null.toString()` as the literal "null" inside the box. */
const exceptionText = computed(() => {
  if (props.exception !== null && props.exception !== undefined) return props.exception
  if (routeQueryException) return routeQueryException
  if (typeof window !== 'undefined' && window.history?.state?.exception) {
    return String(window.history.state.exception)
  }
  return 'null'
})

/** onRejectClick: finishAffinity() + startActivity(MainActivity) — a full app restart. */
async function restart() {
  if (router) {
    await router.replace('/library')
  }
  window.location.reload()
}

async function copyErrorToClipboard() {
  try {
    await navigator.clipboard.writeText(exceptionText.value)
    snackbarMessage.value = 'Copied to clipboard'
    snackbar.value = true
  } catch {
    snackbarMessage.value = 'Failed to copy to clipboard'
    snackbar.value = true
  }
}
</script>

<template>
  <section class="crash-screen">
    <!-- Status bar scrim: background at secondary alpha over the status bar inset. -->
    <div class="crash-screen__scrim" aria-hidden="true" />

    <!-- InfoScreen content Column: verticalScroll, fillMaxWidth, padding(top = 48.dp). -->
    <div class="crash-screen__content">
      <!-- Icon(BugReport, 48.dp, tint = primary, padding(bottom = 8.dp)) -->
      <v-icon icon="bug_report" size="48" color="primary" class="crash-screen__icon" aria-hidden="true" />

      <!-- Text(crash_screen_title, headlineLarge) -->
      <h1 class="crash-screen__heading">Whoops!</h1>

      <!-- Text(crash_screen_description, titleSmall, secondaryItemAlpha, vertical padding 8.dp) -->
      <p class="crash-screen__subtitle">{{ subtitle }}</p>

      <!-- CrashScreen content: Box(padding(vertical = 8.dp), clip(shapes.small),
           fillMaxSize, background(surfaceVariant)) { Text(padding(all = 8.dp)) } -->
      <div class="crash-screen__exception">
        <div class="crash-screen__exception-box">
          <p class="crash-screen__exception-text">{{ exceptionText }}</p>
        </div>
      </div>
    </div>

    <!-- InfoScreen bottomBar: Column(background, hairline top rule, bottom window
         insets, padding(horizontal = 16.dp, vertical = 8.dp)). -->
    <footer class="crash-screen__bottom-bar">
      <!-- Button(fillMaxWidth) { Text(acceptText) } -->
      <v-btn color="primary" variant="flat" block class="crash-screen__button" @click="shareDialog = true">
        Share crash logs
      </v-btn>
      <!-- Row(spacedBy(4.dp)) { OutlinedButton(weight(1f)) { Text(rejectText) } } -->
      <div class="crash-screen__actions-row">
        <v-btn color="primary" variant="outlined" block class="crash-screen__button crash-screen__button--outlined" @click="restart">
          Restart the application
        </v-btn>
      </div>
    </footer>

    <!-- Web limitation stub: MD3 AlertDialog explaining Android logcat dump limitation -->
    <v-dialog v-model="shareDialog" max-width="440">
      <v-card class="crash-screen__dialog-card">
        <v-card-title class="crash-screen__dialog-title">Share crash logs</v-card-title>
        <v-card-text class="crash-screen__dialog-text">
          Sharing crash logs dumps the Android system log files to a share sheet. The web
          version runs in the browser and has no access to those log files, so this action
          is not supported here. Copy the error details above and share them in the support
          channel instead.
        </v-card-text>
        <v-card-actions class="crash-screen__dialog-actions">
          <v-btn color="primary" variant="text" class="crash-screen__dialog-btn" @click="copyErrorToClipboard">
            Copy to clipboard
          </v-btn>
          <v-spacer />
          <v-btn color="primary" variant="text" class="crash-screen__dialog-btn" @click="shareDialog = false">
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar"
      :timeout="3000"
      rounded="pill"
      class="crash-screen__snackbar"
    >
      {{ snackbarMessage }}
    </v-snackbar>
  </section>
</template>

<style scoped>
@layer app-components {
.crash-screen {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  /* Scaffold containerColor = MaterialTheme.colorScheme.background */
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-surface));
}

/* Status bar scrim: Box(zIndex 2f, secondaryItemAlpha, background = background,
   fillMaxWidth, height = top inset). */
.crash-screen__scrim {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: env(safe-area-inset-top, 0px);
  background: rgb(var(--v-theme-background));
  opacity: .78;
  pointer-events: none;
  z-index: 2;
}

/* Column(verticalScroll, fillMaxWidth, padding(paddingValues), padding(top = 48.dp),
   padding(horizontal = 16.dp)) */
.crash-screen__content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-sizing: border-box;
  width: 100%;
  /* paddingValues.top is the status bar inset; the column adds 48.dp on top of it.
     paddingValues.bottom (the bottom bar height) is already outside this column. */
  padding-top: calc(env(safe-area-inset-top, 0px) + 48px);
  padding-bottom: 0;
  padding-left: 16px;
  padding-right: 16px;
}

/* Icon(padding(bottom = 8.dp), size = 48.dp, tint = primary) */
.crash-screen__icon {
  display: block;
  font-size: 48px;
  line-height: 48px;
  width: 48px;
  height: 48px;
  margin-bottom: 8px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
}

/* Text(crash_screen_title, typography.headlineLarge) — 32.sp / 40.sp, Regular. */
.crash-screen__heading {
  margin: 0;
  font-size: 32px;
  line-height: 40px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}

/* Text(crash_screen_description, secondaryItemAlpha(), padding(vertical = 8.dp),
   typography.titleSmall) — 14.sp / 20.sp, Medium. */
.crash-screen__subtitle {
  margin: 8px 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
}

/* Box(padding(vertical = 8.dp).clip(shapes.small).fillMaxSize()
     .background(surfaceVariant)).
   The Column scrolls, so the box height is unbounded and fillMaxSize only fills the
   width; the surfaceVariant area is as tall as the exception text. */
.crash-screen__exception {
  flex: 0 0 auto;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 0;
}

/* The clipped, surfaceVariant filled box. */
.crash-screen__exception-box {
  width: 100%;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-variant));
  overflow: hidden;
}

/* Text(exception.toString(), padding(all = 8.dp), color = onSurfaceVariant) —
   default typography.bodyLarge: 16.sp / 24.sp, Regular. */
.crash-screen__exception-text {
  margin: 0;
  padding: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: .5px;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  user-select: text;
}

/* bottomBar Column(background = background, hairline top rule of `outline`,
   windowInsetsPadding(NavigationBarDefaults.windowInsets),
   padding(horizontal = 16.dp, vertical = 8.dp)) */
.crash-screen__bottom-bar {
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* drawBehind: drawLine(outline, 0f -> size.width, strokeWidth = Hairline) */
  border-top: 1px solid rgb(var(--v-theme-outline));
  background: rgb(var(--v-theme-background));
  /* windowInsetsPadding(NavigationBarDefaults.windowInsets) adds the bottom inset
     below the 8.dp vertical padding. */
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
  padding-left: 16px;
  padding-right: 16px;
  padding-top: 8px;
}

/* Row(horizontalArrangement = Arrangement.spacedBy(MaterialTheme.padding.extraSmall)) */
.crash-screen__actions-row {
  display: flex;
  width: 100%;
  gap: 4px;
}

/* Material3 Button / OutlinedButton: 40.dp tall, content padding 24.dp horizontal,
   labelLarge 14.sp / 20.sp Medium, fully rounded (percent 50) shape, no elevation. */
.crash-screen__button {
  height: 40px;
  border-radius: 20px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  text-transform: none;
  box-shadow: none;
}

/* Material3 OutlinedButton: transparent container, 1.dp border of `outline`,
   content color `primary`. */
.crash-screen__button--outlined {
  border-width: 1px !important;
  border-color: rgb(var(--v-theme-outline)) !important;
  color: rgb(var(--v-theme-primary)) !important;
}

/* Material 3 AlertDialog styling */
.crash-screen__dialog-card {
  border-radius: 28px !important;
  padding: 24px;
  background: rgb(var(--v-theme-surface-container-high)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3) !important;
}

.crash-screen__dialog-title {
  padding: 0 0 16px 0 !important;
  font-size: 24px !important;
  line-height: 32px !important;
  font-weight: 400 !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

.crash-screen__dialog-text {
  padding: 0 0 24px 0 !important;
  font-size: 14px !important;
  line-height: 20px !important;
  font-weight: 400 !important;
  color: rgb(var(--v-theme-on-surface-variant)) !important;
}

.crash-screen__dialog-actions {
  display: flex;
  align-items: center;
  padding: 0 !important;
  min-height: 40px;
}

.crash-screen__dialog-btn {
  height: 40px !important;
  border-radius: 20px !important;
  font-size: 14px !important;
  line-height: 20px !important;
  font-weight: 500 !important;
  letter-spacing: .1px !important;
  text-transform: none !important;
}
}
</style>
