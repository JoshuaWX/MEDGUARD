/**
 * useHealthFeed — reads the auto-ingested Health News feed directly from the
 * `health_posts` table (RLS allows anon/authenticated read of published rows).
 * No edge function needed (same pattern as useRiskMap).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { readPublicCache, writePublicCache } from '../services/publicCache';
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
const FEED_CACHE_FRESH_MS = 15 * 60 * 1000;
type FeedSnapshot = { posts: HealthPost[]; lastUpdatedAt: string | null };
let sharedSnapshot: FeedSnapshot | null = null;
let sharedRequest: Promise<FeedSnapshot> | null = null;

export function mapHealthPost(r: Record<string, unknown>): HealthPost | null {
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

async function loadSharedFeed(force = false): Promise<FeedSnapshot> {
  if (sharedSnapshot && !force) return sharedSnapshot;
  if (sharedRequest) return sharedRequest;
  sharedRequest = (async () => {
    if (!force) {
      const cached = await readPublicCache<FeedSnapshot>('health-news', 'feed', FEED_CACHE_FRESH_MS);
      if (cached?.fresh) {
        sharedSnapshot = cached.data;
        return cached.data;
      }
    }
    if (!supabase) throw new Error('Not configured');
    const [{ data, error: err }, { data: statusRows }] = await Promise.all([
      supabase.from('health_posts').select('id, category, title, summary, body, disease, state, source, source_url, image_url, published_at').order('published_at', { ascending: false }).limit(50),
      supabase.from('health_feed_status').select('last_success_at').not('last_success_at', 'is', null).order('last_success_at', { ascending: false }).limit(1),
    ]);
    if (err) throw err;
    const next: FeedSnapshot = {
      posts: ((data ?? []) as Array<Record<string, unknown>>).map(mapHealthPost).filter((post): post is HealthPost => post !== null),
      lastUpdatedAt: statusRows?.[0]?.last_success_at ? String(statusRows[0].last_success_at) : null,
    };
    sharedSnapshot = next;
    void writePublicCache('health-news', 'feed', next);
    return next;
  })().finally(() => { sharedRequest = null; });
  return sharedRequest;
}

export function useHealthFeed(limit = 50) {
  const [posts, setPosts] = useState<HealthPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    let showedCache = false;
    if (!force) {
      const cached = await readPublicCache<FeedSnapshot>('health-news', 'feed', FEED_CACHE_FRESH_MS);
      if (cached) {
        showedCache = true;
        setPosts(cached.data.posts.slice(0, limit));
        setLastUpdatedAt(cached.data.lastUpdatedAt ?? cached.cachedAt);
        setLoading(false);
        if (cached.fresh) return;
      }
    }
    if (!showedCache) setLoading(true);
    setError(null);
    try {
      const snapshot = await loadSharedFeed(force || showedCache);
      setPosts(snapshot.posts.slice(0, limit));
      setLastUpdatedAt(snapshot.lastUpdatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load health news');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { posts, loading, error, lastUpdatedAt, refresh: () => load(true) };
}

/** Load one exact post for notification deep links, including cold app launches. */
export function useHealthPost(postId?: string, initialPost?: HealthPost) {
  const [post, setPost] = useState<HealthPost | undefined>(initialPost);
  const [loading, setLoading] = useState(Boolean(postId && !initialPost));
  useEffect(() => {
    if (!postId || initialPost?.id === postId) return;
    let active = true;
    setLoading(true);
    supabase.from('health_posts').select('id, category, title, summary, body, disease, state, source, source_url, image_url, published_at').eq('id', postId).maybeSingle()
      .then(({ data }: { data: Record<string, unknown> | null }) => { if (active) setPost(data ? mapHealthPost(data) ?? undefined : undefined); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialPost?.id, postId]);
  return { post, loading };
}

/** Latest post of a given category (e.g. the daily prevention tip). */
export function latestOfCategory(posts: HealthPost[], category: PostCategory): HealthPost | null {
  return posts.find((p) => p.category === category) ?? null;
}
