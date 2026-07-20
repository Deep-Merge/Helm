-- Add hourly-range persistence to saved_filters for existing Supabase DBs

alter table if exists saved_filters
  add column if not exists min_hourly numeric;

alter table if exists saved_filters
  add column if not exists max_hourly numeric;
