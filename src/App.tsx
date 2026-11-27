import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, Navigate, useSearchParams } from 'react-router-dom'
import { ARTICLES } from './data/articles'
import { CATEGORIES, SITE_NAME, SITE_URL, categoryBySlug } from './data/site'
import {
  supabase,
  supabaseConfigured,
  fetchPublishedArticles, fetchArticleBySlug, fetchRelatedArticles, isDuePublished,
  fetchAllArticles,
  rowToArticle,
  articleToRow,
  incrementArticleViews,
  fetchRevisions,
  saveRevision,
  fetchHomepageCategories,
  saveHomepageCategories,
  ALL_CATEGORY_SLUGS,
  type ArticleRow,
  type ArticleRevision,
  type PublicArticle,
} from './lib/supabase'
import { formatBytes, uploadCoverImage } from './lib/image'

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
  return (
    <article className="border rounded-lg p-5 bg-white shadow-sm">
      {a.cover && (<img src={a.cover} alt={a.cover_alt || a.title} className="w-full h-40 object-cover rounded mb-4" loading="lazy" />)}
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">
        {cat ? cat.name : a.category}
        {a.is_featured && (<span className="ml-2 bg-[#C8102E] text-white px-2 py-0.5 rounded normal-case tracking-normal">Featured</span>)}
      </p>
      <h3 className="text-xl font-bold mt-2 leading-snug"><Link to={'/article/' + a.slug} className="hover:underline">{a.title}</Link></h3>
      <p className="text-[#6B7280] mt-2">{a.excerpt}</p>
      <p className="text-sm text-[#6B7280] mt-3">{a.date} | {a.author}{a.views > 0 ? ' | ' + a.views + ' views' : ''}</p>
    </article>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#1F2937]">
      <header className="bg-white text-[#0F2A44]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-3">
          <Link to="/" aria-label="The Newsroom Daily" className="inline-flex flex-col items-start leading-none">
            <span className="font-serif text-[1.75rem] md:text-[2.75rem] font-black tracking-tight text-[#0F2A44]">The Newsroom</span>
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
            <button type="button" aria-label={menuOpen ? 'Close menu' : 'More links'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition-colors md:hidden ' + (menuOpen ? 'bg-[#C8102E]' : 'bg-[#0F2A44] hover:bg-[#C8102E] active:bg-[#C8102E]')}>
              {menuOpen ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" /></svg>
              ) : (
                <svg width="20" height="6" viewBox="0 0 20 6" fill="none" aria-hidden="true"><circle cx="3" cy="3" r="2.5" fill="white" /><circle cx="10" cy="3" r="2.5" fill="white" /><circle cx="17" cy="3" r="2.5" fill="white" /></svg>
              )}
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl md:hidden">
                {CATEGORIES.slice(2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44]">{c.name}</Link>))}
                <Link to="/about" onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44]">About</Link>
                <Link to="/contact" onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44]">Contact</Link>
              </div>
            )}
          </nav>
        </div>
        <div aria-hidden="true" className="h-[3px] w-full bg-[#C8102E]" />
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 md:py-8">{children}</main>
      <footer className="bg-[#0F2A44] text-gray-300">
        <div className="max-w-5xl mx-auto px-4 py-6 text-sm flex flex-wrap gap-3 justify-between md:py-8 md:gap-6">
          <p>{SITE_NAME} | Clear, practical guides for everyday readers.</p>
          <p className="flex gap-4">
            <Link to="/about" className="hover:underline">About</Link>
            <Link to="/contact" className="hover:underline">Contact</Link>
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
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
        <section className="bg-white border rounded-lg p-5 shadow-sm mb-8 md:p-6 md:mb-10">
          <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">Latest article</p>
          <h1 className="text-3xl md:text-4xl font-black mt-2 leading-tight"><Link to={'/article/' + latest.slug} className="hover:underline">{latest.title}</Link></h1>
          <p className="text-[#6B7280] mt-3 text-lg">{latest.excerpt}</p>
          <p className="text-sm text-[#6B7280] mt-3">{latest.date} | {latest.author}</p>
          <Link to={'/article/' + latest.slug} className="inline-block mt-4 bg-[#C8102E] text-white font-bold px-4 py-2 rounded">Read the guide</Link>
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
            <p className="text-[#6B7280] mt-1 mb-4">{c.description}</p>
            {list.length ? (<div className="grid md:grid-cols-2 gap-5">{list.map((a) => (<ArticleCard key={a.slug} a={a} />))}</div>) : (<p className="text-[#6B7280]">More guides in this category are coming soon.</p>)}
          </section>
        )
      })}
    </div>
  )
}

