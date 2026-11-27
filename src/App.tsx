import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, Navigate, useSearchParams, useLocation } from 'react-router-dom'
import { ARTICLES } from './data/articles'
import { CATEGORIES, SITE_NAME, categoryBySlug } from './data/site'
import {
  fetchPublishedArticles, fetchArticleBySlug, fetchRelatedArticles, isDuePublished,
  fetchArticleById, articleUrl,
  incrementArticleViews,
  fetchHomepageCategories,
  formatUsDate,
  ALL_CATEGORY_SLUGS,
  type PublicArticle,
} from './lib/supabase'
import { SearchBox, ShareButtons, ReadingProgressBar, BookmarkButton, useBookmarks, buildToc, blockAnchorId, searchArticles } from './lib/reader'
import { FontSizeControl, ListenControl, PrintButton, ArticleFeedback, ReportCorrectionForm, NewsletterForm, MostReadList, getSavedFontSize, ARTICLE_FONT_SIZE_PX, FONT_SIZE_KEY, type ArticleFontSize } from './lib/reader-features'
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
  const [articles, setArticles] = useState<PublicArticle[]>(ARTICLES as PublicArticle[])
  const [loading, setLoading] = useState(true)
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

const relativeDay = (s: string): string => { const d = new Date(s); if (Number.isNaN(d.getTime())) return s; const n = new Date(); const days = Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days + ' days ago'; }; function ArticleCard({ a }: { a: PublicArticle }) {
  const cat = categoryBySlug(a.category)
  const { isSaved, toggleSaved } = useBookmarks()
  const articleId = a.id
  const saved = articleId != null && isSaved(articleId)
  return (
    <article className="pb-6 border-b border-gray-200 dark:border-[#24405E]">
      {a.cover && (
        <Link to={articleUrl(a)} aria-label={a.title}>
          <img src={a.cover} alt={a.cover_alt || a.title} loading="lazy" className="w-full aspect-video object-cover" />
        </Link>
  )}
      <div className="pt-4">
        <p className="text-xs font-bold tracking-wide text-[#C8102E]">{cat?.name.toUpperCase()}</p>
        <h3 className="text-[22px] font-bold mt-2 leading-snug">
          <Link to={articleUrl(a)} className="hover:text-[#C8102E] hover:underline">{a.title}</Link>
        </h3>
        <p className="text-[#6B7280] mt-2 line-clamp-1">{a.excerpt}</p>
        <span className="flex items-end justify-between gap-3">
          <p className="text-sm text-[#6B7280] mt-3">{relativeDay(a.date)} | The Newsroom Daily{a.views > 0 ? ` \u00B7 ${a.views} views` : ''}</p>
          <button onClick={() => { if (articleId != null) toggleSaved(articleId) }} disabled={articleId == null} className="shrink-0 border rounded-full px-3 py-1 text-xs font-bold hover:border-[#C8102E] hover:text-[#C8102E]">{saved ? 'Saved' : 'Save'}</button>
        </span>
      </div>
    </article>
  )
}

function RelatedArticles({ a }: { a: PublicArticle }) {
  const [related, setRelated] = useState<PublicArticle[]>([])
  useEffect(() => {
    let live = true
    fetchRelatedArticles(a.category, a.slug).then((list) => { if (live) setRelated(list) }).catch(() => {})
    return () => { live = false }
  }, [a.category, a.slug])
  if (related.length === 0) return null
  return (
    <section className="mt-8 print-hidden">
      <h2 className="text-2xl font-bold">Related articles</h2>
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {related.map((r) => (<ArticleCard key={r.slug} a={r} />))}
      </div>
    </section>
  )
}

