<script setup lang="ts">
/**
 * Support us screen — pixel parity target:
 *   mihon/app/src/main/java/mihon/feature/support/SupportUsScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt
 *
 * Structure (SupportUsScreen.kt):
 *   Scaffold(topBar = AppBar(title = stringResource(MR.strings.label_support_us), navigateUp = pop))
 *     Column(
 *       verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small = 8dp),
 *       padding(horizontal = MaterialTheme.padding.medium = 16dp),
 *       verticalScroll
 *     )
 *       Spacer(height = top bar height 64dp)  <- overlays the scroll area
 *       Text(perks)                           -> bodyMedium, padding horizontal 16dp (32dp total inset)
 *       SupportItem(Patreon)                  -> Card { TextPreferenceWidget(icon, title, widget = OpenInNew) }
 *       SupportItem(OpenCollective)           -> Card { TextPreferenceWidget(icon, title, widget = OpenInNew) }
 *       Text(currentlySupportedBy, 200)       -> bodyMedium, padding horizontal 16dp (32dp total inset)
 *       Text(contactForDetailsMessage)        -> bodyMedium, padding horizontal 16dp (32dp total inset)
 *       SupportItem(Discord)                  -> Card { TextPreferenceWidget(icon, title, widget = OpenInNew) }
 *       Spacer(height = bottom padding)
 *
 * TextPreferenceWidget & BasePreferenceWidget metrics:
 *   - Card container: 12dp rounded corners (ShapeDefaults.Medium), surfaceVariant container.
 *   - minHeight = 56dp (LocalPreferenceMinHeight).
 *   - Leading icon: Box(padding start = 16dp, end = 8dp) with 24dp icon tinted with primary.
 *   - Title: Column(weight = 1f, padding vertical = 16dp) > Text(horizontal padding = 16dp, titleLarge, fontSize = 16sp).
 *   - Trailing widget: Box(padding end = 16dp) with 24dp OpenInNew icon, onSurfaceVariant color.
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

/** SimpleIcons paths (simple-icons, 24x24 viewBox) used as the card icons. */
const PATREON = 'M22.957 7.21c-.004-3.064-2.391-5.576-5.191-6.482-3.478-1.125-8.064-.962-11.384.604C2.357 3.231 1.093 7.391 1.046 11.54c-.039 3.411.302 12.396 5.369 12.46 3.765.047 4.326-4.804 6.068-7.141 1.24-1.662 2.836-2.132 4.801-2.618 3.376-.836 5.678-3.501 5.673-7.031Z'
const OPEN_COLLECTIVE = 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c2.54 0 4.894-.79 6.834-2.135l-3.107-3.109a7.715 7.715 0 1 1 0-13.512l3.107-3.109A11.943 11.943 0 0 0 12 0zm9.865 5.166l-3.109 3.107A7.67 7.67 0 0 1 19.715 12a7.682 7.682 0 0 1-.959 3.727l3.109 3.107A11.943 11.943 0 0 0 24 12c0-2.54-.79-4.894-2.135-6.834z'
const DISCORD = 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z'

interface SupportItem {
  key: string
  icon: string
  title: string
  url: string
}

/** Constants.kt: URL_DONATE_PATREON / URL_DONATE_OPENCOLLECTIVE / URL_DISCORD. */
const items: SupportItem[] = [
  { key: 'patreon', icon: PATREON, title: 'Patreon (preferred)', url: 'https://patreon.com/mihon/membership' },
  { key: 'opencollective', icon: OPEN_COLLECTIVE, title: 'OpenCollective', url: 'https://opencollective.com/mihon/contribute' },
  { key: 'discord', icon: DISCORD, title: 'Discord', url: 'https://discord.gg/mihon' },
]

/** MR.strings.supportUsScreen.perks */
const perksText = 'Patrons get access to exclusive channels, with more perks to come.'
/** MR.strings.supportUsScreen.currentlySupportedBy (200) */
const supportedByText = "Mihon is currently backed by 200+ patrons. We want to thank each and everyone of you. Let's make Mihon even better together."
/** MR.strings.supportUsScreen.contactForDetailsMessage */
const contactText = 'For alternative options or any related questions, join our Discord server.'

function goBack() {
  if (typeof window.history.state?.back === 'string') {
    router.back()
    return
  }
  void router.push('/more')
}

onMounted(() => {
  document.body.classList.add('support-screen-active')
})

onBeforeUnmount(() => {
  document.body.classList.remove('support-screen-active')
})
</script>

