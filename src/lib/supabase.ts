import { createClient } from '@supabase/supabase-js'
import { ARTICLES, type Article } from '../data/articles'
import { CATEGORIES, SITE_NAME } from '../data/site'

// Free Supabase project: create a project, then set these two env vars in Vercel.
// SQL for the articles table (id bigint generated always as identity primary key, slug text unique not null, title text not null, category text not null, excerpt text, content text not null, meta_description text, published_at timestamptz, cover_image text, status text not null default 'published');
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const supabaseConfigured = Boolean(supabase)

// Slugs of the five homepage pillars, used as the default homepage category set.
export const ALL_CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug)

// Row shape of the public.articles table.
export interface ArticleRow {
  id: number
  slug: string
  title: string
  category: string
  excerpt: string | null
  content: string
  meta_description: string | null
  published_at: string | null
  cover_image: string | null
  status: string | null
  is_featured: boolean | null
  views: number | null
  deleted_at: string | null
  scheduled_at: string | null
  cover_alt: string | null
}

// Public article shape: the seed Article plus the Phase 2 fields the site shows.
export type PublicArticle = Article & {
  id: number
  is_featured: boolean
  views: number
  scheduled_at?: string
  deleted_at?: string | null
  cover_alt?: string
}

// An article is visible on the public site when it is Published, or Scheduled
// with a publish time that has already passed. The site is static + Supabase
// REST, so this check runs on every public read instead of relying on a cron.
export function isDuePublished(
  status: string | null | undefined,
  scheduledAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (status === 'published') return true
  if (status === 'scheduled' && scheduledAt) return new Date(scheduledAt).getTime() <= now.getTime()
  return false
}

export function rowToArticle(row: ArticleRow): PublicArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.meta_description || row.excerpt || '',
    category: row.category,
    date: row.published_at ? row.published_at.slice(0, 10) : '',
    author: SITE_NAME,
    excerpt: row.excerpt || '',
    content: row.content ? row.content.split(/\n\s*\n/).filter(Boolean) : [],
    cover: row.cover_image || undefined,
    status: row.status || 'published',
    is_featured: row.is_featured ?? false,
    views: row.views ?? 0,
    scheduled_at: row.scheduled_at || undefined,
    deleted_at: row.deleted_at,
    cover_alt: row.cover_alt || undefined,
  }
}

export function articleToRow(a: PublicArticle): Omit<ArticleRow, 'id'> {
  return {
    slug: a.slug,
    title: a.title,
    category: a.category,
    excerpt: a.excerpt,
    content: a.content.join('\n\n'),
    meta_description: a.description,
    published_at: a.date ? a.date + 'T00:00:00Z' : null,
    cover_image: a.cover || null,
    status: a.status || 'published',
    is_featured: a.is_featured ?? false,
    views: a.views ?? 0,
    deleted_at: a.deleted_at ?? null,
    scheduled_at: a.scheduled_at ?? null,
    cover_alt: a.cover_alt ?? null,
  }
}

// Public read: visible articles (Published, or Scheduled and due), newest first,
// featured articles pinned at the top. Falls back to the local seed data when
// Supabase cannot be reached. Trashed articles are never returned.
export async function fetchPublishedArticles(): Promise<PublicArticle[]> {
  if (!supabase) return ARTICLES as PublicArticle[]
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
  if (error || !data) return ARTICLES as PublicArticle[]
  const visible = (data as ArticleRow[]).filter((r) => isDuePublished(r.status, r.scheduled_at))
  visible.sort(
    (x, y) =>
      Number(y.is_featured ?? false) - Number(x.is_featured ?? false) ||
      (y.published_at ?? '').localeCompare(x.published_at ?? ''),
  )
  return visible.map(rowToArticle)
}

export async function fetchArticleBySlug(slug: string): Promise<PublicArticle | null> {
  if (!supabase) return (ARTICLES.find((a) => a.slug === slug) as PublicArticle | undefined) ?? null
  const { data, error } = await supabase.from('articles').select('*').eq('slug', slug).is('deleted_at', null).maybeSingle()
  if (error || !data) return null
  return rowToArticle(data as ArticleRow)
}
export async function fetchArticleById(id: number): Promise<PublicArticle | null> {
  if (!supabase) return (ARTICLES.find((a) => a.id === id) as PublicArticle | undefined) ?? null
  const { data, error } = await supabase.from('articles').select('*').eq('id', id).is('deleted_at', null).maybeSingle()
  if (error || !data) return null
  return rowToArticle(data as ArticleRow)
}

