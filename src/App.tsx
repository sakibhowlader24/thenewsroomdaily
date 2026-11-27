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

function ArticleCard({ a }: { a: PublicArticle }) {
  const cat = categoryBySlug(a.category)
  return (
    <article className="border rounded-lg p-5 bg-white shadow-sm dark:bg-[#122840] dark:border-[#24405E]">
      {a.cover && (<img src={a.cover} alt={a.cover_alt || a.title} className="w-full h-40 object-cover rounded mb-4" loading="lazy" />)}
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">
        {cat ? cat.name : a.category}
        {a.is_featured && (<span className="ml-2 bg-[#C8102E] text-white px-2 py-0.5 rounded normal-case tracking-normal">Featured</span>)}
      </p>
      <h3 className="text-xl font-bold mt-2 leading-snug"><Link to={articleUrl(a)} className="hover:underline">{a.title}</Link></h3>
      <p className="text-[#6B7280] mt-2 dark:text-slate-400">{a.excerpt}</p>
      <p className="text-sm text-[#6B7280] mt-3 dark:text-slate-400">{a.date} | {a.author}{a.views > 0 ? ' | ' + a.views + ' views' : ''}</p>
    </article>
  )
}

function RelatedArticles({ articles }: { articles: PublicArticle[] }) {
  if (articles.length === 0) return null
  return (
    <section className="mt-8" aria-label="Related articles">
      <h2 className="font-serif text-2xl font-bold mb-4">Related articles</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {articles.map((a) => (<ArticleCard key={a.slug} a={a} />))}
      </div>
    </section>
  )
}

function Layout({ children, theme, onToggleTheme }: { children: ReactNode; theme: Theme; onToggleTheme: () => void }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { setOpen(false) }, [location.pathname])
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1F2937] dark:bg-[#0B1C2E] dark:text-slate-100">
      <header className="bg-[#0F2A44] text-white shadow-md print-hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-serif text-xl font-bold tracking-tight md:text-2xl">The Newsroom Daily</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <Link to="/saved" className="rounded bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20">Saved</Link>
            <button type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} className="rounded bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu" className="rounded bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20 md:hidden">{open ? 'Close' : 'Menu'}</button>
          </div>
        </div>
        <nav className={open ? 'block border-t border-white/20 md:block' : 'hidden md:block'} aria-label="Categories">
          <div className="max-w-6xl mx-auto flex flex-col px-4 py-2 md:flex-row md:flex-wrap md:gap-1">
            {CATEGORIES.map((c) => (
              <Link key={c.slug} to={'/' + c.slug} className="rounded px-3 py-2 text-sm font-bold text-white/90 hover:bg-white/10 hover:text-white">{c.name}</Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8 md:py-10">{children}</main>
      <footer className="bg-[#0F2A44] text-white mt-16 print-hidden">
        <div className="max-w-6xl mx-auto px-4 py-8 grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-serif text-xl font-bold">The Newsroom Daily</p>
            <p className="text-sm text-slate-300 mt-2">Clear, practical guides in plain English.</p>
            <p className="text-sm text-slate-300 mt-2"><Link to="/about" className="underline">About</Link> | <Link to="/contact" className="underline">Contact</Link> | <Link to="/privacy" className="underline">Privacy</Link></p>
          </div>
          <div>
            <p className="font-bold">Browse</p>
            <p className="text-sm text-slate-300 mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {CATEGORIES.map((c) => (<Link key={c.slug} to={'/' + c.slug} className="underline">{c.name}</Link>))}
            </p>
          </div>
          <div>
            <NewsletterForm tone="light" />
          </div>
        </div>
        <div className="border-t border-white/20">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
            <span>&copy; {new Date().getFullYear()} The Newsroom Daily</span>
            <span>Clear, practical guides in plain English.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CategoryPage({ slug }: { slug: string }) {
  const { articles, loading } = useArticles()
  const cat = categoryBySlug(slug)
  useSeo(cat ? cat.name : 'Category', cat ? cat.description : 'Category page')
  if (!cat) return <Navigate to="/" replace />
  const list = articles.filter((a) => a.category === slug)
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{cat.name}</h1>
      <p className="text-[#6B7280] mb-8 dark:text-slate-400">{cat.description}</p>
      {loading && <p className="text-[#6B7280] mb-4 dark:text-slate-400">Loading articles...</p>}
      {list.length === 0 && !loading ? (<p>No articles in this category yet. Check back soon.</p>) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
  const results = searchArticles(articles, q)
  useSeo('Search: ' + q, 'Search results for ' + q)
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Search</h1>
      <p className="text-[#6B7280] mb-6 dark:text-slate-400">Results for &ldquo;{q}&rdquo;</p>
      <div className="mb-6"><SearchBox /></div>
      {loading && <p className="text-[#6B7280] dark:text-slate-400">Loading articles...</p>}
      {!loading && q.trim().length < 2 && <p>Type at least 2 characters to search.</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && <p>No articles match &ldquo;{q}&rdquo;.</p>}
      {results.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {results.map((a) => (<ArticleCard key={a.slug} a={a} />))}
        </div>
      )}
    </div>
  )
}

function SavedPage() {
  const { savedIds } = useBookmarks()
  const { articles, loading } = useArticles()
  useSeo('Saved articles', 'Articles you saved for later')
  const saved = articles.filter((a) => a.id != null && savedIds.includes(a.id))
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Saved articles</h1>
      <p className="text-[#6B7280] mb-8 dark:text-slate-400">Saved in this browser only.</p>
      {loading && <p className="text-[#6B7280] dark:text-slate-400">Loading articles...</p>}
      {!loading && saved.length === 0 && <p>You have not saved any articles yet. Tap the save icon on an article to keep it here.</p>}
      {saved.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {saved.map((a) => (<ArticleCard key={a.slug} a={a} />))}
        </div>
      )}
    </div>
  )
}

