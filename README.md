# The Newsroom Daily

The Newsroom Daily is a clean, fast English news and guide site. It covers GTA 6 gaming, tech how-to, money and finance, career and work, and everyday guides. The site name is provisional and is kept in one place, SITE_NAME in src/data/site.ts, so it is easy to change later.

## Stack

Vite, React, TypeScript, Tailwind CSS v4, and react-router-dom. Deployed free on Vercel. No paid service and no AdSense.

## Run locally

npm install
npm run dev
npm run build

## Pages

Home, article pages at /article/<slug>, category pages at /category/<slug> for gaming, tech-how-to, money-finance, career-work, and everyday-guides, plus About, Contact, Privacy Policy, and Admin at /admin.

## Articles and Supabase

Seed articles live in src/data/articles.ts. The admin page can add and edit articles in the browser for now.

For Supabase (free plan), create a project at supabase.com, run this SQL, and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel:

create table articles (id bigint generated always as identity primary key, slug text unique not null, title text not null, category text not null, excerpt text, content text not null, meta_description text, published_at timestamptz default now());

The Supabase client in src/lib/supabase.ts is null until those env vars are set, so the site works without Supabase.
