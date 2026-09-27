-- ShadowTrace AI — PostgreSQL Migration
-- Matches the exact data shapes used by phase10 server.js
-- Run once: node src/db/migrate.js
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING throughout)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── USERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'analyst',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SESSIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_sessions (
  token        TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES st_users(id) ON DELETE CASCADE,
  expires_at   BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON st_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON st_sessions(expires_at);

-- ── AUDIT LOG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_audit_log (
  id           TEXT PRIMARY KEY,
  action       TEXT NOT NULL,
  details      JSONB NOT NULL DEFAULT '{}',
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_action ON st_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_ts     ON st_audit_log(timestamp DESC);

-- ── ENTITIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_entities (
  id               TEXT PRIMARY KEY,
  type             TEXT NOT NULL,
  value            TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, normalized_value)
);
CREATE INDEX IF NOT EXISTS idx_entities_type  ON st_entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_value ON st_entities(value);

-- ── OBSERVATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_observations (
  id               TEXT PRIMARY KEY,
  entity_id        TEXT NOT NULL REFERENCES st_entities(id),
  source_id        TEXT NOT NULL,
  raw_reference    TEXT NOT NULL,
  entity_type      TEXT NOT NULL,
  value            TEXT NOT NULL,
  confidence       NUMERIC(5,4) NOT NULL DEFAULT 0.75,
  raw_excerpt      TEXT NOT NULL DEFAULT '',
  content_hash     TEXT NOT NULL,
  observed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  investigation_id TEXT,
  UNIQUE (source_id, raw_reference)
);
CREATE INDEX IF NOT EXISTS idx_obs_entity ON st_observations(entity_id);
CREATE INDEX IF NOT EXISTS idx_obs_inv    ON st_observations(investigation_id);

-- ── EVIDENCE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_evidence (
  id               TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL REFERENCES st_entities(id),
  target_entity_id TEXT NOT NULL REFERENCES st_entities(id),
  pair_id          TEXT NOT NULL,
  evidence_type    TEXT NOT NULL,
  base_weight      NUMERIC(10,4) NOT NULL DEFAULT 50,
  effective_weight NUMERIC(10,4) NOT NULL DEFAULT 50,
  flagged          BOOLEAN NOT NULL DEFAULT FALSE,
  flags            JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evidence_pair   ON st_evidence(pair_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON st_evidence(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_target ON st_evidence(target_entity_id);

-- ── FUSED SCORES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_fused_scores (
  id                  TEXT PRIMARY KEY,
  pair_id             TEXT NOT NULL,
  confidence          NUMERIC(5,2) NOT NULL DEFAULT 0,
  classification      TEXT NOT NULL DEFAULT 'VERY_WEAK',
  interpretation      TEXT NOT NULL DEFAULT '',
  contributing_evidence JSONB NOT NULL DEFAULT '[]',
  caps_applied        JSONB NOT NULL DEFAULT '{}',
  independence_notes  JSONB NOT NULL DEFAULT '[]',
  config_version      INT NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fused_pair ON st_fused_scores(pair_id);

-- ── CLUSTERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_clusters (
  cluster_id           TEXT PRIMARY KEY,
  member_entity_ids    JSONB NOT NULL DEFAULT '[]',
  internal_edges       JSONB NOT NULL DEFAULT '[]',
  cluster_confidence   NUMERIC(5,2) NOT NULL DEFAULT 0,
  integrity_flags      JSONB NOT NULL DEFAULT '[]',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INVESTIGATIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_investigations (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES st_users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  target        TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active',
  analyst_notes JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_user ON st_investigations(user_id);

-- ── REPORTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS st_reports (
  investigation_id TEXT PRIMARY KEY REFERENCES st_investigations(id) ON DELETE CASCADE,
  report_data      JSONB NOT NULL,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ANALYST SOURCE AUTHORIZATIONS ────────────────────────
CREATE TABLE IF NOT EXISTS st_analyst_auths (
  user_id    TEXT NOT NULL REFERENCES st_users(id) ON DELETE CASCADE,
  source_id  TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, source_id)
);