function ArticlePage() {
  const { slug } = useParams()
  const [a, setA] = useState<PublicArticle | null>(null); const [loading, setLoading] = useState(true); const [related, setRelated] = useState<PublicArticle[]>([])
  useEffect(() => { let live = true; setLoading(true); setA(null); setRelated([]); fetchArticleBySlug(slug ?? '').then((found) => { if (!live) return; const visible = found && isDuePublished(found.status, found.scheduled_at) ? found : null; const article = visible ?? (ARTICLES.find((x) => x.slug === slug) as PublicArticle | undefined) ?? null; setA(article); if (article) fetchRelatedArticles(article.category, article.slug).then((list) => { if (live) setRelated(list) }).catch(() => {}) }).catch(() => { if (live) setA((ARTICLES.find((x) => x.slug === slug) as PublicArticle | undefined) ?? null) }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [slug])
  useSeo(loading && !a ? 'Loading...' : a ? a.title : 'Article not found', a ? a.description : 'This article could not be found.')
  useEffect(() => {
    if (!a) return
    const key = 'viewed-' + a.slug
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      void incrementArticleViews(a.slug)
    }
  }, [a?.slug])
  if (loading && !a) return (<div className="flex flex-col items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#C8102E]" /><p className="mt-4 text-[#6B7280]">Loading...</p></div>); if (!a) return (<div><h1 className="text-3xl font-bold">Article not found</h1><p className="mt-3"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p></div>)
  const cat = categoryBySlug(a.category)
  // Related articles are fetched in the effect above with fetchRelatedArticles.
  const words = countWords(a.content.join(' '))
  const readMinutes = Math.max(1, Math.ceil(words / 200))
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]"><Link to={'/category/' + a.category} className="hover:underline">{cat ? cat.name : a.category}</Link></p>
      <h1 className="text-3xl md:text-4xl font-black mt-2 leading-tight">{a.title}</h1>
      <p className="text-sm text-[#6B7280] mt-3">{a.date} | By {a.author} | {readMinutes} min read{a.views > 0 ? ' | ' + a.views + ' views' : ''}</p>
      {a.cover && (<img src={a.cover} alt={a.cover_alt || a.title} className="w-full rounded-lg mt-6" />)}
      <div className="mt-6 space-y-4 text-lg leading-relaxed bg-white border rounded-lg p-6 shadow-sm">
        {a.content.map((block, i) => block.startsWith('## ') ? (<h2 key={i} className="text-2xl font-bold pt-2">{block.slice(3)}</h2>) : (<p key={i}>{block}</p>))}
      </div>
      <p className="text-sm text-[#6B7280] mt-4">Sources: official game and product pages, and general guidance from public help pages. Money and health articles are general education, not personal advice.</p>
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
      <p className="text-[#6B7280] mt-2 mb-6">{cat.description}</p>
      {list.length ? (<div className="grid md:grid-cols-2 gap-5">{list.map((a) => (<ArticleCard key={a.slug} a={a} />))}</div>) : (<p className="text-[#6B7280]">More guides in this category are coming soon. Check back for new articles.</p>)}
    </div>
  )
}

