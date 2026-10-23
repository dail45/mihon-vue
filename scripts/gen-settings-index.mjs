// Dev-time helper: extracts the preference index (groups + item titles/subtitles) of the
// pinned Mihon settings screens and writes a TS data module.
import { readFileSync, writeFileSync } from 'node:fs'

const base = 'mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen'
const screens = [
  ['SettingsAppearanceScreen.kt', 'appearance', 'Appearance'],
  ['SettingsLibraryScreen.kt', 'library', 'Library'],
  ['SettingsReaderScreen.kt', 'reader', 'Reader'],
  ['SettingsDownloadScreen.kt', 'downloads', 'Downloads'],
  ['SettingsTrackingScreen.kt', 'tracking', 'Tracking'],
  ['SettingsBrowseScreen.kt', 'browse', 'Browse'],
  ['SettingsDataScreen.kt', 'data', 'Data and storage'],
  ['SettingsSecurityScreen.kt', 'security', 'Security and privacy'],
  ['SettingsAdvancedScreen.kt', 'advanced', 'Advanced'],
]

const stringsXml = readFileSync('mihon/i18n/src/commonMain/moko-resources/base/strings.xml', 'utf8')
const strMap = new Map()
for (const m of stringsXml.matchAll(/<string name="([^"]+)">(.*?)<\/string>/gs))
  strMap.set(m[1], m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
const resolve = k => strMap.get(k) ?? k

function calls(src) {
  const re = /Preference\.(PreferenceGroup|PreferenceItem\.[A-Za-z]+)\(/g
  const list = []
  let m
  while ((m = re.exec(src))) {
    const opener = m[0]
    let depth = 0, i = m.index + opener.length - 1
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '"') { i++; while (i < src.length && src[i] !== '"') { if (src[i] === '\\') i++; i++ } ; continue }
      if (c === '(') depth++
      else if (c === ')') { depth--; if (depth === 0) break }
    }
    const body = src.slice(m.index, i + 1)
    // own segment = up to the first nested Preference.* call
    const rest = body.slice(opener.length)
    const nested = rest.search(/Preference\.(PreferenceGroup|PreferenceItem\.[A-Za-z]+)\(/)
    const own = nested === -1 ? body : body.slice(0, opener.length + nested)
    const tm = own.match(/title = stringResource\(MR\.strings\.([A-Za-z0-9_]+)\)/)
    const tl = own.match(/title = "([^"]*)"/)
    const sm = own.match(/subtitle = stringResource\(MR\.strings\.([A-Za-z0-9_]+)\)/)
    list.push({
      kind: m[1] === 'PreferenceGroup' ? 'group' : 'item',
      start: m.index, end: i,
      title: tm ? resolve(tm[1]) : tl ? tl[1] : null,
      subtitle: sm ? resolve(sm[1]) : null,
    })
    re.lastIndex = m.index + opener.length
  }
  return list
}

const result = []
for (const [file, key, title] of screens) {
  const src = readFileSync(`${base}/${file}`, 'utf8')
  const list = calls(src)
  const groupCalls = list.filter(c => c.kind === 'group')
  const groups = groupCalls.map(g => ({ title: g.title, items: [] }))
  const topItems = []
  const ordered = []
  for (const c of list) {
    if (c.kind === 'group') { ordered.push({ kind: 'group', title: c.title, start: c.start }); continue }
    let owner = null
    for (let gi = 0; gi < groupCalls.length; gi++) {
      const g = groupCalls[gi]
      if (g.start < c.start && g.end > c.end) {
        if (!owner || (groupCalls[owner].start < g.start && groupCalls[owner].end > g.end)) owner = gi
      }
    }
    if (owner !== null) groups[owner].items.push({ title: c.title, subtitle: c.subtitle })
    else topItems.push({ title: c.title, subtitle: c.subtitle })
    ordered.push({ kind: 'item', title: c.title, subtitle: c.subtitle, group: owner === null ? null : groups[owner].title, start: c.start })
  }
  result.push({ key, title, groups, topItems, ordered })
}
writeFileSync('scripts/settings-index.raw.json', JSON.stringify(result, null, 2))
for (const r of result) {
  console.log(`\n### ${r.title}`)
  console.log(` TOP: ${r.topItems.map(i => i.title).join(' | ')}`)
  for (const g of r.groups) console.log(` - [${g.title}] ${g.items.map(i => i.title + (i.subtitle ? ' :: ' + i.subtitle : '')).join(' | ')}`)
}
