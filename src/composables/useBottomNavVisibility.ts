import { ref } from 'vue'

/**
 * `HomeScreen.showBottomNav(show: Boolean)` and `rememberNavigationSuiteScaffoldState()`.
 *
 * Mihon hides the navigation bar while the library selection mode is active
 * (`LibraryTab.kt`: `HomeScreen.showBottomNav(!state.selectionMode)`) and shows it again
 * afterwards. The web shell keeps the navigation bar outside the router view, so the
 * visibility is shared through this small reactive holder instead of a global event bus.
 */
const visible = ref(true)

export function useBottomNavVisibility() {
  return {
    bottomNavVisible: visible,
    showBottomNav(show: boolean) { visible.value = show },
  }
}
