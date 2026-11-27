import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  articleUrl,
  fetchArticleFeedbackCounts,
  submitArticleFeedback,
  subscribeNewsletter,
  type PublicArticle,
} from './supabase'

// ---- Font size control (article pages) ----
export type ArticleFontSize = 'small' | 'medium' | 'large'
export const FONT_SIZE_KEY = 'newsroom-article-font-size'

export function getSavedFontSize(): ArticleFontSize {
  try {
    const saved = localStorage.getItem(FONT_SIZE_KEY)
    if (saved === 'small' || saved === 'medium' || saved === 'large') return saved
  } catch {
    // ignore
  }
  return 'medium'
}

export const ARTICLE_FONT_SIZE_PX: Record<ArticleFontSize, string> = {
  small: '1rem',
  medium: '1.125rem',
  large: '1.375rem',
}

export function FontSizeControl({ size, onChange }: { size: ArticleFontSize; onChange: (next: ArticleFontSize) => void }) {
  const options: { value: ArticleFontSize; label: string; aria: string }[] = [
    { value: 'small', label: 'A-', aria: 'Small text size' },
    { value: 'medium', label: 'A', aria: 'Medium text size' },
    { value: 'large', label: 'A+', aria: 'Large text size' },
  ]
  return (
    <div data-testid="font-size-control" role="group" aria-label="Text size" className="flex items-center gap-2">
      <span className="text-sm font-bold text-[#0F2A44] dark:text-slate-100">Text size:</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.aria}
          aria-pressed={size === option.value}
          onClick={() => onChange(option.value)}
          className={size === option.value ? 'rounded-full bg-[#C8102E] px-3 py-1 text-sm font-bold text-white' : 'rounded-full border border-[#0F2A44]/20 bg-white px-3 py-1 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white'}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ---- Print / PDF (article pages) ----
export function PrintButton() {
  return (
    <button
      type="button"
      data-testid="print-button"
      onClick={() => window.print()}
      className="rounded-full border border-[#0F2A44]/20 bg-white px-3 py-1 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white"
    >
      Print / Save as PDF
    </button>
  )
}

// ---- Listen (text-to-speech, article pages) ----
type ListenStatus = 'idle' | 'playing' | 'paused'

export function ListenControl({ text, title }: { text: string; title: string }) {
  const [status, setStatus] = useState<ListenStatus>('idle')
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window)
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])
  const stop = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setStatus('idle')
  }
  const start = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(title + '. ' + text)
    utterance.lang = 'en-US'
    utterance.rate = 1
    const voices = window.speechSynthesis.getVoices()
    const voice =
      voices.find((v) => v.lang === 'en-US') ||
      voices.find((v) => v.lang.startsWith('en-US')) ||
      voices.find((v) => v.lang.startsWith('en'))
    if (voice) utterance.voice = voice
    utterance.onend = () => setStatus('idle')
    utterance.onerror = () => setStatus('idle')
    window.speechSynthesis.speak(utterance)
    setStatus('playing')
  }
  const pause = () => {
    window.speechSynthesis.pause()
    setStatus('paused')
  }
  const resume = () => {
    window.speechSynthesis.resume()
    setStatus('playing')
  }
  if (!supported) return null
  return (
    <span data-testid="listen-control" className="inline-flex flex-wrap items-center gap-2">
      {status === 'idle' ? (
        <button type="button" data-testid="listen-button" onClick={start} className="rounded-full border border-[#0F2A44]/20 bg-white px-3 py-1 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white">Listen</button>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[#0F2A44] dark:text-slate-100" role="status">{status === 'paused' ? 'Paused' : 'Listening...'}</span>
          {status === 'playing' ? (
            <button type="button" data-testid="listen-pause" onClick={pause} className="rounded-full border border-[#0F2A44]/20 bg-white px-3 py-1 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white">Pause</button>
          ) : (
            <button type="button" data-testid="listen-resume" onClick={resume} className="rounded-full border border-[#0F2A44]/20 bg-white px-3 py-1 text-sm font-bold text-[#0F2A44] hover:border-[#C8102E] hover:text-[#C8102E] dark:border-[#24405E] dark:bg-[#122840] dark:text-slate-100 dark:hover:border-[#C8102E] dark:hover:text-white">Resume</button>
          )}
          <button type="button" data-testid="listen-stop" onClick={stop} className="rounded-full bg-[#C8102E] px-3 py-1 text-sm font-bold text-white hover:bg-[#A50D26]">Stop</button>
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

// ---- Most read (homepage) ----
export function MostReadList({ articles }: { articles: PublicArticle[] }) {
  const mostRead = [...articles].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5)
  if (mostRead.length === 0) return null
  return (
    <section aria-label="Most read" className="mb-8 md:mb-10">
      <h2 className="text-2xl font-bold mb-4">Most read</h2>
      <ol className="space-y-3">
        {mostRead.map((a, i) => (
          <li key={a.slug} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-[#24405E] dark:bg-[#122840]">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C8102E] text-sm font-black text-white">{i + 1}</span>
            <span>
              <Link to={articleUrl(a)} className="font-bold leading-snug text-[#0F2A44] hover:text-[#C8102E] hover:underline dark:text-slate-100 dark:hover:text-white">{a.title}</Link>
              <span className="mt-1 block text-sm text-[#6B7280] dark:text-slate-400">{a.date}{a.views > 0 ? ' | ' + a.views + ' views' : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
