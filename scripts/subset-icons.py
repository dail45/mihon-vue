"""Maintainer utility: pip install 'fonttools[woff]'.
Subsets the installed Material Symbols font to all app icons, Vuetify MD aliases,
and common Material Symbols Rounded icons.
"""
from pathlib import Path
import re
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
texts = '\n'.join(p.read_text(encoding='utf-8') for p in (root / 'src').rglob('*') if p.suffix in {'.vue', '.ts'})
aliases = (root / 'node_modules/vuetify/lib/iconsets/md.js').read_text(encoding='utf-8')

font = TTFont(root / 'node_modules/material-symbols/material-symbols-rounded.woff2')
cmap = font.getBestCmap()
inv_cmap = {v: chr(k) for k, v in cmap.items()}

# Extract all ligature names available in the full Google Material Symbols font
available_ligatures = set()
for lookup in font['GSUB'].table.LookupList.Lookup:
    tables = lookup.SubTable if lookup.LookupType == 4 else [t.ExtSubTable for t in lookup.SubTable if lookup.LookupType == 7 and t.ExtensionLookupType == 4]
    for table in tables:
        for first, lig_list in table.ligatures.items():
            for lig in lig_list:
                chars = [inv_cmap.get(first, '')] + [inv_cmap.get(c, '') for c in lig.Component]
                available_ligatures.add(''.join(chars))

# Comprehensive scan for any icon names used in src (attributes, string constants, templates)
raw_names = set(re.findall(r"['\"]([a-z0-9_]+)['\"]", texts + aliases))
raw_names |= set(re.findall(r"<span[^>]*material-symbols[^>]*>\s*([a-z0-9_]+)\s*</span>", texts))
raw_names |= set(re.findall(r"<v-icon[^>]*>\s*([a-z0-9_]+)\s*</v-icon>", texts))
raw_names |= set(re.findall(r"(?:prepend-|append-)?icon=['\"]([a-z0-9_]+)['\"]", texts))

# Keep all names that actually exist in Material Symbols
names = {name for name in raw_names if name in available_ligatures}

# Common core Material Symbols that any UI view might dynamically invoke
core_symbols = {
    'arrow_back', 'arrow_forward', 'arrow_upward', 'arrow_downward', 'arrow_drop_down', 'arrow_drop_up',
    'chevron_left', 'chevron_right', 'expand_more', 'expand_less', 'close', 'check', 'check_circle',
    'search', 'settings', 'more_vert', 'more_horiz', 'filter_list', 'tune', 'sort', 'swap_vert',
    'refresh', 'sync', 'sync_disabled', 'download', 'cloud_download', 'cloud_upload', 'cloud_sync', 'cloud_off',
    'bookmark', 'bookmark_add', 'bookmark_remove', 'favorite', 'favorite_border', 'delete', 'delete_outline',
    'delete_sweep', 'edit', 'edit_note', 'save', 'history', 'update', 'new_releases', 'explore', 'public',
    'travel_explore', 'info', 'help', 'warning', 'error', 'dangerous', 'lock', 'visibility', 'visibility_off',
    'grid_view', 'view_module', 'view_list', 'view_compact', 'checklist', 'select_all', 'flip_to_back',
    'keep', 'keep_off', 'done_all', 'done', 'vertical_align_top', 'vertical_align_bottom', 'format_bold',
    'format_italic', 'format_underlined', 'format_list_bulleted', 'format_list_numbered', 'radio_button_checked',
    'radio_button_unchecked', 'check_box', 'check_box_outline_blank', 'indeterminate_check_box',
    'open_in_new', 'share', 'content_copy', 'content_paste', 'drag_handle', 'drag_indicator', 'rocket_launch',
    'folder', 'folder_open', 'storage', 'sd', 'wifi', 'wifi_tethering', 'dns', 'bug_report', 'code',
    'palette', 'brush', 'category', 'label', 'label_outline', 'feed', 'rss_feed', 'saved_search',
    'auto_stories', 'book', 'chrome_reader_mode', 'volunteer_activism', 'query_stats', 'verified', 'verified_user',
    'male', 'female', 'hourglass_empty', 'schedule', 'event_busy', 'calendar_month', 'play_arrow', 'pause'
}
names.update(core_symbols & available_ligatures)

sequences = {tuple(cmap[ord(c)] for c in name) for name in names if all(ord(c) in cmap for c in name)}
kept = set()
for lookup in font['GSUB'].table.LookupList.Lookup:
    tables = lookup.SubTable if lookup.LookupType == 4 else [t.ExtSubTable for t in lookup.SubTable if lookup.LookupType == 7 and t.ExtensionLookupType == 4]
    for table in tables:
        for first, lig_list in list(table.ligatures.items()):
            matches = [lig for lig in lig_list if (first, *lig.Component) in sequences]
            if matches:
                table.ligatures[first] = matches
                kept.update(lig.LigGlyph for lig in matches)
            else:
                del table.ligatures[first]

options = subset.Options()
options.flavor = 'woff2'
subsetter = subset.Subsetter(options=options)
subsetter.populate(glyphs=kept, text=''.join(names))
subsetter.subset(font)
font.flavor = 'woff2'
target = root / 'src/assets/material-symbols-rounded.woff2'
font.save(target)
print(f'Subset {len(kept)} icon glyphs ({len(names)} ligatures) -> {target.stat().st_size:,} bytes')
