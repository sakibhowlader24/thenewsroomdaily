import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, Navigate, useSearchParams } from 'react-router-dom'
import { ARTICLES } from './data/articles'
import { CATEGORIES, SITE_NAME, SITE_URL, categoryBySlug } from './data/site'
import {
  supabase,
  supabaseConfigured,
  fetchPublishedArticles,
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

function useSeo(title: string, description: string) {
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

function useArticles(): PublicArticle[] {
  const [articles, setArticles] = useState<PublicArticle[]>(ARTICLES as PublicArticle[])
  useEffect(() => {
    let live = true
    fetchPublishedArticles().then((list) => { if (live) setArticles(list) })
    return () => { live = false }
  }, [])
  return articles
}

function countWords(text: string): number {
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
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <Link to="/" aria-label="The Newsroom Daily" className="inline-flex flex-col items-start leading-none">
            <span className="font-serif text-[1.75rem] md:text-[2.75rem] font-black tracking-tight text-[#0F2A44]">The Newsroom</span>
            <span className="mt-1 flex w-full items-center justify-end gap-1.5 md:mt-1.5">
              <span className="text-base md:text-xl font-extrabold tracking-[0.35em] text-[#C8102E]">DAILY</span>
              <span aria-hidden="true" className="inline-block h-2.5 w-3 shrink-0 bg-[#C8102E] md:h-3 md:w-[15px]" />
            </span>
          </Link>
          <nav ref={menuRef} className="relative w-[calc(100%+2rem)] min-w-0 flex items-center gap-5 whitespace-nowrap overflow-x-auto text-sm md:w-auto md:overflow-visible">
            <Link to="/" className="hover:underline">Home</Link>
            {CATEGORIES.slice(0, 2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} className="hover:underline">{c.name}</Link>))}
            {CATEGORIES.slice(2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} className="hidden hover:underline md:inline">{c.name}</Link>))}
            <Link to="/about" className="hidden hover:underline md:inline">About</Link>
            <Link to="/contact" className="hidden hover:underline md:inline">Contact</Link>
            <button type="button" aria-label={menuOpen ? 'Close menu' : 'More links'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="ml-auto font-bold hover:underline md:ml-0">More</button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 divide-y divide-gray-100 overflow-hidden rounded-lg border bg-white shadow-lg">
                {CATEGORIES.slice(2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44]">{c.name}</Link>))}
                <Link to="/about" onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44]">About</Link>
                <Link to="/contact" onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44]">Contact</Link>
                <Link to="/privacy" onClick={() => setMenuOpen(false)} className="menu-link block px-4 py-3 text-[#0F2A44]">Privacy Policy</Link>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">{children}</main>
      <footer className="bg-[#0F2A44] text-white">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="font-bold">{SITE_NAME}</p>
          <nav className="flex flex-wrap gap-5 text-sm">
            <Link to="/about" className="hover:underline">About</Link>
            <Link to="/contact" className="hover:underline">Contact</Link>
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/admin" className="hover:underline">Admin</Link>
          </nav>
          <p className="text-sm text-white/70">© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function Home() {
  const articles = useArticles()
  const [enabledCategories, setEnabledCategories] = useState<string[]>(ALL_CATEGORY_SLUGS)
  useEffect(() => { fetchHomepageCategories().then(setEnabledCategories) }, [])
  useSeo('Clear, practical guides for gaming, tech, money, career and everyday life', 'The Newsroom Daily publishes clear, practical guides for gaming, tech how-tos, money, career and everyday life.')
  const visible = articles.filter((a) => enabledCategories.includes(a.category))
  const featured = visible.filter((a) => a.is_featured)
  const latest = visible[0]
  const byCategory = (slug: string) => visible.filter((a) => a.category === slug).slice(0, 4)
  const latestList = visible.filter((a) => !a.is_featured && a.slug !== latest?.slug)
  return (
    <div>
      {latest && (
        <section className="bg-[#0F2A44] text-white rounded-lg p-6 md:p-10">
          <p className="text-xs font-bold uppercase tracking-wide text-[#FCA5A5]">Latest</p>
          <h1 className="font-serif text-3xl md:text-5xl font-black leading-tight mt-3"><Link to={'/article/' + latest.slug} className="hover:underline">{latest.title}</Link></h1>
          <p className="text-white/80 mt-4 max-w-2xl">{latest.excerpt}</p>
          <p className="mt-5"><Link to={'/article/' + latest.slug} className="inline-block bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26]">Read article</Link></p>
        </section>
      )}
      {featured.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-black">Featured</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
            {featured.map((a) => (<ArticleCard key={a.slug} a={a} />))}
          </div>
        </section>
      )}
      <h2 className="text-2xl font-black mt-10">Latest articles</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
        {latestList.map((a) => (<ArticleCard key={a.slug} a={a} />))}
      </div>
      {CATEGORIES.filter((c) => enabledCategories.includes(c.slug)).map((cat) => {
        const list = byCategory(cat.slug)
        if (list.length === 0) return null
        return (
          <section key={cat.slug} className="mt-10">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-black">{cat.name}</h2>
              <Link to={'/category/' + cat.slug} className="text-[#C8102E] font-bold text-sm">View all</Link>
            </div>
            <p className="text-[#6B7280] mt-1">{cat.description}</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
              {list.map((a) => (<ArticleCard key={a.slug} a={a} />))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ArticlePage() {
  const { slug } = useParams()
  const articles = useArticles()
  const article = articles.find((a) => a.slug === slug)
  useSeo(article ? article.title : 'Article not found', article ? article.description : 'The article you are looking for does not exist.')
  useEffect(() => {
    if (!article) return
    const key = 'viewed-' + article.slug
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      void incrementArticleViews(article.slug)
    }
  }, [article?.slug])
  if (!article) {
    return (
      <div>
        <h1 className="text-3xl font-black">Article not found</h1>
        <p className="mt-3"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p>
      </div>
    )
  }
  const related = articles.filter((a) => a.slug !== article.slug && a.category === article.category).slice(0, 4)
  const words = countWords(article.content.join(' '))
  const readMinutes = Math.max(1, Math.ceil(words / 200))
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">{categoryBySlug(article.category)?.name || article.category}</p>
      <h1 className="font-serif text-3xl md:text-5xl font-black leading-tight mt-3">{article.title}</h1>
      <p className="text-[#6B7280] mt-3">{article.date} | {article.author} | {readMinutes} min read{article.views > 0 ? ' | ' + article.views + ' views' : ''}</p>
      {article.cover && (<img src={article.cover} alt={article.cover_alt || article.title} className="w-full rounded-lg mt-6" />)}
      <div className="mt-6 space-y-5 text-lg leading-relaxed">
        {article.content.map((para, i) => (para.startsWith('## ') ? (<h2 key={i} className="font-serif text-2xl font-black pt-4">{para.slice(3)}</h2>) : para.startsWith('# ') ? (<h2 key={i} className="font-serif text-2xl font-black pt-4">{para.slice(2)}</h2>) : (<p key={i}>{para}</p>)))}
      </div>
      <p className="text-sm text-[#6B7280] mt-8">Sources: {SITE_NAME} editorial guides and official product documentation. Prices and availability change often, so check the official store before you buy.</p>
      <p className="mt-6"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p>
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-black">More from {categoryBySlug(article.category)?.name || article.category}</h2>
          <div className="grid md:grid-cols-2 gap-5 mt-4">
            {related.map((a) => (<ArticleCard key={a.slug} a={a} />))}
          </div>
        </section>
      )}
    </article>
  )
}

function CategoryPage() {
  const { slug } = useParams()
  const articles = useArticles()
  const cat = categoryBySlug(slug || '')
  const list = articles.filter((a) => a.category === slug)
  useSeo(cat ? cat.name : 'Category', cat ? cat.description : 'Articles in this category.')
  if (!cat) {
    return (
      <div>
        <h1 className="text-3xl font-black">Category not found</h1>
        <p className="mt-3"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p>
      </div>
    )
  }
  return (
    <div>
      <h1 className="font-serif text-3xl md:text-5xl font-black leading-tight">{cat.name}</h1>
      <p className="text-[#6B7280] mt-3">{cat.description}</p>
      {list.length === 0 ? (
        <p className="mt-6">No articles in this category yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {list.map((a) => (<ArticleCard key={a.slug} a={a} />))}
        </div>
      )}
    </div>
  )
}

function About() {
  useSeo('About', 'About The Newsroom Daily: a small, independent news and guides site.')
  return (
    <div>
      <h1 className="font-serif text-3xl md:text-5xl font-black leading-tight">About The Newsroom Daily</h1>
      <div className="mt-6 space-y-5 text-lg leading-relaxed">
        <p>We are a small, independent news and guides site. We write clear, practical articles about gaming, tech how-tos, money, career and everyday life.</p>
        <p>We write in our own words, keep paragraphs short, and check facts before we publish. Money and health articles are general education, not personal advice. You can find us at {SITE_URL}.</p>
        <p>Questions or tips? Visit the <Link to="/contact" className="text-[#C8102E] underline">contact page</Link>.</p>
      </div>
    </div>
  )
}

function Contact() {
  const [params] = useSearchParams()
  const sent = params.get('sent') === '1'
  useSeo('Contact', 'Contact The Newsroom Daily: send a question, correction or tip.')
  return (
    <div>
      <h1 className="font-serif text-3xl md:text-5xl font-black leading-tight">Contact</h1>
      <p className="mt-4 text-lg leading-relaxed">Questions, corrections or tips? Send us a message and we will get back to you.</p>
      {sent ? (
        <p className="bg-green-100 border border-green-300 text-green-800 rounded p-4 mt-6">Thank you. Your message has been sent.</p>
      ) : (
        <form action="https://formsubmit.co/rtvsakib@gmail.com" method="POST" className="space-y-4 mt-6 max-w-lg">
          <input type="hidden" name="_subject" value="New contact message - The Newsroom Daily" />
          <input type="hidden" name="_next" value={SITE_URL + '/contact?sent=1'} />
          <input type="hidden" name="_captcha" value="false" />
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
            <textarea name="message" rows={5} required className="w-full border rounded p-3" />
          </div>
          <button className="bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26]">Send message</button>
        </form>
      )}
    </div>
  )
}

function Privacy() {
  useSeo('Privacy Policy', 'Privacy Policy for The Newsroom Daily. We collect only the information you choose to share with us.')
  return (
    <div>
      <h1 className="font-serif text-3xl md:text-5xl font-black leading-tight">Privacy Policy</h1>
      <p className="mt-4">Last updated: 25 November 2026.</p>
      <div className="mt-6 space-y-5 leading-relaxed">
        <p>We run a small, independent news and guides site. We collect only the information you choose to share with us, for example when you send a message through our contact form. We use that information only to reply to you.</p>
        <p>We use Supabase to store published articles and to sign in the site admin. We do not sell personal information and we do not show third-party advertising on this site.</p>
        <p>If you have a privacy question, contact us through the <Link to="/contact" className="text-[#C8102E] underline">contact page</Link>.</p>
      </div>
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
    description: s.meta.trim(),
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
  const [user, setUser] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [isRecovery, setIsRecovery] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetPasswordError, setResetPasswordError] = useState('')
  const [resetPasswordDone, setResetPasswordDone] = useState(false)
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
  const [pubDate, setPubDate] = useState(new Date().toISOString().slice(0, 10))
  const [scheduledAt, setScheduledAt] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [status, setStatus] = useState('published')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingViews, setEditingViews] = useState(0)
  const [editingDeletedAt, setEditingDeletedAt] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
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
  useSeo('Admin', 'Admin page for The Newsroom Daily: add and edit articles in Supabase.')

  const formSnapshotRef = useRef<AdminSnapshot & { dirty: boolean }>({
    title: '', slug: '', category: 'gaming', status: 'published', excerpt: '', meta: '', body: '', cover: '', coverAlt: '', pubDate: new Date().toISOString().slice(0, 10), scheduledAt: '', isFeatured: false, editingId: null, editingViews: 0, editingDeletedAt: null, dirty: false,
  })
  const savingRef = useRef(false)
  useEffect(() => {
    formSnapshotRef.current = { title, slug, category, status, excerpt, meta, body, cover, coverAlt, pubDate, scheduledAt, isFeatured, editingId, editingViews, editingDeletedAt, dirty }
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isRecovery = window.location.hash.includes('type=recovery') || params.get('new_password') === '1'
    if (isRecovery) setIsRecovery(true)
    if (!supabase) { setAuthChecked(true); return }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user.email ?? null); setAuthChecked(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user.email ?? null)
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const load = async () => {
    if (!supabase) return
    setLoading(true)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('articles').delete().lt('deleted_at', cutoff)
    const all = await fetchAllArticles()
    setRows(all)
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthError(error.message)
    else setUser(data.user.email ?? null)
  }

  const sendResetEmail = async () => {
    setResetError('')
    setResetSent(false)
    if (!supabase) { setResetError('Supabase is not configured.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail('rtvsakib@gmail.com', { redirectTo: 'https://thenewsroomdaily.vercel.app/admin' })
    if (error) setResetError(error.message)
    else setResetSent(true)
  }

  const setNewPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setResetPasswordError('')
    if (newPassword.length < 8) { setResetPasswordError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'); return }
    if (newPassword !== confirmPassword) { setResetPasswordError('দুটি পাসওয়ার্ড মিলছে না।'); return }
    if (!supabase) { setResetPasswordError('Supabase is not configured.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setResetPasswordError(error.message); return }
    setResetPasswordDone(true)
    window.history.replaceState(null, '', '/admin')
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }

  const resetForm = () => {
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
    setEditingId(null)
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
    setTitle(a.title)
    setSlug(a.slug)
    setCategory(a.category)
    setStatus(a.status || 'published')
    setExcerpt(a.excerpt)
    setMeta(a.description)
    setCover(a.cover || '')
    setCoverAlt(a.cover_alt || '')
    setPubDate(a.date || new Date().toISOString().slice(0, 10))
    setScheduledAt(a.scheduled_at ? a.scheduled_at.slice(0, 16) : '')
    setIsFeatured(a.is_featured)
    setBody(a.content.join('\n\n'))
    setEditingId(row.id)
    setEditingViews(a.views)
    setEditingDeletedAt(a.deleted_at ?? null)
    setSaved(false)
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
    if (!supabase) { setFormError('Supabase is not configured.'); return }
    setSaved(false)
    setFormError('')
    const s = formSnapshotRef.current
    if (!s.title.trim() || !s.slug.trim()) { setFormError('Title and slug are required.'); return }
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
    setSaved(true)
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
      else setSaved(true)
    } else {
      const { error } = await supabase.from('articles').update({ deleted_at: new Date().toISOString() }).eq('id', row.id)
      if (error) setFormError(error.message)
    }
    load()
  }

  const restoreFromTrash = async (row: ArticleRow) => {
    if (!supabase) return
    const { error } = await supabase.from('articles').update({ deleted_at: null }).eq('id', row.id)
    if (error) setFormError(error.message)
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
            <p className="bg-green-100 border border-green-300 text-green-800 rounded p-4 mt-4">পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন আপনি নতুন পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।</p>
            <button onClick={() => setIsRecovery(false)} className="mt-4 bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26]">আর্টিকেল ম্যানেজারে যান</button>
          </div>
        ) : (
          <form onSubmit={setNewPasswordSubmit} className="space-y-4 mt-4 max-w-md">
            <div>
              <label className="block font-bold mb-1">নতুন পাসওয়ার্ড</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border rounded p-3" />
            </div>
            <div>
              <label className="block font-bold mb-1">নতুন পাসওয়ার্ড নিশ্চিত করুন</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border rounded p-3" />
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
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-3" />
          </div>
          <div>
            <label className="block font-bold mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded p-3" />
          </div>
          {authError && <p className="bg-red-100 border border-red-300 text-red-800 rounded p-3">{authError}</p>}
          <button className="bg-[#C8102E] text-white font-bold px-5 py-3 rounded hover:bg-[#A50D26]">Sign in</button>
          <button type="button" onClick={sendResetEmail} className="ml-3 underline text-[#C8102E]">পাসওয়ার্ড ভুলে গেছেন?</button>
          {resetSent && <p className="bg-green-100 border border-green-300 text-green-800 rounded p-3">পাসওয়ার্ড রিসেট লিঙ্ক rtvsakib@gmail.com-এ পাঠানো হয়েছে। ইনবক্স (এবং স্প্যাম ফোল্ডার) চেক করুন।</p>}
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-black">Admin</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[#6B7280]">Signed in as {user}</span>
          <button onClick={signOut} className="underline text-[#C8102E]">Log out</button>
        </div>
      </div>
      <p className="mt-3">Add and edit articles. Articles are saved to the Supabase articles table. Supabase status: {supabaseConfigured ? 'connected' : 'not configured'}.</p>
      {saved && <p className="bg-green-100 border border-green-300 text-green-800 rounded p-3 mt-4">Saved.</p>}
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

      <form onSubmit={submit} className="space-y-4 mt-8">
        <h2 className="text-2xl font-black">{editingId ? 'Edit article' : 'New article'}</h2>
        <p className="text-sm text-[#6B7280]">{autosaveStatus || (dirty ? 'Unsaved changes — autosave runs every 5 seconds while you edit a saved article.' : 'Autosave runs every 5 seconds while you edit a saved article.')}</p>
        <div>
          <label className="block font-bold mb-1">Title</label>
          <input required value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
        </div>
        <div>
          <label className="block font-bold mb-1">Slug</label>
          <input required value={slug} onChange={(e) => { setSlug(e.target.value); setDirty(true) }} className="w-full border rounded p-3" />
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