function ArticlePage({ slug }: { slug: string }) {
  const [a, setA] = useState<PublicArticle | null>(null)
  const [related, setRelated] = useState<PublicArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [fontSize, setFontSize] = useState<ArticleFontSize>(() => getSavedFontSize())
  const [tocOpen, setTocOpen] = useState(false)
  useEffect(() => { try { localStorage.setItem(FONT_SIZE_KEY, fontSize) } catch { /* ignore */ } }, [fontSize])
  useEffect(() => { window.scrollTo(0, 0) }, [slug])
  useEffect(() => {
    let live = true
    setLoading(true)
    fetchArticleBySlug(slug).then((found) => {
      if (!live) return
      setA(found)
      setLoading(false)
      if (found && found.id != null) {
        incrementArticleViews(found.id)
        fetchRelatedArticles(found).then((list) => { if (live) setRelated(list) }).catch(() => {})
      }
    }).catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [slug])
  useSeo(a ? a.title : 'Article', a ? a.excerpt : 'Article')
  if (loading) return <p>Loading article...</p>
  if (!a) return <p>Article not found. <Link to="/" className="text-[#C8102E] underline">Back to home</Link></p>
  const cat = categoryBySlug(a.category)
  const toc = buildToc(a.content)
  const readingMinutes = Math.max(1, Math.round(countWords(a.content.join(' ')) / 200))
  return (
    <article data-testid="article-page" className="min-w-0">
      <ReadingProgressBar />
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">{cat ? cat.name : a.category}</p>
      <h1 className="text-3xl md:text-4xl font-bold mt-2 leading-tight font-serif">{a.title}</h1>
      <p className="text-[#6B7280] mt-3 dark:text-slate-400">{a.date} | {a.author} | {readingMinutes} min read{a.views > 0 ? ' | ' + a.views + ' views' : ''}</p>
      <p className="mt-3 text-lg text-[#374151] dark:text-slate-200">{a.excerpt}</p>
      {a.cover && (<img src={a.cover} alt={a.cover_alt || a.title} className="w-full h-64 object-cover rounded-lg mt-4" />)}
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
      <div className="bg-white border rounded-lg p-6 shadow-sm mt-6 space-y-4 leading-relaxed dark:bg-[#122840] dark:border-[#24405E]" data-testid="article-body" data-font-size={fontSize} style={{ fontSize: ARTICLE_FONT_SIZE_PX[fontSize] }}>
        {a.content.map((block, i) => {
          if (block.startsWith('## ')) return <h2 key={i} id={blockAnchorId(a.content, i)} className="text-2xl font-bold mt-2 scroll-mt-24">{block.slice(3)}</h2>
          return <p key={i} id={blockAnchorId(a.content, i)} className="scroll-mt-24">{block}</p>
        })}
      </div>
      <ArticleFeedback articleId={a.id} />
      <ReportCorrectionForm articleId={a.id} />
      <RelatedArticles articles={related} />
      <div className="mt-8 flex flex-wrap items-center gap-3 print-hidden">
        <ShareButtons article={a} />
        <BookmarkButton article={a} />
      </div>
    </article>
  )
}

function HomePage() {
  const { articles, loading } = useArticles()
  const [categories, setCategories] = useState(CATEGORIES)
  useSeo('Home', 'Clear, practical guides in plain English.')
  useEffect(() => {
    fetchHomepageCategories().then((list) => { if (list.length > 0) setCategories(list) }).catch(() => {})
  }, [])
  const featured = articles.find((a) => a.is_featured)
  const rest = articles.filter((a) => !a.is_featured)
  return (
    <div>
      <div className="mb-8 md:mb-10">
        <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">Clear, practical guides in plain English.</h1>
        <p className="mt-2 text-[#6B7280] dark:text-slate-400">Gaming, tech how-to, money, career and everyday guides.</p>
        <div className="mt-4 max-w-xl"><SearchBox /></div>
      </div>
      <MostReadList articles={articles} />
      {loading && <p className="text-[#6B7280] dark:text-slate-400">Loading articles...</p>}
      {featured && (
        <section aria-label="Featured article" className="mb-8 md:mb-10">
          <h2 className="text-2xl font-bold mb-4">Featured</h2>
          <ArticleCard a={featured} />
        </section>
      )}
      <h2 className="text-2xl font-bold mb-4">Latest articles</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((a) => (<ArticleCard key={a.slug} a={a} />))}
      </div>
    </div>
  )
}

