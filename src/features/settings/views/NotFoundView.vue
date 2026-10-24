<script setup lang="ts">
import { useRouter } from 'vue-router'

/**
 * Mihon has no dedicated "404 / not found" screen, so the closest native reference is
 * tachiyomi.presentation.core.screens.EmptyScreen
 * (mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/EmptyScreen.kt):
 *
 *   Column(
 *       modifier = modifier
 *           .fillMaxSize()
 *           .verticalScroll(rememberScrollState())
 *           .padding(horizontal = 24.dp),
 *       horizontalAlignment = Alignment.CenterHorizontally,
 *       verticalArrangement = Arrangement.Center,
 *   ) {
 *       CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
 *           Text(text = face, modifier = Modifier.secondaryItemAlpha(),
 *                style = MaterialTheme.typography.displayMedium)
 *       }
 *       Text(text = message,
 *            modifier = Modifier.paddingFromBaseline(top = 24.dp).secondaryItemAlpha(),
 *            style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
 *       if (!actions.isNullOrEmpty()) {
 *           Row(modifier = Modifier.padding(top = 24.dp),
 *               horizontalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small)) {
 *               actions.fastForEach { ActionButton(modifier = Modifier.weight(1f), ...) }
 *           }
 *       }
 *   }
 *
 * ActionButton.kt (mihon/presentation-core/.../components/ActionButton.kt):
 *   TextButton { Column(spacedBy(MaterialTheme.padding.extraSmall),
 *                      horizontalAlignment = CenterHorizontally) { Icon, Text } }
 *   The Text inside a TextButton uses the MD3 labelLarge style; the Icon is the
 *   default 24.dp one and inherits the button content colour (primary).
 *
 * Values taken from the pinned reference:
 *   - MaterialTheme.padding.small      = 8.dp   (mihon/.../components/material/Constants.kt:20)
 *   - MaterialTheme.padding.extraSmall = 4.dp   (mihon/.../components/material/Constants.kt:22)
 *   - SECONDARY_ALPHA                  = .78f   (mihon/.../components/material/Constants.kt:10)
 *   - Error faces list                 = mihon/presentation-core/.../screens/EmptyScreen.kt:101-114
 */

const faces = [
  '(･o･;)',
  'Σ(ಠ_ಠ)',
  'ಥ_ಥ',
  '(˘･_･˘)',
  '(；￣Д￣)',
  '(･Д･。',
  '(╬ಠ益ಠ)',
  '(╥﹏╥)',
  '(⋟﹏⋞)',
  'Ò︵Ó',
  ' ˙ᯅ˙)',
  '(¬_¬)',
]

const router = useRouter()

/* remember { getRandomErrorFace() } — picked once per screen instance, not per render. */
const face = faces[Math.floor(Math.random() * faces.length)]

function goBack() {
  if (typeof window.history.state?.back === 'string') {
    router.back()
    return
  }
  void router.push('/library')
}
</script>

<template>
  <section class="not-found" aria-live="polite">
    <div class="not-found__content">
      <!-- CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) -->
      <span class="not-found__face text-display-medium" dir="ltr">{{ face }}</span>

      <p class="not-found__message text-body-medium">The requested screen does not exist.</p>

      <div class="not-found__actions">
        <v-btn to="/library" variant="text" color="primary" class="not-found__action">
          <span class="not-found__action-content">
            <v-icon icon="home" size="24" aria-hidden="true" />
            <span class="not-found__action-label text-label-large">Library</span>
          </span>
        </v-btn>
        <v-btn variant="text" color="primary" class="not-found__action" @click="goBack">
          <span class="not-found__action-content">
            <v-icon icon="arrow_back" size="24" aria-hidden="true" />
            <span class="not-found__action-label text-label-large">Go back</span>
          </span>
        </v-btn>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp)) */
.not-found {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  /*
   * fillMaxSize() — the Column fills the whole screen area. v-main is not a
   * fixed-height box, so the available height is derived from the viewport
   * minus the layout insets the app bar / bottom bar reserve.
   */
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 24px;
  overflow-y: auto;
}

/*
 * The Column content is centred with Arrangement.Center, but the Column is also
 * scrollable, so the centred block gets `margin: auto` instead of
 * justify-content: center — otherwise overflowing content is clipped at the top
 * and cannot be scrolled to.
 */
.not-found__content {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Text(face, displayMedium, secondaryItemAlpha() = alpha .78) */
.not-found__face {
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  white-space: nowrap;
}

/*
 * Text(message, bodyMedium, textAlign = Center, modifier = paddingFromBaseline(top = 24.dp) + secondaryItemAlpha())
 *
 * paddingFromBaseline(top = 24.dp) places the layout top 24.dp above the text
 * baseline. Roboto's cap height is ~9.95px at 14px, so the visible ink gap is
 * 24 - 9.95 ~= 14px — not a flat 24px margin.
 */
.not-found__message {
  margin-top: 14px;
  max-width: 100%;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
}

/* Row(modifier.padding(top = 24.dp), spacedBy(MaterialTheme.padding.small = 8.dp)) */
.not-found__actions {
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 24px;
}

/* ActionButton(modifier = Modifier.weight(1f)) — equal-width text buttons. */
.not-found__action {
  flex: 1 1 0;
  min-width: 0;
  /*
   * MD3 TextButton (Compose ButtonDefaults.TextButtonContentPadding):
   *   horizontal = 12.dp, vertical = 8.dp; container height = 40.dp,
   *   shape = full (radius 20.dp). Vuetify's default text button is 36dp
   *   tall with 16dp side padding and a 4dp radius, so it is overridden here.
   */
  height: auto;
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 20px;
}

/* Column(spacedBy(MaterialTheme.padding.extraSmall = 4.dp), horizontalAlignment = CenterHorizontally) */
.not-found__action-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.not-found__action-label {
  text-align: center;
}
</style>
