import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, Navigate, useSearchParams } from 'react-router-dom'
import { ARTICLES } from './data/articles'
import { CATEGORIES, SITE_NAME, SITE_URL, categoryBySlug } from './data/site'
import {
  fetchPublishedArticles, fetchArticleBySlug, fetchRelatedArticles, isDuePublished,
  fetchArticleById, articleUrl,
  incrementArticleViews,
  fetchHomepageCategories,
  ALL_CATEGORY_SLUGS,
  type PublicArticle,
} from './lib/supabase'
import { SearchBox, ShareButtons, ReadingProgressBar, BookmarkButton, useBookmarks, buildToc, blockAnchorId, searchArticles, ReaderArticleCard } from './lib/reader'
const Admin = lazy(() => import('./pages/Admin'))

const THEME_KEY = 'newsroom-theme'
type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  if (document.documentElement.classList.contains('dark')) return 'dark'
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title + ' | ' + SITE_NAME
    let m = document.querySelector('meta[name="description"]')
    if (m) m.setAttribute('content', description)
    const setOg = (prop: string, val: string) => {
      let t = document.querySelector('meta[property="' + prop + '"]')
      if (!t) { t = document.createElement('meta'); t.setAttribute('property', prop); document.head.appendChild(t) }
      t.setAttribute('content', val)
    }
    setOg('og:title', title)
    setOg('og:description', description)
    setOg('og:type', 'article')
  }, [title, description])
}

function useArticles(): { articles: PublicArticle[]; loading: boolean } {
  const [articles, setArticles] = useState<PublicArticle[]>(ARTICLES as PublicArticle[]); const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    fetchPublishedArticles().then((list) => { if (live) setArticles(list) }).catch(() => {}).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])
  return { articles, loading }
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return text.trim() ? words.length : 0
}

function ArticleCard({ a }: { a: PublicArticle }) {
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

function Layout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const menuRef = useRef<HTMLElement | null>(null)
  const { savedIds } = useBookmarks()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      try { if (!localStorage.getItem(THEME_KEY)) setTheme(mq.matches ? 'dark' : 'light') } catch { /* ignore */ }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(THEME_KEY, next) } catch { /* ignore */ }
    setTheme(next)
  }
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#1F2937] dark:bg-[#0A1A2C] dark:text-slate-200">
      <header className="bg-white text-[#0F2A44] dark:bg-[#0D2138] dark:text-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3">
          <Link to="/" aria-label="The Newsroom Daily" className="inline-flex flex-col items-start leading-none">
            <span className="font-serif text-[1.75rem] md:text-[2.75rem] font-black tracking-tight text-[#0F2A44] dark:text-white">The Newsroom</span>
            <span className="mt-1 flex w-full items-center justify-end gap-1.5 md:mt-1.5">
              <span className="text-base md:text-xl font-extrabold tracking-[0.35em] text-[#C8102E]">DAILY</span>
              <span aria-hidden="true" className="inline-block h-2.5 w-3 shrink-0 bg-[#C8102E] md:h-3 md:w-[15px]" />
            </span>
          </Link>
          <nav ref={menuRef} className="relative w-[calc(100%+2rem)] min-w-0 flex items-center gap-5 whitespace-nowrap text-sm font-semibold -mx-4 px-4 md:w-auto md:mx-0 md:flex-wrap md:gap-4">
            <Link to="/" className="hover:underline">Home</Link>
            {CATEGORIES.slice(0, 2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} className="hover:underline">{c.name}</Link>))}
            {CATEGORIES.slice(2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} className="hidden hover:underline md:inline">{c.name}</Link>))}
            <Link to="/about" className="hidden hover:underline md:inline">About</Link>
            <Link to="/contact" className="hidden hover:underline md:inline">Contact</Link>
            <Link to="/saved" className="hover:underline">Saved{savedIds.length > 0 ? ' (' + savedIds.length + ')' : ''}</Link>
            <button type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#0F2A44]/20 bg-white text-[#0F2A44] shadow-sm transition-colors hover:bg-gray-100 dark:border-white/20 dark:bg-[#122840] dark:text-amber-300 dark:hover:bg-[#1A3550]">
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="currentColor" /></svg>
              )}
            </button>
            <button type="button" aria-label={menuOpen ? 'Close menu' : 'More links'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-colors md:hidden ' + (menuOpen ? 'bg-[#C8102E]' : 'bg-[#0F2A44] hover:bg-[#C8102E] active:bg-[#C8102E]')}>
              {menuOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
              ) : (
                <svg width="20" height="6" viewBox="0 0 20 6" fill="none" aria-hidden="true"><circle cx="3" cy="3" r="2.5" fill="white" /><circle cx="10" cy="3" r="2.5" fill="white" /><circle cx="17" cy="3" r="2.5" fill="white" /></svg>
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl md:hidden dark:divide-[#24405E] dark:border-[#24405E] dark:bg-[#122840]">
                {CATEGORIES.slice(2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44] dark:text-slate-100">{c.name}</Link>))}
                <Link to="/about" onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44] dark:text-slate-100">About</Link>
                <Link to="/contact" onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44] dark:text-slate-100">Contact</Link>
                <Link to="/saved" onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44] dark:text-slate-100">Saved{savedIds.length > 0 ? ' (' + savedIds.length + ')' : ''}</Link>
              </div>
            )}
          </nav>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3">
          <SearchBox />
        </div>
        <div aria-hidden="true" className="h-[3px] w-full bg-[#C8102E]" />
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 md:py-8">{children}</main>
      <footer className="bg-[#0F2A44] text-gray-300 dark:bg-[#081524] dark:text-slate-300">
        <div className="max-w-5xl mx-auto px-4 py-6 text-sm flex flex-wrap gap-3 justify-between md:py-8 md:gap-6">
          <p>{SITE_NAME} | Clear, practical guides for everyday readers.</p>
          <p className="flex gap-4">
            <Link to="/about" className="hover:underline">About</Link>
            <Link to="/contact" className="hover:underline">Contact</Link>
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/saved" className="hover:underline">Saved</Link>
            <Link to="/admin" className="hover:underline">Admin</Link>
          </p>
        </div>
      </footer>
    </div>
  )
}