function AboutPage() {
  useSeo('About', 'About The Newsroom Daily')
  return (
    <div className="prose max-w-none dark:prose-invert">
      <h1 className="text-3xl font-bold mb-4">About The Newsroom Daily</h1>
      <p>The Newsroom Daily is a small, independent publication. We write clear, practical guides in plain English, starting from what a real person actually needs to do, and we check what we publish.</p>
      <p>We cover gaming, tech how-to, money, career and everyday guides. Every guide is written to be useful on its own, with no filler and no jargon.</p>
      <p>We only publish articles we can stand behind. If you spot a mistake, use the Report an error button on any article.</p>
    </div>
  )
}

function ContactPage() {
  useSeo('Contact', 'Contact The Newsroom Daily')
  return (
    <div className="prose max-w-none dark:prose-invert">
      <h1 className="text-3xl font-bold mb-4">Contact</h1>
      <p>For corrections, tips or general feedback, use the Report an error button on any article.</p>
      <p>You can also reach the editor at <a href="mailto:sakibhowlader24@gmail.com" className="text-[#C8102E] underline">sakibhowlader24@gmail.com</a>.</p>
    </div>
  )
}

function PrivacyPage() {
  useSeo('Privacy', 'Privacy policy for The Newsroom Daily')
  return (
    <div className="prose max-w-none dark:prose-invert">
      <h1 className="text-3xl font-bold mb-4">Privacy</h1>
      <p>We collect as little as possible. Your saved articles, font size and theme are stored in your own browser (localStorage) and never sent to us.</p>
      <p>Newsletter signups are stored so we can send you the guides you asked for. You can unsubscribe at any time.</p>
      <p>We do not sell your data.</p>
    </div>
  )
}

function ArticleById() {
  const { id } = useParams()
  const [slug, setSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    const num = Number(id)
    if (!Number.isFinite(num)) { setLoading(false); return }
    fetchArticleById(num).then((found) => { if (live) { setSlug(found ? found.slug : null); setLoading(false) } }).catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [id])
  if (loading) return <p>Loading article...</p>
  if (!slug) return <p>Article not found. <Link to="/" className="text-[#C8102E] underline">Back to home</Link></p>
  return <ArticlePage slug={slug} />
}

function CategoryBySlug() {
  const { slug } = useParams()
  return <CategoryPage slug={slug || ''} />
}

function ArticleBySlug() {
  const { slug } = useParams()
  return <ArticlePage slug={slug || ''} />
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  }, [theme])
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return (
    <BrowserRouter>
      <Layout theme={theme} onToggleTheme={toggleTheme}>
        <Suspense fallback={<p>Loading...</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/:category/:id" element={<ArticleById />} />
            <Route path="/:category/:slug" element={<ArticleBySlug />} />
            <Route path="/:slug" element={<CategoryBySlug />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}
