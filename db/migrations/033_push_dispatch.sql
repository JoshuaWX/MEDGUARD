-- 033_push_dispatch.sql
-- Extends notification_log to support two new server-push types and per-item
-- dedupe, so the push dispatcher can send each health-news post / risk-tier
-- change to a given user at most once.
--
-- Safe to run once. Manual apply (like all MedGuard migrations).

-- 1. Allow the new notification types.
alter table public.notification_log
  drop constraint if exists notification_log_notification_type_check;

alter table public.notification_log
  add constraint notification_log_notification_type_check
  check (notification_type in (
    'checkin_reminder',
    'community_trend',
    'streak_milestone',
    'health_post',   -- new official health-news post pushed to the user
    'risk_change',   -- the user's state risk tier rose in the weekly forecast
    'general'
  ));

-- 2. Per-item dedupe key: which post / which forecast period this row is for.
--    NULL for types that dedupe by cooldown (e.g. community_trend).
alter table public.notification_log
  add column if not exists ref_id text;

-- Fast "have we already pushed <ref_id> to <user>?" lookups.
create index if not exists idx_notification_log_dedupe
  on public.notification_log (user_id, notification_type, ref_id);
