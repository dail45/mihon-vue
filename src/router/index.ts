import { createRouter, createWebHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/library' },
    { path: '/library', component: () => import('../views/LibraryView.vue'), meta: { title: 'Library' } },
    { path: '/manga/:id(\\d+)', component: () => import('../views/MangaView.vue'), meta: { title: 'Manga', detail: true } },
    { path: '/manga/:id(\\d+)/read/:chapterIndex(\\d+)', component: () => import('../views/ReaderView.vue'), meta: { title: 'Reader', detail: true, reader: true } },
    { path: '/updates', component: () => import('../views/UpdatesView.vue'), meta: { title: 'Updates', icon: 'update' } },
    { path: '/history', component: () => import('../views/PlannedView.vue'), meta: { title: 'History', icon: 'history' } },
    { path: '/browse', component: () => import('../views/BrowseView.vue'), meta: { title: 'Browse' } },
    { path: '/browse/source/:sourceId', component: () => import('../views/SourceView.vue'), meta: { title: 'Source', detail: true, catalogue: true } },
    { path: '/more', component: () => import('../views/MoreView.vue'), meta: { title: 'More' } },
    { path: '/settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'Settings', detail: true } },
    ...['appearance', 'library', 'reader', 'connection'].map(section => ({ path: `/settings/${section}`, component: () => import('../views/SettingsView.vue'), meta: { title: section === 'connection' ? 'Server connection' : section[0]!.toUpperCase() + section.slice(1), detail: true, settingsSection: section } })),
    { path: '/categories', component: () => import('../views/CategoriesView.vue'), meta: { title: 'Categories', detail: true } },
    { path: '/about', component: () => import('../views/AboutView.vue'), meta: { title: 'About', detail: true } },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Not found' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
router.afterEach(to => { document.title = `${String(to.meta.title || 'Mihon')} · Mihon` })
