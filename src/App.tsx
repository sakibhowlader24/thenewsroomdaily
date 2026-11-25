import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, Navigate } from 'react-router-dom'
import { ARTICLES, type Article } from './data/articles'
import { CATEGORIES, SITE_NAME, SITE_URL, categoryBySlug } from './data/site'
import { supabaseConfigured } from './lib/supabase'

function useSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title + ' | ' + SITE_NAME
    let m = document.querySelector('meta[name="description"]')
    if (m) m.setAttribute('content', description)
    const setOg = (prop: string, val: string) => { let t = document.querySelector('meta[property="' + prop + '"]'); if (!t) { t = document.createElement('meta'); t.setAttribute('property', prop); document.head.appendChild(t) } t.setAttribute('content', val) }
    setOg('og:title', title)
    setOg('og:description', description)
    setOg('og:type', 'article')
  }, [title, description])
}
function getLocalArticles(): Article[] {
  try { const raw = localStorage.getItem('tnd-articles'); if (raw) return JSON.parse(raw) as Article[] } catch { /* ignore */ }
  return ARTICLES
}
function ArticleCard({ a }: { a: Article }) {
  const cat = categoryBySlug(a.category)
  return (
    <article className="border rounded-lg p-5 bg-white shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]">{cat ? cat.name : a.category}</p>
      <h3 className="text-xl font-bold mt-2 leading-snug"><Link to={'/article/' + a.slug} className="hover:underline">{a.title}</Link></h3>
      <p className="text-[#6B7280] mt-2">{a.excerpt}</p>
      <p className="text-sm text-[#6B7280] mt-3">{a.date} | {a.author}</p>
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
          <Link to="/" aria-label="The Newsroom Daily" className="inline-flex flex-col items-start leading-none"><span className="font-serif text-[1.75rem] md:text-[2.75rem] font-black tracking-tight text-[#0F2A44]">The Newsroom</span><span className="mt-1 flex w-full items-center justify-end gap-1.5 md:mt-1.5"><span className="text-base md:text-xl font-extrabold tracking-[0.35em] text-[#C8102E]">DAILY</span><span aria-hidden="true" className="inline-block h-2.5 w-3 shrink-0 bg-[#C8102E] md:h-3 md:w-[15px]" /></span></Link>
          <nav ref={menuRef} className="relative w-[calc(100%+2rem)] min-w-0 flex items-center gap-5 whitespace-nowrap text-sm font-semibold -mx-4 px-4 md:w-auto md:mx-0 md:flex-wrap md:gap-4">
            <Link to="/" className="hover:underline">Home</Link>
            {CATEGORIES.slice(0, 2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} className="hover:underline">{c.name}</Link>))}
            {CATEGORIES.slice(2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} className="hidden hover:underline md:inline">{c.name}</Link>))}
            <Link to="/about" className="hidden hover:underline md:inline">About</Link>
            <Link to="/contact" className="hidden hover:underline md:inline">Contact</Link>
            <button type="button" aria-label="More links" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F2A44] text-white shadow-md transition-colors hover:bg-[#C8102E] active:bg-[#C8102E] md:hidden"><svg width="20" height="6" viewBox="0 0 20 6" fill="none" aria-hidden="true"><circle cx="3" cy="3" r="2.5" fill="white" /><circle cx="10" cy="3" r="2.5" fill="white" /><circle cx="17" cy="3" r="2.5" fill="white" /></svg></button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl md:hidden">
                {CATEGORIES.slice(2).map((c) => (<Link key={c.slug} to={'/category/' + c.slug} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-[#0F2A44] hover:text-[#C8102E] hover:bg-gray-50 hover:shadow-[inset_4px_0_0_0_#C8102E] active:text-[#C8102E] active:bg-gray-50 active:shadow-[inset_4px_0_0_0_#C8102E]">{c.name}</Link>))}
                <Link to="/about" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-[#0F2A44] hover:text-[#C8102E] hover:bg-gray-50 hover:shadow-[inset_4px_0_0_0_#C8102E] active:text-[#C8102E] active:bg-gray-50 active:shadow-[inset_4px_0_0_0_#C8102E]">About</Link>
                <Link to="/contact" onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-[#0F2A44] hover:text-[#C8102E] hover:bg-gray-50 hover:shadow-[inset_4px_0_0_0_#C8102E] active:text-[#C8102E] active:bg-gray-50 active:shadow-[inset_4px_0_0_0_#C8102E]">Contact</Link>
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
          <p className="flex gap-4"><Link to="/about" className="hover:underline">About</Link><Link to="/contact" className="hover:underline">Contact</Link><Link to="/privacy" className="hover:underline">Privacy Policy</Link><Link to="/admin" className="hover:underline">Admin</Link></p>
        </div>
      </footer>
    </div>
  )
}
function Home() {
  useSeo('Home', 'Clear, practical guides on GTA 6 gaming, tech how-to, money and finance, career and work, and everyday life.')
  const articles = getLocalArticles()
  const latest = articles[0]
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
      <h2 className="text-2xl font-bold mb-4">Latest articles</h2>
      <div className="grid md:grid-cols-2 gap-5 mb-8 md:mb-10">{articles.map((a) => (<ArticleCard key={a.slug} a={a} />))}</div>
      {CATEGORIES.map((c) => {
        const list = articles.filter((a) => a.category === c.slug)
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
  const articles = getLocalArticles()
  const a = articles.find((x) => x.slug === slug)
  useSeo(a ? a.title : 'Article not found', a ? a.description : 'This article could not be found.')
  if (!a) return (<div><h1 className="text-3xl font-bold">Article not found</h1><p className="mt-3"><Link to="/" className="text-[#C8102E] underline">Back to home</Link></p></div>)
  const cat = categoryBySlug(a.category)
  const related = articles.filter((x) => x.category === a.category && x.slug !== a.slug)
  return (
    <article>
      <p className="text-xs font-bold uppercase tracking-wide text-[#C8102E]"><Link to={'/category/' + a.category} className="hover:underline">{cat ? cat.name : a.category}</Link></p>
      <h1 className="text-3xl md:text-4xl font-black mt-2 leading-tight">{a.title}</h1>
      <p className="text-sm text-[#6B7280] mt-3">{a.date} | By {a.author}</p>
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
  const list = getLocalArticles().filter((a) => a.category === cat.slug)
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
  useSeo('Contact', 'Contact The Newsroom Daily with a question, a correction, or a story idea.')
  const [sent, setSent] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h1 className="text-3xl font-black">Contact</h1>
      <p className="text-[#6B7280] mt-2 mb-6">Send a question, a correction, or a story idea. This form shows a confirmation on this page. Email contact will be added later.</p>
      {sent ? (<p className="bg-green-100 border border-green-300 rounded p-4">Thank you, {name || 'reader'}. Your message was noted on this page. We will add email delivery for this form soon.</p>) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setSent(true) }}>
          <label className="block">Name<input className="w-full border rounded px-3 py-2 mt-1" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="block">Email<input type="email" className="w-full border rounded px-3 py-2 mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="block">Message<textarea className="w-full border rounded px-3 py-2 mt-1" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required /></label>
          <button type="submit" className="bg-[#C8102E] text-white font-bold px-4 py-2 rounded">Send message</button>
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
function Admin() {
  useSeo('Admin', 'Admin page for The Newsroom Daily: add and edit articles stored locally until Supabase is connected.')
  const [articles, setArticles] = useState<Article[]>(getLocalArticles())
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState('gaming')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState('')
  const [saved, setSaved] = useState('')
  const save = (list: Article[]) => { setArticles(list); localStorage.setItem('tnd-articles', JSON.stringify(list)); setSaved('Saved locally at ' + new Date().toLocaleTimeString()) }
  const startEdit = (a: Article) => { setEditing(a.slug); setTitle(a.title); setSlug(a.slug); setCategory(a.category); setExcerpt(a.excerpt); setBody(a.content.join('\n\n')) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const item: Article = { slug: slug.trim(), title: title.trim(), description: excerpt.trim(), category, date: '2026-11-25', author: SITE_NAME, excerpt: excerpt.trim(), content: body.split(/\n\s*\n/).filter(Boolean) }
    const list = editing ? articles.map((a) => (a.slug === editing ? item : a)) : [...articles, item]
    save(list); setEditing(''); setTitle(''); setSlug(''); setExcerpt(''); setBody('')
  }
  return (
    <div>
      <h1 className="text-3xl font-black">Admin</h1>
      <p className="text-[#6B7280] mt-2">Add and edit articles. Articles are saved in this browser for now. Supabase status: {supabaseConfigured ? 'connected' : 'pending, Supabase env vars are not set yet. When they are set, articles will sync to the Supabase articles table.'}</p>
      {saved && <p className="bg-green-100 border border-green-300 rounded p-3 mt-4">{saved}</p>}
      <form onSubmit={submit} className="bg-white border rounded-lg p-6 shadow-sm space-y-4 mt-6">
        <label className="block">Title<input className="w-full border rounded px-3 py-2 mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label className="block">Slug<input className="w-full border rounded px-3 py-2 mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} required /></label>
        <label className="block">Category<select className="w-full border rounded px-3 py-2 mt-1" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => (<option key={c.slug} value={c.slug}>{c.name}</option>))}</select></label>
        <label className="block">Excerpt and meta description<textarea className="w-full border rounded px-3 py-2 mt-1" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} required /></label>
        <label className="block">Content, paragraphs separated by a blank line, subheadings start with ## <textarea className="w-full border rounded px-3 py-2 mt-1" rows={8} value={body} onChange={(e) => setBody(e.target.value)} required /></label>
        <button type="submit" className="bg-[#C8102E] text-white font-bold px-4 py-2 rounded">{editing ? 'Save changes' : 'Add article'}</button>
      </form>
      <h2 className="text-2xl font-bold mt-8 mb-4">Articles ({articles.length})</h2>
      <ul className="space-y-3">{articles.map((a) => (<li key={a.slug} className="bg-white border rounded p-4 flex flex-wrap justify-between gap-3"><span><Link to={'/article/' + a.slug} className="font-bold hover:underline">{a.title}</Link><span className="text-[#6B7280] text-sm block">{a.category} | {a.slug}</span></span><span className="flex gap-3"><button className="text-[#C8102E] underline" onClick={() => startEdit(a)}>Edit</button><button className="text-[#C8102E] underline" onClick={() => save(articles.filter((x) => x.slug !== a.slug))}>Delete</button></span></li>))}</ul>
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
