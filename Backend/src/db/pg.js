/**
 * ShadowTrace AI — PostgreSQL Persistence Adapter
 *
 * Provides the same API as the in-memory Maps/arrays used by server.js,
 * but backed by Postgres. All functions are async.
 *
 * The server imports this module and calls DB.init() on startup,
 * then uses the exported store objects in place of the raw Maps.
 */
"use strict";
require("dotenv").config();
const { Pool } = require("pg");
const fs       = require("fs");
const path     = require("path");

// ─────────────────────────────────────────────────────────
// CONNECTION POOL
// ─────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => console.error("PG pool error:", err.message));

async function query(text, params) {
  const client = await pool.connect();
  try { return await client.query(text, params); }
  finally { client.release(); }
}

// ─────────────────────────────────────────────────────────
// INIT — run migration SQL on startup
// ─────────────────────────────────────────────────────────
async function init() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await query(sql);
  console.log("[DB] Schema ready.");
}

// ─────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────
const Users = {
  async findByEmail(email) {
    const r = await query("SELECT * FROM st_users WHERE email = $1", [email.toLowerCase()]);
    return r.rows[0] ? rowToUser(r.rows[0]) : null;
  },
  async findById(id) {
    const r = await query("SELECT * FROM st_users WHERE id = $1", [id]);
    return r.rows[0] ? rowToUser(r.rows[0]) : null;
  },
  async create({ id, name, email, passwordHash, role, createdAt }) {
    await query(
      "INSERT INTO st_users (id, name, email, password_hash, role, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [id, name, email.toLowerCase(), passwordHash, role, createdAt]
    );
    return this.findById(id);
  },
};

function rowToUser(row) {
  return { id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash, role: row.role, createdAt: row.created_at?.toISOString() };
}

// ─────────────────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────────────────
const Sessions = {
  async create(token, userId, expiresAt) {
    await query(
      "INSERT INTO st_sessions (token, user_id, expires_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [token, userId, expiresAt]
    );
  },
  async get(token) {
    const r = await query("SELECT * FROM st_sessions WHERE token = $1", [token]);
    if (!r.rows[0]) return null;
    return { userId: r.rows[0].user_id, expiresAt: Number(r.rows[0].expires_at) };
  },
  async updateExpiry(token, expiresAt) {
    await query("UPDATE st_sessions SET expires_at = $1 WHERE token = $2", [expiresAt, token]);
  },
  async delete(token) {
    await query("DELETE FROM st_sessions WHERE token = $1", [token]);
  },
  async deleteExpired() {
    await query("DELETE FROM st_sessions WHERE expires_at < $1", [Date.now()]);
  },
};

// ─────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────
const AuditLog = {
  async insert(entry) {
    const { id, action, timestamp, ...details } = entry;
    await query(
      "INSERT INTO st_audit_log (id, action, details, timestamp) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [id, action, JSON.stringify(details), timestamp]
    );
  },
  async getAll() {
    const r = await query("SELECT * FROM st_audit_log ORDER BY timestamp ASC");
    return r.rows.map(row => ({ id: row.id, action: row.action, ...row.details, timestamp: row.timestamp?.toISOString() }));
  },
};

// ─────────────────────────────────────────────────────────
// ENTITIES
// ─────────────────────────────────────────────────────────
const Entities = {
  async resolveOrCreate({ id, type, value, normalized_value }) {
    // Upsert: if the (type, normalized_value) pair already exists, return it
    await query(
      `INSERT INTO st_entities (id, type, value, normalized_value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (type, normalized_value) DO NOTHING`,
      [id, type, value, normalized_value]
    );
    const r = await query("SELECT * FROM st_entities WHERE type = $1 AND normalized_value = $2", [type, normalized_value]);
    return r.rows[0] ? rowToEntity(r.rows[0]) : null;
  },
  async findById(id) {
    const r = await query("SELECT * FROM st_entities WHERE id = $1", [id]);
    return r.rows[0] ? rowToEntity(r.rows[0]) : null;
  },
  async search(q) {
    const r = await query(
      "SELECT * FROM st_entities WHERE value ILIKE $1 OR normalized_value ILIKE $1 LIMIT 200",
      [`%${q}%`]
    );
    return r.rows.map(rowToEntity);
  },
  async all() {
    const r = await query("SELECT * FROM st_entities");
    return r.rows.map(rowToEntity);
  },
};

function rowToEntity(row) {
  return { id: row.id, type: row.type, value: row.value, normalized_value: row.normalized_value, created_at: row.created_at?.toISOString() };
}

