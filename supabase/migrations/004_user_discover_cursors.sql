-- Per-user discover cursor (incremental Freelancer polling)

create table if not exists discover_cursors (
  user_id uuid not null references profiles(id) on delete cascade,
  filter_fp text not null default 'global',
  last_discover_at timestamptz not null,
  primary key (user_id, filter_fp)
);

alter table discover_cursors enable row level security;

create policy "Users manage own discover cursors" on discover_cursors
  for all using (auth.uid() = user_id);

-- saved_filters was missing RLS in 002
alter table saved_filters enable row level security;

create policy "Users manage own saved filters" on saved_filters
  for all using (auth.uid() = user_id);
