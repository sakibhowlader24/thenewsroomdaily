export const SITE_NAME = 'The Newsroom Daily'
export const SITE_URL = 'https://thenewsroomdaily.vercel.app'
export interface Category { slug: string; name: string; description: string }
export const CATEGORIES: Category[] = [
  { slug: 'gaming', name: 'GTA 6 Gaming', description: 'Guides, maps, weapons and money tips for GTA 6 in Leonida.' },
  { slug: 'tech-how-to', name: 'Tech How-To', description: 'Simple fixes for laptops, phones, Wi-Fi, email and batteries.' },
  { slug: 'money-finance', name: 'Money and Finance', description: 'Budgets, savings, debt and investing, explained in plain words.' },
  { slug: 'career-work', name: 'Career and Work', description: 'CVs, interviews, remote work and asking for a raise.' },
  { slug: 'everyday-guides', name: 'Everyday Guides', description: 'Sleep, travel, learning English and staying healthy at a desk.' },
]
export function categoryBySlug(slug: string) { return CATEGORIES.find((c) => c.slug === slug) }
