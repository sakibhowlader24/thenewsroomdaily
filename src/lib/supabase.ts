import { createClient } from '@supabase/supabase-js'
import { ARTICLES, type Article } from '../data/articles'
import { SITE_NAME } from '../data/site'

// Free Supabase project: create a project, then set these two env vars in Vercel.
// SQL for the articles table (id bigint generated always as identity primary key, slug text unique not null, title text not null, category text not null, excerpt text, content text not null, meta_description text, published_at timestamptz default now(), cover_image text, status text not null default 'published');
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const supabaseConfigured = Boolean(supabase)

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
}

export function rowToArticle(row: ArticleRow): Article {
  return {
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
  }
}

export function articleToRow(a: Article): Omit<ArticleRow, 'id'> {
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
  }
}

// Public read: published articles, newest first. Falls back to the local seed data when Supabase cannot be reached.
export async function fetchPublishedArticles(): Promise<Article[]> {
  if (!supabase) return ARTICLES
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  if (error || !data) return ARTICLES
  return (data as ArticleRow[]).map(rowToArticle)
}

// Admin read: all articles, newest first (drafts included).
export async function fetchAllArticles(): Promise<ArticleRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('published_at', { ascending: false })
  if (error || !data) return []
  return data as ArticleRow[]
}