function About() {
  useSeo('About', 'About The Newsroom Daily: clear, practical guides on gaming, tech, money, career and everyday life, written in plain words.')
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4 text-lg leading-relaxed">
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
      <p className="text-[#6B7280] mt-2">Send a question, a correction, or a story idea. We read every message and reply by email when an answer is needed.</p>
      {sent ? (
        <p className="bg-green-100 border border-green-300 rounded p-4 mt-4">Thank you. Your message was sent. We will reply by email when an answer is needed.</p>
      ) : (
        <form className="space-y-4 mt-4" action="https://formsubmit.co/rtvsakib@gmail.com" method="POST">
          <input type="hidden" name="_subject" value="New contact message - The Newsroom Daily" />
          <input type="hidden" name="_captcha" value="false" />
          <input type="hidden" name="_template" value="table" />
          <input type="hidden" name="_next" value={SITE_URL + '/contact?sent=1'} />
          <div>
            <label className="block font-bold mb-1">Name</label>
            <input name="name" required className="w-full border rounded p-3" />
          </div>
          <div>
            <label className="block font-bold mb-1">Email</label>
            <input name="email" type="email" required className="w-full border rounded p-3" />
          </div>
          <div>
            <label className="block font-bold mb-1">Message</label>
            <textarea name="message" required rows={5} className="w-full border rounded p-3" />
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
    <div className="bg-white border rounded-lg p-6 shadow-sm space-y-4 text-lg leading-relaxed">
      <h1 className="text-3xl font-black">Privacy Policy</h1>
      <p>Last updated: 25 November 2026.</p>
      <p>{SITE_NAME} does not sell personal information. This site does not use advertising trackers at launch, and it does not run Google AdSense.</p>
      <p>If you use the contact form, we receive the name, email address, and message you type. We use that only to read and reply to your message. We do not share it with other parties.</p>
      <p>This site may use basic, privacy friendly visit counts from its host to understand which pages are read. Those counts do not identify individual readers.</p>
      <p>If you have a privacy question, use the Contact page. This policy will be updated here if the site adds analytics, comments, or advertising in future.</p>
    </div>
  )
}

interface AdminSnapshot {
  title: string
  slug: string
  category: string
  status: string
  excerpt: string
  meta: string
  body: string
  cover: string
  coverAlt: string
  pubDate: string
  scheduledAt: string
  isFeatured: boolean
  editingId: number | null
  editingViews: number
  editingDeletedAt: string | null
}

function buildItemFromSnapshot(s: AdminSnapshot): PublicArticle {
  return {
    slug: s.slug.trim(),
    title: s.title.trim(),
    description: s.meta.trim() || s.excerpt.trim(),
    category: s.category,
    date: s.status === 'scheduled' && s.scheduledAt ? s.scheduledAt.slice(0, 10) : s.pubDate,
    author: SITE_NAME,
    excerpt: s.excerpt.trim(),
    content: s.body.split(/\n\s*\n/).filter(Boolean),
    cover: s.cover.trim() || undefined,
    status: s.status,
    is_featured: s.isFeatured,
    views: s.editingViews,
    scheduled_at: s.scheduledAt ? new Date(s.scheduledAt).toISOString() : undefined,
    deleted_at: s.editingDeletedAt,
    cover_alt: s.coverAlt.trim() || undefined,
  }
}

function Admin() {
  useSeo('Admin', 'Admin page for The Newsroom Daily: add and edit articles in Supabase.')
  const [user, setUser] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isRecovery, setIsRecovery] = useState(false)
  const [resetSent, setResetSent] = useState('')
  const [resetError, setResetError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetPasswordError, setResetPasswordError] = useState('')
  const [resetPasswordDone, setResetPasswordDone] = useState('')
  const [rows, setRows] = useState<ArticleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState('gaming')
  const [excerpt, setExcerpt] = useState('')
  const [meta, setMeta] = useState('')
  const [body, setBody] = useState('')
  const [cover, setCover] = useState('')
  const [coverAlt, setCoverAlt] = useState('')
  const [pubDate, setPubDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [scheduledAt, setScheduledAt] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [status, setStatus] = useState('published')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingViews, setEditingViews] = useState(0)
  const [editingDeletedAt, setEditingDeletedAt] = useState<string | null>(null)
  const [saved, setSaved] = useState('')
  const [formError, setFormError] = useState('')
  const [revisions, setRevisions] = useState<ArticleRevision[]>([])
  const [dirty, setDirty] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState('')
  const [uploadInfo, setUploadInfo] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [homeCategories, setHomeCategories] = useState<string[]>(ALL_CATEGORY_SLUGS)
  const [settingsMsg, setSettingsMsg] = useState('')
  const [restoreMsg, setRestoreMsg] = useState('')
  const [view, setView] = useState<'articles' | 'trash'>('articles')
  const [deleteTarget, setDeleteTarget] = useState<{ row: ArticleRow; permanent: boolean } | null>(null)

  const formSnapshotRef = useRef<AdminSnapshot & { dirty: boolean }>({
    title: '', slug: '', category: 'gaming', status: 'published', excerpt: '', meta: '', body: '', cover: '', coverAlt: '', pubDate: new Date().toISOString().slice(0, 10), scheduledAt: '', isFeatured: false, editingId: null, editingViews: 0, editingDeletedAt: null, dirty: false,
  })
  const savingRef = useRef(false)
  useEffect(() => {
    formSnapshotRef.current = { title, slug, category, status, excerpt, meta, body, cover, coverAlt, pubDate, scheduledAt, isFeatured, editingId, editingViews, editingDeletedAt, dirty }
  })

  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user?.email ?? null)
      setAuthChecked(true)
    })
    if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery')) setIsRecovery(true)
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => { setUser(session?.user?.email ?? null); if (event === 'PASSWORD_RECOVERY') setIsRecovery(true) })
    return () => { listener.subscription.unsubscribe() }
  }, [])

  const load = async () => {
    if (!supabase) return
    setLoading(true)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('articles').delete().lt('deleted_at', cutoff)
    const list = await fetchAllArticles()
    setRows(list)
    setHomeCategories(await fetchHomepageCategories())
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user])

  const autosaveTick = async () => {
    const s = formSnapshotRef.current
    if (!s.dirty || s.editingId === null || savingRef.current || !supabase) return
    if (!s.title.trim() || !s.slug.trim()) return
    savingRef.current = true
    setAutosaveStatus('Saving...')
    try {
      const item = buildItemFromSnapshot(s)
      const { error } = await supabase.from('articles').update(articleToRow(item)).eq('id', s.editingId)
      if (error) { setAutosaveStatus(error.message); return }
      await saveRevision(s.editingId, { article_slug: s.slug.trim(), title: s.title.trim(), excerpt: s.excerpt.trim(), meta_description: s.meta.trim(), content: s.body })
      setDirty(false)
      setAutosaveStatus('Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      setRevisions(await fetchRevisions(s.editingId))
    } finally {
      savingRef.current = false
    }
  }

  useEffect(() => {
    if (!user) return
    const timer = setInterval(() => { void autosaveTick() }, 5000)
    return () => clearInterval(timer)
  }, [user])

  const signIn = async (e: FormEvent) => {
    e.preventDefault()
    setAuthError('')
    if (!supabase) { setAuthError('Supabase is not configured.'); return }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
  }

  const sendResetEmail = async () => {
    setResetError('')
    setResetSent('')
    if (!supabase) { setResetError('Supabase is not configured.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail('rtvsakib@gmail.com', { redirectTo: 'https://thenewsroomdaily.vercel.app/admin' })
    if (error) setResetError(error.message)
    else setResetSent('পাসওয়ার্ড রিসেটের লিঙ্ক rtvsakib@gmail.com-এ পাঠানো হয়েছে। ইনবক্স (এবং স্প্যাম ফোল্ডার) চেক করুন।')
  }

  const setNewPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setResetPasswordError('')
    if (newPassword.length < 8) { setResetPasswordError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'); return }
    if (newPassword !== confirmPassword) { setResetPasswordError('দুটি পাসওয়ার্ড মিলছে না।'); return }
    if (!supabase) { setResetPasswordError('Supabase is not configured.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setResetPasswordError(error.message); return }
    setResetPasswordDone('পাসওয়ার্ড সফলভাবে সেট হয়েছে। এখন আপনি নতুন পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।')
    window.history.replaceState(null, '', '/admin')
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setSlug('')
    setCategory('gaming')
    setExcerpt('')
    setMeta('')
    setBody('')
    setCover('')
    setCoverAlt('')
    setPubDate(new Date().toISOString().slice(0, 10))
    setScheduledAt('')
    setIsFeatured(false)
    setStatus('published')
    setEditingViews(0)
    setEditingDeletedAt(null)
    setRevisions([])
    setDirty(false)
    setAutosaveStatus('')
    setUploadInfo('')
    setUploadError('')
    setRestoreMsg('')
  }

  const startEdit = async (row: ArticleRow) => {
    const a = rowToArticle(row)
    setEditingId(row.id)
    setTitle(a.title)
    setSlug(a.slug)
    setCategory(a.category)
    setExcerpt(a.excerpt)
    setMeta(a.description)
    setBody(a.content.join('\n\n'))
    setCover(a.cover || '')
    setCoverAlt(a.cover_alt || '')
    setPubDate(a.date || new Date().toISOString().slice(0, 10))
    setScheduledAt(a.scheduled_at ? a.scheduled_at.slice(0, 16) : '')
    setIsFeatured(a.is_featured)
    setStatus(a.status || 'published')
    setEditingViews(a.views)
    setEditingDeletedAt(a.deleted_at ?? null)
    setSaved('')
    setFormError('')
    setDirty(false)
    setAutosaveStatus('')
    setUploadInfo('')
    setUploadError('')
    setRestoreMsg('')
    setRevisions(await fetchRevisions(row.id))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    setSaved('')
    if (!supabase) { setFormError('Supabase is not configured.'); return }
    const s = formSnapshotRef.current
    if (s.status === 'scheduled' && !s.scheduledAt) { setFormError('Choose a publish time for a Scheduled article.'); return }
    const row = articleToRow(buildItemFromSnapshot(s))
    if (s.editingId !== null) {
      const { error } = await supabase.from('articles').update(row).eq('id', s.editingId)
      if (error) { setFormError(error.message); return }
      await saveRevision(s.editingId, { article_slug: s.slug.trim(), title: s.title.trim(), excerpt: s.excerpt.trim(), meta_description: s.meta.trim(), content: s.body })
    } else {
      const { data, error } = await supabase.from('articles').insert(row).select('id').single()
      if (error) { setFormError(error.message); return }
      await saveRevision(data.id, { article_slug: s.slug.trim(), title: s.title.trim(), excerpt: s.excerpt.trim(), meta_description: s.meta.trim(), content: s.body })
    }
    setSaved('Saved to Supabase at ' + new Date().toLocaleTimeString())
    setDirty(false)
    setAutosaveStatus('Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    resetForm()
    load()
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !supabase) return
    const { row, permanent } = deleteTarget
    setDeleteTarget(null)
    if (permanent) {
      const { error } = await supabase.from('articles').delete().eq('id', row.id)
      if (error) setFormError(error.message)
      else setSaved('Deleted from Supabase at ' + new Date().toLocaleTimeString())
    } else {
      const { error } = await supabase.from('articles').update({ deleted_at: new Date().toISOString() }).eq('id', row.id)
      if (error) setFormError(error.message)
      else setSaved('Moved to Trash at ' + new Date().toLocaleTimeString())
    }
    load()
  }

  const restoreFromTrash = async (row: ArticleRow) => {
    if (!supabase) return
    const { error } = await supabase.from('articles').update({ deleted_at: null }).eq('id', row.id)
    if (error) setFormError(error.message)
    else setSaved('Restored from Trash at ' + new Date().toLocaleTimeString())
    load()
  }

  const toggleFeatured = async (row: ArticleRow) => {
    if (!supabase) return
    const { error } = await supabase.from('articles').update({ is_featured: !row.is_featured }).eq('id', row.id)
    if (error) setFormError(error.message)
    load()
  }

  const handleCoverFile = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setUploadError('')
    setUploadInfo('')
    try {
      const result = await uploadCoverImage(file, slug || 'cover')
      setCover(result.publicUrl)
      setDirty(true)
      setUploadInfo(formatBytes(result.originalSize) + ' -> ' + formatBytes(result.compressedSize))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    }
    setUploading(false)
  }

  const restoreRevision = (rev: ArticleRevision) => {
    setTitle(rev.title ?? '')
    setExcerpt(rev.excerpt ?? '')
    setMeta(rev.meta_description ?? '')
    setBody(rev.content ?? '')
    setDirty(true)
    setRestoreMsg('Revision loaded into the form. Save the article to keep it.')
  }

  const saveSettings = async () => {
    setSettingsMsg('')
    await saveHomepageCategories(homeCategories)
    setSettingsMsg('Homepage categories saved.')
  }

  if (!supabaseConfigured) {
    return (
      <div>
        <h1 className="text-3xl font-black">Admin</h1>
        <p className="text-[#6B7280] mt-2">Supabase is not configured. Set the Supabase env vars in Vercel to use the admin.</p>
      </div>
    )
  }

  if (!authChecked) {
    return (
      <div>
        <h1 className="text-3xl font-black">Admin</h1>
        <p className="mt-3">Checking sign-in status...</p>
      </div>
    )
  }

  if (isRecovery) {
    return (
      <div>
        <h1 className="text-3xl font-black">Admin</h1>
        <p className="mt-3">নতুন পাসওয়ার্ড সেট করুন</p>
        {resetPasswordDone ? (
          <div>
            <p className="bg-green-100 border border-green-300 text-green-800 rounded p-4 mt-4">{resetPasswordDone}</p>
            <button className="bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26] mt-4" onClick={() => setIsRecovery(false)}>আর্টিকেল ম্যানেজারে যান</button>
          </div>
        ) : (
          <form className="space-y-4 mt-4" onSubmit={setNewPasswordSubmit}>
            <div>
              <label className="block font-bold mb-1">নতুন পাসওয়ার্ড</label>
              <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border rounded p-3" />
            </div>
            <div>
              <label className="block font-bold mb-1">নতুন পাসওয়ার্ড নিশ্চিত করুন</label>
              <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border rounded p-3" />
            </div>
            {resetPasswordError && <p className="bg-red-100 border border-red-300 text-red-800 rounded p-3">{resetPasswordError}</p>}
            <button className="bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26]">পাসওয়ার্ড সেট করুন</button>
          </form>
        )}
      </div>
    )
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-3xl font-black">Admin</h1>
        <p className="mt-3">Sign in to manage articles.</p>
        <form onSubmit={signIn} className="space-y-4 mt-4 max-w-md">
          <div>
            <label className="block font-bold mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-3" required />
          </div>
          <div>
            <label className="block font-bold mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded p-3" required />
          </div>
          {authError && <p className="bg-red-100 border border-red-300 text-red-800 rounded p-3">{authError}</p>}
          <button className="bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26]">Sign in</button>
          <button type="button" className="block text-[#C8102E] underline" onClick={sendResetEmail}>পাসওয়ার্ড ভুলে গেছেন?</button>
          {resetSent && <p className="bg-green-100 border border-green-300 text-green-800 rounded p-3">{resetSent}</p>}
          {resetError && <p className="bg-red-100 border border-red-300 text-red-800 rounded p-3">{resetError}</p>}
        </form>
      </div>
    )
  }

  const active = rows.filter((r) => !r.deleted_at)
  const trashed = rows.filter((r) => r.deleted_at)
  const totalViews = active.reduce((sum, r) => sum + (r.views ?? 0), 0)
  const publishedCount = active.filter((r) => r.status === 'published').length
  const draftCount = active.filter((r) => r.status === 'draft').length
  const scheduledCount = active.filter((r) => r.status === 'scheduled').length
  const topRead = [...active].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5)
  const words = countWords(body)
  const readMinutes = Math.max(1, Math.ceil(words / 200))
  const titleLen = title.length
  const metaLen = meta.length

  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <h1 className="text-3xl font-black">Admin</h1>
        <span className="flex gap-3 items-center">
          <span className="text-[#6B7280] text-sm">Signed in as {user}</span>
          <button className="text-[#C8102E] underline" onClick={signOut}>Log out</button>
        </span>
      </div>
      <p className="text-[#6B7280] mt-2">Add and edit articles. Articles are saved to the Supabase articles table. Supabase status: connected.</p>
      {saved && <p className="bg-green-100 border border-green-300 rounded p-3 mt-4">{saved}</p>}
      {formError && <p className="bg-red-100 border border-red-300 text-red-800 rounded p-3 mt-4">{formError}</p>}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        {[
          { label: 'Total articles', value: active.length },
          { label: 'Published', value: publishedCount },
          { label: 'Draft', value: draftCount },
          { label: 'Scheduled', value: scheduledCount },
          { label: 'Total views', value: totalViews },
        ].map((s) => (
          <div key={s.label} className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-sm text-[#6B7280]">{s.label}</p>
            <p className="text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </section>
      <section className="bg-white border rounded-lg p-6 shadow-sm mt-4">
        <h2 className="font-bold">Most-read articles</h2>
        {topRead.length === 0 ? (
          <p className="text-sm text-[#6B7280] mt-2">No views yet.</p>
        ) : (
          <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm">
            {topRead.map((r) => (<li key={r.id}>{r.title} — {r.views ?? 0} views</li>))}
          </ol>
        )}
      </section>

      <form className="space-y-4 mt-4" onSubmit={submit}>
        <div>
          <label className="block font-bold mb-1">Title</label>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true) }} className="w-full border rounded p-3" required />
        </div>
        <div>
          <label className="block font-bold mb-1">Slug</label>
          <input value={slug} onChange={(e) => { setSlug(e.target.value); setDirty(true) }} className="w-full border rounded p-3" required />
        </div>
        <div>
          <label className="block font-bold mb-1">Category</label>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setDirty(true) }} className="w-full border rounded p-3">
            {CATEGORIES.map((c) => (<option key={c.slug} value={c.slug}>{c.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block font-bold mb-1">Status</label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setDirty(true) }} className="w-full border rounded p-3">
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        {status === 'scheduled' && (
          <div>
            <label className="block font-bold mb-1">Publish at</label>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => { setScheduledAt(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
            <p className="text-sm text-[#6B7280] mt-1">Scheduled articles appear on the public site once this time has passed.</p>
          </div>
        )}
        <div>
          <label className="block font-bold mb-1">Published date</label>
          <input type="date" value={pubDate} onChange={(e) => { setPubDate(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isFeatured} onChange={(e) => { setIsFeatured(e.target.checked); setDirty(true) }} />
          Featured article (pinned at the top of the homepage)
        </label>
        <div>
          <label className="block font-bold mb-1">Excerpt</label>
          <textarea rows={2} value={excerpt} onChange={(e) => { setExcerpt(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
        </div>
        <div>
          <label className="block font-bold mb-1">Meta description</label>
          <textarea rows={2} value={meta} onChange={(e) => { setMeta(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
        </div>
        <div className="border rounded p-4 bg-gray-50">
          <p className="font-bold">SEO preview</p>
          <p className="text-sm mt-2">Meta title: {titleLen} / 60 characters {titleLen <= 60 ? (<span className="text-green-700 font-bold">OK</span>) : (<span className="text-red-600 font-bold">too long</span>)}</p>
          <p className="text-sm">Meta description: {metaLen} characters (target 150-160) {metaLen >= 150 && metaLen <= 160 ? (<span className="text-green-700 font-bold">OK</span>) : (<span className="text-red-600 font-bold">outside target</span>)}</p>
          <div className="mt-3 bg-white border rounded p-3">
            <p className="text-[#1a0dab] text-lg leading-snug">{title || 'Article title'}</p>
            <p className="text-[#006621] text-sm">thenewsroomdaily.vercel.app/article/{slug || 'article-slug'}</p>
            <p className="text-sm text-[#545454]">{meta || excerpt || 'Meta description preview.'}</p>
          </div>
          <p className="text-sm mt-2">{words} words · about {readMinutes} min read</p>
        </div>
        <div>
          <label className="block font-bold mb-1">Cover image URL (optional)</label>
          <input value={cover} onChange={(e) => { setCover(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
        </div>
        <div>
          <label className="block font-bold mb-1">Upload image</label>
          <input type="file" accept="image/*" onChange={(e) => { void handleCoverFile(e.target.files?.[0]) }} className="w-full border rounded p-3" />
          {uploading && <p className="text-sm text-[#6B7280] mt-1">Compressing and uploading...</p>}
          {uploadInfo && <p className="text-sm text-green-700 mt-1">Compressed: {uploadInfo}</p>}
          {uploadError && <p className="text-sm text-red-600 mt-1">{uploadError}</p>}
          <p className="text-sm text-[#6B7280] mt-1">Images are compressed in your browser (longest side max 1600px, WebP quality 0.8) before upload to Supabase Storage.</p>
        </div>
        <div>
          <label className="block font-bold mb-1">Cover image alt text (optional)</label>
          <input value={coverAlt} onChange={(e) => { setCoverAlt(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
        </div>
        {cover && (<img src={cover} alt={coverAlt || title} className="w-full max-w-md rounded" />)}
        <div>
          <label className="block font-bold mb-1">Content (paragraphs separated by a blank line, subheads start with ##)</label>
          <textarea rows={8} value={body} onChange={(e) => { setBody(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
        </div>
        <p className="text-sm text-[#6B7280]">{autosaveStatus || (dirty ? 'Unsaved changes — autosave runs every 5 seconds while you edit a saved article.' : 'Autosave runs every 5 seconds while you edit a saved article.')}</p>
        {editingId !== null && (
          <div className="border rounded p-4">
            <h3 className="font-bold">Revision history</h3>
            {revisions.length === 0 ? (
              <p className="text-sm text-[#6B7280] mt-1">No revisions yet. Autosave creates a revision every 5 seconds while you edit.</p>
            ) : (
              <ul className="space-y-2 mt-2">
                {revisions.map((rev) => (
                  <li key={rev.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>{new Date(rev.created_at).toLocaleString()} — {rev.title || '(no title)'}</span>
                    <button type="button" onClick={() => restoreRevision(rev)} className="border rounded px-3 py-1">Restore</button>
                  </li>
                ))}
              </ul>
            )}
            {restoreMsg && <p className="text-sm text-green-700 mt-2">{restoreMsg}</p>}
          </div>
        )}
        <button className="bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26]">{editingId ? 'Save changes' : 'Add article'}</button>
        {editingId ? (<button type="button" className="ml-3 underline text-[#C8102E]" onClick={resetForm}>Cancel edit</button>) : null}
      </form>

      <section className="bg-white border rounded-lg p-6 shadow-sm mt-8">
        <h2 className="text-xl font-black">Homepage settings</h2>
        <p className="text-sm text-[#6B7280] mt-1">Choose which categories appear on the homepage. Featured articles are picked with the Featured toggle in the article list below.</p>
        <div className="flex flex-wrap gap-4 mt-4">
          {CATEGORIES.map((c) => (
            <label key={c.slug} className="flex items-center gap-2 border rounded px-3 py-2">
              <input type="checkbox" checked={homeCategories.includes(c.slug)} onChange={(e) => setHomeCategories(e.target.checked ? [...homeCategories, c.slug] : homeCategories.filter((s) => s !== c.slug))} />
              {c.name}
            </label>
          ))}
        </div>
        <button onClick={saveSettings} className="mt-4 bg-[#0F2A44] text-white font-bold px-4 py-2 rounded">Save homepage settings</button>
        {settingsMsg && <p className="text-sm text-green-700 mt-2">{settingsMsg}</p>}
      </section>

      <div className="flex gap-2 mt-8">
        <button onClick={() => setView('articles')} className={view === 'articles' ? 'bg-[#0F2A44] text-white font-bold px-4 py-2 rounded' : 'border rounded px-4 py-2'}>Articles ({active.length})</button>
        <button onClick={() => setView('trash')} className={view === 'trash' ? 'bg-[#0F2A44] text-white font-bold px-4 py-2 rounded' : 'border rounded px-4 py-2'}>Trash ({trashed.length})</button>
      </div>
      {deleteTarget && (
        <div className="bg-red-50 border border-red-300 rounded p-4 mt-4">
          <p className="font-bold">{deleteTarget.permanent ? 'Permanently delete this article?' : 'Move this article to Trash?'}</p>
          <p className="text-sm mt-1">{deleteTarget.row.title}</p>
          <p className="text-sm text-[#6B7280]">{deleteTarget.permanent ? 'This cannot be undone. Its revisions are kept.' : 'You can restore it from Trash within 30 days.'}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={confirmDelete} className="bg-[#C8102E] text-white font-bold px-4 py-2 rounded">{deleteTarget.permanent ? 'Delete permanently' : 'Move to Trash'}</button>
            <button onClick={() => setDeleteTarget(null)} className="border rounded px-4 py-2">Cancel</button>
          </div>
        </div>
      )}
      {view === 'articles' ? (
        <div>
          <h2 className="text-2xl font-black mt-8">Articles ({active.length})</h2>
          {loading ? <p className="text-[#6B7280] mt-2">Loading articles.</p> : (
            <ul className="space-y-3 mt-4">
              {active.map((row) => {
                const a = rowToArticle(row)
                return (
                  <li key={row.id} className="bg-white border rounded p-4 flex flex-wrap justify-between gap-3">
                    <span>
                      <Link to={'/article/' + a.slug} className="font-bold hover:underline">{a.title}</Link>
                      <span className="text-[#6B7280] text-sm block">{a.category} | {a.slug} | {a.status || 'published'}{a.status === 'scheduled' && a.scheduled_at ? ' at ' + new Date(a.scheduled_at).toLocaleString() : ''} | {a.views} views{a.is_featured ? ' | Featured' : ''}</span>
                    </span>
                    <span className="flex gap-3">
                      <button className="text-[#C8102E] underline" onClick={() => toggleFeatured(row)}>{row.is_featured ? 'Unfeature' : 'Feature'}</button>
                      <button className="text-[#C8102E] underline" onClick={() => startEdit(row)}>Edit</button>
                      <button className="text-[#C8102E] underline" onClick={() => setDeleteTarget({ row, permanent: false })}>Delete</button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-black mt-8">Trash ({trashed.length})</h2>
          <p className="text-sm text-[#6B7280] mt-1">Deleted articles stay here for 30 days, then they are permanently removed. Revisions are kept.</p>
          {trashed.length === 0 ? (
            <p className="text-[#6B7280] mt-4">Trash is empty.</p>
          ) : (
            <ul className="space-y-3 mt-4">
              {trashed.map((row) => {
                const a = rowToArticle(row)
                const daysLeft = row.deleted_at ? Math.max(0, 30 - Math.floor((Date.now() - new Date(row.deleted_at).getTime()) / (1000 * 60 * 60 * 24))) : 30
                return (
                  <li key={row.id} className="bg-white border rounded p-4 flex flex-wrap justify-between gap-3">
                    <span>
                      <span className="font-bold">{a.title}</span>
                      <span className="text-[#6B7280] text-sm block">Deleted {row.deleted_at ? new Date(row.deleted_at).toLocaleDateString() : ''} · {daysLeft} days left · {a.category} | {a.slug}</span>
                    </span>
                    <span className="flex gap-3">
                      <button className="text-[#C8102E] underline" onClick={() => restoreFromTrash(row)}>Restore</button>
                      <button className="text-[#C8102E] underline" onClick={() => setDeleteTarget({ row, permanent: true })}>Delete permanently</button>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/article/:slug" element={<ArticlePage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