// ─────────────────────────────────────────────────────────
// OBSERVATIONS
// ─────────────────────────────────────────────────────────
const Observations = {
  async insert(obs) {
    const r = await query(
      `INSERT INTO st_observations
         (id, entity_id, source_id, raw_reference, entity_type, value, confidence, raw_excerpt, content_hash, observed_at, ingested_at, investigation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (source_id, raw_reference) DO NOTHING
       RETURNING id`,
      [obs.id, obs.entity_id, obs.source_id, obs.raw_reference, obs.entity_type, obs.value,
       obs.confidence, obs.raw_excerpt, obs.content_hash, obs.observed_at, obs.ingested_at, obs.investigation_id || null]
    );
    return r.rowCount > 0; // false = duplicate
  },
  async findByDedupeKey(source_id, raw_reference) {
    const r = await query(
      "SELECT * FROM st_observations WHERE source_id = $1 AND raw_reference = $2",
      [source_id, raw_reference]
    );
    return r.rows[0] ? rowToObs(r.rows[0]) : null;
  },
  async findByEntity(entityId) {
    const r = await query("SELECT * FROM st_observations WHERE entity_id = $1 ORDER BY ingested_at ASC", [entityId]);
    return r.rows.map(rowToObs);
  },
  async findByInvestigation(investigationId) {
    const r = await query("SELECT * FROM st_observations WHERE investigation_id = $1 ORDER BY ingested_at ASC", [investigationId]);
    return r.rows.map(rowToObs);
  },
  async all() {
    const r = await query("SELECT * FROM st_observations ORDER BY ingested_at ASC");
    return r.rows.map(rowToObs);
  },
};

function rowToObs(row) {
  return {
    id: row.id, entity_id: row.entity_id, source_id: row.source_id,
    raw_reference: row.raw_reference, entity_type: row.entity_type, value: row.value,
    confidence: parseFloat(row.confidence), raw_excerpt: row.raw_excerpt,
    content_hash: row.content_hash,
    observed_at: row.observed_at?.toISOString(), ingested_at: row.ingested_at?.toISOString(),
    investigation_id: row.investigation_id,
  };
}

