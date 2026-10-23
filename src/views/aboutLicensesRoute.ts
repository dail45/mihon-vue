/**
 * Route registration for the "Open source licenses" screen of the About screen.
 *
 * Reference: `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/about/AboutScreen.kt`
 *   TextPreferenceWidget(title = MR.strings.licenses) navigates to `OpenSourceLicensesScreen`.
 *
 * The shared router file is owned by the integration task, so the route is added from
 * this module instead of editing `src/router/index.ts`. The module is imported by
 * `src/views/AboutView.vue`, so the path is registered before the row can be pressed.
 * A literal path keeps a higher priority than the catch-all route of the shared router.
 */
import { router } from '../router'
import OpenSourceLicensesView from './OpenSourceLicensesView.vue'

if (!router.hasRoute('about-licenses')) {
  router.addRoute({
    path: '/about/licenses',
    name: 'about-licenses',
    component: OpenSourceLicensesView,
    meta: { title: 'Open source licenses', detail: true, ownToolbar: true },
  })
}
