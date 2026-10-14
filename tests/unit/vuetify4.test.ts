import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
function files(dir: string): string[] { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.name.endsWith('.vue')?[join(dir,e.name)]:[]) }
describe('Vuetify 4 migration guardrails',()=>{
 it('locks Vuetify 4 and does not re-enable a legacy compatibility blueprint',()=>{
  const pkg=JSON.parse(readFileSync('package-lock.json','utf8'));expect(pkg.packages['node_modules/vuetify'].version).toMatch(/^4\./)
  expect(readFileSync('src/plugins/vuetify.ts','utf8')).not.toMatch(/blueprint\s*:|from ['"]vuetify\/blueprints/)
 })
 it('all templates use MD3 names rather than legacy typography utilities',()=>{
  expect(files('src').filter(p=>/\btext-(?:h[1-6]|subtitle-[12]|body-[12]|caption|overline)\b/.test(readFileSync(p,'utf8')))).toEqual([])
 })
 it('loads the explicit cascade layer order before application entry',()=>{
  const html=readFileSync('index.html','utf8');expect(html.indexOf('/layers.css')).toBeLessThan(html.indexOf('/src/main.ts'))
  expect(readFileSync('public/layers.css','utf8')).toContain('app-components, vuetify-utilities')
 })
 it('uses native Vuetify controls for common settings and toolbar input',()=>{
  for(const p of ['src/components/PreferenceCheckbox.vue','src/components/TriStateRow.vue'])expect(readFileSync(p,'utf8')).toContain('<v-checkbox')
  for(const p of ['src/components/SearchAppBar.vue','src/views/SourceView.vue']){const s=readFileSync(p,'utf8');expect(s).toContain('<v-text-field');expect(s).not.toMatch(/<input\b/)}
 })
})