// ─────────────────────────────────────────────────────────
// EVIDENCE
// ─────────────────────────────────────────────────────────
const Evidence = {
  async insert(ev) {
    await query(
      `INSERT INTO st_evidence (id, source_entity_id, target_entity_id, pair_id, evidence_type, base_weight, effective_weight, flagged, flags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [ev.id, ev.source_entity_id, ev.target_entity_id, ev.pair_id, ev.evidence_type,
       ev.base_weight, ev.effective_weight, ev.flagged, JSON.stringify(ev.flags)]
    );
  },
  async findByEntity(entityId) {
    const r = await query(
      "SELECT * FROM st_evidence WHERE source_entity_id = $1 OR target_entity_id = $1",
      [entityId]
    );
    return r.rows.map(rowToEvidence);
  },
  async all() {
    const r = await query("SELECT * FROM st_evidence");
    return r.rows.map(rowToEvidence);
  },
};

function rowToEvidence(row) {
  return {
    id: row.id, source_entity_id: row.source_entity_id, target_entity_id: row.target_entity_id,
    pair_id: row.pair_id, evidence_type: row.evidence_type,
    base_weight: parseFloat(row.base_weight), effective_weight: parseFloat(row.effective_weight),
    flagged: row.flagged, flags: row.flags || [],
    created_at: row.created_at?.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// FUSED SCORES
// ─────────────────────────────────────────────────────────
const FusedScores = {
  async upsert(fs) {
    await query(
      `INSERT INTO st_fused_scores (id, pair_id, confidence, classification, interpretation, contributing_evidence, caps_applied, independence_notes, config_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET confidence=$3, classification=$4, interpretation=$5, contributing_evidence=$6, caps_applied=$7, independence_notes=$8`,
      [fs.id, fs.pair_id, fs.confidence, fs.classification, fs.interpretation || "",
       JSON.stringify(fs.contributing_evidence || []), JSON.stringify(fs.caps_applied || {}),
       JSON.stringify(fs.independence_notes || []), fs.config_version || 1]
    );
  },
  async findByPair(pairId) {
    const r = await query("SELECT * FROM st_fused_scores WHERE pair_id = $1 ORDER BY created_at DESC LIMIT 1", [pairId]);
    return r.rows[0] ? rowToFused(r.rows[0]) : null;
  },
  async all() {
    const r = await query("SELECT DISTINCT ON (pair_id) * FROM st_fused_scores ORDER BY pair_id, created_at DESC");
    return r.rows.map(rowToFused);
  },
};

function rowToFused(row) {
  return {
    id: row.id, pair_id: row.pair_id, confidence: parseFloat(row.confidence),
    classification: row.classification, interpretation: row.interpretation,
    contributing_evidence: row.contributing_evidence || [],
    caps_applied: row.caps_applied || {}, independence_notes: row.independence_notes || [],
    config_version: row.config_version,
  };
}

// ─────────────────────────────────────────────────────────
// CLUSTERS
// ─────────────────────────────────────────────────────────
const Clusters = {
  async upsert(c) {
    await query(
      `INSERT INTO st_clusters (cluster_id, member_entity_ids, internal_edges, cluster_confidence, integrity_flags)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cluster_id) DO UPDATE SET member_entity_ids=$2, internal_edges=$3, cluster_confidence=$4, integrity_flags=$5`,
      [c.cluster_id, JSON.stringify(c.member_entity_ids || []), JSON.stringify(c.internal_edges || []),
       c.cluster_confidence || 0, JSON.stringify(c.integrity_flags || [])]
    );
  },
  async findById(id) {
    const r = await query("SELECT * FROM st_clusters WHERE cluster_id = $1", [id]);
    return r.rows[0] ? rowToCluster(r.rows[0]) : null;
  },
  async all() {
    const r = await query("SELECT * FROM st_clusters ORDER BY created_at DESC");
    return r.rows.map(rowToCluster);
  },
  async count() {
    const r = await query("SELECT COUNT(*) FROM st_clusters");
    return parseInt(r.rows[0].count, 10);
  },
};

function rowToCluster(row) {
  return {
    cluster_id: row.cluster_id, member_entity_ids: row.member_entity_ids || [],
    internal_edges: row.internal_edges || [], cluster_confidence: parseFloat(row.cluster_confidence),
    integrity_flags: row.integrity_flags || [], created_at: row.created_at?.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// INVESTIGATIONS
// ─────────────────────────────────────────────────────────
const Investigations = {
  async create(inv) {
    await query(
      `INSERT INTO st_investigations (id, user_id, title, description, target, status, analyst_notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [inv.id, inv.userId, inv.title, inv.description, inv.target, inv.status,
       JSON.stringify(inv.analyst_notes || []), inv.createdAt, inv.updatedAt]
    );
    return this.findById(inv.id);
  },
  async findById(id) {
    const r = await query("SELECT * FROM st_investigations WHERE id = $1", [id]);
    return r.rows[0] ? rowToInv(r.rows[0]) : null;
  },
  async findByUser(userId) {
    const r = await query("SELECT * FROM st_investigations WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return r.rows.map(rowToInv);
  },
  async delete(id) {
    await query("DELETE FROM st_investigations WHERE id = $1", [id]);
  },
  async touch(id) {
    await query("UPDATE st_investigations SET updated_at = NOW() WHERE id = $1", [id]);
  },
};

function rowToInv(row) {
  return {
    id: row.id, userId: row.user_id, title: row.title, description: row.description,
    target: row.target, status: row.status, analyst_notes: row.analyst_notes || [],
    createdAt: row.created_at?.toISOString(), updatedAt: row.updated_at?.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────
const Reports = {
  async save(investigationId, reportData) {
    await query(
      `INSERT INTO st_reports (investigation_id, report_data) VALUES ($1,$2)
       ON CONFLICT (investigation_id) DO UPDATE SET report_data=$2, generated_at=NOW()`,
      [investigationId, JSON.stringify(reportData)]
    );
  },
  async findByInvestigation(investigationId) {
    const r = await query("SELECT * FROM st_reports WHERE investigation_id = $1", [investigationId]);
    return r.rows[0] ? { ...r.rows[0].report_data, generated_at: r.rows[0].generated_at?.toISOString() } : null;
  },
};

// ─────────────────────────────────────────────────────────
// ANALYST AUTHS
// ─────────────────────────────────────────────────────────
const AnalystAuths = {
  async grant(userId, sourceId) {
    await query(
      "INSERT INTO st_analyst_auths (user_id, source_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [userId, sourceId]
    );
  },
  async has(userId, sourceId) {
    const r = await query("SELECT 1 FROM st_analyst_auths WHERE user_id=$1 AND source_id=$2", [userId, sourceId]);
    return r.rowCount > 0;
  },
};

module.exports = { init, pool, query, Users, Sessions, AuditLog, Entities, Observations, Evidence, FusedScores, Clusters, Investigations, Reports, AnalystAuths };
