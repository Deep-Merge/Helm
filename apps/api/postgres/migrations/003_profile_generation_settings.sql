-- User-selectable proposal generation settings: number of client questions and AI model

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS question_count INT DEFAULT 3;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS proposal_model TEXT DEFAULT 'gpt-4.1';

INSERT INTO schema_migrations (version)
VALUES ('003_profile_generation_settings')
ON CONFLICT (version) DO NOTHING;