function Home() {
  useSeo('Home', 'Clear, practical guides on GTA 6 gaming, tech how-to, money and finance, career and work, and everyday life.')
  const { articles } = useArticles()
  const [enabledCategories, setEnabledCategories] = useState<string[]>(ALL_CATEGORY_SLUGS)
  useEffect(() => { fetchHomepageCategories().then(setEnabledCategories) }, [])
  const visible = articles.filter((a) => enabledCategories.includes(a.category))
  const featured = visible.filter((a) => a.is_featured)
  const latest = visible[0]
  return (
    <div>
      {latest && (
        <section className="bg-white border rounded-lg p-5 shadow-sm mb-8 md:p-6 md:mb-10 dark:bg-[#122840] dark:border-[#24405E]">
          <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">Latest article</p>
          <h1 className="text-3xl md:text-4xl font-black mt-2 leading-tight"><Link to={articleUrl(latest)} className="hover:underline">{latest.title}</Link></h1>
          <p className="text-[#6B7280] mt-3 text-lg dark:text-slate-400">{latest.excerpt}</p>
          <p className="text-sm text-[#6B7280] mt-3 dark:text-slate-400">{latest.date} | {latest.author}</p>
          <Link to={articleUrl(latest)} className="inline-block mt-4 bg-[#C8102E] text-white font-bold px-4 py-2 rounded">Read the guide &rarr;</Link>
        </section>
      )}
      {featured.length > 0 && (
        <section className="mb-8 md:mb-10">
          <h2 className="text-2xl font-bold mb-4">Featured</h2>
          <div className="grid md:grid-cols-2 gap-5">{featured.map((a) => (<ArticleCard key={a.slug} a={a} />))}</div>
        </section>
      )}
      <h2 className="text-2xl font-bold mb-4">Latest articles</h2>
      <div className="grid md:grid-cols-2 gap-5 mb-8 md:mb-10">{visible.map((a) => (<ArticleCard key={a.slug} a={a} />))}</div>
      {CATEGORIES.filter((c) => enabledCategories.includes(c.slug)).map((c) => {
        const list = visible.filter((a) => a.category === c.slug)
        return (
          <section key={c.slug} className="mb-8 md:mb-10">
            <h2 className="text-2xl font-bold"><Link to={'/category/' + c.slug} className="hover:underline">{c.name}</Link></h2>
            <p className="text-[#6B7280] mt-1 mb-4 dark:text-slate-400">{c.description}</p>
            {list.length ? (<div className="grid md:grid-cols-2 gap-5">{list.map((a) => (<ArticleCard key={a.slug} a={a} />))}</div>) : (<p className="text-[#6B7280] dark:text-slate-400">More guides in this category are coming soon.</p>)}
          </section>
        )
      })}
    </div>
  )
}

