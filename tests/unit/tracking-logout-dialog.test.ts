import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/TrackingLogoutDialog.vue', 'utf8')

describe('TrackingLogoutDialog matches the Mihon reference', () => {
  it('renders the reference title with the tracker name', () => {
    expect(source).toContain('`Log out from ${props.trackerName}?`')
  })

  it('renders the reference action buttons', () => {
    expect(source).toContain('>Cancel</button>')
    expect(source).toContain('>Log out</button>')
  })

  it('uses the MD3 alert dialog geometry', () => {
    expect(source).toMatch(/padding:\s*24px/)
    expect(source).toMatch(/border-radius:\s*28px/)
    expect(source).toMatch(/min-width:\s*min\(280px/)
    expect(source).toMatch(/max-width:\s*min\(560px/)
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*32px/)
    expect(source).toMatch(/text-align:\s*center/)
  })

  it('lays the buttons out like the reference Row with 4dp spacing and equal weights', () => {
    expect(source).toMatch(/gap:\s*4px/)
    expect(source).toMatch(/flex:\s*1 1 0/)
    expect(source).toMatch(/height:\s*40px/)
    expect(source).toMatch(/border-radius:\s*20px/)
  })

  it('styles the buttons as MD3 outlined and filled buttons', () => {
    expect(source).toMatch(/border:\s*1px solid rgb\(var\(--v-theme-outline\)\)/)
    expect(source).toMatch(/background:\s*rgb\(var\(--v-theme-error\)\)/)
    expect(source).toMatch(/color:\s*rgb\(var\(--v-theme-on-error\)\)/)
  })

  it('reports an unsupported log-out instead of pretending to succeed', () => {
    expect(source).toContain('not supported in the web client')
  })
})
