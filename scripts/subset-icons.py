"""Optional maintainer utility: pip install 'fonttools[woff]'.
Subsets the installed Material Symbols font to app icons and Vuetify MD aliases.
The generated asset is checked in; ordinary npm builds do not need Python.
"""
from pathlib import Path
import re
from fontTools import subset
from fontTools.ttLib import TTFont
root = Path(__file__).resolve().parent.parent
texts = '\n'.join(p.read_text(encoding='utf-8') for p in (root / 'src').rglob('*') if p.suffix in {'.vue', '.ts'})
# Icon names in attributes and TS constants plus all Vuetify MD aliases.
aliases = (root / 'node_modules/vuetify/lib/iconsets/md.js').read_text(encoding='utf-8')
# Icon names in attributes and TS constants plus all Vuetify MD aliases.
# Quoted names cover v-icon="..." and TS string constants; the unquoted snake_case
# scan covers the <span class="material-symbols-rounded">name</span> ligature markup.
names = set(re.findall(r"['\"]([a-z]+(?:_[a-z]+)*)['\"]", texts + aliases))
# The ligature markup <span class="material-symbols-rounded">name</span> carries the icon
# name as element text, so it is picked up from the span body directly.
names |= set(re.findall(r"<span[^>]*material-symbols[^>]*>\s*([a-z0-9_]+)\s*</span>", texts))
font = TTFont(root / 'node_modules/material-symbols/material-symbols-rounded.woff2')
cmap = font.getBestCmap()
sequences = {tuple(cmap[ord(c)] for c in name) for name in names if all(ord(c) in cmap for c in name)}
kept = set()
for lookup in font['GSUB'].table.LookupList.Lookup:
    tables = lookup.SubTable if lookup.LookupType == 4 else [t.ExtSubTable for t in lookup.SubTable if lookup.LookupType == 7 and t.ExtensionLookupType == 4]
    for table in tables:
        for first, ligatures in list(table.ligatures.items()):
            matches = [lig for lig in ligatures if (first, *lig.Component) in sequences]
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
print(f'Subset {len(kept)} icon glyphs -> {target.stat().st_size:,} bytes')
