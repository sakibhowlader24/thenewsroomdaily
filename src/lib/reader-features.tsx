import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  articleUrl,
  fetchArticleFeedbackCounts,
  submitArticleFeedback,
  submitArticleCorrection,
  subscribeNewsletter,
  type PublicArticle,
} from './supabase'

// ---- Font size control (article pages): 90 / 100 / 110 / 125 / 150 percent ----
// The storage key is unchanged ('newsroom-article-font-size') so readers keep
// their setting. Old values map to the closest new step: small -> 90, medium -> 100, large -> 125.
export type ArticleFontSize = '90' | '100' | '110' | '125' | '150'
export const FONT_SIZE_KEY = 'newsroom-article-font-size'
export const FONT_SIZE_STEPS: ArticleFontSize[] = ['90', '100', '110', '125', '150']

export function getSavedFontSize(): ArticleFontSize {
  try {
    const saved = localStorage.getItem(FONT_SIZE_KEY)
    if (saved === 'small') return '90'
    if (saved === 'medium') return '100'
    if (saved === 'large') return '125'
    if (saved === '90' || saved === '100' || saved === '110' || saved === '125' || saved === '150') return saved
    if (saved === '90%' || saved === '100%' || saved === '110%' || saved === '125%' || saved === '150%') return saved.slice(0, -1) as ArticleFontSize
  } catch {
    // ignore
  }
  return '100'
}

export const ARTICLE_FONT_SIZE_PX: Record<ArticleFontSize, string> = {
  '90': '1rem',
  '100': '1.125rem',
  '110': '1.25rem',
  '125': '1.406rem',
  '150': '1.688rem',
}

const iconButtonClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0F2A44]/20 bg-white text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] disabled:opacity-40 dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white'

export function FontSizeControl({ size, onChange }: { size: ArticleFontSize; onChange: (next: ArticleFontSize) => void }) {
  const index = FONT_SIZE_STEPS.indexOf(size)
  const safeIndex = index < 0 ? 1 : index
  const decrease = () => { if (safeIndex > 0) onChange(FONT_SIZE_STEPS[safeIndex - 1]) }
  const increase = () => { if (safeIndex < FONT_SIZE_STEPS.length - 1) onChange(FONT_SIZE_STEPS[safeIndex + 1]) }
  return (
    <span data-testid="font-size-control" role="group" aria-label="Text size" className="inline-flex shrink-0 items-center gap-1">
      <button type="button" data-testid="font-size-decrease" aria-label="Decrease text size" disabled={safeIndex <= 0} onClick={decrease} className={iconButtonClass}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M8 11h6" /></svg>
      </button>
      <span data-testid="font-size-percent" aria-live="polite" className="w-10 shrink-0 text-center text-xs font-bold text-[#C8102E] dark:text-[#FF6B81]">{size}%</span>
      <button type="button" data-testid="font-size-increase" aria-label="Increase text size" disabled={safeIndex >= FONT_SIZE_STEPS.length - 1} onClick={increase} className={iconButtonClass}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M11 8v6M8 11h6" /></svg>
      </button>
    </span>
  )
}

// ---- Print / PDF (article pages): icon-only button ----
export function PrintButton() {
  return (
    <button type="button" data-testid="print-button" onClick={() => window.print()} aria-label="Print / Save as PDF" title="Print / Save as PDF" className={iconButtonClass}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>
    </button>
  )
}

// ---- Listen (text-to-speech, article pages) ----
// Mobile browsers load speech voices asynchronously: getVoices() is often empty
// on the first tap, and speaking before a voice is ready (or cancelling and
// speaking in the same tick) can kill the utterance silently. So we wait for
// voiceschanged (with a timeout), cancel cleanly before starting, prefer an
// en-US voice, and speak the article in short chunks, one after another.
type ListenStatus = 'idle' | 'playing' | 'paused'

export function splitSpeechChunks(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [clean]
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    const part = sentence.trim()
    if (!part) continue
    if (current && (current + ' ' + part).length > 220) {
      chunks.push(current.trim())
      current = part
    } else {
      current = current ? current + ' ' + part : part
    }
    while (current.length > 220) {
      chunks.push(current.slice(0, 220).trim())
      current = current.slice(220).trim()
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

function waitForVoices(synth: SpeechSynthesis): Promise<void> {
  return new Promise((resolve) => {
    if (synth.getVoices().length > 0) { resolve(); return }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      synth.removeEventListener('voiceschanged', finish)
      resolve()
    }
    synth.addEventListener('voiceschanged', finish)
    window.setTimeout(finish, 2000)
  })
}

function pickEnUsVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices()
  if (voices.length === 0) return null
  return (
    voices.find((v) => v.lang === 'en-US') ||
    voices.find((v) => v.lang.startsWith('en-US')) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0]
  )
}