function Layout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  }, [theme])
  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname, location.search])
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-[#0F2A44] text-white dark:bg-[#081524] dark:text-slate-100 print:hidden">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between gap-2">
            <button className="md:hidden w-9 h-9 shrink-0 flex items-center justify-center -ml-1" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false) }}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <Link to="/" className="text-center py-3 md:py-4 hover:opacity-90 min-w-0" aria-label="The Newsroom Daily home">
              <span className="block font-serif font-black text-4xl md:text-5xl leading-none tracking-tight text-white">The Newsroom</span>
              <span className="mt-1 flex items-center justify-center gap-2 text-[#C8102E] font-black tracking-[0.35em] md:tracking-[0.45em] text-xs md:text-sm">DAILY <span className="inline-block w-3 h-3 bg-[#C8102E]" aria-hidden="true" /></span>
            </Link>
            <span className="flex items-center gap-1.5 shrink-0">
              <button type="button" className="w-9 h-9 flex items-center justify-center rounded-full border border-white/50 text-white hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:hover:border-[#C8102E]" aria-label={searchOpen ? 'Close search' : 'Open search'} aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false) }}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              </button>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="w-9 h-9 md:w-auto md:h-auto md:p-2 flex items-center justify-center rounded-full border border-gray-300 hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:hover:border-[#C8102E]">{theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}</button>
            </span>
          </div>
          <nav className="hidden md:flex flex-wrap items-center justify-center gap-6 md:gap-8 pb-3 md:pb-4 text-xs font-bold uppercase tracking-[0.25em] text-white">
            {/* */}
            {CATEGORIES.map((c) => (<Link key={c.slug} to={'/category/' + c.slug} className="menu-link">{c.name}</Link>))}
            {/* */}
            {/* */}
            {/* */}
          </nav>
          {searchOpen && (<form className="hidden md:flex gap-0 pb-4" role="search" action="/search" method="get">
            <SearchBox />
            <button className="bg-[#C8102E] text-white font-bold px-4 rounded-r">Search</button>
          </form>)}
          {searchOpen && (
            <div className="md:hidden pb-4">
              <SearchBox />
            </div>
          )}
          {menuOpen && (
            <nav className="md:hidden pb-4 flex flex-col gap-1 text-sm font-bold" aria-label="Mobile menu">
              <Link to="/" className="menu-link" onClick={() => setMenuOpen(false)}>Home</Link>
              {CATEGORIES.map((c) => (<Link key={c.slug} to={'/category/' + c.slug} className="menu-link" onClick={() => setMenuOpen(false)}>{c.name}</Link>))}
              <Link to="/saved" className="menu-link" onClick={() => setMenuOpen(false)}>Saved</Link>
              <Link to="/about" className="menu-link" onClick={() => setMenuOpen(false)}>About</Link>
              <Link to="/contact" className="menu-link" onClick={() => setMenuOpen(false)}>Contact</Link>
              <Link to="/privacy" className="menu-link" onClick={() => setMenuOpen(false)}>Privacy</Link>
            </nav>
          )}
        </div>
      </header>
      <div className="border-t-2 border-[#C8102E]" />
      <main className="max-w-5xl mx-auto px-4 py-6 md:py-8">{children}</main>
      <footer className="bg-[#0F2A44] text-gray-300 dark:bg-[#081524] dark:text-slate-300 print:hidden"><div className="max-w-5xl mx-auto px-4 py-6 md:py-8"><div className="grid gap-6 md:grid-cols-3"><div><p className="font-serif text-lg font-bold text-white">Categories</p><ul className="mt-2 space-y-1 text-sm">{CATEGORIES.map((c) => (<li key={c.slug}><Link to={'/category/' + c.slug} className="hover:text-white">{c.name}</Link></li>))}</ul></div><div><p className="font-serif text-lg font-bold text-white">About</p><ul className="mt-2 space-y-1 text-sm"><li><Link to="/about" className="hover:text-white">About</Link></li><li><Link to="/contact" className="hover:text-white">Contact</Link></li><li><Link to="/privacy" className="hover:text-white">Privacy</Link></li></ul></div><div><p className="font-serif text-lg font-bold text-white">Follow</p><p className="mt-3 flex gap-3"><span title="Coming soon" aria-label="X (coming soon)" className="w-9 h-9 flex items-center justify-center rounded-full border border-white/40 text-white"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></span><span title="Coming soon" aria-label="Facebook (coming soon)" className="w-9 h-9 flex items-center justify-center rounded-full border border-white/40 text-white"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg></span><span title="Coming soon" aria-label="YouTube (coming soon)" className="w-9 h-9 flex items-center justify-center rounded-full border border-white/40 text-white"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg></span></p></div></div><p className="mt-6 pt-4 border-t border-white/15 text-xs text-slate-400">© {new Date().getFullYear()} {SITE_NAME} | Clear, practical guides for everyday readers.</p></div></footer>
    </div>
  )
}

