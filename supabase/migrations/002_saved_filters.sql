-- Saved filter presets for dashboard project discovery

create table if not exists saved_filters (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  q text,
  countries text[] default '{}',
  skills text[] default '{}',
  min_budget numeric,
  max_budget numeric,
  budget_type text default 'any',
  exclude_submitted boolean default true,
  days int,
  created_at timestamptz default now()
);

create index if not exists saved_filters_user_id_idx on saved_filters(user_id);
