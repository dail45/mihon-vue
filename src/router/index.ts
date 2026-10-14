import { createRouter, createWebHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/library' },
    { path: '/library', component: () => import('../views/LibraryView.vue'), meta: { title: 'Library' } },
    { path: '/manga/:id(\\d+)', component: () => import('../views/MangaView.vue'), meta: { title: 'Manga', detail: true } },
    { path: '/manga/:id(\\d+)/read/:chapterIndex(\\d+)', component: () => import('../views/ReaderView.vue'), meta: { title: 'Reader', detail: true, reader: true } },
    { path: '/updates', component: () => import('../views/PlannedView.vue'), meta: { title: 'Updates', icon: 'update' } },
    { path: '/history', component: () => import('../views/PlannedView.vue'), meta: { title: 'History', icon: 'history' } },
    { path: '/browse', component: () => import('../views/BrowseView.vue'), meta: { title: 'Browse' } },
    { path: '/browse/source/:sourceId', component: () => import('../views/SourceView.vue'), meta: { title: 'Source', detail: true, catalogue: true } },
    { path: '/more', component: () => import('../views/MoreView.vue'), meta: { title: 'More' } },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Not found' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
router.afterEach(to => { document.title = `${String(to.meta.title || 'Mihon')} · Mihon` })
