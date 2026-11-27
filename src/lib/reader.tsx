import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ARTICLES } from '../data/articles'
import { SITE_URL, categoryBySlug } from '../data/site'
import { articleUrl, fetchPublishedArticles, type PublicArticle } from './supabase'

// ---- Articles for search and saved pages (seed data first, then Supabase). ----
export function usePublishedArticles(): PublicArticle[] {
  const [articles, setArticles] = useState<PublicArticle[]>(ARTICLES as PublicArticle[])
  useEffect(() => {
    let live = true
    fetchPublishedArticles().then((list) => { if (live) setArticles(list) }).catch(() => {})
    return () => { live = false }
  }, [])
  return articles
}

// ---- Bookmarks: saved for later, stored in this browser only (localStorage). ----
const BOOKMARKS_KEY = 'newsroom-saved-articles'
const BOOKMARKS_EVENT = 'newsroom-bookmarks-changed'

export function getSavedArticleIds(): number[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch { return [] }
}

export function useBookmarks(): { savedIds: number[]; isSaved: (id: number) => boolean; toggleSaved: (id: number) => void } {
  const [savedIds, setSavedIds] = useState<number[]>(() => getSavedArticleIds())
  useEffect(() => {
    const refresh = () => setSavedIds(getSavedArticleIds())
    window.addEventListener(BOOKMARKS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(BOOKMARKS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  const toggleSaved = (id: number) => {
    const current = getSavedArticleIds()
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    setSavedIds(next)
    window.dispatchEvent(new Event(BOOKMARKS_EVENT))
  }
  return { savedIds, isSaved: (id: number) => savedIds.includes(id), toggleSaved }
}

// Icon-only save button for the article toolbar: a bookmark icon, red when saved.
export function BookmarkButton({ article }: { article: PublicArticle }) {
  const { isSaved, toggleSaved } = useBookmarks()
  const articleId = article.id
  if (articleId == null) return null
  const saved = isSaved(articleId)
  return (
    <button type="button" onClick={() => toggleSaved(articleId)} aria-pressed={saved} aria-label={saved ? 'Saved. Tap to remove bookmark' : 'Save for later'} title={saved ? 'Saved' : 'Save for later'} className={saved ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8102E] text-white hover:bg-[#A50D26]' : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0F2A44]/20 bg-white text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white'}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
    </button>
  )
}

// ---- Search: client-side search over the loaded published articles. ----
export function searchArticles(articles: PublicArticle[], query: string): PublicArticle[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return articles.filter((a) => (a.title + ' ' + a.excerpt).toLowerCase().includes(q))
}

export function SearchBox() {
  const articles = usePublishedArticles()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const results = searchArticles(articles, query).slice(0, 8)
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim().length >= 2) {
      setOpen(false)
      navigate('/search?q=' + encodeURIComponent(query.trim()))
    }
  }
  return (
    <div ref={boxRef} className="relative w-full">
      <form role="search" onSubmit={submit} className="flex w-full">
        <label htmlFor="site-search" className="sr-only">Search articles</label>
        <input id="site-search" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Search guides, e.g. GTA 6 map or debt" autoComplete="off" className="w-full rounded-l-lg border border-[#0F2A44]/20 bg-white px-4 py-2.5 text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:placeholder:text-slate-400" />
        <button type="submit" className="shrink-0 rounded-r-lg bg-[#C8102E] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#A50D26]">Search</button>
      </form>
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-[#24405E] dark:bg-[#122840]">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#6B7280] dark:text-slate-400">No articles match &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            results.map((a) => (
              <Link key={a.slug} to={articleUrl(a)} onClick={() => { setOpen(false); setQuery('') }} className="block border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50 dark:border-[#24405E] dark:hover:bg-[#1A3550]">
                <span className="block text-sm font-bold text-[#0F2A44] dark:text-slate-100">{a.title}</span>
                <span className="mt-0.5 block text-xs text-[#6B7280] dark:text-slate-400">{a.excerpt}</span>
              </Link>
            ))
          )}
          {results.length > 0 && (
            <Link to={'/search?q=' + encodeURIComponent(query.trim())} onClick={() => setOpen(false)} className="block bg-gray-50 px-4 py-2.5 text-sm font-bold text-[#C8102E] dark:bg-[#0D2138]">See all results for &ldquo;{query.trim()}&rdquo;</Link>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Share buttons: small round icon-only buttons in one row (copy link, Facebook, X, WhatsApp). No Instagram: it offers no direct web share link. ----
export function ShareButtons({ article }: { article: PublicArticle }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? window.location.href : SITE_URL + articleUrl(article)
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(article.title)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  const buttonClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0F2A44]/20 bg-white text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white'
  return (
    <div className="flex items-center gap-1.5" aria-label="Share this article">
      <button type="button" onClick={copyLink} aria-live="polite" aria-label={copied ? 'Copied' : 'Copy link'} title={copied ? 'Copied' : 'Copy link'} className={copied ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8102E] text-white' : buttonClass}>
        {copied ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
        )}
      </button>
      <a href={'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" title="Share on Facebook" className={buttonClass}><span aria-hidden="true" className="text-base font-black leading-none">f</span></a>
      <a href={'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedTitle} target="_blank" rel="noopener noreferrer" aria-label="Share on X" title="Share on X" className={buttonClass}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></a>
      <a href={'https://wa.me/?text=' + encodeURIComponent(article.title + ' ' + url)} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" title="Share on WhatsApp" className={buttonClass}><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg></a>
    </div>
  )
}

// ---- Reading progress bar: thin red bar fixed at the very top of article pages. ----
export function ReadingProgressBar() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const update = () => {
      const el = document.documentElement
      const total = el.scrollHeight - el.clientHeight
      setProgress(total > 0 ? Math.min(100, Math.max(0, (el.scrollTop / total) * 100)) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  return (
    <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-transparent" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
      <div className="h-full bg-[#C8102E]" style={{ width: progress + '%' }} data-testid="reading-progress" />
    </div>
  )
}

// ---- Table of contents: built from the article's own structure. ----
// Articles have no subheadings, so each paragraph gets an anchor id and its
// opening words become a jump link. Lines starting with "## " render as h2
// headings with an id and appear in the TOC as proper entries.
export interface TocEntry { id: string; label: string; isHeading: boolean }

export function paragraphOpener(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const opener = words.slice(0, 7).join(' ')
  return words.length > 7 ? opener + '...' : opener
}

export function buildToc(content: string[]): TocEntry[] {
  const entries: TocEntry[] = []
  let para = 0
  content.forEach((block, i) => {
    if (block.startsWith('## ')) {
      entries.push({ id: 'section-' + i, label: block.slice(3).trim(), isHeading: true })
    } else {
      para += 1
      entries.push({ id: 'para-' + para, label: paragraphOpener(block), isHeading: false })
    }
  })
  return entries.slice(0, 12)
}

export function blockAnchorId(content: string[], index: number): string {
  const block = content[index]
  if (block.startsWith('## ')) return 'section-' + index
  return 'para-' + content.slice(0, index + 1).filter((b) => !b.startsWith('## ')).length
}

// ---- Article card used by the search and saved pages. ----
export function ReaderArticleCard({ a }: { a: PublicArticle }) {
  const cat = categoryBySlug(a.category)
  const { isSaved, toggleSaved } = useBookmarks()
  const articleId = a.id
  const saved = articleId != null && isSaved(articleId)
  return (
    <article className="border rounded-lg p-5 bg-white shadow-sm dark:bg-[#122840] dark:border-[#24405E]">
      {a.cover && (<img src={a.cover} alt={a.cover_alt || a.title} className="w-full h-40 object-cover rounded mb-4" loading="lazy" />)}
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">
        {cat ? cat.name : a.category}
        {a.is_featured && (<span className="ml-2 bg-[#C8102E] text-white px-2 py-0.5 rounded normal-case tracking-normal">Featured</span>)}
      </p>
      <h3 className="text-xl font-bold mt-2 leading-snug"><Link to={articleUrl(a)} className="hover:underline">{a.title}</Link></h3>
      <p className="text-[#6B7280] mt-2 dark:text-slate-400">{a.excerpt}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-sm text-[#6B7280] dark:text-slate-400">{a.date} | {a.author}{a.views > 0 ? ' | ' + a.views + ' views' : ''}</p>
        {articleId != null && (
          <button type="button" onClick={() => toggleSaved(articleId)} aria-pressed={saved} aria-label={(saved ? 'Remove bookmark for ' : 'Save for later: ') + a.title} className={saved ? 'shrink-0 rounded-full bg-[#C8102E] px-3 py-1 text-xs font-bold text-white hover:bg-[#A50D26]' : 'shrink-0 rounded-full border border-[#0F2A44]/20 px-3 py-1 text-xs font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white'}>
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>
    </article>
  )
}
