-- Intel cache: server-side cache for outbreak/season intel per region
-- Only accessed by service role (no RLS needed for client)
create table if not exists intel_cache (
  id uuid primary key default gen_random_uuid(),
  region_key text not null,                -- normalized state name e.g. 'ogun', 'lagos'
  scope text not null default 'general',   -- 'general' | 'outbreak' | 'weather'
  payload jsonb not null,                  -- cached intel response
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (region_key, scope)
);

create index if not exists idx_intel_cache_region_scope
  on intel_cache (region_key, scope);

create index if not exists idx_intel_cache_expires
  on intel_cache (expires_at);

-- No RLS - only server/service role accesses this table
