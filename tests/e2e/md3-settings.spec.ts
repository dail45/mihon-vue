import { test, expect } from '@playwright/test'
import { category, manga } from '../fixtures'
test.beforeEach(async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('mihon.apiUrl','/api/v1'))
  await page.route('**/api/v1/**', r => r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/category') ? [category(4,'Default')] : [manga(1,'Alpha')]}))
})
test('primary modal tabs have text-sized indicators and no Done; discrete slider has ticks and a bar', async ({page}) => {
  await page.goto('/library'); await page.getByRole('button',{name:'Filter and sort library'}).click(); await page.getByRole('tab',{name:'Display',exact:true}).click()
  await expect(page.getByRole('button',{name:'Done',exact:true})).toHaveCount(0)
  const geometry=await page.locator('.v-tab--selected .settings-tab-label').evaluate(e=>({label:e.getBoundingClientRect().width,indicator:parseFloat(getComputedStyle(e,'::after').width),height:parseFloat(getComputedStyle(e,'::after').height)}))
  expect(geometry.indicator).toBeLessThanOrEqual(geometry.label);expect(geometry.height).toBe(3)
  await expect(page.locator('.md3-slider-stop')).toHaveCount(11)
  await expect(page.locator('.md3-slider-handle')).toHaveCSS('width','4px');await expect(page.locator('.md3-slider-handle')).toHaveCSS('height','44px')
  const slider=page.getByRole('slider',{name:'Items per row'});await slider.focus();await slider.press('End');await expect(slider).toHaveValue('10')
  await page.keyboard.press('Escape'); await expect(page.locator('.adaptive-settings-card')).toBeHidden()
})
test('ten native sections plus server; preference dialogs and tablet mode persist', async ({page}) => {
  await page.goto('/settings'); await expect(page.locator('.settings-navigation a')).toHaveCount(11)
  await page.goto('/settings/appearance'); await page.getByText('Tablet UI',{exact:true}).click();await page.getByRole('radio',{name:'Never',exact:true}).click()
  await expect(page.locator('.settings-two-pane')).toHaveCount(0);await page.goto('/library');await expect(page.locator('.mihon-navigation')).toBeVisible()
  await page.reload();await expect(page.locator('.mihon-navigation')).toBeVisible()
  await page.goto('/settings/appearance');await page.getByText('Tablet UI',{exact:true}).click();await page.getByRole('radio',{name:'Always',exact:true}).click()
  await expect(page.locator('.settings-two-pane')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.goto('/library');await expect(page.locator('.mihon-rail')).toBeVisible()
})
test('server drafts do not autosave; explicit confirmation sends only changed allowed fields', async ({page}) => {
  const settings={downloadAsCbz:false,autoDownloadNewChapters:false,autoDownloadIgnoreReUploads:true,autoDownloadNewChaptersLimit:0,globalUpdateInterval:12,maxSourcesInParallel:6};let mutations=0
  await page.route('**/api/graphql',async r=>{const body=r.request().postDataJSON();if(body.query.startsWith('mutation')) {mutations++;expect(body.variables.input.settings).toEqual({downloadAsCbz:true});await r.fulfill({json:{data:{setSettings:{settings:{...settings,downloadAsCbz:true}}}}})}else await r.fulfill({json:{data:{settings}}})})
  await page.goto('/settings/connection');expect(mutations).toBe(0);await page.getByRole('button',{name:'Load server settings'}).click();await page.getByRole('checkbox',{name:'Save chapters as CBZ'}).check();expect(mutations).toBe(0)
  await page.getByRole('button',{name:'Save',exact:true}).click();expect(mutations).toBe(0);await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(mutations).toBe(0)
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Save to server'}).click();await expect(page.getByRole('status')).toContainText('saved');expect(mutations).toBe(1)
})
test('chapter overflow confirms browser defaults, reset restores them, tablet manga separates panes', async ({page}) => {
  await page.route('**/api/v1/manga/1/full*',r=>r.fulfill({json:manga(1,'Alpha')}))
  await page.route('**/api/v1/manga/1/chapters*',r=>r.fulfill({json:[]}))
  await page.goto('/manga/1');await page.getByRole('button',{name:'Chapter settings',exact:true}).click();await page.getByRole('tab',{name:'Display',exact:true}).click();await page.getByRole('radio',{name:'Show chapter number'}).check()
  await page.getByRole('button',{name:'Chapter settings options'}).click();await page.getByText('Set as default',{exact:true}).click();await page.getByRole('button',{name:'OK',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('mihon.chapters.default')||'{}').display)).toBe('number')
  await page.getByRole('radio',{name:'Show title'}).check();await page.getByRole('button',{name:'Chapter settings options'}).click();await page.getByText('Reset to defaults',{exact:true}).click();await expect(page.getByRole('radio',{name:'Show chapter number'})).toBeChecked();await page.keyboard.press('Escape')
  await expect(page.locator('.manga-two-pane')).toHaveCount(page.viewportSize()!.width >= 600 ? 1 : 0)
})