// Related articles for an article page: only the light fields ArticleCard needs, at most 4. 
export async function fetchRelatedArticles(category: string, excludeSlug: string): Promise<PublicArticle[]> { const seed = (ARTICLES as PublicArticle[]).filter((a) => a.category === category && a.slug !== excludeSlug).slice(0, 4); if (!supabase) return seed; const { data, error } = await supabase.from('articles').select(id, 'slug, title, cover_image, category, published_at').eq('category', category).neq('slug', excludeSlug).eq('status', 'published').is('deleted_at', null).order('published_at', { ascending: false }).limit(4); if (error || !data) return seed; return (data as { id: number; slug: string; title: string; cover_image: string | null; category: string; published_at: string | null }[]).map((r) => ({ id: r.id, slug: r.slug, title: r.title, description: '', category: r.category, date: r.published_at ? r.published_at.slice(0, 10) : '', author: SITE_NAME, excerpt: '', content: [], cover: r.cover_image || undefined, status: 'published', is_featured: false, views: 0 })) } // Admin read: every article row (including Drafts, Scheduled and trashed ones).
export async function fetchAllArticles(): Promise<ArticleRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('articles').select('*').order('published_at', { ascending: false })
  if (error || !data) return []
  return data as ArticleRow[]
}

// Views: increments once per browser tab session (the article page guards with
// sessionStorage). Runs through a SECURITY DEFINER function so the public anon
// key can count a view without being allowed to update articles directly.
export async function incrementArticleViews(slug: string): Promise<void> {
  if (!supabase) return
  await supabase.rpc('increment_article_views', { article_slug: slug })
}

// ---- Revision history (Phase 2) ----
export interface ArticleRevision {
  id: number
  article_id: number | null
  article_slug: string | null
  title: string | null
  excerpt: string | null
  meta_description: string | null
  content: string | null
  created_at: string
}

export async function fetchRevisions(articleId: number): Promise<ArticleRevision[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('article_revisions')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error || !data) return []
  return data as ArticleRevision[]
}

export interface RevisionSnapshot {
  article_slug: string
  title: string
  excerpt: string
  meta_description: string
  content: string
}

// Saves a snapshot and keeps at most 20 revisions per article (oldest pruned).
export async function saveRevision(articleId: number, snap: RevisionSnapshot): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('article_revisions').insert({ article_id: articleId, ...snap })
  if (error) return
  const { data } = await supabase
    .from('article_revisions')
    .select('id')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false })
  if (!data || data.length <= 20) return
  const staleIds = (data as { id: number }[]).slice(20).map((r) => r.id)
  await supabase.from('article_revisions').delete().in('id', staleIds)
}

// ---- Homepage settings (Phase 2) ----
export async function fetchHomepageCategories(): Promise<string[]> {
  if (!supabase) return ALL_CATEGORY_SLUGS
  const { data, error } = await supabase.from('site_settings').select('value').eq('key', 'homepage_categories').maybeSingle()
  if (error || !data) return ALL_CATEGORY_SLUGS
  try {
    const parsed = JSON.parse((data as { value: string }).value) as unknown
    if (Array.isArray(parsed)) {
      const slugs = parsed.filter((s): s is string => typeof s === 'string' && ALL_CATEGORY_SLUGS.includes(s))
      if (slugs.length > 0) return slugs
    }
  } catch {
    // fall through to the default
  }
  return ALL_CATEGORY_SLUGS
}

export async function saveHomepageCategories(slugs: string[]): Promise<void> {
  if (!supabase) return
  await supabase
    .from('site_settings')
    .upsert({ key: 'homepage_categories', value: JSON.stringify(slugs) }, { onConflict: 'key' })
}


// Canonical public URL: /<category>/<numeric-id>. Falls back to /article/<slug> when no id is known.
export function articleUrl(a: { category: string; id?: number | null; slug: string }): string {
  return a.id != null ? '/' + a.category + '/' + a.id : '/article/' + a.slug
}
