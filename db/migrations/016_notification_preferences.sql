-- Migration: 016_notification_preferences.sql
-- Push notification preferences (DESIGN ONLY - NOT ENABLED)
-- 
-- PUBLIC HEALTH REASONING:
-- - Opt-in only, disabled by default
-- - Single daily reminder max
-- - Non-alarmist, supportive messaging
-- - Architecture ready for future activation without refactor

-- ============================================================================
-- NOTIFICATION PREFERENCES TABLE
-- Stores user preferences for notifications (currently disabled)
-- ============================================================================
create table if not exists notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  
  -- Daily health check-in reminder
  -- Currently NOT enabled - this is architecture for future use
  checkin_reminder_enabled boolean not null default false,
  
  -- Time of day to send reminder (local time, 24-hour format)
  -- Only triggers if user hasn't checked in by this time
  checkin_reminder_time time not null default '09:00:00',
  
  -- Timezone for local time calculation
  timezone text not null default 'Africa/Lagos',
  
  -- Community trend alerts (opt-in)
  community_alerts_enabled boolean not null default false,
  
  -- Push notification token (for future use)
  push_token text,
  push_token_updated_at timestamptz,
  
  -- Last notification sent (to prevent spam)
  last_checkin_reminder_at timestamptz,
  
  -- Global notification pause
  notifications_paused boolean not null default false,
  notifications_paused_until timestamptz,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- NOTIFICATION LOG TABLE
-- Tracks sent notifications (for future use, debugging, and preventing spam)
-- ============================================================================
create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Notification type
  notification_type text not null check (notification_type in (
    'checkin_reminder',
    'community_trend',
    'streak_milestone',
    'general'
  )),
  
  -- Content (for debugging)
  title text not null,
  body text not null,
  
  -- Delivery status
  status text not null default 'pending' check (status in (
    'pending',
    'sent',
    'failed',
    'skipped'
  )),
  
  -- Error details if failed
  error_message text,
  
  -- Timestamps
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_log_user 
  on notification_log (user_id, created_at desc);

create index if not exists idx_notification_log_status 
  on notification_log (status, scheduled_for)
  where status = 'pending';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table notification_preferences enable row level security;

create policy "Users can view own notification prefs"
  on notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can upsert own notification prefs"
  on notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification prefs"
  on notification_preferences for update
  using (auth.uid() = user_id);

alter table notification_log enable row level security;

create policy "Users can view own notifications"
  on notification_log for select
  using (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTION: Check if reminder should be sent
-- Returns true ONLY if:
-- 1. Feature is enabled (currently always false)
-- 2. User has opted in
-- 3. User hasn't checked in today
-- 4. Current time is past reminder time
-- 5. No reminder sent today
-- ============================================================================
create or replace function should_send_checkin_reminder(p_user_id uuid)
returns boolean as $$
declare
  v_enabled boolean;
  v_paused boolean;
  v_reminder_time time;
  v_timezone text;
  v_last_reminder timestamptz;
  v_has_checkin_today boolean;
  v_current_local_time time;
  v_feature_enabled constant boolean := false;  -- MASTER SWITCH: Currently disabled
begin
  -- Feature-level kill switch
  if not v_feature_enabled then
    return false;
  end if;

  -- Get user preferences
  select 
    checkin_reminder_enabled,
    notifications_paused,
    checkin_reminder_time,
    timezone,
    last_checkin_reminder_at
  into 
    v_enabled,
    v_paused,
    v_reminder_time,
    v_timezone,
    v_last_reminder
  from notification_preferences
  where user_id = p_user_id;
  
  -- No preferences = no reminder
  if not found or not v_enabled or v_paused then
    return false;
  end if;
  
  -- Check if already checked in today
  select exists(
    select 1 from health_checkins
    where user_id = p_user_id
    and checkin_date = current_date
  ) into v_has_checkin_today;
  
  if v_has_checkin_today then
    return false;
  end if;
  
  -- Check if reminder already sent today
  if v_last_reminder is not null 
     and v_last_reminder::date = current_date then
    return false;
  end if;
  
  -- Check if current time is past reminder time
  v_current_local_time := (now() at time zone v_timezone)::time;
  if v_current_local_time < v_reminder_time then
    return false;
  end if;
  
  return true;
end;
$$ language plpgsql security definer
set search_path = public;

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on table notification_preferences is 
  'User notification preferences. NOTIFICATIONS ARE CURRENTLY DISABLED. Architecture only.';

comment on column notification_preferences.checkin_reminder_enabled is 
  'Opt-in daily reminder. Disabled by default. Feature currently not active.';

comment on function should_send_checkin_reminder is 
  'Checks if a checkin reminder should be sent. Currently always returns false (feature disabled).';
