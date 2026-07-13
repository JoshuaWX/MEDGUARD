/**
 * useHealthFeed — reads the auto-ingested Health News feed directly from the
 * `health_posts` table (RLS allows anon/authenticated read of published rows).
 * No edge function needed (same pattern as useRiskMap).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Colors } from '../../theme';
import type { IconName } from '../components/Icon';

export type PostCategory = 'official_update' | 'outbreak_news' | 'prevention_tip' | 'announcement';

/** Per-category display metadata (icon, label, accent), shared by feed screens + card. */
export const CATEGORY_META: Record<PostCategory, { label: string; icon: IconName; color: string }> = {
  outbreak_news: { label: 'Outbreak update', icon: 'alert-triangle', color: Colors.warning },
  official_update: { label: 'Official update', icon: 'shield-check', color: Colors.primary },
  prevention_tip: { label: 'Prevention tip', icon: 'heart', color: Colors.success },
  announcement: { label: 'Announcement', icon: 'info', color: Colors.info },
};

export function relativeDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export interface HealthPost {
  id: string;
  category: PostCategory;
  title: string;
  summary: string | null;
  body: string;
  disease: string | null;
  state: string | null;
  source: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  publishedAt: string;
}

const CATEGORIES: PostCategory[] = ['official_update', 'outbreak_news', 'prevention_tip', 'announcement'];

function mapRow(r: Record<string, unknown>): HealthPost | null {
  const category = String(r.category ?? '') as PostCategory;
  if (!CATEGORIES.includes(category) || !r.id || !r.title || !r.body) return null;
  return {
    id: String(r.id),
    category,
    title: String(r.title),
    summary: r.summary ? String(r.summary) : null,
    body: String(r.body),
    disease: r.disease ? String(r.disease) : null,
    state: r.state ? String(r.state) : null,
    source: r.source ? String(r.source) : 'MedGuard',
    sourceUrl: r.source_url ? String(r.source_url) : null,
    imageUrl: r.image_url ? String(r.image_url) : null,
    publishedAt: String(r.published_at ?? ''),
  };
}

export function useHealthFeed(limit = 50) {
  const [posts, setPosts] = useState<HealthPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Not configured');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('health_posts')
        .select('id, category, title, summary, body, disease, state, source, source_url, image_url, published_at')
        .order('published_at', { ascending: false })
        .limit(limit);
      if (err) throw err;
      const out = ((data ?? []) as Array<Record<string, unknown>>)
        .map(mapRow)
        .filter((p): p is HealthPost => p !== null);
      setPosts(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load health news');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { posts, loading, error, refresh: load };
}

/** Latest post of a given category (e.g. the daily prevention tip). */
export function latestOfCategory(posts: HealthPost[], category: PostCategory): HealthPost | null {
  return posts.find((p) => p.category === category) ?? null;
}
