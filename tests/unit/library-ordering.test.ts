import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { manga, chapter } from '../fixtures'
import { defaultFilters, defaultSort, matchesLibrary, nextTriState, sortLibrary, summarizeChapters } from '../../src/utils/library'
import { defaultChapterSettings, sortChapters, chapterTitle } from '../../src/utils/chapters'
import { usePreferencesStore } from '../../src/stores/preferences'
import { useChapterSettings } from '../../src/stores/chapterSettings'
const titles = [manga(1, 'Beta', 2), manga(2, 'Alpha', 2), manga(3, 'Read', 0), manga(4, 'Gamma', 7), { ...manga(5, 'Unknown'), unreadCount: null }]
const ids = (items: { id: number }[]) => items.map(i => i.id)
beforeEach(() => {
  const data = new Map<string,string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => { data.set(k,v) } })
  setActivePinia(createPinia())
})
describe('Mihon library sorting semantics', () => {
  it('keeps fully-read and unknown counts at the end in either direction', () => {
    expect(ids(sortLibrary(titles,{ ...defaultSort(),type:'unread' }))).toEqual([2,1,4,3,5])
    expect(ids(sortLibrary(titles,{ ...defaultSort(),type:'unread',descending:true }))).toEqual([4,2,1,3,5])
  })
  it('does not reverse the alphabetical tie-breaker for numeric descending sorts', () => {
    const items=titles.slice(0,2).map(m=>({...m,chapterCount:8}))
    expect(ids(sortLibrary(items,{ ...defaultSort(),type:'total',descending:true }))).toEqual([2,1])
  })
  it('compares titles without case/accent distinctions and does not mutate API arrays', () => {
    const before=ids(titles); const items=[manga(1,'zeta'),manga(2,'Álpha'),manga(3,'beta')]
    expect(ids(sortLibrary(items,defaultSort()))).toEqual([2,3,1]); expect(ids(titles)).toEqual(before)
  })
  it.each(['total','added','lastRead'] as const)('sorts %s numerically and unknowns last', type => {
    const key=type==='total'?'chapterCount':type==='added'?'inLibraryAt':'lastReadAt'
    const items=[{...manga(1,'Beta'),[key]:20},{...manga(2,'Alpha'),[key]:20},{...manga(3,'Gamma'),[key]:1},{...manga(4,'Unknown'),[key]:null}]
    expect(ids(sortLibrary(items,{...defaultSort(),type}))).toEqual([3,2,1,4])
    expect(ids(sortLibrary(items,{...defaultSort(),type,descending:true}))).toEqual([2,1,3,4])
  })
  it('uses real upload/fetch timestamps, not manga metadata-fetch time', () => {
    const items=[{...manga(1),lastFetchedAt:999999},manga(2)]
    const summary={1:summarizeChapters([{...chapter,uploadDate:1000,fetchedAt:80}]),2:summarizeChapters([{...chapter,uploadDate:2000,fetchedAt:40}])}
    expect(ids(sortLibrary(items,{...defaultSort(),type:'latestChapter'},summary))).toEqual([1,2])
    expect(ids(sortLibrary(items,{...defaultSort(),type:'chapterFetched'},summary))).toEqual([2,1])
  })
  it('holds a random order stable until the seed changes', () => {
    expect(ids(sortLibrary(titles,{type:'random',seed:123,descending:false}))).toEqual(ids(sortLibrary(titles.slice().reverse(),{type:'random',seed:123,descending:false})))
    expect(ids(sortLibrary(titles,{type:'random',seed:456,descending:false}))).not.toEqual(ids(sortLibrary(titles,{type:'random',seed:123,descending:false})))
  })
  it('cycles disabled → include → exclude → disabled', () => {
    expect(nextTriState('all')).toBe('include'); expect(nextTriState('include')).toBe('exclude'); expect(nextTriState('exclude')).toBe('all')
  })
  it('does not conflate publishing-finished with completed', () => {
    const f={...defaultFilters(),completed:'include' as const}
    expect(matchesLibrary({...manga(1),status:'COMPLETED'},f,false)).toBe(true)
    expect(matchesLibrary({...manga(1),status:'PUBLISHING_FINISHED'},f,false)).toBe(false)
  })
  it('applies global downloaded-only as a lock and treats local titles as downloaded', () => {
    const m={...manga(1),downloadCount:0}, f={...defaultFilters(),downloaded:'exclude' as const}
    expect(matchesLibrary(m,f,true)).toBe(false)
    expect(matchesLibrary({...m,source:{...m.source!,lang:'localsourcelang'}},f,true)).toBe(true)
  })
  it('never treats missing bookmarks/counts as false', () => {
    expect(matchesLibrary(manga(1),{...defaultFilters(),bookmarked:'exclude'},false)).toBe(false)
    expect(matchesLibrary(manga(1),{...defaultFilters(),bookmarked:'exclude'},false,summarizeChapters([]))).toBe(true)
    expect(matchesLibrary({...manga(1),unreadCount:null},{...defaultFilters(),unread:'exclude'},false)).toBe(false)
  })
})
describe('persisted UI preferences', () => {
  it('persists filters, sorts, independent badges, both column settings and category options', async () => {
    const p=usePreferencesStore(); p.filters.unread='exclude';p.portraitColumns=3;p.landscapeColumns=7;p.downloadBadge=true;p.unreadBadge=false;p.categoryCounts=true
    p.chooseLibrarySort('/api/v1',4,'unread');await nextTick(); setActivePinia(createPinia());const restored=usePreferencesStore()
    expect(restored.filters.unread).toBe('exclude');expect(restored.portraitColumns).toBe(3);expect(restored.landscapeColumns).toBe(7);expect(restored.downloadBadge).toBe(true);expect(restored.unreadBadge).toBe(false);expect(restored.categoryCounts).toBe(true);expect(restored.globalSort.type).toBe('unread')
  })
  it('shares sort globally by default and toggles direction only on selecting the same row', () => {
    const p=usePreferencesStore();p.chooseLibrarySort('/api',4,'unread');expect(p.getLibrarySort('/api',19).type).toBe('unread')
    p.chooseLibrarySort('/api',4,'unread');expect(p.globalSort.descending).toBe(true)
    p.chooseLibrarySort('/api',4,'total');expect(p.globalSort.descending).toBe(true)
  })
  it('isolates optional category sorts by BOTH server and category', async () => {
    const p=usePreferencesStore();p.categorizedSort=true;p.chooseLibrarySort('/a',4,'unread');p.chooseLibrarySort('/a',19,'added');await nextTick()
    expect(p.getLibrarySort('/a',4).type).toBe('unread');expect(p.getLibrarySort('/a',19).type).toBe('added');expect(p.getLibrarySort('/b',4).type).toBe('title')
    setActivePinia(createPinia());expect(usePreferencesStore().getLibrarySort('/a',4).type).toBe('unread')
  })
  it('uses pinned native badge/count defaults for a clean install', () => {
    const p=usePreferencesStore();expect(p.downloadBadge).toBe(false);expect(p.unreadBadge).toBe(true);expect(p.localBadge).toBe(true);expect(p.languageBadge).toBe(false);expect(p.categoryCounts).toBe(false)
  })
  it('rejects malformed saved settings and invalid column values', () => {
    localStorage.setItem('mihon.library.filters','bad-json');localStorage.setItem('mihon.library.sort','{"type":"invented"}');localStorage.setItem('mihon.library.columns.portrait','100')
    const p=usePreferencesStore();expect(p.filters).toEqual(defaultFilters());expect(p.globalSort.type).toBe('title');expect(p.portraitColumns).toBe(0)
  })
})
describe('chapter sorting and display', () => {
  const chapters=[{...chapter,id:1,index:3,chapterNumber:10,uploadDate:1000,name:'Alpha'},{...chapter,id:2,index:1,chapterNumber:2,uploadDate:3000,name:'Gamma'},{...chapter,id:3,index:2,chapterNumber:4,uploadDate:2000,name:'Beta'}]
  it.each([['source',[2,3,1]],['number',[2,3,1]],['uploaded',[1,3,2]],['title',[1,3,2]]] as const)('sorts by %s independently of the URL index', (sort,expected) => {
    expect(ids(sortChapters(chapters,{...defaultChapterSettings(),sort,descending:false}))).toEqual(expected)
    expect(ids(sortChapters(chapters,{...defaultChapterSettings(),sort,descending:true}))).toEqual([...expected].reverse())
  })
  it('new chapter sort mode starts ascending; tapping it again reverses', () => {
    const store=useChapterSettings(),s=store.forManga('/api',1);store.choose(s,'number');expect(s.descending).toBe(false);store.choose(s,'number');expect(s.descending).toBe(true)
  })
  it('persists per-manga/server settings and browser defaults without storing chapter data', async () => {
    const store=useChapterSettings(),s=store.forManga('/a',1);s.display='number';s.unread='exclude';store.setDefault(s);await nextTick();setActivePinia(createPinia());const restored=useChapterSettings()
    expect(restored.forManga('/a',1).display).toBe('number');expect(restored.forManga('/b',1).unread).toBe('exclude')
    expect(localStorage.getItem('mihon.chapters.settings') ?? '').not.toContain('Chapter 1')
  })
  it('supports negative tri-state filters and number-only presentation', () => {
    expect(sortChapters([{...chapter,read:true},{...chapter,id:2,read:false}],{...defaultChapterSettings(),unread:'exclude'})).toHaveLength(1)
    expect(chapterTitle(chapters[0]!,'number')).toBe('Chapter 10');expect(chapterTitle({...chapter,chapterNumber:-1},'number')).toBe('Chapter number unknown')
  })
})