function Home() {
  const { articles, loading } = useArticles()
  const [homeCategories, setHomeCategories] = useState<string[]>(ALL_CATEGORY_SLUGS)
  useEffect(() => {
    let live = true
    fetchHomepageCategories().then((list) => { if (live) setHomeCategories(list) }).catch(() => {})
    return () => { live = false }
  }, [])
  useSeo('Home', 'The Newsroom Daily brings clear, practical guides on gaming, tech how-to, money and finance, career and work, and everyday life.')
  const featured = articles.find((a) => a.is_featured)
  const latest = featured ?? articles[0]
  const visible = articles.filter((a) => isDuePublished(a.status, a.scheduled_at)); const featureExclusions = visible.filter((a) => a.slug !== latest?.slug).slice(0, 2); const feature = visible.find((a) => a.slug !== latest?.slug && a.cover && !featureExclusions.some((n) => n.slug === a.slug))
  const shownCategories = CATEGORIES.filter((c) => homeCategories.includes(c.slug))
  return (
    <div>
      {loading && <p className="text-[#6B7280]">Loading articles...</p>}
      {latest && (
        <section className="mb-12 md:mb-16 pb-8 md:pb-10 border-b border-gray-200 dark:border-[#24405E]">
          <div className="grid gap-8 md:grid-cols-5 md:gap-6"><div className="md:col-span-3">{latest.cover && (<img src={latest.cover} alt={latest.cover_alt || latest.title} className="hero-cover w-full aspect-video md:aspect-auto md:h-[440px] object-cover" />)}
          <div className="pt-5">
            <p className="text-xs font-bold tracking-widest text-[#C8102E]">LATEST ARTICLE</p>
            <h1 className="text-4xl md:text-[40px] font-black mt-2 leading-tight"><Link to={articleUrl(latest)} className="hover:text-[#C8102E] hover:underline">{latest.title}</Link></h1>
            <p className="text-[#6B7280] mt-3 line-clamp-2">{latest.excerpt}</p>
            <p className="text-sm text-[#6B7280] mt-3">{latest.date} | The Newsroom Daily</p>
            <Link to={articleUrl(latest)} className="inline-block mt-4 bg-[#C8102E] text-white font-bold px-4 py-2 rounded hover:bg-[#A50D26]">Read the guide &rarr;</Link></div></div><div className="md:col-span-2 flex flex-col md:border-l md:border-gray-200 md:dark:border-[#24405E] md:pl-6"><MostReadList articles={visible} compact /></div></div></section>
      )}
      
      <div className="mb-4"><h2 className="text-lg font-bold uppercase tracking-wide text-[#0F2A44] dark:text-slate-100">Latest articles</h2><div className="mt-2 h-[3px] w-10 bg-[#C8102E]" /></div>
      <div className="grid gap-6 md:grid-cols-3 mb-12 md:mb-16">
        {visible.slice(0, 6).map((a) => (<ArticleCard key={a.slug} a={a} />))}
      </div>{feature && (<section className="mb-12 md:mb-16 pb-8 md:pb-10 border-b border-gray-200 dark:border-[#24405E]"><div className="grid gap-6 md:grid-cols-3 md:gap-8 items-center"><div className="order-2 md:order-1 md:col-span-1"><p className="text-xs font-bold tracking-widest text-[#C8102E]">FEATURED GUIDE</p><h2 className="feature-headline font-serif text-3xl md:text-4xl font-black leading-tight mt-2"><Link to={articleUrl(feature)} className="hover:underline">{feature.title}</Link></h2><p className="text-[#6B7280] mt-3 line-clamp-3">{feature.excerpt}</p><p className="mt-4"><span className="rounded-full border border-[#C8102E] text-[#C8102E] text-xs font-bold px-3 py-1">{(categoryBySlug(feature.category)?.name ?? feature.category).toUpperCase()}</span></p><Link to={articleUrl(feature)} className="inline-block mt-4 text-sm font-bold uppercase tracking-wide text-[#C8102E] hover:underline">Read more &rarr;</Link></div><div className="order-1 md:order-2 md:col-span-2">{feature.cover && (<Link to={articleUrl(feature)}><img src={feature.cover} alt={feature.cover_alt || feature.title} className="w-full aspect-video object-cover" /></Link>)}</div></div></section>)}<section className="mb-12 md:mb-16 bg-[#0F2A44] dark:bg-[#081524] text-white px-6 py-8 md:px-10 md:py-10"><h2 className="newsletter-title font-serif text-2xl md:text-3xl font-black">Get one useful guide a week</h2><p className="mt-2 text-slate-300">One clear, practical guide in your inbox every week. No spam.</p><NewsletterForm tone="light" /></section>{shownCategories.map((c) => {
        const list = visible.filter((a) => a.category === c.slug)
        if (list.length === 0) {
          return (
            <section key={c.slug} className="mb-12 md:mb-16">
              <div className="flex items-end justify-between gap-4 mb-4"><div><h2 className="text-lg font-bold uppercase tracking-wide text-[#0F2A44] dark:text-slate-100"><Link to={'/category/' + c.slug} className="hover:text-[#C8102E] hover:underline">{c.name}</Link></h2><div className="mt-2 h-[3px] w-10 bg-[#C8102E]" /></div><Link to={'/category/' + c.slug} className="shrink-0 text-sm font-bold text-[#C8102E] hover:underline">View all &rarr;</Link></div>
              <p className="text-[#6B7280] mt-2">{c.description}</p>
              <p className="text-[#6B7280] mt-2">More guides in this category are coming soon.</p>
            </section>
          )
        }
        return (
          <section key={c.slug} className="mb-12 md:mb-16">
            <div className="flex items-end justify-between gap-4 mb-4"><div><h2 className="text-lg font-bold uppercase tracking-wide text-[#0F2A44] dark:text-slate-100"><Link to={'/category/' + c.slug} className="hover:text-[#C8102E] hover:underline">{c.name}</Link></h2><div className="mt-2 h-[3px] w-10 bg-[#C8102E]" /></div><Link to={'/category/' + c.slug} className="shrink-0 text-sm font-bold text-[#C8102E] hover:underline">View all &rarr;</Link></div>
            <p className="text-[#6B7280] mt-2">{c.description}</p>
            <div className="grid gap-6 md:grid-cols-2 mt-6">
              {list.slice(0, 4).map((a) => (<ArticleCard key={a.slug} a={a} />))}
            </div>
          </section>
        )
      })}<section className="mb-12 md:mb-16"><div className="mb-4"><h2 className="text-lg font-bold uppercase tracking-wide text-[#0F2A44] dark:text-slate-100">More guides</h2><div className="mt-2 h-[3px] w-10 bg-[#C8102E]" /></div><div className="border-t border-gray-200 dark:border-[#24405E]">{visible.slice(6).map((a) => (<article key={a.slug} className="flex flex-col gap-1 border-b border-gray-200 dark:border-[#24405E] py-4"><h3 className="text-[18px] font-bold leading-snug"><Link to={articleUrl(a)} className="hover:text-[#C8102E] hover:underline">{a.title}</Link></h3><p className="text-sm text-[#6B7280] line-clamp-1">{a.excerpt}</p><p className="text-xs text-[#6B7280]">{relativeDay(a.date)}</p></article>))}</div></section>
      
    </div>
  )
}

