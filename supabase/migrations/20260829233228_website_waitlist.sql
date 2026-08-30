-- Public website prototype waitlist. Browser roles never receive table access;
-- the join-waitlist Edge Function is the only write boundary.
create table public.prototype_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  platform text not null default 'other',
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint prototype_waitlist_email_length check (char_length(email) between 3 and 254),
  constraint prototype_waitlist_email_normalized check (email = lower(btrim(email))),
  constraint prototype_waitlist_platform check (platform in ('android', 'ios', 'other'))
);

create unique index prototype_waitlist_email_unique
  on public.prototype_waitlist (lower(email));

alter table public.prototype_waitlist enable row level security;
alter table public.prototype_waitlist force row level security;

revoke all on table public.prototype_waitlist from public, anon, authenticated;
grant insert, select on table public.prototype_waitlist to service_role;

comment on table public.prototype_waitlist is
  'Prototype contact consent. Server-only; contains no health, name, location or IP data.';
comment on column public.prototype_waitlist.email is
  'Lowercase normalized email used only for prototype access communication.';
