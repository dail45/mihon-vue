// Real-server read-only acceptance. No fixtures, API dumps or credentials written.
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const api=process.env.LIVE_SUWAYOMI_API_URL
if (!api) throw Error('Explicit live Suwayomi URL required')
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5180', output=process.env.QA_OUTPUT||'/data/sort-display-behavior-live'
await mkdir(output,{recursive:true})
const report={fixtures:false,checks:[],captures:[],errors:[],blockedWrites:[]}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']})
try {
 for (const [device,width,height] of [['mobile',390,844],['desktop',1440,1000]]) {
  const context=await browser.newContext({viewport:{width,height}})
  await context.addInitScript(api=>{localStorage.setItem('mihon.apiUrl',api);localStorage.setItem('mihon.reader.saveProgress','false')},api)
  const page=await context.newPage(); page.on('pageerror',e=>report.errors.push(`${device}: ${e.message}`))
  await page.route(`${new URL(api).origin}/**`,route=>{
   const r=route.request(),u=new URL(r.url())
   if(!['GET','HEAD'].includes(r.method())||/\/manga\/\d+\/library\/?$/.test(u.pathname)||u.searchParams.get('onlineFetch')==='true'||(/\/page\/\d+$/.test(u.pathname)&&u.searchParams.get('updateProgress')!=='false')){report.blockedWrites.push(r.method()+' '+u.pathname);return route.abort()}
   return route.continue()
  })
  const shot=async name=>{
   await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(400)
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`Overflow ${device}/${name}`)
   await page.screenshot({path:`${output}/${device}-${name}.png`,animations:'disabled'});report.captures.push(`${device}-${name}`)
  }
  const open=async(tab,chapters=false)=>{await page.getByRole('button',{name:chapters?'Chapter settings':'Filter and sort library',exact:true}).click();await page.getByRole('tab',{name:tab,exact:true}).click()}
  const done=()=>page.getByRole('button',{name:'Done',exact:true}).click()
  const ids=()=>page.locator('.manga-card, .manga-list-link').evaluateAll(es=>es.map(e=>Number(e.getAttribute('href').split('/').pop())))
  await page.goto(base+'/library');await page.locator('.manga-card').first().waitFor({timeout:30000});report.vuetifyVersion=await page.locator('.v-application').getAttribute('data-vuetify-version');if(!report.vuetifyVersion?.startsWith('4.'))throw Error('Vuetify 4 required')
  const items=await page.evaluate(async api=>{const cats=await(await fetch(api+'/category')).json();cats.sort((a,b)=>a.order-b.order);return await(await fetch(api+'/category/'+cats[0].id)).json()},api)
  if(!items.length)throw Error('Live default category empty: cannot verify ordering')
  const chapters={}
  for(const m of items)chapters[m.id]=await page.evaluate(async({api,id})=>await(await fetch(`${api}/manga/${id}/chapters?onlineFetch=false`)).json(),{api,id:m.id})
  const max=(m,key)=>chapters[m.id].reduce((n,c)=>Math.max(n,c[key]||0),0)
  const titles=new Intl.Collator(undefined,{sensitivity:'base',numeric:false})
  const options=[['Alphabetically','title'],['Total chapters','chapterCount'],['Last read','lastReadAt'],['Unread chapters','unreadCount'],['Latest chapter','uploadDate'],['Chapter fetch date','fetchedAt'],['Date added','inLibraryAt']]
  for(const [label,key]of options){
   await open('Sort');const button=page.getByRole('button',{name:label,exact:true});await button.click()
   // Choosing library modes preserves direction; force ASC with a second tap if necessary.
   if((await button.getAttribute('aria-description')).startsWith('Descending'))await button.click()
   await done()
   const value=m=>key==='uploadDate'||key==='fetchedAt'?max(m,key):key==='lastReadAt'?m.lastReadAt??max(m,key):m[key]
   for(const desc of [false,true]){
    if(desc){await open('Sort');await page.getByRole('button',{name:label,exact:true}).click();await done()}
    const expected=items.slice().sort((a,b)=>{
     if(key==='title')return titles.compare(a.title,b.title)*(desc?-1:1)
     const av=value(a),bv=value(b)
     if(av==null||bv==null)return av===bv?titles.compare(a.title,b.title):av==null?1:-1
     if(key==='unreadCount'&&(av===0||bv===0)&&av!==bv)return av===0?1:-1
     return (desc?bv-av:av-bv)||titles.compare(a.title,b.title)
    }).map(m=>m.id)
    await expect.poll(ids,{timeout:30000}).toEqual(expected);report.checks.push(`${device}: library ${key} ${desc?'DESC':'ASC'}`)
   }
  }
  await shot('library-unread-and-date-sort'); await page.reload();await expect(page.locator('.manga-card')).toHaveCount(items.length);report.checks.push(`${device}: ordering preferences survive reload`)
  await open('Filter');await page.getByRole('checkbox',{name:'Unread',exact:true}).click();await page.getByRole('checkbox',{name:'Unread',exact:true}).click();await shot('library-unread-exclude-control');await done()
  const read=items.filter(m=>m.unreadCount===0).map(m=>m.id).sort();await expect.poll(async()=> (await ids()).sort()).toEqual(read);report.checks.push(`${device}: unread exclusion uses real counts (${read.length} matches)`)
  await open('Filter');await page.getByRole('checkbox',{name:'Unread',exact:true}).click();await done()
  await open('Display');await page.getByRole('checkbox',{name:'Show continue reading button',exact:true}).click();await shot('display-with-auto-value');await page.getByRole('checkbox',{name:'Show number of items',exact:true}).scrollIntoViewIfNeeded();await shot('display-tabs-options');await done()
  await expect(page.locator('a.continue-reading')).toHaveCount(items.filter(m=>chapters[m.id].some(c=>!c.read)).length);await shot('library-continue');report.checks.push(`${device}: continue button points to first unread source index`)
  for(const a of await page.locator('a.continue-reading').all()) {const parts=(await a.getAttribute('href')).split('/');const id=Number(parts[2]);expect(Number(parts[4])).toBe(Math.min(...chapters[id].filter(c=>!c.read).map(c=>c.index)))}
  await open('Display');await page.getByRole('button',{name:'List',exact:true}).click();await done();await expect(page.locator('.manga-list-row').first()).toHaveCSS('height','56px');await expect(page.locator('.manga-list-link .v-img').first()).toHaveCSS('width','40px');await shot('library-list-geometry');report.checks.push(`${device}: list rows 56px and square 40px covers`)
  const m=items[0],list=chapters[m.id];await page.goto(base+'/manga/'+m.id);await page.locator('.manga-detail h1').waitFor({timeout:30000})
  const chapterIds=()=>page.locator('.manga-detail a.v-list-item[href*="/read/"]').evaluateAll(es=>es.map(e=>Number(e.getAttribute('href').split('/').pop())))
  for(const [label,key]of [['By chapter number','chapterNumber'],['By upload date','uploadDate'],['Alphabetically','name'],['By source','index']]){
   await open('Sort',true);await page.getByRole('button',{name:label,exact:true}).click();await done()
   for(const desc of [false,true]){
    if(desc){await open('Sort',true);await page.getByRole('button',{name:label,exact:true}).click();await done()}
    const expected=list.slice().sort((a,b)=>(key==='name'?titles.compare(a.name,b.name):a[key]-b[key])*(desc?-1:1)).map(c=>c.index)
    await expect.poll(chapterIds,{timeout:30000}).toEqual(expected);report.checks.push(`${device}: chapter ${key} ${desc?'DESC':'ASC'}`)
   }
  }
  await open('Display',true);await page.getByRole('radio',{name:'Show chapter number',exact:true}).check();await shot('chapter-display');await done();await shot('chapter-numbers');await page.reload();await page.locator('.manga-detail h1').waitFor();await expect.poll(chapterIds).toEqual(list.slice().sort((a,b)=>b.index-a.index).map(c=>c.index));report.checks.push(`${device}: chapter ordering survives reload`)
  await context.close()
 }
}catch(e){report.errors.push(e.message);process.exitCode=1}
finally{await browser.close();await writeFile(output+'/report.json',JSON.stringify(report,null,2))}
console.log(JSON.stringify(report,null,2));if(report.errors.length||report.blockedWrites.length)process.exitCode=1