function CategoryPage() {
  const { slug } = useParams()
  const cat = slug ? categoryBySlug(slug) : undefined
  const { articles, loading } = useArticles()
  useSeo(cat ? cat.name : 'Category', cat ? cat.description : 'Browse articles by category on The Newsroom Daily.')
  const list = articles.filter((a) => a.category === slug && isDuePublished(a.status, a.scheduled_at))
  if (!cat) return <p>Category not found. <Link to="/" className="text-[#C8102E] underline">Go home</Link></p>
  return (
    <div>
      <h1 className="text-3xl font-black">{cat.name}</h1>
      <p className="text-[#6B7280] mt-2">{cat.description}</p>
      {loading && <p className="text-[#6B7280] mt-4">Loading articles...</p>}
      {list.length === 0 ? (<p className="text-[#6B7280] mt-4">No articles in this category yet.</p>) : (
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          {list.map((a) => (<ArticleCard key={a.slug} a={a} />))}
        </div>
      )}
    </div>
  )
}

function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const { articles, loading } = useArticles()
  useSeo('Search: ' + q, 'Search results for "' + q + '" on The Newsroom Daily.')
  const results = searchArticles(articles, q)
  return (
    <div>
      <h1 className="text-3xl font-black">Search results for &ldquo;{q}&rdquo;</h1>
      {loading && <p className="text-[#6B7280] mt-4">Loading articles...</p>}
      {results.length === 0 ? (<p className="text-[#6B7280] mt-4">No articles matched your search.</p>) : (
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          {results.map((a) => (<ArticleCard key={a.slug} a={a} />))}
        </div>
      )}
    </div>
  )
}

