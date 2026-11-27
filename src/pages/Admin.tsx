import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, SITE_NAME } from '../data/site'
import {
  supabase,
  supabaseConfigured,
  fetchAllArticles,
  articleUrl,
  rowToArticle,
  articleToRow,
  displayDateToIso,
  fetchRevisions,
  saveRevision,
  fetchHomepageCategories,
  fetchArticleCorrections, fetchNewsletterSubscribers, formatUsDate,
  reviewArticleCorrection,
  deleteArticleCorrection,
  saveHomepageCategories,
  ALL_CATEGORY_SLUGS,
  type ArticleRow,
  type ArticleRevision,
  type PublicArticle,
  type ArticleCorrection, type NewsletterSubscriber,
} from '../lib/supabase'
import { formatBytes, uploadCoverImage } from '../lib/image'
import { countWords, useSeo } from '../App'

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

export default function Admin() {
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
  const [corrections, setCorrections] = useState<ArticleCorrection[]>([]); const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([])
  const [correctionsMsg, setCorrectionsMsg] = useState('')
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
    setCorrections(await fetchArticleCorrections()); setSubscribers(await fetchNewsletterSubscribers())
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
    setPubDate(displayDateToIso(a.date) || new Date().toISOString().slice(0, 10))
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

  const reviewCorrection = async (c: ArticleCorrection, status: 'approved' | 'rejected') => {
    setCorrectionsMsg('')
    const ok = await reviewArticleCorrection(c, status)
    if (!ok) { setCorrectionsMsg('Could not update that correction. Please try again.'); return }
    setCorrections(await fetchArticleCorrections())
    setRows(await fetchAllArticles())
    setCorrectionsMsg(status === 'approved' ? 'Correction approved. The article now shows a Corrected date.' : 'Correction rejected.')
  }
  const downloadSubscribersCsv = () => { const header = 'email,subscribed date'; const lines = subscribers.map((s) => s.email + ',"' + formatUsDate(s.created_at) + '"'); const csv = [header, ...lines].join(String.fromCharCode(10)); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'newsletter-subscribers.csv'; a.click(); URL.revokeObjectURL(url) }; const removeCorrection = async (c: ArticleCorrection) => {
    if (!window.confirm('Delete this correction report?')) return
    const ok = await deleteArticleCorrection(c.id)
    if (!ok) { setCorrectionsMsg('Could not delete that correction.'); return }
    setCorrections(await fetchArticleCorrections())
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
            <p className="text-[#006621] text-sm">thenewsroomdaily.vercel.app/{category}/{editingId ?? 'article-id'}</p>
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

      <section data-testid="admin-corrections" className="bg-white border rounded-lg p-6 shadow-sm mt-8 dark:bg-[#122840] dark:border-[#24405E]">
        <h2 className="text-xl font-black">Corrections</h2>
        <p className="text-sm text-[#6B7280] dark:text-slate-400 mt-1">Reader suggestions are reviewed here. Nothing changes on an article until you approve a correction.</p>
        {correctionsMsg && <p role="status" className="mt-2 text-sm font-bold text-[#0F2A44] dark:text-slate-100">{correctionsMsg}</p>}
        {corrections.length === 0 ? (
          <p className="mt-3 text-sm text-[#6B7280] dark:text-slate-400">No correction reports yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {corrections.map((c) => {
              const row = rows.find((r) => r.id === c.article_id)
              const art = row ? rowToArticle(row) : null
              return (
                <li key={c.id} data-testid="admin-correction" className="rounded border border-gray-200 p-4 dark:border-[#24405E]">
                  <p className="font-bold">{art ? <Link to={articleUrl(art)}>{art.title}</Link> : 'Article ' + c.article_id}</p>
                  <p className="mt-2 text-sm"><span className="font-bold">Wrong line: </span>{c.wrong_text}</p>
                  <p className="mt-1 text-sm"><span className="font-bold">Suggested correction: </span>{c.correction}</p>
                  <p className="mt-1 text-sm"><span className="font-bold">Source: </span><a href={c.source_url} target="_blank" rel="noreferrer" className="text-[#C8102E] underline break-all">{c.source_url}</a></p>
                  {(c.name || c.email) && <p className="mt-1 text-sm text-[#6B7280] dark:text-slate-400">{[c.name, c.email].filter(Boolean).join(' | ')}</p>}
                  <p className="mt-1 text-sm text-[#6B7280] dark:text-slate-400">{new Date(c.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | Status: <span className="font-bold">{c.status}</span></p>
                  {c.status === 'pending' ? (
                    <span className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => reviewCorrection(c, 'approved')} className="rounded bg-[#C8102E] px-3 py-1 text-sm font-bold text-white hover:bg-[#A50D26]">Approve</button>
                      <button onClick={() => reviewCorrection(c, 'rejected')} className="rounded border border-[#0F2A44]/20 px-3 py-1 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:text-slate-100">Reject</button>
                    </span>
                  ) : (
                    <span className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => removeCorrection(c)} className="rounded border border-[#0F2A44]/20 px-3 py-1 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:text-slate-100">Delete</button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section id="admin-subscribers" data-testid="admin-subscribers" className="bg-white border rounded-lg p-6 shadow-sm mt-8 dark:bg-[#122840] dark:border-[#24405E]"><h2 className="text-xl font-black">Subscribers</h2><p className="text-sm text-[#6B7280] dark:text-slate-400 mt-1">Newsletter subscribers, newest first.</p><p className="mt-3 text-sm font-bold text-[#0F2A44] dark:text-slate-100">Total subscribers: {subscribers.length}</p><button type="button" onClick={downloadSubscribersCsv} className="mt-3 rounded bg-[#C8102E] px-3 py-1 text-sm font-bold text-white hover:bg-[#A50D26]">Download CSV</button>{subscribers.length === 0 ? (<p className="mt-3 text-sm text-[#6B7280] dark:text-slate-400">No subscribers yet.</p>) : (<ul className="mt-3 space-y-3">{subscribers.map((s) => (<li key={s.email} className="rounded border border-gray-200 p-4 dark:border-[#24405E]"><p className="font-bold">{s.email}</p><p className="mt-1 text-sm text-[#6B7280] dark:text-slate-400">Subscribed: {formatUsDate(s.created_at)}</p></li>))}</ul>)}</section><div className="flex gap-2 mt-8">
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
                      <Link to={articleUrl(a)} className="font-bold hover:underline">{a.title}</Link>
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
            <p className="text-[#6B7280] mt-4"> Trash is empty.</p>
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
