import fs from 'node:fs'
import path from 'node:path'

const mokoDir = 'mihon/i18n/src/commonMain/moko-resources'
const outDir = 'src/locales'

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}
if (!fs.existsSync('src/i18n')) {
  fs.mkdirSync('src/i18n', { recursive: true })
}

function unescapeAndroidString(str) {
  let val = str.trim()
  if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
    val = val.slice(1, -1)
  }
  val = val
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

  // Convert Android placeholders to vue-i18n interpolation placeholders:
  val = val.replace(/%%/g, '__PERCENT__')
  val = val.replace(/%(\d+)\$([0-9.]*)?[a-zA-Z]/g, (_, num) => `{${parseInt(num, 10) - 1}}`)
  let argIdx = 0
  val = val.replace(/%([0-9.]*)?[a-zA-Z]/g, () => `{${argIdx++}}`)
  val = val.replace(/__PERCENT__/g, '%')
  val = val.replace(/@([a-zA-Z0-9_.-]+)/g, "@{'@'}$1")

  return val
}

const dirs = fs.readdirSync(mokoDir).filter(d => fs.statSync(path.join(mokoDir, d)).isDirectory())

const langMap = {}
const pluralMap = {}
const allKeys = new Set()
const allPluralKeys = new Set()

for (const d of dirs) {
  if (d === 'az' || d === 'tt') continue
  const tag = d === 'base' ? 'en' : d.replace(/-r/g, '-')
  const sf = path.join(mokoDir, d, 'strings.xml')
  const pf = path.join(mokoDir, d, 'plurals.xml')

  const strings = {}
  if (fs.existsSync(sf)) {
    const content = fs.readFileSync(sf, 'utf8')
    for (const m of content.matchAll(/<string name="([^"]+)"[^>]*>(.*?)<\/string>/gs)) {
      const key = m[1]
      allKeys.add(key)
      strings[key] = unescapeAndroidString(m[2])
    }
  }
  langMap[tag] = strings

  const plurals = {}
  if (fs.existsSync(pf)) {
    const content = fs.readFileSync(pf, 'utf8')
    for (const m of content.matchAll(/<plurals name="([^"]+)">([\s\S]*?)<\/plurals>/g)) {
      const pKey = m[1]
      allPluralKeys.add(pKey)
      const items = {}
      for (const im of m[2].matchAll(/<item quantity="([^"]+)">([\s\S]*?)<\/item>/g)) {
        items[im[1]] = unescapeAndroidString(im[2])
      }
      plurals[pKey] = items
    }
  }
  pluralMap[tag] = plurals
}

console.log(`Parsed ${Object.keys(langMap).length} languages. Unique strings: ${allKeys.size}, unique plurals: ${allPluralKeys.size}`)

const enStrings = langMap['en'] || {}
const enPlurals = pluralMap['en'] || {}

let totalFiles = 0
for (const tag of Object.keys(langMap)) {
  const mergedStrings = { ...enStrings, ...(langMap[tag] || {}) }
  const mergedPlurals = { ...enPlurals, ...(pluralMap[tag] || {}) }
  const outputObj = {
    ...mergedStrings,
    _plurals: mergedPlurals,
  }
  fs.writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(outputObj, null, 2), 'utf8')
  totalFiles++
}

console.log(`Wrote ${totalFiles} locale files to ${outDir}`)

// Generate MR.ts
const sortedKeys = [...allKeys].sort()
const sortedPluralKeys = [...allPluralKeys].sort()

let mrContent = `/**
 * Generated Mihon string & plural resource keys.
 * Matches \`MR.strings.*\` and \`MR.plurals.*\` from Mihon's moko-resources.
 */

export const MR = {
  strings: {
`

for (const key of sortedKeys) {
  const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
  mrContent += `    ${safeKey}: '${key}',\n`
}

mrContent += `  } as const,
  plurals: {
`

for (const pKey of sortedPluralKeys) {
  const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(pKey) ? pKey : JSON.stringify(pKey)
  mrContent += `    ${safeKey}: '${pKey}',\n`
}

mrContent += `  } as const,
}

export type StringResourceKey = keyof typeof MR.strings
export type PluralResourceKey = keyof typeof MR.plurals
`

fs.writeFileSync('src/i18n/MR.ts', mrContent, 'utf8')
console.log('Generated src/i18n/MR.ts')
