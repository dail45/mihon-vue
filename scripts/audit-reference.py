"""Inventory a pinned Mihon presentation checkout, never claim behavioral parity.
Usage: python3 scripts/audit-reference.py /path/to/mihon
"""
from pathlib import Path
import sys, subprocess, hashlib, re
from collections import Counter
PIN = '446f6df82c390ab760802c2fce3b677bce3f31c1'
root = Path(sys.argv[1]); base = root / 'app/src/main/java/eu/kanade/presentation'
revision = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
if revision != PIN: raise SystemExit('Reference revision differs from AGENTS.md')
# Conservative mappings: partial means a subset exists, never one-to-one parity.
def classify(path):
    n = Path(path).stem
    if 'PreviewProvider' in n or n.endswith('Provider'):
        return 'Reference helper', '—', 'Preview/state fixture; not an independent screen.'
    if path.startswith('theme/'):
        if n in ['TachiyomiTheme', 'BaseColorScheme', 'TachiyomiColorScheme']:
            return 'Partial', 'src/plugins/vuetify.ts; src/styles/main.scss', 'Default light/dark palette only; no Android dynamic colors or exact Compose rendering.'
        return 'Missing', '—', 'Alternate/dynamic palette not implemented.'
    if path.startswith('history/'):
        return 'Missing', 'src/views/PlannedView.vue', 'History tab is explicitly unimplemented; no full-history REST contract integrated.'
    if path.startswith('track/'):
        return 'Missing', '—', 'Tracking/auth/search/update workflows not integrated.'
    if path.startswith('webview/'):
        return 'Native-specific', '—', 'No embedded Android WebView, cookie manager or bypass workflow.'
    if path.startswith('crash/'):
        return 'Missing', '—', 'Request-level errors exist, but no app-wide crash screen/reporting.'
    if path.startswith('category/'):
        return 'Partial' if n in ['CategoryScreen', 'CategoryListItem'] else 'Missing', 'src/views/CategoriesView.vue', 'Read-only server categories/counts/navigation; no create, rename, delete, drag or dialogs.'
    if path.startswith('updates/'):
        return ('Partial', 'src/views/UpdatesView.vue; src/stores/updates.ts', 'Paged recent feed/date groups/search/download filter; no selection, calendar, bulk commands or trigger-library-update.') if n in ['UpdatesScreen','UpdatesUiItem','UpdatesFilterDialog'] else ('Missing','—','No multi-delete or confirmation workflow.')
    if path.startswith('library/'):
        if n in ['DeleteLibraryMangaDialog','GlobalSearchItem']:
            return 'Missing','—','No multi-selection/batch removal or global-source search from library.'
        return 'Partial','src/views/LibraryView.vue; src/components/LibrarySettingsSheet.vue; src/components/MangaCollection.vue; src/components/MangaCard.vue','Four display modes, category tabs, search, limited filters/sorts/badges; no multi-select, swipe pager, continue overlay or every native filter.'
    if path.startswith('browse/'):
        if n.startswith(('Extension','GlobalSearch','Migrate')) or n in ['SourcesFilterScreen','BrowseSourceDialogs','ContentWarningLabel']:
            return 'Missing','—','No extension management, global search, migration, native dialogs or dedicated source filter screen.'
        return 'Partial','src/views/BrowseView.vue; src/views/SourceView.vue; src/components/MangaCollection.vue; src/components/MangaCard.vue','Installed-source search/popular/latest/pagination/four layouts; no source filters, pins, per-source configuration or all native badges.'
    if path.startswith('manga/'):
        if n in ['MangaScreen','MangaScreenConstants','BaseMangaListItem','ChapterHeader','DotSeparatorText','MangaChapterListItem','MangaCover','MangaCoverDialog','MangaDialogs','MangaInfoHeader','MangaToolbar','ChapterSettingsDialog']:
            return 'Partial','src/views/MangaView.vue','Metadata/plain description/cover viewer/chapter search/order/boolean filters/membership; no full native toolbar, tri-state settings or multi-actions.'
        return 'Missing','—','Notes, duplicate resolution, scanlator filters, markdown, missing-chapter indicators, downloads or bulk action component absent.'
    if path.startswith('reader/'):
        if n in ['DisplayRefreshHost','OrientationSelectDialog','ReaderPageActionsDialog','ColorFilterPage']:
            return 'Missing','—','Native refresh/orientation, page-share/save actions or image color filters not implemented.'
        return 'Partial','src/views/ReaderView.vue; src/stores/reader.ts; src/stores/readerPreferences.ts','LTR/RTL/Webtoon, page/chapter navigation, controls, limited settings and opt-in progress; no every native reading/zoom/crop/transition option.'
    if path.startswith('components/'):
        if n == 'DownloadDropdownMenu': return 'Missing','—','Download management not integrated.'
        return 'Partial','src/App.vue; src/components/EmptyState.vue; src/components/LibrarySettingsSheet.vue; src/utils/dates.ts','Vuetify equivalents, not a direct Compose component port; geometry/accessibility may differ.'
    if path.startswith('util/'):
        return 'Web adaptation','src/App.vue; src/api/client.ts; src/utils/dates.ts; src/router/index.ts','Web router/viewport/date/error equivalents only; no native permissions/resources/animated vectors.'
    if path.startswith('more/'):
        if n in ['MoreScreen','LogoHeader']:
            return 'Partial','src/views/MoreView.vue','Downloaded-only/categories/settings/about; no incognito, download queue, stats, storage, native logo or every menu entry.'
        if n in ['SettingsMainScreen','SettingsAppearanceScreen','SettingsLibraryScreen','SettingsReaderScreen','AboutScreen']:
            return 'Partial','src/views/SettingsView.vue; src/views/AboutView.vue','Only implemented web preferences; not the complete native preference tree.'
        if '/widget/' in path and n in ['SwitchPreferenceWidget','TextPreferenceWidget','InfoWidget','ListPreferenceWidget','BasePreferenceWidget','PreferenceGroupHeader','AppThemeModePreferenceWidget'] or n in ['Preference','PreferenceItem','PreferenceScaffold','PreferenceScreen','Commons']:
            return 'Partial','src/views/SettingsView.vue','Vuetify list/switch/radio/select equivalents, not all widget behaviors.'
        return 'Missing','—','Native onboarding/migration/update, advanced/data/download/tracking/security/search/stats/license-browser or extra preference flow not implemented.'
    return 'Unmapped','—','Requires manual classification.'
