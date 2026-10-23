/**
 * Route registration for the "New update" screen pushed by the About screen.
 *
 * Reference: `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/about/AboutScreen.kt`
 *   checkVersion() -> onAvailableUpdate -> navigator.push(NewUpdateScreen(...))
 *
 * The shared router file is owned by the integration task, so the route is added from
 * this module instead of editing `src/router/index.ts`. The module is imported by
 * `src/views/AboutView.vue`, so the path is registered before the row can be pressed.
 * A literal path keeps a higher priority than the catch-all route of the shared router.
 */
import { router } from '../router'
import NewUpdateView from './NewUpdateView.vue'

if (!router.hasRoute('about-new-update')) {
  router.addRoute({
    path: '/about/update',
    name: 'about-new-update',
    component: NewUpdateView,
    meta: { title: 'New update', detail: true, ownToolbar: true },
  })
}

if (!router.hasRoute('new-update')) {
  router.addRoute({
    path: '/new-update',
    name: 'new-update',
    component: NewUpdateView,
    meta: { title: "What's new", detail: true, ownToolbar: true },
  })
}

