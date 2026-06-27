-- BidAutomation initial schema

create extension if not exists "uuid-ossp";

create type project_status as enum (
  'new', 'viewed', 'drafted', 'submitted', 'ignored', 'won', 'lost'
);

create type bid_status as enum ('draft', 'submitted', 'archived');

create type model_tier as enum ('auto', 'standard', 'premium');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  title text default 'Senior Full-Stack Developer',
  bio text,
  skills text[] default array['React', 'Next.js', 'Node.js', 'TypeScript', 'Python', 'FastAPI'],
  hourly_rate_min numeric,
  hourly_rate_max numeric,
  proposal_style text default 'Warm, confident, human. No generic AI tone.',
  default_direction text default 'Explain my approach simply and ask to discuss in Freelancer chat.',
  default_model_tier model_tier default 'auto',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table watcher_configs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  search_url text not null,
  keywords text[] default '{}',
  min_budget numeric,
  max_budget numeric,
  skills text[] default '{}',
  poll_interval_sec int default 60,
  is_active boolean default true,
  last_polled_at timestamptz,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  freelancer_project_id text not null,
  url text not null,
  title text not null,
  description text default '',
  budget_text text,
  budget_min numeric,
  budget_max numeric,
  budget_type text default 'unknown',
  skills text[] default '{}',
  client_country text,
  client_rating numeric,
  status project_status default 'new',
  risk_score int,
  risk_notes text,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  submitted_at timestamptz,
  raw_snapshot jsonb default '{}',
  unique (user_id, freelancer_project_id)
);

create table bids (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  version int not null default 1,
  status bid_status default 'draft',
  proposal_text text not null,
  bid_amount numeric,
  delivery_days int,
  questions jsonb default '[]',
  direction text,
  model_used text,
  model_tier model_tier default 'standard',
  ai_metadata jsonb default '{}',
  created_at timestamptz default now(),
  submitted_at timestamptz
);

create table project_events (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  event_type text not null,
  payload jsonb default '{}',
  created_at timestamptz default now()
);

create table templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  content text not null,
  tags text[] default '{}',
  is_winning_example boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index idx_projects_user_status on projects(user_id, status);
create index idx_projects_user_seen on projects(user_id, first_seen_at desc);
create index idx_bids_project on bids(project_id, version desc);
create index idx_bids_user on bids(user_id, created_at desc);

-- RLS
alter table profiles enable row level security;
alter table watcher_configs enable row level security;
alter table projects enable row level security;
alter table bids enable row level security;
alter table project_events enable row level security;
alter table templates enable row level security;

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = id);

create policy "Users manage own watcher configs" on watcher_configs
  for all using (auth.uid() = user_id);

create policy "Users manage own projects" on projects
  for all using (auth.uid() = user_id);

create policy "Users manage own bids" on bids
  for all using (auth.uid() = user_id);

create policy "Users manage own events" on project_events
  for all using (auth.uid() = user_id);

create policy "Users manage own templates" on templates
  for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