// Legacy /article/:slug URLs redirect to the new /:category/:id form.
function LegacyArticleRedirect() {
  const { slug } = useParams()
  const [target, setTarget] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => { let live = true; fetchArticleBySlug(slug ?? '').then((found) => { if (!live) return; const visible = found && isDuePublished(found.status, found.scheduled_at) ? found : null; const article = visible ?? (ARTICLES.find((x) => x.slug === slug) as PublicArticle | undefined) ?? null; if (article && article.id != null) setTarget(articleUrl(article)); else setMissing(true) }).catch(() => { if (live) setMissing(true) }); return () => { live = false } }, [slug])
  if (missing) return (<div><h1 className="text-3xl font-bold">Article not found</h1><p className="mt-3"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p></div>)
  if (target) return <Navigate to={target} replace />
  return (<div className="flex flex-col items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#C8102E] dark:border-slate-700" /><p className="mt-4 text-[#6B7280] dark:text-slate-400">Loading...</p></div>)
}

function ArticlePage() {
  const { category, id } = useParams()
  const numericId = Number(id)
  const [a, setA] = useState<PublicArticle | null>(null); const [loading, setLoading] = useState(true); const [related, setRelated] = useState<PublicArticle[]>([])
  useEffect(() => { let live = true; setLoading(true); setA(null); setRelated([]); fetchArticleById(numericId).then((found) => { if (!live) return; const visible = found && isDuePublished(found.status, found.scheduled_at) ? found : null; const article = visible ?? (ARTICLES.find((x) => x.id === numericId) as PublicArticle | undefined) ?? null; setA(article); if (article) fetchRelatedArticles(article.category, article.slug).then((list) => { if (live) setRelated(list) }).catch(() => {}) }).catch(() => { if (live) setA((ARTICLES.find((x) => x.id === numericId) as PublicArticle | undefined) ?? null) }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [category, numericId])
  useSeo(loading && !a ? 'Loading...' : a ? a.title : 'Article not found', a ? a.description : 'This article could not be found.')
  useEffect(() => {
    if (!a) return
    const key = 'viewed-' + a.slug
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      void incrementArticleViews(a.slug)
    }
  }, [a?.slug])
  useEffect(() => {
    if (!a) return
    if (window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1))
      if (el) window.setTimeout(() => el.scrollIntoView(), 100)
    } else {
      window.scrollTo(0, 0)
    }
  }, [a])
  if (loading && !a) return (<div className="flex flex-col items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#C8102E] dark:border-slate-700" /><p className="mt-4 text-[#6B7280] dark:text-slate-400">Loading...</p></div>); if (!a) return (<div><h1 className="text-3xl font-bold">Article not found</h1><p className="mt-3"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p></div>)
  if (a && a.category !== category) return <Navigate to={articleUrl(a)} replace />
  const cat = categoryBySlug(a.category)
  // Related articles are fetched in the effect above with fetchRelatedArticles.
  const words = countWords(a.content.join(' '))
  const readMinutes = Math.max(1, Math.ceil(words / 200))
  const toc = buildToc(a.content)
  return (
    <article>
      <ReadingProgressBar />
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]"><Link to={'/category/' + a.category} className="hover:underline">{cat ? cat.name : a.category}</Link></p>
      <h1 className="text-3xl md:text-4xl font-black mt-2 leading-tight">{a.title}</h1>
      <p className="text-sm text-[#6B7280] mt-3 dark:text-slate-400">{a.date} | By {a.author} | {readMinutes} min read{a.views > 0 ? ' | ' + a.views + ' views' : ''}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ShareButtons article={a} />
        <BookmarkButton article={a} />
      </div>
      {a.cover && (<img src={a.cover} alt={a.cover_alt || a.title} className="w-full rounded-lg mt-6" />)}
      {toc.length > 1 && (
        <nav aria-label="In this article" className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-[#24405E] dark:bg-[#122840]">
          <h2 className="font-serif text-xl font-bold text-[#0F2A44] dark:text-white">In this article</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-snug">
            {toc.map((entry) => (
              <li key={entry.id} className={entry.isHeading ? 'font-bold' : ''}>
                <a href={'#' + entry.id} className="text-[#0F2A44] hover:text-[#C8102E] hover:underline dark:text-slate-200 dark:hover:text-white">{entry.label}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="mt-6 space-y-4 text-lg leading-relaxed bg-white border rounded-lg p-6 shadow-sm dark:bg-[#122840] dark:border-[#24405E]">
        {a.content.map((block, i) => block.startsWith('## ') ? (<h2 key={i} id={blockAnchorId(a.content, i)} className="text-2xl font-bold pt-2 scroll-mt-24 dark:text-[#F1F5F9]">{block.slice(3)}</h2>) : (<p key={i} id={blockAnchorId(a.content, i)} className="scroll-mt-24">{block}</p>))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ShareButtons article={a} />
        <BookmarkButton article={a} />
      </div>
      <p className="text-sm text-[#6B7280] mt-4 dark:text-slate-400">Sources: official game and product pages, and general guidance from public help pages. Money and health articles are general education, not personal advice.</p>
      {related.length > 0 && (<section className="mt-10"><h2 className="text-2xl font-bold mb-4">Related articles</h2><div className="grid md:grid-cols-2 gap-5">{related.map((r) => (<ArticleCard key={r.slug} a={r} />))}</div></section>)}
      <p className="mt-8"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p>
    </article>
  )
}

function CategoryPage() {
  const { slug } = useParams()
  const cat = slug ? categoryBySlug(slug) : undefined
  useSeo(cat ? cat.name : 'Category not found', cat ? cat.description : 'This category could not be found.')
  if (!cat) return (<div><h1 className="text-3xl font-bold">Category not found</h1><p className="mt-3"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p></div>)
  const { articles } = useArticles()
  const list = articles.filter((a) => a.category === cat.slug)
  return (
    <div>
      <h1 className="text-3xl font-bold">{cat.name}</h1>
      <p className="text-[#6B7280] mt-2 mb-6 dark:text-slate-400">{cat.description}</p>
      {list.length ? (<div className="grid md:grid-cols-2 gap-5">{list.map((a) => (<ArticleCard key={a.slug} a={a} />))}</div>) : (<p className="text-[#6B7280] dark:text-slate-400">More guides in this category are coming soon. Check back for new articles.</p>)}
    </div>
  )
}

function SearchPage() {
  const [params] = useSearchParams()
  const q = (params.get('q') || '').trim()
  const { articles } = useArticles()
  const results = searchArticles(articles, q)
  useSeo(q ? 'Search: ' + q : 'Search', q ? 'Search results for ' + q + ' on The Newsroom Daily.' : 'Search The Newsroom Daily guides.')
  return (
    <div>
      <h1 className="text-3xl font-black">{q ? 'Search results for "' + q + '"' : 'Search'}</h1>
      <p className="text-[#6B7280] mt-2 mb-6 dark:text-slate-400">Search published articles by title and excerpt.</p>
      {q.length < 2 ? (
        <p className="text-[#6B7280] dark:text-slate-400">Type at least two characters in the search box above to find a guide.</p>
      ) : results.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-5">{results.map((a) => (<ReaderArticleCard key={a.slug} a={a} />))}</div>
      ) : (
        <p className="text-[#6B7280] dark:text-slate-400">No articles found for &ldquo;{q}&rdquo;. Try another keyword.</p>
      )}
    </div>
  )
}

function SavedPage() {
  useSeo('Saved articles', 'Articles you saved for later on The Newsroom Daily.')
  const { articles } = useArticles()
  const { savedIds } = useBookmarks()
  const saved = articles.filter((a) => a.id != null && savedIds.includes(a.id))
  return (
    <div>
      <h1 className="text-3xl font-black">Saved articles</h1>
      <p className="text-[#6B7280] mt-2 mb-6 dark:text-slate-400">Articles you saved for later. Saved articles are stored in this browser only.</p>
      {saved.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-5">{saved.map((a) => (<ReaderArticleCard key={a.slug} a={a} />))}</div>
      ) : (
        <p className="text-[#6B7280] dark:text-slate-400">You have no saved articles yet. Tap &ldquo;Save for later&rdquo; on any article to keep it here. <Link to="/" className="text-[#C8102E] underline">Browse the latest guides</Link></p>
      )}
    </div>
  )
}

function About() {
  useSeo('About', 'About The Newsroom Daily: clear, practical guides on gaming, tech, money, career and everyday life, written in plain words.')
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4 text-lg leading-relaxed dark:bg-[#122840] dark:border-[#24405E]">
      <h1 className="text-3xl font-black">About {SITE_NAME}</h1>
      <p>{SITE_NAME} is a new English news and guide site. Our goal is simple: explain useful things in plain words, so any reader can act on them.</p>
      <p>We cover five areas: GTA 6 gaming, tech how-to, money and finance, career and work, and everyday guides. Most of our work is evergreen, which means a good guide should still help a reader months or years after it is published.</p>
      <p>We write in our own words, keep paragraphs short, and check facts before we publish. Money and health articles are general education, not personal advice. You can find us at {SITE_URL}.</p>
      <p>The site name is provisional while the project grows, so the name is kept in one place in the code and is easy to change later.</p>
    </div>
  )
}

function Contact() {
  useSeo('Contact', 'Contact The Newsroom Daily: send a question, a correction, or a story idea.')
  const [params] = useSearchParams()
  const sent = params.get('sent') === '1'
  return (
    <div>
      <h1 className="text-3xl font-black">Contact</h1>
      <p className="text-[#6B7280] mt-2 dark:text-slate-400">Send a question, a correction, or a story idea. We read every message and reply by email when an answer is needed.</p>
      {sent ? (
        <p className="bg-green-100 border border-green-300 rounded p-4 mt-4 dark:bg-green-950 dark:border-green-800 dark:text-green-100">Thank you. Your message was sent. We will reply by email when an answer is needed.</p>
      ) : (
        <form className="space-y-4 mt-4" action="https://formsubmit.co/rtvsakib@gmail.com" method="POST">
          <input type="hidden" name="_subject" value="New contact message - The Newsroom Daily" />
          <input type="hidden" name="_captcha" value="false" />
          <input type="hidden" name="_template" value="table" />
          <input type="hidden" name="_next" value={SITE_URL + '/contact?sent=1'} />
          <div>
            <label className="block font-bold mb-1">Name</label>
            <input name="name" required className="w-full border rounded p-3 dark:bg-[#122840] dark:border-[#24405E] dark:text-slate-100" />
          </div>
          <div>
            <label className="block font-bold mb-1">Email</label>
            <input name="email" type="email" required className="w-full border rounded p-3 dark:bg-[#122840] dark:border-[#24405E] dark:text-slate-100" />
          </div>
          <div>
            <label className="block font-bold mb-1">Message</label>
            <textarea name="message" required rows={5} className="w-full border rounded p-3 dark:bg-[#122840] dark:border-[#24405E] dark:text-slate-100" />
          </div>
          <button className="bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26]">Send message</button>
        </form>
      )}
    </div>
  )
}

function Privacy() {
  useSeo('Privacy Policy', 'Privacy Policy for The Newsroom Daily: what we collect, how we use it, and how to contact us.')
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4 text-lg leading-relaxed dark:bg-[#122840] dark:border-[#24405E]">
      <h1 className="text-3xl font-black">Privacy Policy</h1>
      <p>Last updated: November 25, 2026.</p>
      <p>{SITE_NAME} does not sell personal information. This site does not use advertising trackers at launch, and it does not run Google AdSense.</p>
      <p>If you use the contact form, we receive the name, email address, and message you type. We use that only to read and reply to your message. We do not share it with other parties.</p>
      <p>This site may use basic, privacy friendly visit counts from its host to understand which pages are read. Those counts do not identify individual readers.</p>
      <p>If you have a privacy question, use the Contact page. This policy will be updated here if the site adds analytics, comments, or advertising in future.</p>
    </div>
  )
}


export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/:category/:id" element={<ArticlePage />} />
          <Route path="/article/:slug" element={<LegacyArticleRedirect />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/admin" element={<Suspense fallback={<div className="text-center py-16"><p className="text-[#6B7280] dark:text-slate-400">Loading admin...</p></div>}><Admin /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
