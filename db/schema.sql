-- show-me-love schema. Idempotent: safe to run repeatedly.
create extension if not exists citext;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  password_hash text,
  role text not null default 'creator' check (role in ('creator','admin')),
  created_at timestamptz not null default now()
);

create table if not exists creators (
  user_id uuid primary key references users(id) on delete cascade,
  username citext unique not null,
  display_name text,
  bio text,
  photo_url text,
  birthday date,
  birthday_mode text,
  socials jsonb not null default '{}'::jsonb,
  treat_id text,
  custom_treat jsonb,
  unit_price_ngn numeric not null default 1000,
  presets int[] not null default '{1,3,5}',
  thank_you_text text,
  page_style jsonb not null default '{}'::jsonb,
  share_message text,
  payout_address text,
  payout_network text check (payout_network in ('bep20','trc20')),
  bank jsonb,
  created_at timestamptz not null default now()
);

create table if not exists username_history (
  old_username citext primary key,
  user_id uuid not null references users(id) on delete cascade
);

create table if not exists treat_catalog (
  id text primary key,
  name text not null,
  aliases text[] not null default '{}',
  emoji text,
  image text,
  active boolean not null default true,
  category text,
  parent_id text references treat_catalog(id),
  sort_order int not null default 0
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(user_id) on delete cascade,
  slug text not null,
  title text not null,
  story text,
  cover_url text,
  currency text not null default 'NGN',
  target numeric,
  suggested numeric[],
  show_progress boolean not null default true,
  show_target boolean not null default true,
  organizer_name text,
  organizer_photo text,
  header_mode text not null default 'default' check (header_mode in ('default','logo','hidden')),
  paused boolean not null default false,
  currency_locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (creator_id, slug)
);

create table if not exists group_payments (
  id uuid primary key default gen_random_uuid(),
  payer_user_id uuid references users(id),
  currency text not null,
  split_mode text not null default 'even' check (split_mode in ('even','custom')),
  payment_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  kind text not null check (kind in ('treat','goal','group')),
  creator_id uuid references creators(user_id),
  goal_id uuid references goals(id),
  group_id uuid references group_payments(id),
  supporter_name text,
  supporter_email text,
  message text,
  is_public boolean not null default true,
  quantity int not null default 1,
  amount_ngn numeric,
  amount_usdt numeric,
  received_usdt numeric,
  rate numeric,
  link_url text,
  network text,
  status text not null default 'pending' check (status in ('pending','successful','expired','failed','refunded')),
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table payments add column if not exists refund_address text;
alter table payments add column if not exists refund_network text;
alter table payments add column if not exists refund_reference text;
create index if not exists payments_creator_idx on payments(creator_id, status, created_at desc);

create table if not exists group_splits (
  group_id uuid not null references group_payments(id) on delete cascade,
  creator_id uuid not null references creators(user_id),
  share_amount numeric not null,
  primary key (group_id, creator_id)
);

alter table group_payments add column if not exists total numeric;
alter table group_splits add column if not exists ordinal int not null default 0;

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(user_id),
  kind text not null check (kind in ('credit','fee','hold','release','reversal','payout')),
  amount_usdt numeric not null,
  ref text unique not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_creator_idx on ledger_entries(creator_id);

create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(user_id),
  method text not null check (method in ('usdt','ngn_bank')),
  amount_usdt numeric not null,
  fee_usdt numeric not null default 0,
  amount_ngn numeric,
  destination jsonb not null default '{}'::jsonb,
  status text not null default 'awaiting_review' check (status in ('awaiting_review','processing','paid','rejected','failed')),
  ras_reference text,
  bank_reference text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists one_time_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('login','withdrawal')),
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists apps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  mode text not null default 'sandbox' check (mode in ('sandbox','live')),
  redirect_uris text[] not null default '{}',
  client_id text unique not null
);
alter table apps add column if not exists created_at timestamptz not null default now();

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(id) on delete cascade,
  prefix text not null,
  last4 text not null,
  key_hash text not null,
  revoked_at timestamptz
);
alter table api_keys add column if not exists created_at timestamptz not null default now();

create table if not exists auth_codes (
  code_hash text primary key,
  app_id uuid not null references apps(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  user_ref text,
  earnings_shared boolean not null default false,
  state text,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists connections (
  app_id uuid not null references apps(id) on delete cascade,
  user_ref text not null,
  user_id uuid not null references users(id) on delete cascade,
  earnings_shared boolean not null default false,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (app_id, user_ref)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  reason text not null,
  details text,
  reporter_email text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create table if not exists webhook_events (
  event_id text primary key,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now()
);

-- Treat catalog seed. Generic names only, no trademarks.
insert into treat_catalog (id, name, aliases, emoji, image, category, parent_id, sort_order) values
  ('malt',      'Malt',         '{"malt drink"}',      '🥤', '/treats/malt.svg',      'drink'  , null, 1),
  ('zobo',      'Zobo',         '{"hibiscus","sobo"}', '🌺', '/treats/zobo.svg',      'drink',   null, 2),
  ('suya',      'Suya',         '{"kebab","skewer"}',  '🍢', '/treats/suya.svg',      'food',    null, 3),
  ('jollof',    'Jollof',       '{"rice","jollof rice"}', '🍛', '/treats/jollof.svg', 'food',    null, 4),
  ('coffee',    'Coffee',       '{"cafe","latte"}',    '☕', '/treats/coffee.svg',    'drink',   null, 5),
  ('glucose-d', 'Glucose D',    '{"glucose","energy"}','🥤', '/treats/glucose-d.svg', 'drink',   null, 6),
  ('ribena',    'Blackcurrant', '{"cordial","juice"}', '🧃', '/treats/ribena.svg',    'drink',   null, 7),
  ('lucozade',  'Energy Drink', '{"energy drink"}',    '⚡', '/treats/lucozade.svg',  'drink',   null, 8),
  ('chapman',   'Chapman',      '{"cocktail","mocktail"}', '🍹', '/treats/chapman.svg', 'treat', null, 9),
  ('trophy',    'Trophy',       '{"award","cup"}',     '🏆', '/treats/trophy.svg',    'alcohol', null, 10)
on conflict (id) do nothing;

insert into treat_catalog (id, name, aliases, emoji, image, category, parent_id, sort_order) values
  ('malt-classic',  'Classic Malt',  '{}', '🥤', '/treats/malt-classic.svg',  'drink'  , 'malt',   1),
  ('malt-dark',     'Dark Malt',     '{}', '🥤', '/treats/malt-dark.svg',     'drink'  , 'malt',   2),
  ('malt-gold',     'Gold Malt',     '{}', '🥤', '/treats/malt-gold.svg',     'drink'  , 'malt',   3),
  ('trophy-gold',   'Gold Trophy',   '{}', '🏆', '/treats/trophy-gold.svg',   'alcohol', 'trophy', 1),
  ('trophy-silver', 'Silver Trophy', '{}', '🏆', '/treats/trophy-silver.svg', 'alcohol', 'trophy', 2)
on conflict (id) do nothing;

-- Malt is non-alcoholic: fix databases seeded before this correction.
update treat_catalog set category = 'drink', emoji = '🥤'
  where id in ('malt', 'malt-classic', 'malt-dark', 'malt-gold') and category = 'alcohol';