export function ListenControl({ text, title }: { text: string; title: string }) {
  const [status, setStatus] = useState<ListenStatus>('idle')
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState('')
  const runIdRef = useRef(0)
  const chunkIndexRef = useRef(0)
  const chunksRef = useRef<string[]>([])
  const statusRef = useRef<ListenStatus>('idle')
  const setListenStatus = (next: ListenStatus) => { statusRef.current = next; setStatus(next) }
  useEffect(() => {
    const ok = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
    setSupported(ok)
    if (ok) { try { window.speechSynthesis.getVoices() } catch { /* ignore */ } }
    return () => {
      runIdRef.current += 1
      if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel() } catch { /* ignore */ } }
    }
  }, [])
  const stop = () => {
    runIdRef.current += 1
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel() } catch { /* ignore */ } }
    setError('')
    setListenStatus('idle')
  }
  const speakChunk = (index: number, run: number) => {
    if (run !== runIdRef.current) return
    const chunks = chunksRef.current
    if (index >= chunks.length) { setListenStatus('idle'); return }
    chunkIndexRef.current = index
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(chunks[index])
    utterance.lang = 'en-US'
    utterance.rate = 1
    const voice = pickEnUsVoice(synth)
    if (voice) utterance.voice = voice
    utterance.onend = () => { if (run === runIdRef.current) speakChunk(index + 1, run) }
    utterance.onerror = (e) => {
      if (run !== runIdRef.current) return
      if (e.error === 'canceled' || e.error === 'interrupted') return
      setError('Could not play audio. Please try again.')
      setListenStatus('idle')
    }
    try { synth.speak(utterance) } catch {
      setError('Could not play audio. Please try again.')
      setListenStatus('idle')
    }
  }
  const start = async () => {
    if (!('speechSynthesis' in window)) { setError('Listen is not available in this browser.'); return }
    const synth = window.speechSynthesis
    const run = runIdRef.current + 1
    runIdRef.current = run
    try { synth.cancel() } catch { /* ignore */ }
    setError('')
    setListenStatus('playing')
    try {
      await waitForVoices(synth)
      if (run !== runIdRef.current) return
      const chunks = splitSpeechChunks(title + '. ' + text)
      if (chunks.length === 0) { setListenStatus('idle'); return }
      chunksRef.current = chunks
      chunkIndexRef.current = 0
      speakChunk(0, run)
    } catch {
      if (run !== runIdRef.current) return
      setError('Could not play audio. Please try again.')
      setListenStatus('idle')
    }
  }
  const pause = () => {
    try { window.speechSynthesis.pause() } catch { /* ignore */ }
    setListenStatus('paused')
  }
  const resume = () => {
    try { window.speechSynthesis.resume() } catch { /* ignore */ }
    setListenStatus('playing')
    window.setTimeout(() => {
      if (runIdRef.current && statusRef.current === 'playing' && !window.speechSynthesis.speaking && chunksRef.current.length > 0) {
        speakChunk(chunkIndexRef.current, runIdRef.current)
      }
    }, 100)
  }
  if (!supported) {
    return (
      <span data-testid="listen-control" className="inline-flex shrink-0 items-center gap-1.5">
        <button type="button" disabled aria-label="Listen is not available in this browser" title="Listen is not available in this browser" className={iconButtonClass}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <span role="alert" className="text-xs font-bold text-[#C8102E] dark:text-[#FF6B81]">Audio unavailable</span>
      </span>
    )
  }
  return (
    <span data-testid="listen-control" className="inline-flex shrink-0 items-center gap-1.5">
      {status === 'idle' ? (
        <span className="inline-flex items-center gap-1.5">
          <button type="button" data-testid="listen-button" onClick={start} aria-label="Listen to this article" title="Listen" className={iconButtonClass}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </button>
          {error && <span role="alert" className="text-xs font-bold text-[#C8102E] dark:text-[#FF6B81]">{error}</span>}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          <span className="text-xs font-bold text-[#0F2A44] dark:text-slate-100" role="status">{status === 'paused' ? 'Paused' : 'Listening...'}</span>
          {status === 'playing' ? (
            <button type="button" data-testid="listen-pause" onClick={pause} aria-label="Pause" title="Pause" className={iconButtonClass}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            </button>
          ) : (
            <button type="button" data-testid="listen-resume" onClick={resume} aria-label="Resume" title="Resume" className={iconButtonClass}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
          )}
          <button type="button" data-testid="listen-stop" onClick={stop} aria-label="Stop listening" title="Stop" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8102E] text-white hover:bg-[#A50D26]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
          </button>
        </span>
      )}
    </span>
  )
}