rows=[]
for p in sorted(base.rglob('*.kt')):
    text=p.read_text(); rel=str(p.relative_to(base)); status,target,gap=classify(rel)
    decl=re.findall(r'^(?:(?:private|internal|public|protected|suspend|inline|tailrec|override|data|sealed|enum|open|abstract)\s+)*(?:fun|class|object|interface)\s+([^\s(:<{]+)',text,re.M)
    rows.append((rel,status,target,gap,len(text.splitlines()),','.join(decl),hashlib.sha256(text.encode()).hexdigest()))
assert len(rows)==190 and not any(r[1]=='Unmapped' for r in rows)
counts=Counter(r[1] for r in rows)
out=['# Mihon presentation parity inventory', '', f'Reference: `{PIN}` ([source](https://github.com/mihonapp/mihon/tree/{PIN})).', '',
'## What this establishes', '',
'This is a file-level source inventory with conservative implementation mappings, **not a claim that every screen/component works or matches pixels**. All 190 Kotlin files in `app/src/main/java/eu/kanade/presentation/` were enumerated and scanned for declarations. Detailed source comparisons informed the library grid, settings sheet, More menu, updates row groups, chapter controls and reader work. Status is deliberately partial whenever only a subset exists.', '',
'Native routes/controllers under `eu/kanade/tachiyomi/ui`, shared `presentation-core` widgets, XML/platform code, source extensions and backend code are outside this inventory. Therefore 190 files is not the entire Mihon UI. No Android emulator screenshots or native-vs-web pixel-diff baseline were available. File counts are not completion percentages.', '',
'## Scope and remaining work', '',
'- Implemented web workflows: library, source catalogue, manga, reader, recent updates, read-only categories, More, limited appearance/library/reader/connection settings and About.',
'- Major gaps: real History, downloads queue/control, statistics, trackers, category editing, notes, multi-select/bulk actions, global search, migration, backup/restore, full settings and alternate palettes.',
'- Extension installation/management, native storage/permissions, Android WebView and native display controls do not run in this headless browser client. They require a separately agreed web/server design rather than fake working buttons.',
'- Existing Suwayomi REST integration does not establish API impossibility for omitted features. Backend capability needs separate contract work.',
'- Live tests remain read-only at the client command boundary. Source and chapter GETs can populate server caches; do not describe them as zero backend side effects.', '',
'## Status counts', '', *[f'- {k}: {v}' for k,v in sorted(counts.items())], '',
'## File-by-file mapping', '', '| Reference file | Status | Web counterpart | Remaining difference |', '| --- | --- | --- | --- |']
for rel,status,target,gap,*_ in rows:
    out.append(f'| [{rel}](https://github.com/mihonapp/mihon/blob/{PIN}/app/src/main/java/eu/kanade/presentation/{rel}) | {status} | {target} | {gap} |')
Path('docs/PARITY_AUDIT.md').write_text('\n'.join(out)+'\n')
print(f'Inventoried {len(rows)} files; {sum(r[4] for r in rows)} lines; statuses: {dict(counts)}')
