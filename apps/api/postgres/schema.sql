-- BidAutomation local PostgreSQL schema (no Supabase auth dependency)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'new', 'viewed', 'drafted', 'submitted', 'ignored', 'won', 'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bid_status AS ENUM ('draft', 'submitted', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE model_tier AS ENUM ('auto', 'standard', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Local auth users (replaces Supabase auth.users for self-hosted installs)
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users (lower(email));

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  display_name TEXT,
  title TEXT DEFAULT 'Senior Full-Stack Developer',
  bio TEXT DEFAULT '',
  skills TEXT[] DEFAULT ARRAY['React', 'Next.js', 'Node.js', 'TypeScript', 'Python', 'FastAPI'],
  hourly_rate_min NUMERIC,
  hourly_rate_max NUMERIC,
  proposal_style TEXT DEFAULT 'Warm, confident, human. No generic AI tone.',
  default_direction TEXT DEFAULT 'Explain my approach simply and ask to discuss in Freelancer chat.',
  default_model_tier model_tier DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Authoritative per-user pipeline status (New / Seen / Submitted)
CREATE TABLE IF NOT EXISTS user_project_status (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  freelancer_project_id TEXT NOT NULL,
  status project_status NOT NULL DEFAULT 'new',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, freelancer_project_id)
);

CREATE INDEX IF NOT EXISTS idx_user_project_status_user ON user_project_status (user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_project_status_fid ON user_project_status (user_id, freelancer_project_id);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  freelancer_project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  budget_text TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  budget_type TEXT DEFAULT 'unknown',
  skills TEXT[] DEFAULT '{}',
  client_country TEXT,
  client_country_flag TEXT,
  client_location TEXT,
  client_rating NUMERIC,
  client_review_count INT,
  bid_count INT,
  bid_avg NUMERIC,
  bid_currency_code TEXT,
  bid_currency_sign TEXT,
  clarifications JSONB DEFAULT '[]'::jsonb,
  submitted_bid_amount NUMERIC,
  submitted_delivery_days INT,
  status project_status DEFAULT 'new',
  risk_score INT,
  risk_notes TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  discovered_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  raw_snapshot JSONB DEFAULT '{}'::jsonb,
  UNIQUE (user_id, freelancer_project_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects (user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_user_discovered ON projects (user_id, discovered_at DESC NULLS LAST, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_user_country ON projects (user_id, client_country);
CREATE INDEX IF NOT EXISTS idx_projects_user_budget ON projects (user_id, budget_min, budget_max);
CREATE INDEX IF NOT EXISTS idx_projects_skills ON projects USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_projects_title_trgm ON projects USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_freelancer_id ON projects (user_id, freelancer_project_id);

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  status bid_status DEFAULT 'draft',
  proposal_text TEXT NOT NULL,
  bid_amount NUMERIC,
  delivery_days INT,
  questions JSONB DEFAULT '[]'::jsonb,
  direction TEXT,
  model_used TEXT,
  model_tier model_tier DEFAULT 'standard',
  ai_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bids_project ON bids (project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_bids_user ON bids (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_events_user ON project_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_events_project ON project_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS watcher_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  search_url TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  min_budget NUMERIC,
  max_budget NUMERIC,
  skills TEXT[] DEFAULT '{}',
  poll_interval_sec INT DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watcher_configs_user ON watcher_configs (user_id);

CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  q TEXT,
  countries TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  min_budget NUMERIC,
  max_budget NUMERIC,
  budget_type TEXT DEFAULT 'any',
  exclude_submitted BOOLEAN DEFAULT true,
  days INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_winning_example BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_user ON templates (user_id);

CREATE TABLE IF NOT EXISTS discover_cursors (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  filter_fp TEXT NOT NULL DEFAULT 'global',
  last_discover_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, filter_fp)
);

-- Aggregated skills catalog per user (built from projects.skills — not stored on projects)
CREATE TABLE IF NOT EXISTS user_project_skills (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  project_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_user_project_skills_user ON user_project_skills (user_id, lower(skill));

-- Schema version marker
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version)
VALUES ('001_local_postgres')
ON CONFLICT (version) DO NOTHING;
