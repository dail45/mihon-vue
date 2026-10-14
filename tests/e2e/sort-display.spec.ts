import { test, expect, type Page } from '@playwright/test'
import { category, chapter, manga, source } from '../fixtures'
const titles = ['Zulu', 'Alpha', 'Beta', 'Read']
async function setup(page: Page) {
  await page.addInitScript(() => localStorage.setItem('mihon.apiUrl', '/api/v1'))
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    const items = titles.map((t,i) => ({ ...manga(i+1,t,[4,2,2,0][i]), chapterCount: [9,3,3,8][i], downloadCount: i === 0 ? 2 : 0, status: i === 2 ? 'COMPLETED' : 'ONGOING' }))
    if (path.endsWith('/category')) body = [category(4,'Default'),category(19,'Reading',1)]
    else if (/\/category\/(4|19)$/.test(path)) body = items
    else if (path.endsWith('/source/list')) body = [source]
    else if (/\/source\/.+\/popular\//.test(path)) body = { mangaList: items, hasNextPage: false }
    else if (path.endsWith('/full')) body = items[0]
    else if (path.endsWith('/chapters')) body = [
      {...chapter,id:11,index:1,name:'Zulu chapter',chapterNumber:3,uploadDate:30,read:false,bookmarked:true},
      {...chapter,id:12,index:2,name:'Alpha chapter',chapterNumber:1,uploadDate:20,read:true,bookmarked:false},
      {...chapter,id:13,index:3,name:'Beta chapter',chapterNumber:2,uploadDate:10,read:false,bookmarked:false},
    ]
    else if (path.endsWith('/thumbnail')) { await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"><rect width="40" height="60" fill="gray"/></svg>'}); return }
    await route.fulfill({json:body})
  })
}
const order = (page: Page) => page.locator('.manga-card, .manga-list-link').evaluateAll(els => els.map(e => e.querySelector('.manga-title-text, .manga-list-title')?.textContent?.trim()))
async function sheet(page:Page, tab:string, chapterMode=false) {
  await page.getByRole('button',{name:chapterMode?'Chapter settings':'Filter and sort library',exact:true}).click()
  await page.getByRole('tab',{name:tab,exact:true}).click()
}
async function done(page:Page) { await page.getByRole('button',{name:'Done',exact:true}).click() }
test('library ordering reverses primary only, keeps zero unread last, persists across routes and categories', async ({page}) => {
  await setup(page); await page.goto('/library')
  await expect.poll(()=>order(page)).toEqual(['Alpha','Beta','Read','Zulu'])
  await sheet(page,'Sort'); await page.getByRole('button',{name:'Unread chapters',exact:true}).click(); await done(page)
  await expect.poll(()=>order(page)).toEqual(['Alpha','Beta','Zulu','Read'])
  await sheet(page,'Sort'); await page.getByRole('button',{name:'Unread chapters',exact:true}).click(); await done(page)
  await expect.poll(()=>order(page)).toEqual(['Zulu','Alpha','Beta','Read'])
  await sheet(page,'Sort'); await page.getByRole('button',{name:'Total chapters',exact:true}).click(); await done(page)
  await expect.poll(()=>order(page)).toEqual(['Zulu','Read','Alpha','Beta'])
  await page.getByRole('tab',{name:'Reading',exact:true}).click()
  await expect.poll(()=>order(page)).toEqual(['Zulu','Read','Alpha','Beta'])
  await page.goto('/more'); await page.goto('/library'); await page.reload()
  await expect.poll(()=>order(page)).toEqual(['Zulu','Read','Alpha','Beta'])
  await sheet(page,'Sort'); await expect(page.getByRole('button',{name:'Last update unavailable'})).toBeDisabled(); await done(page)
})
test('tri-state includes, excludes, clears and persists instead of treating exclusion as inclusion', async ({page}) => {
  await setup(page); await page.goto('/library'); await sheet(page,'Filter')
  const row=page.getByRole('checkbox',{name:'Unread',exact:true})
  await expect(row).not.toBeChecked(); await row.click(); await expect(row).toBeChecked(); await done(page)
  await expect.poll(()=>order(page)).toEqual(['Alpha','Beta','Zulu'])
  await sheet(page,'Filter'); await row.click(); await expect(row).toHaveAttribute('aria-checked','mixed'); await done(page)
  await expect.poll(()=>order(page)).toEqual(['Read']); await page.reload(); await expect.poll(()=>order(page)).toEqual(['Read'])
  await sheet(page,'Filter'); await row.click(); await done(page); await expect.poll(()=>order(page)).toEqual(['Alpha','Beta','Read','Zulu'])
})
test('display modes, independent badges, column orientation and list geometry are real changes', async ({page}) => {
  await setup(page); await page.goto('/library'); await sheet(page,'Display')
  await page.getByRole('checkbox',{name:'Download badges',exact:true}).click()
  await page.getByRole('checkbox',{name:'Unread badges',exact:true}).click()
  const slider=page.getByRole('slider',{name:'Items per row',exact:true})
  await slider.focus(); await slider.press('Home'); await slider.press('ArrowRight'); await slider.press('ArrowRight'); await slider.press('ArrowRight'); await done(page)
  await expect(page.locator('.library-grid')).toHaveCSS('grid-template-columns', /^\S+ \S+ \S+$/)
  await expect(page.locator('.manga-badge[aria-label$="unread chapters"]')).toHaveCount(0)
  await expect(page.locator('.manga-badge[aria-label$="downloaded chapters"]')).toHaveCount(1)
  const size=page.viewportSize()!
  await page.setViewportSize({width:size.height,height:size.width})
  // The opposite orientation is still Auto, not the three-column override.
  expect(await page.locator('.library-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)).not.toBe(3)
  await page.setViewportSize(size)
  await page.goto(`/browse/source/${source.id}`)
  await expect(page.locator('.library-grid')).toHaveCSS('grid-template-columns', /^\S+ \S+ \S+$/)
  await page.goto('/library'); await sheet(page,'Display'); await page.getByRole('button',{name:'List',exact:true}).click(); await done(page)
  await expect(page.locator('.manga-list-row').first()).toHaveCSS('height','56px')
  await expect(page.locator('.list-cover-image').first()).toHaveCSS('width','40px')
  await expect(page.locator('.list-cover-image').first()).toHaveCSS('height','40px')
  await page.reload(); await expect(page.getByLabel('Manga list')).toBeVisible()
})
test('chapter four ordering fields, reversal, persistence, negative filter and chapter-number display', async ({page}) => {
  await setup(page); await page.goto('/manga/1')
  // Links are the authoritative displayed sequence; no API array reordering assumptions.
  const links=()=>page.locator('.manga-detail a.v-list-item[href*="/read/"]').evaluateAll(els=>els.map(e=>e.getAttribute('href')?.split('/').pop()))
  await expect.poll(links).toEqual(['3','2','1'])
  for (const [label, expected] of [['By chapter number',['2','3','1']],['By upload date',['3','2','1']],['Alphabetically',['2','3','1']],['By source',['1','2','3']]] as const) {
    await sheet(page,'Sort',true); await page.getByRole('button',{name:label,exact:true}).click(); await done(page)
    await expect.poll(links).toEqual([...expected])
    await sheet(page,'Sort',true); await page.getByRole('button',{name:label,exact:true}).click(); await done(page)
    await expect.poll(links).toEqual([...expected].reverse())
  }
  await page.reload(); await expect.poll(links).toEqual(['3','2','1'])
  await sheet(page,'Filter',true); const row=page.getByRole('checkbox',{name:'Unread',exact:true}); await row.click(); await row.click(); await done(page)
  await expect.poll(links).toEqual(['2'])
  await sheet(page,'Display',true); await page.getByRole('radio',{name:'Show chapter number',exact:true}).check(); await done(page)
  await expect(page.getByText('Chapter 1',{exact:true})).toBeVisible(); await expect(page.getByText('Alpha chapter',{exact:true})).toHaveCount(0)
})
