-- ==============================================================================
-- Resume Pipeline Database Schema (PostgreSQL)
-- ==============================================================================

-- 1. Users table for authentication and account isolation
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE, -- FALSE for active, TRUE for disabled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sessions table for persistent login state via secure HTTP cookies
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Profiles table for each user's master career dossier
-- User picture is stored in `photo_src` as a cropped high-resolution Base64 data URL
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  basics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  photo_src TEXT,
  photo_on_resumes BOOLEAN NOT NULL DEFAULT TRUE,
  skills_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  projects_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  education_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  publications_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  references_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Custom Themes created or imported by the user
CREATE TABLE IF NOT EXISTS custom_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. User Settings (preferred theme, paper size, base language)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  base_theme_id TEXT NOT NULL DEFAULT 'editorial',
  paper TEXT NOT NULL DEFAULT 'LETTER',
  language TEXT,
  include_references BOOLEAN NOT NULL DEFAULT FALSE,
  page_limit TEXT NOT NULL DEFAULT 'none',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tailored Job Applications & Curated Resumes
CREATE TABLE IF NOT EXISTS tailored_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_text TEXT NOT NULL,
  match_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generated', -- 'generated', 'applied', 'interviewing', 'offered', 'rejected', 'archived'
  notes TEXT NOT NULL DEFAULT '',
  units_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for rapid lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_themes_user_id ON custom_themes(user_id);
CREATE INDEX IF NOT EXISTS idx_tailored_drafts_user_id ON tailored_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_tailored_drafts_user_created ON tailored_drafts(user_id, created_at DESC);
