-- ==============================================================================
-- Resume Pipeline Database Schema (SQLite)
-- Database file: data/resume_pipeline.db
-- ==============================================================================

-- 1. Users table for authentication and account isolation
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
  is_disabled INTEGER NOT NULL DEFAULT 0, -- 0 for active, 1 for disabled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sessions table for persistent login state via secure HTTP cookies
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Profiles table for each user's master career dossier
-- User picture is stored in `photo_src` as a cropped high-resolution Base64 data URL
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  basics_json TEXT NOT NULL DEFAULT '{}',
  photo_src TEXT,
  photo_on_resumes INTEGER DEFAULT 1,
  skills_json TEXT NOT NULL DEFAULT '[]',
  languages_json TEXT NOT NULL DEFAULT '[]',
  experience_json TEXT NOT NULL DEFAULT '[]',
  projects_json TEXT NOT NULL DEFAULT '[]',
  education_json TEXT NOT NULL DEFAULT '[]',
  publications_json TEXT NOT NULL DEFAULT '[]',
  references_json TEXT NOT NULL DEFAULT '[]',
  facts_json TEXT NOT NULL DEFAULT '[]',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Custom Themes created or imported by the user
CREATE TABLE IF NOT EXISTS custom_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  theme_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. User Settings (preferred theme, paper size, base language)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  base_theme_id TEXT NOT NULL DEFAULT 'editorial',
  paper TEXT NOT NULL DEFAULT 'LETTER',
  language TEXT,
  include_references INTEGER DEFAULT 0,
  page_limit TEXT DEFAULT 'none',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Tailored Job Applications & Curated Resumes
CREATE TABLE IF NOT EXISTS tailored_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_text TEXT NOT NULL,
  match_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generated', -- 'generated', 'applied', 'interviewing', 'offered', 'rejected', 'archived'
  notes TEXT NOT NULL DEFAULT '',
  units_json TEXT NOT NULL DEFAULT '[]',
  analysis_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indices for rapid lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_themes_user_id ON custom_themes(user_id);
CREATE INDEX IF NOT EXISTS idx_tailored_drafts_user_id ON tailored_drafts(user_id);