<template>
  <section class="support-screen">
    <!-- AppBar.kt: TopAppBar, 64dp tall, surfaceColorAtElevation(0dp) = surface, up navigation icon. -->
    <header class="support-toolbar">
      <button
        type="button"
        class="support-back"
        aria-label="Navigate up"
        title="Navigate up"
        @click="goBack"
      >
        <span class="material-symbols-rounded support-back-icon" aria-hidden="true">arrow_back</span>
      </button>
      <h1 class="support-toolbar-title">Support Us</h1>
    </header>

    <!-- Column(verticalScroll, spacedBy(8dp), padding horizontal = 16dp) -->
    <div class="support-content">
      <p class="support-paragraph support-paragraph--inset">{{ perksText }}</p>

      <!-- SupportItem -> Card { TextPreferenceWidget } -->
      <a
        v-for="item in items.slice(0, 2)"
        :key="item.key"
        class="support-card"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="support-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path :d="item.icon" fill="currentColor" /></svg>
        </span>
        <span class="support-title">{{ item.title }}</span>
        <span class="support-widget">
          <span class="material-symbols-rounded support-widget-icon" aria-hidden="true">open_in_new</span>
        </span>
      </a>

      <p class="support-paragraph support-paragraph--inset">{{ supportedByText }}</p>
      <p class="support-paragraph support-paragraph--inset">{{ contactText }}</p>

      <a
        v-for="item in items.slice(2)"
        :key="item.key"
        class="support-card"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="support-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path :d="item.icon" fill="currentColor" /></svg>
        </span>
        <span class="support-title">{{ item.title }}</span>
        <span class="support-widget">
          <span class="material-symbols-rounded support-widget-icon" aria-hidden="true">open_in_new</span>
        </span>
      </a>
    </div>
  </section>
</template>

<style>
/* The shared shell bar is hidden while this screen provides its own top bar (SupportUsScreen.kt). */
body.support-screen-active .app-toolbar { display: none; }
/* The screen owns the full viewport height below the shell bar: the app bar overlays the
   scroll area (Scaffold content), so the shell must not reserve space for its own bar. */
body.support-screen-active .v-main { padding-top: 0; }
</style>

<style scoped>
@layer app-components {
.support-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* AppBar.kt / TopAppBar: 64dp tall, container color surfaceColorAtElevation(0dp) = surface. */
.support-toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* Material3 TopAppBar navigation icon slot: 48dp container (40dp state layer), 24dp icon. */
.support-back {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 24px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.support-back::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 20px;
  background: currentColor;
  opacity: 0;
  transition: opacity .2s ease-in-out;
  pointer-events: none;
}
@media (hover: hover) {
  .support-back:hover::before {
    opacity: 0.08;
  }
}
.support-back:active::before {
  opacity: 0.12;
}
.support-back:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.support-back-icon {
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* TopAppBar title slot: titleLarge (22sp / 28sp, Regular), maxLines 1 + ellipsis. */
.support-toolbar-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 4px;
  font-family: Roboto, sans-serif;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Column(verticalScroll, spacedBy(padding.small = 8dp)) whose PaddingValues zero the top and
   bottom padding and add padding.medium = 16dp to the sides. The first child Spacer(64dp)
   pushes content below the 64dp top bar, leaving an 8dp gap before the first text paragraph. */
.support-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px max(16px, calc(16px + env(safe-area-inset-bottom)));
  box-sizing: border-box;
  width: 100%;
}

/* bodyMedium: 14sp / 20sp, letterSpacing 0.25px, color onSurface. */
.support-paragraph {
  margin: 0;
  font-family: Roboto, sans-serif;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
}

/* Text(modifier = padding(horizontal = padding.medium = 16dp)) inside the 16dp column padding (32dp total). */
.support-paragraph--inset {
  padding: 0 16px;
}

/* Card (filled): containerColor = surfaceVariant, CardDefaults.shape = 12dp, elevation 0. */
.support-card {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  box-sizing: border-box;
  border: none;
  border-radius: 12px;
  background-color: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface));
  text-decoration: none;
  cursor: pointer;
  overflow: hidden;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
@media (hover: hover) {
  .support-card:hover {
    background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, rgb(var(--v-theme-surface-variant)));
  }
}
.support-card:active {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, rgb(var(--v-theme-surface-variant)));
}
.support-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* BasePreferenceWidget: icon Box(padding(start = 16dp, end = 8dp)), tint = primary. */
.support-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding-left: 16px;
  padding-right: 8px;
  box-sizing: content-box;
  color: rgb(var(--v-theme-primary));
}
.support-icon svg {
  width: 24px;
  height: 24px;
  display: block;
}

/* BasePreferenceWidget: title Text(horizontal padding 16dp) inside a Column with
   padding(vertical = PrefsVerticalPadding = 16dp), titleLarge with fontSize 16.sp (TitleFontSize). */
.support-title {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  padding: 16px;
  font-family: Roboto, sans-serif;
  font-size: 16px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* BasePreferenceWidget: widget Box(padding(end = 16dp)), contentColor = onSurfaceVariant. */
.support-widget {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding-left: 0;
  padding-right: 16px;
  box-sizing: content-box;
  color: rgb(var(--v-theme-on-surface-variant));
}
.support-widget-icon {
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
}
</style>