// ---- Newsletter signup (footer and homepage) ----
export function NewsletterForm({ tone = 'dark' }: { tone?: 'light' | 'dark' }) {
  const inputId = useId()
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setSaving(true)
    const result = await subscribeNewsletter(email)
    setSaving(false)
    if (result.ok) setDone(true)
    else setError(result.error || 'Could not subscribe. Please try again.')
  }
  if (done) {
    return (
      <p role="status" data-testid="newsletter-success" className="rounded border border-green-300 bg-green-100 p-3 text-sm font-bold text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100">Thanks for subscribing! You will get our latest guides in your inbox.</p>
    )
  }
  return (
    <form data-testid="newsletter-form" onSubmit={submit} className="mt-3">
      <label htmlFor={inputId} className={tone === 'light' ? 'block text-sm font-bold text-slate-100' : 'block text-sm font-bold text-[#0F2A44] dark:text-slate-100'}>Get our latest guides by email</label>
      <span className="mt-2 flex flex-wrap gap-2">
        <input id={inputId} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-[#1F2937] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100" />
        <button type="submit" disabled={saving} className="rounded bg-[#C8102E] px-4 py-2 text-sm font-bold text-white hover:bg-[#A50D26] disabled:opacity-60">{saving ? 'Subscribing...' : 'Subscribe'}</button>
      </span>
      <span className={tone === 'light' ? 'mt-2 block text-xs text-slate-300' : 'mt-2 block text-xs text-[#6B7280] dark:text-slate-400'}>No spam. Unsubscribe anytime.</span>
      {error && <span role="alert" className="mt-2 block rounded border border-red-300 bg-red-100 p-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</span>}
    </form>
  )
}

// ---- Helpful vote (article pages) ----
export function ArticleFeedback({ articleId }: { articleId: number }) {
  const [helpfulCount, setHelpfulCount] = useState(0)
  const [notHelpfulCount, setNotHelpfulCount] = useState(0)
  const [voted, setVoted] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const storageKey = 'newsroom-feedback-' + articleId
  useEffect(() => {
    let live = true
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === 'yes') setVoted(true)
      else if (saved === 'no') setVoted(false)
    } catch {
      // ignore
    }
    fetchArticleFeedbackCounts(articleId)
      .then((counts) => {
        if (live) {
          setHelpfulCount(counts.helpful)
          setNotHelpfulCount(counts.notHelpful)
        }
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [articleId, storageKey])
  const vote = async (helpful: boolean) => {
    if (voted !== null || saving) return
    setSaving(true)
    setError('')
    const ok = await submitArticleFeedback(articleId, helpful)
    setSaving(false)
    if (!ok) {
      setError('Could not save your vote. Please try again.')
      return
    }
    try {
      localStorage.setItem(storageKey, helpful ? 'yes' : 'no')
    } catch {
      // ignore
    }
    setVoted(helpful)
    const counts = await fetchArticleFeedbackCounts(articleId)
    setHelpfulCount(counts.helpful)
    setNotHelpfulCount(counts.notHelpful)
  }
  const helpfulText = helpfulCount === 1 ? '1 reader found this helpful' : helpfulCount + ' readers found this helpful'
  return (
    <section data-testid="article-feedback" aria-label="Was this article helpful?" className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-[#24405E] dark:bg-[#122840]">
      <h2 className="font-serif text-xl font-bold text-[#0F2A44] dark:text-white">Was this article helpful?</h2>
      {voted === null ? (
        <span className="mt-3 flex flex-wrap gap-2">
          <button type="button" data-testid="feedback-yes" disabled={saving} onClick={() => vote(true)} className="rounded bg-[#C8102E] px-4 py-2 text-sm font-bold text-white hover:bg-[#A50D26] disabled:opacity-60">Yes</button>
          <button type="button" data-testid="feedback-no" disabled={saving} onClick={() => vote(false)} className="rounded border border-[#0F2A44]/20 px-4 py-2 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white">No</button>
        </span>
      ) : (
        <p role="status" className="mt-3 text-sm font-bold text-[#0F2A44] dark:text-slate-100">Thanks for your feedback!</p>
      )}
      <p data-testid="feedback-counts" className="mt-2 text-sm text-[#6B7280] dark:text-slate-400">{helpfulText}{notHelpfulCount > 0 ? ' | ' + notHelpfulCount + (notHelpfulCount === 1 ? ' reader did not find it helpful' : ' readers did not find it helpful') : ''}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}

// ---- Report an error (moderated corrections, article pages) ----
export function ReportCorrectionForm({ articleId }: { articleId: number }) {
  const [open, setOpen] = useState(false)
  const [wrongText, setWrongText] = useState('')
  const [correction, setCorrection] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!wrongText.trim()) { setError('Paste the line that is wrong.'); return }
    if (!correction.trim()) { setError('Tell us what the correct information is.'); return }
    if (!sourceUrl.trim()) { setError('A source link is required. Paste a link that supports the correction.'); return }
    let parsed: URL | null = null
    try { parsed = new URL(sourceUrl.trim()) } catch { parsed = null }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) { setError('Enter a valid source link starting with http:// or https://'); return }
    setSaving(true)
    const result = await submitArticleCorrection({ article_id: articleId, wrong_text: wrongText, correction, source_url: sourceUrl, name, email })
    setSaving(false)
    if (!result.ok) { setError(result.error || 'Could not send your correction. Please try again.'); return }
    setDone(true)
  }
  return (
    <section data-testid="report-error" aria-label="Report an error" className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-[#24405E] dark:bg-[#122840] print-hidden">
      <h2 className="font-serif text-xl font-bold text-[#0F2A44] dark:text-white">Report an error</h2>
      <p className="mt-1 text-sm text-[#6B7280] dark:text-slate-400">Spotted a mistake? Tell us what is wrong. Corrections are reviewed before anything changes.</p>
      {done ? (
        <p role="status" data-testid="report-error-success" className="mt-3 rounded border border-green-300 bg-green-100 p-3 text-sm font-bold text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100">Thanks! Your correction has been submitted for review. Nothing changes on the article until the owner checks it.</p>
      ) : open ? (
        <form data-testid="report-error-form" onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#0F2A44] dark:text-slate-100">Which part is wrong?</label>
            <textarea data-testid="report-error-wrong" rows={3} value={wrongText} onChange={(e) => setWrongText(e.target.value)} placeholder="Paste the wrong line from the article" className="mt-1 w-full rounded border border-gray-300 bg-white p-3 text-sm text-[#1F2937] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#0F2A44] dark:text-slate-100">What is the correct information?</label>
            <textarea data-testid="report-error-correction" rows={3} value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Write the correct information" className="mt-1 w-full rounded border border-gray-300 bg-white p-3 text-sm text-[#1F2937] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#0F2A44] dark:text-slate-100">Source link (required)</label>
            <input data-testid="report-error-source" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://example.com/source" className="mt-1 w-full rounded border border-gray-300 bg-white p-3 text-sm text-[#1F2937] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-[#0F2A44] dark:text-slate-100">Name (optional)</label>
              <input data-testid="report-error-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="mt-1 w-full rounded border border-gray-300 bg-white p-3 text-sm text-[#1F2937] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#0F2A44] dark:text-slate-100">Email (optional)</label>
              <input data-testid="report-error-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded border border-gray-300 bg-white p-3 text-sm text-[#1F2937] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100" />
            </div>
          </div>
          {error && <p role="alert" data-testid="report-error-error" className="rounded border border-red-300 bg-red-100 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</p>}
          <p className="text-xs text-[#6B7280] dark:text-slate-400">Corrections are reviewed before anything changes. Nothing you submit changes the article directly.</p>
          <span className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="rounded bg-[#C8102E] px-4 py-2 text-sm font-bold text-white hover:bg-[#A50D26] disabled:opacity-60">{saving ? 'Sending...' : 'Send correction'}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-[#0F2A44]/20 px-4 py-2 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white">Cancel</button>
          </span>
        </form>
      ) : (
        <button type="button" data-testid="report-error-button" onClick={() => setOpen(true)} className="mt-3 rounded border border-[#C8102E] px-4 py-2 text-sm font-bold text-[#C8102E] hover:bg-[#C8102E] hover:text-white dark:text-white">Report an error</button>
      )}
    </section>
  )
}

// ---- Most read (homepage) ----
export function MostReadList({ articles }: { articles: PublicArticle[] }) {
  const mostRead = [...articles].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5)
  if (mostRead.length === 0) return null
  return (
    <section aria-label="Most read" className="mb-12 md:mb-16 pb-8 md:pb-10 border-b border-gray-200 dark:border-[#24405E]">
      <div className="mb-4"><h2 className="text-lg font-bold uppercase tracking-wide text-[#0F2A44] dark:text-slate-100">Most read</h2><div className="mt-2 h-[3px] w-10 bg-[#C8102E]" /></div>
      <ol className="grid gap-x-8 gap-y-4 md:grid-cols-2">
        {mostRead.map((a, i) => (
          <li key={a.slug} className="flex items-start gap-4">
            <span aria-hidden="true" className="font-serif text-3xl md:text-4xl font-black leading-none text-[#C8102E]">{i + 1}</span>
            <span>
              <Link to={articleUrl(a)} className="text-[18px] font-bold leading-snug text-[#0F2A44] hover:text-[#C8102E] hover:underline dark:text-slate-100 dark:hover:text-white">{a.title}</Link>
              <span className="mt-1 block text-xs text-[#6B7280] dark:text-slate-400">{a.views > 0 ? a.views + ' views' : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
