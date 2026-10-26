import { createRouter, createWebHistory } from 'vue-router'
import { stringResource } from '@/core/i18n'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/library' },
    { path: '/library', component: () => import('@/features/library/views/LibraryView.vue'), meta: { title: 'Library' } },
    { path: '/manga/:id(\\d+)', component: () => import('@/features/manga/views/MangaView.vue'), meta: { title: 'Manga', detail: true, manga: true, ownToolbar: true } },
    { path: '/manga/:id(\\d+)/suggestions', component: () => import('@/features/manga/views/RelatedMangasView.vue'), meta: { title: 'pref_source_related_mangas', detail: true, manga: true, ownToolbar: true } },
    { path: '/manga/:id(\\d+)/notes', component: () => import('@/features/manga/views/MangaNotesView.vue'), meta: { title: 'Notes', detail: true, manga: true, ownToolbar: true } },
    { path: '/manga/:id(\\d+)/read/:chapterIndex(\\d+)', component: () => import('@/features/reader/views/ReaderView.vue'), meta: { title: 'Reader', detail: true, reader: true } },
    { path: '/updates', component: () => import('@/features/updates/views/UpdatesView.vue'), meta: { title: 'Updates', icon: 'update' } },
    { path: '/updates/errors', component: () => import('@/features/updates/views/LibraryUpdateErrorView.vue'), meta: { title: 'option_label_library_update_errors', detail: true, ownToolbar: true } },
    { path: '/upcoming', component: () => import('@/features/updates/views/UpcomingView.vue'), meta: { title: 'Upcoming', detail: true, ownToolbar: true } },
    { path: '/history', component: () => import('@/features/history/views/HistoryView.vue'), meta: { title: 'History', icon: 'history', ownToolbar: true } },
    { path: '/browse', component: () => import('@/features/browse/views/BrowseView.vue'), meta: { title: 'Browse' } },
    // Mihon `GlobalSearchScreen` is a separate screen with its own toolbar (GlobalSearchToolbar.kt).
    { path: '/browse/global-search', component: () => import('@/features/browse/views/GlobalSearchView.vue'), meta: { title: 'Global search', detail: true, catalogue: true } },
    // The app bar actions of the Browse tabs open their own screens
    // (`SourcesTab.kt`: "Filter", `ExtensionsTab.kt`: "Filter" / "Extension stores").
    { path: '/browse/sources/filter', component: () => import('@/features/browse/views/SourcesFilterView.vue'), meta: { title: 'label_sources', detail: true } },
    { path: '/browse/extensions/filter', component: () => import('@/features/browse/views/ExtensionFilterView.vue'), meta: { title: 'label_extensions', detail: true } },
    {
      path: '/browse/extensions/stores',
      component: () => import('@/features/browse/views/ExtensionStoresView.vue'),
      meta: { title: 'Extension stores', detail: true, ownToolbar: true },
      beforeEnter: to => {
        if (to.query.from === 'settings') {
          return { path: '/settings/browse/stores' }
        }
      },
    },
    { path: '/browse/extension/:pkgName', component: () => import('@/features/browse/views/ExtensionDetailsView.vue'), meta: { title: 'Extension info', detail: true, ownToolbar: true } },
    { path: '/browse/source/:sourceId', component: () => import('@/features/browse/views/SourceView.vue'), meta: { title: 'Source', detail: true, catalogue: true } },
    // Mihon `SourcePreferencesScreen`: the per-source settings screen opened from the
    // source toolbar overflow menu (`action_settings`).
    { path: '/browse/source/:sourceId/preferences', component: () => import('@/features/browse/views/SourcePreferencesView.vue'), meta: { title: 'Source settings', detail: true, catalogue: true, ownToolbar: true } },
    // Mihon migration routes:
    { path: '/migrate/config', component: () => import('@/features/migration/views/MigrationConfigView.vue'), meta: { title: 'Migration', detail: true, ownToolbar: true } },
    { path: '/migrate/config/:id(\\d+)', component: () => import('@/features/migration/views/MigrationConfigView.vue'), meta: { title: 'Migration', detail: true, ownToolbar: true } },
    { path: '/migrate/source/:sourceId', component: () => import('@/features/migration/views/MigrationConfigView.vue'), meta: { title: 'Migration', detail: true, ownToolbar: true } },
    { path: '/migrate/list', component: () => import('@/features/migration/views/MigrationListView.vue'), meta: { title: 'Migration', detail: true, ownToolbar: true } },
    { path: '/migrate/manga/:mangaId(\\d+)', component: () => import('@/features/migration/views/MigrateSearchView.vue'), meta: { title: 'Migrate', detail: true, ownToolbar: true } },
    { path: '/more', component: () => import('@/features/settings/views/MoreView.vue'), meta: { title: 'More' } },
    { path: '/download-queue', component: () => import('@/features/downloads/views/DownloadQueueView.vue'), meta: { title: 'Download queue', detail: true, ownToolbar: true } },
    { path: '/support-us', component: () => import('@/features/settings/views/SupportUsView.vue'), meta: { title: 'Support Us', detail: true, ownToolbar: true } },
    { path: '/stats', component: () => import('@/features/settings/views/StatsView.vue'), meta: { title: 'Statistics', detail: true, ownToolbar: true } },
    { path: '/settings', component: () => import('@/features/settings/views/SettingsView.vue'), meta: { title: 'Settings', detail: true, ownToolbar: true } },
    // Mihon `SettingsSearchScreen`: a dedicated screen with its own search app bar.
    { path: '/settings/search', component: () => import('@/features/settings/views/SettingsSearchView.vue'), meta: { title: 'Search settings', detail: true, ownToolbar: true } },
    ...['appearance', 'library', 'reader', 'downloads', 'tracking', 'browse', 'data', 'security', 'advanced', 'about', 'connection'].map(section => ({ path: `/settings/${section}`, component: () => import('@/features/settings/views/SettingsView.vue'), meta: { title: section === 'connection' ? 'Server connection' : section === 'data' ? 'Data and storage' : section === 'security' ? 'Security and privacy' : section[0]!.toUpperCase() + section.slice(1), detail: true, settingsSection: section, ownToolbar: true } })),
    // Mihon `AppLanguageScreen` (Appearance)
    {
      path: '/settings/appearance/language',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'App language',
        detail: true,
        settingsSection: 'appearance',
        subSection: 'language',
        ownToolbar: true,
      },
    },
    { path: '/settings/app-language', redirect: '/settings/appearance/language' },
    // Komikku `AppCustomThemeColorPickerScreen` (Appearance -> Custom color)
    {
      path: '/settings/appearance/custom-color',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Custom color',
        detail: true,
        settingsSection: 'appearance',
        subSection: 'custom-color',
        ownToolbar: true,
      },
    },
    // Mihon `CategoryScreen` (Library -> Edit categories)
    {
      path: '/settings/library/categories',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Edit categories',
        detail: true,
        settingsSection: 'library',
        subSection: 'categories',
        ownToolbar: true,
      },
    },
    // TachiyomiSY `SortTagScreen` (Library -> Tag sorting)
    {
      path: '/settings/library/sort-tags',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Tag sorting',
        detail: true,
        settingsSection: 'library',
        subSection: 'sort-tags',
        ownToolbar: true,
      },
    },
    // Mihon `ExtensionStoresScreen` (Browse -> Extension stores)
    {
      path: '/settings/browse/stores',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Extension stores',
        detail: true,
        settingsSection: 'browse',
        subSection: 'stores',
        ownToolbar: true,
      },
    },
    // Mihon `CreateBackupScreen` and `RestoreBackupScreen` (Data & storage)
    {
      path: '/settings/data/create-backup',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Create backup',
        detail: true,
        settingsSection: 'data',
        subSection: 'create-backup',
        ownToolbar: true,
      },
    },
    {
      path: '/settings/data/restore-backup',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Restore backup',
        detail: true,
        settingsSection: 'data',
        subSection: 'restore-backup',
        ownToolbar: true,
      },
    },
    // Mihon `ClearDatabaseScreen` (Advanced)
    {
      path: '/settings/advanced/clear-database',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Clear database',
        detail: true,
        settingsSection: 'advanced',
        subSection: 'clear-database',
        ownToolbar: true,
      },
    },
    { path: '/settings/clear-database', redirect: '/settings/advanced/clear-database' },
    // Mihon `DebugInfoScreen`, `WorkerInfoScreen`, `BackupSchemaScreen` (Advanced -> Debug info)
    {
      path: '/settings/advanced/debug',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Debug information',
        detail: true,
        settingsSection: 'advanced',
        subSection: 'debug',
        ownToolbar: true,
      },
    },
    { path: '/settings/debug', redirect: '/settings/advanced/debug' },
    { path: '/settings/debug/worker', component: () => import('@/features/settings/views/WorkerInfoView.vue'), meta: { title: 'Worker info', detail: true, ownToolbar: true } },
    { path: '/settings/debug/backup-schema', component: () => import('@/features/settings/views/BackupSchemaView.vue'), meta: { title: 'Backup file schema', detail: true, ownToolbar: true } },
    { path: '/debug/backup-schema', redirect: '/settings/debug/backup-schema' },
    // Mihon `OpenSourceLicensesScreen` (About -> Open source licenses)
    {
      path: '/settings/about/licenses',
      component: () => import('@/features/settings/views/SettingsView.vue'),
      meta: {
        title: 'Open source licenses',
        detail: true,
        settingsSection: 'about',
        subSection: 'licenses',
        ownToolbar: true,
      },
    },
    // Mihon `CategoryScreen`: the app bar title is `action_edit_categories` = "Edit categories".
    {
      path: '/categories',
      component: () => import('@/features/library/views/CategoriesView.vue'),
      meta: { title: 'Edit categories', detail: true, ownToolbar: true },
      beforeEnter: to => {
        if (to.query.from === 'settings') {
          return { path: '/settings/library/categories' }
        }
      },
    },
    { path: '/category', redirect: '/categories' },
    { path: '/tracker-search', component: () => import('@/features/trackers/views/TrackerSearchView.vue'), meta: { title: 'Track search', detail: true, ownToolbar: true } },
    { path: '/tracker-login', component: () => import('@/features/trackers/views/TrackerLoginView.vue'), meta: { title: 'Track login', detail: true } },
    { path: '/about', component: () => import('@/features/settings/views/AboutView.vue'), meta: { title: 'About', detail: true, ownToolbar: true } },
    { path: '/about/licenses', name: 'about-licenses', component: () => import('@/features/settings/views/OpenSourceLicensesView.vue'), meta: { title: 'Open source licenses', detail: true, ownToolbar: true } },
    { path: '/about/update', name: 'about-new-update', component: () => import('@/features/updates/views/NewUpdateView.vue'), meta: { title: 'New update', detail: true, ownToolbar: true } },
    { path: '/new-update', name: 'new-update', component: () => import('@/features/updates/views/NewUpdateView.vue'), meta: { title: "What's new", detail: true, ownToolbar: true } },
    { path: '/crash', component: () => import('@/features/settings/views/CrashView.vue'), meta: { title: 'Crash', detail: true, ownToolbar: true } },
    // Mihon `DeepLinkScreen`: the app bar title is `action_search_hint` = "Search…".
    { path: '/deeplink', component: () => import('@/features/settings/views/DeepLinkView.vue'), meta: { title: 'Search…', detail: true, ownToolbar: true } },
    // Mihon `OnboardingScreen`: the onboarding guide (MR.strings.pref_onboarding_guide).
    { path: '/onboarding', component: () => import('@/features/onboarding/views/OnboardingView.vue'), meta: { title: 'Onboarding guide', detail: true, ownToolbar: true, layout: 'fullscreen' } },
    { path: '/:pathMatch(.*)*', component: () => import('@/features/settings/views/NotFoundView.vue'), meta: { title: 'Not found' } },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
router.afterEach(to => {
  const title = to.meta.title ? stringResource(String(to.meta.title)) : 'Mihon'
  document.title = `${title} · Mihon`
})
