-- Migration: 032_health_feed.sql
-- MedGuard Health News & Alerts feed (auto-ingested) + USSD/SMS delivery of posts.
--
-- WHY:
--   MedGuard already relays official NCDC/WHO outbreak reports via public.verified_reports
--   (migration 022) — but those are entered by hand, and there is no general "news / blog /
--   daily prevention tips" surface. This table backs an AUTO-INGESTED feed: a scheduled job
--   pulls what NCDC/WHO/ReliefWeb publish and writes attributed posts here; the app reads them
--   as a Health News feed, and USSD subscribers can receive the FULL TEXT by SMS (feature phones
--   can't open links).
--
-- WRITE MODEL / SAFETY (matches the app's locked stance):
--   Written SERVER-SIDE ONLY (service role) by the ingestion job. Official posts are stored
--   ATTRIBUTED (source + source_url + published date) using the publisher's own wording — never
--   paraphrased into new claims, and MedGuard never self-declares an outbreak. Prevention tips are
--   educational and non-diagnostic. Clients get READ access to published, non-expired rows only.

-- ============================================================================
-- health_posts: the feed. `body` is the full post text (this is what gets SMS'd).
-- ============================================================================
create table if not exists public.health_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'official_update'
    check (category in ('official_update', 'outbreak_news', 'prevention_tip', 'announcement')),
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),   -- full text (SMS + detail view)
  summary text,                                         -- short blurb for feed cards
  disease text,                                         -- optional tag: lassa|malaria|cholera|...
  state text,                                           -- optional; null = national
  source text not null default 'MedGuard',              -- e.g. NCDC, WHO, ReliefWeb, MedGuard
  source_url text,
  image_url text,
  published_at timestamptz not null default now(),
  expires_at timestamptz,                               -- null = never expires
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  external_id text unique,                              -- dedupe key for ingested items
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_health_posts_category_published
  on public.health_posts (category, published_at desc);
create index if not exists idx_health_posts_published
  on public.health_posts (published_at desc);

-- ============================================================================
-- RLS: read published + non-expired for everyone; writes are service-role only
-- (mirrors public.verified_reports, migration 022).
-- ============================================================================
alter table public.health_posts enable row level security;

drop policy if exists "read published health posts" on public.health_posts;
create policy "read published health posts"
  on public.health_posts
  for select
  to anon, authenticated
  using (status = 'published' and (expires_at is null or expires_at > now()));

drop policy if exists "service role full access health_posts" on public.health_posts;
create policy "service role full access health_posts"
  on public.health_posts
  for all
  to service_role
  using (true) with check (true);

revoke all on table public.health_posts from anon, authenticated;
grant select on table public.health_posts to anon, authenticated;
grant select, insert, update, delete on table public.health_posts to service_role;

-- updated_at maintenance.
create or replace function public.set_health_posts_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_health_posts_updated_at on public.health_posts;
create trigger trg_health_posts_updated_at
  before update on public.health_posts
  for each row execute function public.set_health_posts_updated_at();

revoke all on function public.set_health_posts_updated_at() from public;

comment on table public.health_posts is
  'MedGuard Health News feed: auto-ingested official (NCDC/WHO/ReliefWeb) updates + curated '
  'prevention tips. Service-role written; attributed relays, never self-declared. `body` = full '
  'text used for the detail view and full-text SMS. Clients read published, non-expired rows.';

-- ============================================================================
-- Subscribers: opt-in to news, plus a weekly-tip-digest cooldown anchor.
-- (public.ussd_subscribers created in migration 030.)
-- ============================================================================
alter table public.ussd_subscribers
  add column if not exists news_opt_in boolean not null default true;
alter table public.ussd_subscribers
  add column if not exists last_tip_digest_at timestamptz;

-- ============================================================================
-- sms_outbox: allow the two new dispatch reasons (created in migration 030).
-- ============================================================================
alter table public.sms_outbox drop constraint if exists sms_outbox_reason_check;
alter table public.sms_outbox add constraint sms_outbox_reason_check
  check (reason in ('forecast', 'verified_report', 'health_post', 'tip_digest'));
