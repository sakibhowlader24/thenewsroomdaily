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

export function BookmarkButton({ article }: { article: PublicArticle }) {
  const { isSaved, toggleSaved } = useBookmarks()
  const articleId = article.id
  if (articleId == null) return null
  const saved = isSaved(articleId)
  return (
    <button type="button" onClick={() => toggleSaved(articleId)} aria-pressed={saved} className={saved ? 'rounded-full bg-[#C8102E] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#A50D26]' : 'rounded-full border border-[#0F2A44]/20 bg-white px-3 py-1.5 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white'}>
      {saved ? 'Saved' : 'Save for later'}
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

// ---- Share buttons: copy link plus Facebook, X and WhatsApp for the live URL. ----
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
  const buttonClass = 'rounded-full border border-[#0F2A44]/20 bg-white px-3 py-1.5 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white'
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this article">
      <span className="text-sm font-bold text-[#0F2A44] dark:text-slate-100">Share:</span>
      <button type="button" onClick={copyLink} aria-live="polite" className={copied ? 'rounded-full bg-[#C8102E] px-3 py-1.5 text-sm font-bold text-white' : buttonClass}>{copied ? 'Copied' : 'Copy link'}</button>
      <a href={'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl} target="_blank" rel="noopener noreferrer" className={buttonClass}>Facebook</a>
      <a href={'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedTitle} target="_blank" rel="noopener noreferrer" className={buttonClass}>X</a>
      <a href={'https://wa.me/?text=' + encodeURIComponent(article.title + ' ' + url)} target="_blank" rel="noopener noreferrer" className={buttonClass}>WhatsApp</a>
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
