-- Public website pilot and feedback inquiries. Browser roles never receive
-- table access; submit-website-inquiry is the only write boundary.
create table public.website_inquiries (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  topic text not null,
  organization text,
  role text,
  message text not null,
  fingerprint text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint website_inquiries_email_length check (char_length(email) between 3 and 254),
  constraint website_inquiries_email_normalized check (email = lower(btrim(email))),
  constraint website_inquiries_topic check (topic in ('pilot', 'product_feedback', 'community_idea')),
  constraint website_inquiries_organization_length check (organization is null or char_length(organization) between 1 and 120),
  constraint website_inquiries_role_length check (role is null or char_length(role) between 1 and 80),
  constraint website_inquiries_message_length check (char_length(message) between 20 and 1500),
  constraint website_inquiries_fingerprint_format check (fingerprint ~ '^[0-9a-f]{64}$')
);

create index website_inquiries_recent_fingerprint_idx
  on public.website_inquiries (fingerprint, created_at desc);

alter table public.website_inquiries enable row level security;
alter table public.website_inquiries force row level security;

revoke all on table public.website_inquiries from public, anon, authenticated;
grant insert, select on table public.website_inquiries to service_role;

comment on table public.website_inquiries is
  'Server-only website pilot and feedback inquiries. Health and location data are prohibited.';
comment on column public.website_inquiries.fingerprint is
  'SHA-256 duplicate-suppression key. It is not an analytics or identity identifier.';
