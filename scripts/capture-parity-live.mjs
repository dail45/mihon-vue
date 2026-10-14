// Explicit opt-in real-data visual acceptance for the parity increment.
// Launches a sandbox-local browser for the local app, not the shared browser.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const api = process.env.LIVE_SUWAYOMI_API_URL
if (!api) throw Error('Set LIVE_SUWAYOMI_API_URL explicitly; no fixture fallback.')
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5180'
const output = process.env.QA_OUTPUT || '/data/parity-controls-live'
await mkdir(output, { recursive: true })
const report = { fixtures: false, captures: [], errors: [], blockedWrites: [], imageFailures: [], warnings: [] }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] })
try {
  for (const [size,width,height] of [['mobile',390,844],['desktop',1440,1000]].filter(([size]) => !process.env.QA_DEVICE || process.env.QA_DEVICE === size)) {
    const context = await browser.newContext({ viewport: {width,height}, colorScheme: 'light' })
    await context.addInitScript(url => { localStorage.setItem('mihon.apiUrl',url); localStorage.setItem('mihon.reader.saveProgress','false') }, api)
    const page = await context.newPage()
    page.on('pageerror', e => report.errors.push(`${size}: ${e.message}`))
    page.on('console', message => { if (/Failed to resolve component/.test(message.text())) report.errors.push(`${size}: unresolved Vue component`) })
    await page.route(`${new URL(api).origin}/**`, route => {
      const r=route.request(), url=new URL(r.url())
      if (!['GET','HEAD'].includes(r.method()) || /\/manga\/\d+\/library\/?$/.test(url.pathname) || url.searchParams.get('onlineFetch')==='true' || (/\/page\/\d+$/.test(url.pathname) && url.searchParams.get('updateProgress')!=='false')) {
        report.blockedWrites.push(`${r.method()} ${url.pathname}`); return route.abort('blockedbyclient')
      }
      return route.continue()
    })
    async function capture(state) {
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(400)
      await page.waitForFunction(() => [...document.querySelectorAll('.v-img')].filter(e => { const r=e.getBoundingClientRect(); return r.bottom>0 && r.top<innerHeight && r.width>0 }).every(e=>{ const i=e.querySelector('img.v-img__img:not(.v-img__img--preload)'); return i?.complete && i.naturalWidth>0 }), undefined, {timeout:30000}).catch(()=>{})
      await page.waitForTimeout(300)
      if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error(`Overflow: ${size}/${state}`)
      const failed=await page.evaluate(()=>[...document.images].filter(i=>{const r=(i.closest('.v-img')||i).getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.width>0&&(!i.complete||!i.naturalWidth)}).length)
      if (failed) report.imageFailures.push({size,state,count:failed})
      const badIcons=await page.evaluate(()=>{const ctx=document.createElement('canvas').getContext('2d');ctx.font='24px "Material Symbols Rounded"';return [...document.querySelectorAll('.material-symbols-rounded')].filter(e=>ctx.measureText(e.textContent||'').width>26).map(e=>e.textContent)})
      if(badIcons.length) throw Error(`Unshaped icons: ${badIcons.join(', ')}`)
      await page.screenshot({path:`${output}/${size}-${state}.png`,animations:'disabled'})
      report.captures.push(`${size}-${state}`)
    }
    await page.goto(`${base}/library`); await page.locator('.manga-card').first().waitFor({timeout:30000}); report.vuetifyVersion = await page.locator('.v-application').getAttribute('data-vuetify-version'); if (!report.vuetifyVersion?.startsWith('4.')) throw Error('Live acceptance requires Vuetify 4'); await capture('library')
    const href=await page.locator('.manga-card').first().getAttribute('href'), id=href.split('/')[2]
    const sourceId=await page.evaluate(async({api,id})=>{const r=await fetch(`${api}/manga/${id}/full?onlineFetch=false`,{credentials:'include'});if(!r.ok)throw Error('Manga lookup failed');return (await r.json()).sourceId},{api,id})
    await page.getByRole('button',{name:'Open library search'}).click(); await capture('library-search'); await page.getByRole('button',{name:'Close search',exact:true}).click()
    for(const tab of ['Filter','Sort','Display']) {
      await page.getByRole('button',{name:'Filter and sort library'}).click(); await page.getByRole('tab',{name:tab,exact:true}).click(); await capture(`library-${tab.toLowerCase()}`); await page.getByRole('button',{name:'Done',exact:true}).click()
    }
    for(const [label,state] of [['Comfortable grid','comfortable'],['Cover-only grid','covers'],['List','list'],['Compact grid','compact']]) {
      await page.getByRole('button',{name:'Filter and sort library'}).click(); await page.getByRole('tab',{name:'Display',exact:true}).click(); await page.getByRole('button',{name:label,exact:true}).click(); await page.getByRole('button',{name:'Done',exact:true}).click(); if(state!=='compact')await capture(`library-${state}`)
    }
    await page.goto(`${base}${href}`); await page.locator('.manga-detail h1').waitFor({timeout:30000}); await capture('manga')
    await page.getByRole('button',{name:'View full cover'}).click(); await capture('cover'); await page.getByRole('button',{name:'Close cover'}).click()
    await page.getByRole('button',{name:'Chapter settings',exact:true}).click(); await capture('chapter-filter'); await page.getByRole('tab',{name:'Sort',exact:true}).click(); await capture('chapter-sort'); await page.getByRole('button',{name:'Done',exact:true}).click()
    await page.goto(`${base}/browse`); await page.getByRole('link',{name:/./}).last().waitFor(); await page.getByRole('button',{name:'Open source list search'}).click(); await capture('sources-search')
    await page.goto(`${base}/browse/source/${encodeURIComponent(sourceId)}`); await page.locator('.manga-card').first().waitFor({timeout:30000}); await capture('source-popular')
    if(await page.getByRole('button',{name:'Use dark theme'}).count() || await page.getByRole('button',{name:'Server connection settings'}).count())throw Error('Extraneous toolbar actions')
    const title=(await page.locator('.manga-title-text').first().innerText()).trim()
    const latest=page.getByRole('button',{name:'Latest',exact:true})
    if(await latest.count()) {await latest.click();await page.waitForFunction(()=>!document.querySelector('[aria-label="Loading catalogue"]'));await page.locator('.manga-card').first().waitFor({timeout:30000});await capture('source-latest')}
    await page.getByRole('button',{name:'Open source search'}).click(); await page.getByLabel('Search source').fill(title); await capture('source-search-input')
    await page.getByLabel('Search source').press('Enter'); await page.waitForFunction(()=>!document.querySelector('[aria-label="Loading catalogue"]')); await page.locator('.manga-card').first().waitFor({timeout:30000}); await capture('source-search-results')
    await page.getByRole('button',{name:'Catalogue display mode'}).click();await capture('source-display-menu'); await page.getByText('List',{exact:true}).click();await capture('source-list')
    for(const width of (size==='mobile'?[320,720]:[])) {await page.setViewportSize({width,height:844});await capture(`source-width-${width}`)}
    await page.setViewportSize({width,height})
    for(const route of ['updates','history','more','categories','settings','settings/appearance','settings/library','settings/reader','settings/connection','about']) {
      await page.goto(`${base}/${route}`)
      if(route==='updates'){await page.waitForFunction(()=>!document.querySelector('[aria-label="Loading updates"]'),undefined,{timeout:30000}); if(await page.getByRole('heading',{name:'Updates unavailable'}).count())throw Error('Live updates unavailable')}
      if(route==='categories')await page.locator('.settings-content .v-list-item').first().waitFor({timeout:30000})
      await capture(route.replaceAll('/','-'))
    }
    await page.goto(`${base}/settings/appearance`);await page.getByRole('radio',{name:'Dark',exact:true}).check();await capture('appearance-dark')
    await page.goto(`${base}/browse/source/${encodeURIComponent(sourceId)}`);await page.getByRole('button',{name:'Catalogue display mode'}).click();await page.getByText('Compact grid',{exact:true}).click();await page.locator('.manga-card').first().waitFor({timeout:30000});await capture('source-dark')
    await context.close()
  }
} catch(e) {report.errors.push(e.message);process.exitCode=1}
finally {await browser.close();await writeFile(`${output}/report.json`,JSON.stringify(report,null,2))}
console.log(JSON.stringify(report,null,2))
if(report.errors.length||report.blockedWrites.length||report.imageFailures.length)process.exitCode=1
