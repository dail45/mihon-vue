import { createRouter, createWebHistory } from 'vue-router'
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/library' },
    { path: '/library', component: () => import('../views/LibraryView.vue'), meta: { title: 'Library' } },
    { path: '/manga/:id(\\d+)', component: () => import('../views/MangaView.vue'), meta: { title: 'Manga', detail: true, manga: true, ownToolbar: true } },
    { path: '/manga/:id(\\d+)/notes', component: () => import('../views/MangaNotesView.vue'), meta: { title: 'Notes', detail: true, manga: true } },
    { path: '/manga/:id(\\d+)/notes', component: () => import('../views/MangaNotesView.vue'), meta: { title: 'Notes', detail: true, ownToolbar: true } },
    { path: '/manga/:id(\\d+)/read/:chapterIndex(\\d+)', component: () => import('../views/ReaderView.vue'), meta: { title: 'Reader', detail: true, reader: true } },
    { path: '/updates', component: () => import('../views/UpdatesView.vue'), meta: { title: 'Updates', icon: 'update' } },
    { path: '/upcoming', component: () => import('../views/UpcomingView.vue'), meta: { title: 'Upcoming', detail: true, ownToolbar: true } },
    { path: '/history', component: () => import('../views/PlannedView.vue'), meta: { title: 'History', icon: 'history', ownToolbar: true } },
    { path: '/browse', component: () => import('../views/BrowseView.vue'), meta: { title: 'Browse' } },
    // Mihon `GlobalSearchScreen` is a separate screen with its own toolbar (GlobalSearchToolbar.kt).
    { path: '/browse/global-search', component: () => import('../views/GlobalSearchView.vue'), meta: { title: 'Global search', detail: true, catalogue: true } },
    // The app bar actions of the Browse tabs open their own screens
    // (`SourcesTab.kt`: "Filter", `ExtensionsTab.kt`: "Filter" / "Extension stores").
    { path: '/browse/sources/filter', component: () => import('../views/SourcesFilterView.vue'), meta: { title: 'Sources', detail: true } },
    { path: '/browse/extensions/filter', component: () => import('../views/ExtensionFilterView.vue'), meta: { title: 'Extensions', detail: true } },
    { path: '/browse/extensions/stores', component: () => import('../views/ExtensionStoresView.vue'), meta: { title: 'Extension stores', detail: true, ownToolbar: true } },
    { path: '/browse/extension/:pkgName', component: () => import('../views/ExtensionDetailsView.vue'), meta: { title: 'Extension info', detail: true, ownToolbar: true } },
    { path: '/browse/source/:sourceId', component: () => import('../views/SourceView.vue'), meta: { title: 'Source', detail: true, catalogue: true } },
    // Mihon `SourcePreferencesScreen`: the per-source settings screen opened from the
    // source toolbar overflow menu (`action_settings`).
    { path: '/browse/source/:sourceId/preferences', component: () => import('../views/SourcePreferencesView.vue'), meta: { title: 'Source settings', detail: true, catalogue: true, ownToolbar: true } },
    // Mihon migration routes:
    { path: '/migrate/config', component: () => import('../views/MigrationConfigView.vue'), meta: { title: 'Migration', detail: true, ownToolbar: true } },
    { path: '/migrate/config/:id(\\d+)', component: () => import('../views/MigrationConfigView.vue'), meta: { title: 'Migration', detail: true, ownToolbar: true } },
    { path: '/migrate/source/:sourceId', component: () => import('../views/MigrationConfigView.vue'), meta: { title: 'Migration', detail: true, ownToolbar: true } },
    { path: '/migrate/list', component: () => import('../views/MigrationListView.vue'), meta: { title: 'Migration', detail: true, ownToolbar: true } },
    { path: '/migrate/manga/:mangaId(\\d+)', component: () => import('../views/MigrateSearchView.vue'), meta: { title: 'Migrate', detail: true, ownToolbar: true } },
    { path: '/more', component: () => import('../views/MoreView.vue'), meta: { title: 'More' } },
    { path: '/download-queue', component: () => import('../views/DownloadQueueView.vue'), meta: { title: 'Download queue', detail: true, ownToolbar: true } },
    { path: '/support-us', component: () => import('../views/SupportUsView.vue'), meta: { title: 'Support Us', detail: true, ownToolbar: true } },
    { path: '/stats', component: () => import('../views/StatsView.vue'), meta: { title: 'Statistics', detail: true, ownToolbar: true } },
    { path: '/settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'Settings', detail: true, ownToolbar: true } },
    // Mihon `SettingsSearchScreen`: a dedicated screen with its own search app bar.
    { path: '/settings/search', component: () => import('../views/SettingsSearchView.vue'), meta: { title: 'Search settings', detail: true, ownToolbar: true } },
    ...['appearance', 'library', 'reader', 'downloads', 'tracking', 'browse', 'data', 'security', 'advanced', 'about', 'connection'].map(section => ({ path: `/settings/${section}`, component: () => import('../views/SettingsView.vue'), meta: { title: section === 'connection' ? 'Server connection' : section === 'data' ? 'Data and storage' : section === 'security' ? 'Security and privacy' : section[0]!.toUpperCase() + section.slice(1), detail: true, settingsSection: section, ownToolbar: true } })),
    // Mihon `AppLanguageScreen` (Appearance)
    { path: '/settings/appearance/language', component: () => import('../views/AppLanguageView.vue'), meta: { title: 'App language', detail: true, ownToolbar: true } },
    { path: '/settings/app-language', redirect: '/settings/appearance/language' },
    // Mihon `CreateBackupScreen` and `RestoreBackupScreen` (Data & storage)
    { path: '/settings/data/create-backup', component: () => import('../views/CreateBackupView.vue'), meta: { title: 'Create backup', detail: true, ownToolbar: true } },
    { path: '/settings/data/restore-backup', component: () => import('../views/RestoreBackupView.vue'), meta: { title: 'Restore backup', detail: true, ownToolbar: true } },
    // Mihon `ClearDatabaseScreen` (Advanced)
    { path: '/settings/advanced/clear-database', component: () => import('../views/ClearDatabaseView.vue'), meta: { title: 'Clear database', detail: true, ownToolbar: true } },
    { path: '/settings/clear-database', redirect: '/settings/advanced/clear-database' },
    // Mihon `DebugInfoScreen`, `WorkerInfoScreen`, `BackupSchemaScreen` (Advanced -> Debug info)
    { path: '/settings/advanced/debug', component: () => import('../views/DebugInfoView.vue'), meta: { title: 'Debug information', detail: true, ownToolbar: true } },
    { path: '/settings/debug', redirect: '/settings/advanced/debug' },
    { path: '/settings/debug/worker', component: () => import('../views/WorkerInfoView.vue'), meta: { title: 'Worker info', detail: true, ownToolbar: true } },
    { path: '/settings/debug/backup-schema', component: () => import('../views/BackupSchemaView.vue'), meta: { title: 'Backup file schema', detail: true, ownToolbar: true } },
    { path: '/debug/backup-schema', redirect: '/settings/debug/backup-schema' },
    // Mihon `CategoryScreen`: the app bar title is `action_edit_categories` = "Edit categories".
    { path: '/categories', component: () => import('../views/CategoriesView.vue'), meta: { title: 'Edit categories', detail: true, ownToolbar: true } },
    { path: '/category', redirect: '/categories' },
    { path: '/tracker-search', component: () => import('../views/TrackerSearchView.vue'), meta: { title: 'Track search', detail: true, ownToolbar: true } },
    { path: '/tracker-login', component: () => import('../views/TrackerLoginView.vue'), meta: { title: 'Track login', detail: true } },
    { path: '/about', component: () => import('../views/AboutView.vue'), meta: { title: 'About', detail: true, ownToolbar: true } },
    { path: '/about/licenses', component: () => import('../views/OpenSourceLicensesView.vue'), meta: { title: 'Open source licenses', detail: true, ownToolbar: true } },
    { path: '/new-update', component: () => import('../views/NewUpdateView.vue'), meta: { title: "What's new", detail: true, ownToolbar: true } },
    { path: '/crash', component: () => import('../views/CrashView.vue'), meta: { title: 'Crash', detail: true, ownToolbar: true } },
    // Mihon `DeepLinkScreen`: the app bar title is `action_search_hint` = "Search…".
    { path: '/deeplink', component: () => import('../views/DeepLinkView.vue'), meta: { title: 'Search…', detail: true, ownToolbar: true } },
    // Mihon `OnboardingScreen`: the onboarding guide (MR.strings.pref_onboarding_guide).
    { path: '/onboarding', component: () => import('../views/OnboardingView.vue'), meta: { title: 'Onboarding guide', detail: true, ownToolbar: true } },
    { path: '/:pathMatch(.*)*', component: () => import('../views/NotFoundView.vue'), meta: { title: 'Not found' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
router.afterEach(to => { document.title = `${String(to.meta.title || 'Mihon')} · Mihon` })
