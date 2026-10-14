// Real-server acceptance. No fixtures; only allowlisted read-only GraphQL query.
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const api=process.env.LIVE_SUWAYOMI_API_URL
if(!api) throw Error('Set LIVE_SUWAYOMI_API_URL explicitly; no fixture fallback.')
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5180', output=process.env.QA_OUTPUT||'/data/md3-settings-live'
await mkdir(output,{recursive:true})
const report={fixtures:false,captures:[],checks:[],errors:[],blockedWrites:[]}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']})
try {
 for(const [size,width,height] of [['mobile',390,844],['desktop',1440,1000]]) {
  const context=await browser.newContext({viewport:{width,height}})
  await context.addInitScript(api=>{localStorage.setItem('mihon.apiUrl',api);localStorage.setItem('mihon.reader.saveProgress','false')},api)
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(`${size}: ${e.message}`))
  await page.route(`${new URL(api).origin}/**`,r=>{
   const req=r.request(),u=new URL(req.url())
   const readSettings=req.method()==='POST'&&u.pathname.endsWith('/api/graphql')&&req.postDataJSON()?.query==='query WebSettings { settings { downloadAsCbz autoDownloadNewChapters autoDownloadIgnoreReUploads autoDownloadNewChaptersLimit globalUpdateInterval maxSourcesInParallel } }'
   if((!['GET','HEAD'].includes(req.method())&&!readSettings)||/\/manga\/\d+\/library\/?$/.test(u.pathname)||u.searchParams.get('onlineFetch')==='true'||(/\/page\/\d+$/.test(u.pathname)&&u.searchParams.get('updateProgress')!=='false')) {report.blockedWrites.push(`${req.method()} ${u.pathname}`);return r.abort()}
   return r.continue()
  })
  async function capture(state,fullPage=false){
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(450)
   await page.waitForFunction(()=>[...document.querySelectorAll('.v-img')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.bottom>0&&r.top<innerHeight}).every(e=>{const i=e.querySelector('img.v-img__img:not(.v-img__img--preload)');return i?.complete&&i.naturalWidth}),undefined,{timeout:25000}).catch(()=>{})
   await page.waitForFunction(()=>[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.bottom>0&&r.top<innerHeight}).every(i=>i.complete),undefined,{timeout:25000}).catch(()=>{})
   await page.waitForTimeout(500) // let VImg's loaded-state transition render after naturalWidth becomes available
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`Overflow ${size}/${state}`)
   await page.screenshot({path:`${output}/${size}-${state}.png`,fullPage,animations:'disabled'});report.captures.push(`${size}-${state}`)
  }
  await page.goto(`${base}/library`);await page.locator('.manga-card').first().waitFor({timeout:30000});const href=await page.locator('.manga-card').first().getAttribute('href')
  for(const tab of ['Filter','Sort','Display']){await page.getByRole('button',{name:'Filter and sort library'}).click();await page.getByRole('tab',{name:tab,exact:true}).click();await capture(`library-${tab.toLowerCase()}`);await page.keyboard.press('Escape')}
  await page.goto(`${base}${href}`);await page.locator('.manga-detail h1').waitFor({timeout:30000});await capture('manga-layout');await page.getByRole('button',{name:'Chapter settings',exact:true}).click();await page.getByRole('button',{name:'Chapter settings options'}).click();await capture('chapter-overflow');await page.getByText('Set as default',{exact:true}).click();await capture('chapter-default');await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.keyboard.press('Escape')
  await page.goto(`${base}/settings`);await capture('settings',true)
  await page.goto(`${base}/settings/appearance`);await page.getByText('Tablet UI',{exact:true}).click();await capture('tablet-choice');await page.getByRole('radio',{name:'Never',exact:true}).click();await capture('appearance-phone',true)
  await page.goto(`${base}/library`);if(!await page.locator('.mihon-navigation').isVisible())throw Error('Never must use bottom navigation');await page.getByRole('button',{name:'Filter and sort library'}).click();await page.getByRole('tab',{name:'Display',exact:true}).click();await capture('forced-phone-sheet');await page.keyboard.press('Escape')
  await page.goto(`${base}/settings/appearance`);await page.getByText('Tablet UI',{exact:true}).click();await page.getByRole('radio',{name:'Always',exact:true}).click();await capture('forced-tablet-settings',true)
  await page.goto(`${base}/library`);if(!await page.locator('.mihon-rail').isVisible())throw Error('Always must use rail');await page.getByRole('button',{name:'Filter and sort library'}).click();await page.getByRole('tab',{name:'Display',exact:true}).click();await capture('forced-tablet-sheet');await page.keyboard.press('Escape')
  await page.goto(`${base}/settings/appearance`);await page.getByText('Tablet UI',{exact:true}).click();await page.getByRole('radio',{name:'Automatic',exact:true}).click()
  await page.goto(`${base}/settings/reader`);await capture('reader-preferences',true);await page.getByText('Reading mode',{exact:true}).click();await capture('reader-choice');await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await page.goto(`${base}/settings/connection`);await page.getByRole('button',{name:'Load server settings'}).click();await page.getByRole('checkbox',{name:'Save chapters as CBZ'}).waitFor({timeout:25000});await capture('server-settings',true)
  await page.getByRole('checkbox',{name:'Save chapters as CBZ'}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await capture('server-confirmation');await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes'}).click()
  report.checks.push(`${size}: sheets dismissed by Escape; Never/Always layout verified; live allowlisted settings read; server draft discarded without saving`)
  await context.close()
 }
} catch(e){report.errors.push(e.message);process.exitCode=1} finally {await browser.close();await writeFile(`${output}/report.json`,JSON.stringify(report,null,2))}
console.log(JSON.stringify({captures:report.captures.length,checks:report.checks,errors:report.errors,blockedWrites:report.blockedWrites},null,2))
