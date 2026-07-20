-- Add hourly-range persistence to saved filter presets

ALTER TABLE saved_filters
  ADD COLUMN IF NOT EXISTS min_hourly NUMERIC;

ALTER TABLE saved_filters
  ADD COLUMN IF NOT EXISTS max_hourly NUMERIC;

INSERT INTO schema_migrations (version)
VALUES ('004_saved_filter_hourly')
ON CONFLICT (version) DO NOTHING;