function SavedPage() {
  const { articles, loading } = useArticles()
  const { savedIds } = useBookmarks()
  useSeo('Saved', 'Your saved articles on The Newsroom Daily.')
  const list = articles.filter((a) => a.id != null && savedIds.includes(a.id))
  return (
    <div>
      <h1 className="text-3xl font-black">Saved articles</h1>
      {loading && <p className="text-[#6B7280] mt-4">Loading articles...</p>}
      {list.length === 0 ? (<p className="text-[#6B7280] mt-4">No saved articles yet. Use the Save button on an article to keep it here.</p>) : (
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          {list.map((a) => (<ArticleCard key={a.slug} a={a} />))}
        </div>
      )}
    </div>
  )
}

function ArticlePage() {
  const { slug, category, id } = useParams()
  const [a, setA] = useState<PublicArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState<ArticleFontSize>(getSavedFontSize)
  const [tocOpen, setTocOpen] = useState(false)
  const toc = buildToc(a?.content ?? [])
  useEffect(() => {
    try { localStorage.setItem(FONT_SIZE_KEY, fontSize) } catch { /* ignore */ }
  }, [fontSize])
  useEffect(() => {
    let live = true
    setLoading(true)
    const run = async () => {
      const article = id ? await fetchArticleById(Number(id)) : slug ? await fetchArticleBySlug(slug) : null
      if (!live) return
      setA(article)
      setLoading(false)
      if (article) {
        const key = 'newsroom-viewed-' + article.slug
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          void incrementArticleViews(article.slug)
        }
      }
    }
    run().catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [id, slug])
  useSeo(a ? a.title : 'Article', a ? a.description : 'Read a guide on The Newsroom Daily.')
  if (loading) return <p className="text-[#6B7280]">Loading article...</p>
  if (!a) return <p>Article not found. <Link to="/" className="text-[#C8102E] underline">Go home</Link></p>
  if (category && a.category !== category) return <Navigate to={articleUrl(a)} replace />
  const words = countWords(a.content.join(' '))
  const minutes = Math.max(1, Math.ceil(words / 200))
  return (
    <article>
      <ReadingProgressBar />
      <p className="text-xs font-bold tracking-wide text-[#C8102E]">{categoryBySlug(a.category)?.name.toUpperCase()}</p>
      <h1 className="text-3xl md:text-4xl font-black mt-2 leading-tight">{a.title}</h1>
      <p className="text-sm text-[#6B7280] mt-3">{a.date} | The Newsroom Daily | {minutes} min read{a.views > 0 ? ` \u00B7 ${a.views} views` : ''}</p>
      <div className="mt-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto print-hidden" data-testid="reader-controls" aria-label="Article toolbar">
        <FontSizeControl size={fontSize} onChange={setFontSize} />
        <ListenControl text={a.content.join(' ')} title={a.title} />
        <PrintButton />
        <span className="mx-0.5 h-6 w-px shrink-0 bg-[#0F2A44]/15 dark:bg-[#24405E]" aria-hidden="true" />
        <ShareButtons article={a} />
        <BookmarkButton article={a} />
      </div>
      {toc.length > 0 && (
        <nav aria-label="Table of contents" className="mt-6 w-full max-w-full box-border overflow-hidden bg-white border rounded-lg p-5 shadow-sm dark:bg-[#122840] dark:border-[#24405E] print-hidden">
          <button type="button" data-testid="toc-toggle" aria-expanded={tocOpen} aria-controls="toc-list" onClick={() => setTocOpen(!tocOpen)} className="flex w-full items-center justify-between gap-2 text-left font-bold text-[#0F2A44] dark:text-slate-100">
            <span>On this page</span>
            <svg className={tocOpen ? 'h-4 w-4 shrink-0 rotate-180 transition-transform' : 'h-4 w-4 shrink-0 transition-transform'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {tocOpen && (
            <ul id="toc-list" className="mt-2 space-y-1">
              {toc.map((t) => (<li key={t.id}><a href={'#' + t.id} onClick={() => setTocOpen(false)} className="text-[#C8102E] hover:underline break-words">{t.label}</a></li>))}
            </ul>
          )}
        </nav>
      )}
      {a.cover && (<img src={a.cover} alt={a.cover_alt || a.title} className="w-full rounded-lg mt-6 print:hidden" />)}
      <div data-testid="article-body" data-font-size={fontSize} style={{ fontSize: ARTICLE_FONT_SIZE_PX[fontSize] }} className="mt-6 space-y-4 leading-relaxed bg-white border rounded-lg p-6 shadow-sm dark:bg-[#122840] dark:border-[#24405E]">
        {a.content.map((block, i) => {
          if (block.startsWith('## ')) return <h2 key={i} id={blockAnchorId(a.content, i)} className="text-2xl font-bold mt-2 scroll-mt-24">{block.slice(3)}</h2>
          return <p key={i} id={blockAnchorId(a.content, i)} className="scroll-mt-24">{block}</p>
        })}
      </div>
      {a.corrected_at && <p data-testid="article-corrected" className="mt-3 text-sm text-[#6B7280] dark:text-slate-400">Corrected: {formatUsDate(a.corrected_at)}</p>}
      {a.id != null && <ArticleFeedback articleId={a.id} />}
      {a.id != null && <ReportCorrectionForm articleId={a.id} />}
      <div className="mt-6 print-hidden">
        <ShareButtons article={a} />
      </div>
      <RelatedArticles a={a} />
      <p className="mt-8 print-hidden"><Link to="/" className="text-[#C8102E] underline">&larr; Back to home</Link></p>
    </article>
  )
}

function AboutPage() {
  useSeo('About', 'The Newsroom Daily is a clean, fast news site with clear, practical guides on gaming, tech, money, career and everyday life.')
  return (
    <div>
      <h1 className="text-3xl font-black">About The Newsroom Daily</h1>
      <div className="mt-4 space-y-4 leading-relaxed bg-white border rounded-lg p-6 shadow-sm dark:bg-[#122840] dark:border-[#24405E]">
        <p>The Newsroom Daily is a clean, fast news site. It covers GTA 6 gaming, tech how-to, money and finance, career and work, and everyday guides.</p>
        <p>Every guide is written in plain US English, so you can follow it in a few minutes and get the answer you need.</p>
      </div>
    </div>
  )
}

function ContactPage() {
  useSeo('Contact', 'Contact The Newsroom Daily with a question, a correction, or a story idea.')
  return (
    <div>
      <h1 className="text-3xl font-black">Contact</h1>
      <div className="mt-4 space-y-4 leading-relaxed bg-white border rounded-lg p-6 shadow-sm dark:bg-[#122840] dark:border-[#24405E]">
        <p>Questions, corrections, or story ideas? Write to us and we will get back to you.</p>
        <p>Email: <a href="mailto:rtvsakib@gmail.com" className="text-[#C8102E] underline">rtvsakib@gmail.com</a></p>
      </div>
    </div>
  )
}

function PrivacyPage() {
  useSeo('Privacy Policy', 'How The Newsroom Daily handles reader data: bookmarks stay in your browser, and the newsletter only stores the email you choose to share.')
  return (
    <div>
      <h1 className="text-3xl font-black">Privacy Policy</h1>
      <p className="text-sm text-[#6B7280] mt-2">Last updated: November 25, 2026</p>
      <div className="mt-4 space-y-4 leading-relaxed bg-white border rounded-lg p-6 shadow-sm dark:bg-[#122840] dark:border-[#24405E]">
        <p>The Newsroom Daily collects as little as possible. Bookmarks are stored only in your browser, and reading progress is not sent to us.</p>
        <p>If you subscribe to the newsletter, we store only the email address you enter, and only to send you our guides. We do not sell or share it.</p>
        <p>If you vote on whether an article was helpful, we store only your answer and the article, with no name or email attached.</p>
        <p>If you report a correction, we store the wrong line, the suggested correction, the source link, and the name and email you choose to share, only so we can review the report.</p>
        <p>Contact us at <a href="mailto:rtvsakib@gmail.com" className="text-[#C8102E] underline">rtvsakib@gmail.com</a> with any privacy question.</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p className="p-6 text-[#6B7280]">Loading...</p>}>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/article/:slug" element={<ArticlePage />} />
            <Route path="/:category/:id" element={<ArticlePage />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Layout>
      </Suspense>
    </BrowserRouter>
  )
}
