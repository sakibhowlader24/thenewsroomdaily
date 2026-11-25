import { createClient } from '@supabase/supabase-js'
// Free Supabase project: create a project, then set these two env vars in Vercel.
// SQL for the articles table:
// create table articles (id bigint generated always as identity primary key, slug text unique not null, title text not null, category text not null, excerpt text, content text not null, meta_description text, published_at timestamptz default now());
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const supabaseConfigured = Boolean(supabase)
