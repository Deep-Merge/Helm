-- Aggregated skills catalog per user (source: projects.skills arrays)

CREATE TABLE IF NOT EXISTS user_project_skills (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  project_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_user_project_skills_user ON user_project_skills (user_id, lower(skill));

INSERT INTO user_project_skills (user_id, skill, project_count, updated_at)
SELECT p.user_id, skill, COUNT(*)::int, now()
FROM projects p, unnest(p.skills) AS skill
WHERE skill IS NOT NULL AND trim(skill) <> ''
GROUP BY p.user_id, skill
ON CONFLICT (user_id, skill) DO UPDATE
SET project_count = EXCLUDED.project_count,
    updated_at = EXCLUDED.updated_at;

INSERT INTO schema_migrations (version)
VALUES ('002_user_project_skills')
ON CONFLICT (version) DO NOTHING;
