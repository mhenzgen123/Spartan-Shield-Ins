-- Spartan Shield Insurance — initial schema
--
-- Apply locally:  npm run db:migrate:local
-- Apply remotely: npm run db:migrate:remote
--
-- Both tables are written by Pages Functions and read only by the Cloudflare
-- Access protected admin dashboard.

-- ---------------------------------------------------------------------------
-- Contact submissions
--
-- This table is the TCPA defence. Every row stores not just WHETHER the person
-- consented but the FULL TEXT of the label they were shown, so if the wording
-- is ever revised the historical record still proves exactly what that person
-- agreed to on that date. Spec 6.3.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_submissions (
  id                     TEXT PRIMARY KEY,
  created_at             TEXT NOT NULL,
  name                   TEXT NOT NULL,
  email                  TEXT NOT NULL,
  phone                  TEXT NOT NULL,
  topic                  TEXT NOT NULL,
  message                TEXT NOT NULL,
  consent_service        INTEGER NOT NULL,
  consent_marketing      INTEGER NOT NULL,
  consent_service_text   TEXT NOT NULL,
  consent_marketing_text TEXT NOT NULL,
  page_url               TEXT NOT NULL,
  user_agent             TEXT,
  ip_address             TEXT,
  status                 TEXT NOT NULL DEFAULT 'new'
);

-- ---------------------------------------------------------------------------
-- Job applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id               TEXT PRIMARY KEY,
  created_at       TEXT NOT NULL,
  position         TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,
  location         TEXT NOT NULL,
  linkedin_url     TEXT,
  licensed         TEXT NOT NULL,
  notes            TEXT,
  resume_key       TEXT NOT NULL,
  resume_filename  TEXT NOT NULL,
  resume_size      INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_applications_created  ON applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_position ON applications(position);
CREATE INDEX IF NOT EXISTS idx_contact_created       ON contact_submissions(created_at DESC);
