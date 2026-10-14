import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? vueFiles(join(dir, e.name)) : e.name.endsWith('.vue') ? [join(dir, e.name)] : [])
}
describe('explicit Vuetify component registration', () => {
  it('registers every Vuetify component used by templates', () => {
    const config = readFileSync('src/plugins/vuetify.ts', 'utf8')
    const registered = new Set(config.match(/components: \{([^}]+)\}/s)![1]!.split(',').map(s => s.trim()))
    const missing = vueFiles('src').flatMap(file => [...readFileSync(file, 'utf8').matchAll(/<v-([a-z-]+)\b/g)].flatMap(m => {
      const component = `V${m[1]!.split('-').map(s => s[0]!.toUpperCase() + s.slice(1)).join('')}`
      return registered.has(component) ? [] : [`${file}: ${component}`]
    }))
    expect(missing).toEqual([])
  })
})
