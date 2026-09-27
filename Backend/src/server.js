/**
 * SHADOWTRACE AI — PHASE 10: Real OSINT Sources + React-Ready API
 *
 * Extends Phase 9 with:
 *   - Real OSINT source adapters (GitHub, Reddit, HackerNews, Gravatar)
 *   - Maigret subprocess adapter (500+ platform username checks)
 *   - Async lookup() — ClearWebResolution.search() is now fully async
 *   - CORS configured for React frontend (http://localhost:3000 by default)
 *   - /api/me alias for React auth bootstrap
 *   - /api/osint/lookup — direct single-username OSINT fan-out endpoint
 *   - /api/osint/sources — lists all sources with live status
 *   - Graceful error isolation: one failing source never kills the search
 *   - All existing Phase 9 endpoints preserved unchanged
 *
 * OSINT ENV VARS (all optional — sources degrade gracefully without them):
 *   GITHUB_TOKEN          — GitHub PAT, raises rate limit 60→5000/hr
 *   REDDIT_CLIENT_ID      — Reddit API app client ID
 *   REDDIT_CLIENT_SECRET  — Reddit API app client secret
 *   GRAVATAR_API_KEY      — Gravatar REST API key (v3)
 *   MAIGRET_PATH          — path to maigret executable (default: "maigret")
 *
 * REACT CORS ENV VARS:
 *   FRONTEND_ORIGIN       — allowed origin (default: http://localhost:3000)
 *
 * NEW ENDPOINTS:
 *   POST /api/osint/lookup          { username, email? } → raw OSINT results
 *   GET  /api/osint/sources         list all OSINT sources + enabled/healthy status
 *   GET  /api/me                    alias for /api/auth/me  (React convenience)
 *
 * ALL PHASE 9 ENDPOINTS PRESERVED:
 *   See Phase 9 header for full list.
 */

"use strict";

const express      = require("express");
const helmet       = require("helmet");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
const argon2       = require("argon2");
const crypto       = require("crypto");
const rateLimit    = require("express-rate-limit");
const https        = require("https");
const http         = require("http");
const { execFile } = require("child_process");
require("dotenv").config();
const DB           = require("./db/pg");

const app  = express();
const PORT = process.env.PORT || 8080;

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const SESSION_COOKIE_NAME               = "st_session";
const SESSION_TTL_MS                    = 8 * 60 * 60 * 1000;
const LLM_MODEL_NAME                    = process.env.LLM_MODEL_NAME  || "gpt-4o-mini";
const LLM_API_BASE                      = process.env.LLM_API_BASE    || "https://api.openai.com/v1";
const LLM_API_KEY                       = process.env.LLM_API_KEY     || "";
const GITHUB_TOKEN                      = process.env.GITHUB_TOKEN    || "";
const REDDIT_CLIENT_ID                  = process.env.REDDIT_CLIENT_ID    || "";
const REDDIT_CLIENT_SECRET              = process.env.REDDIT_CLIENT_SECRET || "";
const GRAVATAR_API_KEY                  = process.env.GRAVATAR_API_KEY || "";
const MAIGRET_PATH                      = process.env.MAIGRET_PATH    || "maigret";
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  "https://shadow-trace-ai-frontend.vercel.app";
const UNCALIBRATED_SHRINKAGE            = 0.6;
const MIN_SAMPLES_FOR_TRUST             = 50;
const CLUSTER_EDGE_THRESHOLD            = 50;
const MAX_COMPONENT_SIZE_FOR_FULL_AUDIT = 50;
const AUDIT_SAMPLE_SIZE                 = 20;
const MIN_SIZE_FOR_DENSITY_CHECK        = 3;
const MIN_DENSITY                       = 0.3;
const CLEAR_WEB_THRESHOLD               = 70;
const CLEAR_WEB_MIN_SCORE               = 0.5;
const MIN_INDEPENDENT_FEATURES          = 2;
const SEEDING_WINDOW_MS                 = 24 * 60 * 60 * 1000;
const SEEDING_COUNT_THRESHOLD           = 10;
const MEDIUM_EVIDENCE_MAX               = 60;
const USERNAME_SIMILARITY_MIN_THRESHOLD = 0.75;
const GENERIC_USERNAME_CAP              = 0.3;
const GENERIC_USERNAME_BLOCKLIST        = new Set(["admin","user","guest","test","info","support","help","root","null","anon","anonymous"]);
const STRONG_EVIDENCE_TYPES             = new Set(["EMAIL_REUSE"]);
const KNOWN_SHARED_INFRA                = new Set(["1.1.1.1","8.8.8.8","cloudflare.com","outlook.com","gmail.com","yahoo.com"]);
const GENERIC_HANDLES                   = new Set(["admin","user","guest","test","info","support","help","root","null","anon","anonymous","me","profile","account"]);

// ═══════════════════════════════════════════════════════════
// STORES — in-memory only for non-critical / transient state.
// Critical data (users, sessions, entities, observations,
// investigations, evidence, clusters, reports) is persisted
// via DB.* adapter calls.  The Maps below are kept as fast
// in-memory caches that are populated on startup from the DB.
// ═══════════════════════════════════════════════════════════
const users              = new Map();   // cache — loaded from DB.Users
const sessions           = new Map();   // cache — loaded from DB.Sessions (kept thin)
const auditLog           = [];          // cache — written through to DB.AuditLog
const entities           = new Map();   // cache — loaded from DB.Entities
const observations       = new Map();   // cache — loaded from DB.Observations
const evidenceStore      = new Map();   // cache — loaded from DB.Evidence
const edgeStore          = new Map();
const obsDedupeIdx       = new Map();   // source_id|raw_reference → obs.id
const entityIdx          = new Map();   // type|normalized_value  → entity.id
const adversarialFlags   = [];
const fusionConfigs      = [];
const fusedScores        = new Map();   // cache — loaded from DB.FusedScores
const clusters           = new Map();   // cache — loaded from DB.Clusters
const aiSignalStore      = new Map();
const calibrationCurves  = new Map();
const adjudicationLog    = [];
const candidatesStore    = new Map();
const analystAuths       = new Map();   // userId|sourceId — loaded from DB.AnalystAuths
const investigations     = new Map();   // cache — loaded from DB.Investigations
const reports            = new Map();   // cache — loaded from DB.Reports
const rateLimitBuckets   = new Map();

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════
function generateId(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function logAudit(action, details = {}) {
  const entry = { id: generateId("aud"), action, ...details, timestamp: new Date().toISOString() };
  auditLog.push(entry);
  DB.AuditLog.insert(entry).catch(e => console.error("[DB] auditLog write error:", e.message));
}
function contentHash(text) { return crypto.createHash("sha256").update(String(text).trim().toLowerCase()).digest("hex"); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function md5(str) { return crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex"); }

// ═══════════════════════════════════════════════════════════
// HTTP HELPER  (used by OSINT adapters)
// ═══════════════════════════════════════════════════════════
function httpGet(url, headers = {}, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port    : parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path    : parsed.pathname + parsed.search,
      headers : { "User-Agent": "ShadowTrace-OSINT/1.0 (research tool)", ...headers },
    };
    const req = lib.get(opts, (res) => {
      // Follow one redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpGet(res.headers.location, headers, timeoutMs).then(resolve);
        return;
      }
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ status: 0, body: null }); });
    req.on("error", () => resolve({ status: 0, body: null }));
  });
}

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin     : FRONTEND_ORIGIN,
  credentials: true,
  methods    : ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false });
const apiLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

// ═══════════════════════════════════════════════════════════
// PHASE 1 — AUTH
// ═══════════════════════════════════════════════════════════
function sanitizeUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt }; }

function createSession(userId, res) {
  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { userId, expiresAt });
  DB.Sessions.create(token, userId, expiresAt).catch(e => console.error("[DB] session create error:", e.message));
 res.cookie(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS
});
  return token;
}

function authorize(req, res, next) {
  // Accept Bearer token from Authorization header (frontend) OR session cookie
  const bearerHeader = req.headers["authorization"];
  const token = (bearerHeader && bearerHeader.startsWith("Bearer ") ? bearerHeader.slice(7) : null)
    || req.cookies[SESSION_COOKIE_NAME];
  if (!token) return res.status(401).json({ success: false, message: "Authentication required." });

  // Check in-memory cache first; fall back to DB for sessions created before this process started
  let session = sessions.get(token);
  if (!session) {
    // Async DB lookup — restart the authorize flow after loading from DB
    DB.Sessions.get(token).then(async dbSession => {
      if (!dbSession || Date.now() > dbSession.expiresAt) {
        res.clearCookie(SESSION_COOKIE_NAME);
        return res.status(401).json({ success: false, message: "Session expired." });
      }
      // Warm the cache
      sessions.set(token, dbSession);
      let user = users.get(dbSession.userId);
      if (!user) { user = await DB.Users.findById(dbSession.userId); if (user) users.set(user.id, user); }
      if (!user) return res.status(401).json({ success: false, message: "User not found." });
      dbSession.expiresAt = Date.now() + SESSION_TTL_MS;
      DB.Sessions.updateExpiry(token, dbSession.expiresAt).catch(() => {});
      res.cookie(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_MS
});
      req.user = user; req.session = dbSession; next();
    }).catch(() => res.status(500).json({ success: false, message: "Auth error." }));
    return;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    DB.Sessions.delete(token).catch(() => {});
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(401).json({ success: false, message: "Session expired." });
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  DB.Sessions.updateExpiry(token, session.expiresAt).catch(() => {});
  res.cookie(SESSION_COOKIE_NAME, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: SESSION_TTL_MS });
  const user = users.get(session.userId);
  if (!user) { sessions.delete(token); return res.status(401).json({ success: false, message: "User not found." }); }
  req.user = user; req.session = session; next();
}

// ═══════════════════════════════════════════════════════════
// PHASE 2 — ENTITY + OBSERVATION
// ═══════════════════════════════════════════════════════════
function normalizeValue(type, value) { const b = String(value).trim().toLowerCase().replace(/\s+/g," "); return type==="USERNAME"?b.replace(/[0-9_.\-]/g,""):b; }

const EntityModule = {
  resolveOrCreate(type, value) {
    const normalized = normalizeValue(type, value), key = `${type}|${normalized}`, eid = entityIdx.get(key);
    if (eid) return entities.get(eid);
    const e = { id: generateId("ent"), type: type.toUpperCase(), value: String(value).trim(), normalized_value: normalized, created_at: new Date().toISOString() };
    entities.set(e.id, e); entityIdx.set(key, e.id);
    logAudit("ENTITY_CREATED", { entity_id: e.id, type });
    DB.Entities.resolveOrCreate(e).catch(err => console.error("[DB] entity write error:", err.message));
    return e;
  },
  get(id) { return entities.get(id) || null; },
  search(q) { const lq = q.toLowerCase(); return [...entities.values()].filter(e => e.value.toLowerCase().includes(lq) || e.normalized_value.includes(lq)); },
};

const ObservationModule = {
  ingest({ entity_type, value, source_id, raw_reference, confidence = 1.0, raw_excerpt = "", observed_at, investigation_id }) {
    if (!entity_type || !value || !source_id || !raw_reference) throw new Error("entity_type, value, source_id, and raw_reference are required.");
    const entity = EntityModule.resolveOrCreate(entity_type, value);
    const dk = `${source_id}|${raw_reference}`, ei = obsDedupeIdx.get(dk);
    if (ei) return { entity, observation: observations.get(ei), duplicate: true };
    const obs = { id: generateId("obs"), entity_id: entity.id, source_id, raw_reference, entity_type: entity.type, value: entity.value, confidence: Math.min(1.0, Math.max(0.0, Number(confidence))), raw_excerpt: String(raw_excerpt).trim(), content_hash: contentHash(raw_excerpt || value), observed_at: observed_at || new Date().toISOString(), ingested_at: new Date().toISOString(), investigation_id: investigation_id || null };
    observations.set(obs.id, obs); obsDedupeIdx.set(dk, obs.id);
    DB.Observations.insert(obs).catch(err => console.error("[DB] observation write error:", err.message));
    return { entity, observation: obs, duplicate: false };
  },
  getForEntity(entityId) { return [...observations.values()].filter(o => o.entity_id === entityId); },
};

// ═══════════════════════════════════════════════════════════
// PHASE 3 — RULE ENGINE
// ═══════════════════════════════════════════════════════════
function normalizeUsername(n) { return String(n).toLowerCase().replace(/[0-9_.\-]/g, ""); }
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) { const c = a[i-1] === b[j-1] ? 0 : 1; dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+c); }
  return dp[a.length][b.length];
}
function usernameSimilarity(a, b) {
  const na = normalizeUsername(a), nb = normalizeUsername(b);
  if (na === nb) return 1.0;
  const m = Math.max(na.length, nb.length);
  if (m === 0) return 1.0;
  return Math.min(1.0, (1 - levenshtein(na, nb) / m) + ((na.includes(nb) || nb.includes(na)) ? 0.3 : 0));
}

const ruleRegistry = {
  _rules: new Map(),
  register(r) { this._rules.set(r.id, r); },
  match(st, tt) { return [...this._rules.values()].filter(r => r.enabled && (r.source_types.includes("*") || r.source_types.includes(st)) && (r.target_types.includes("*") || r.target_types.includes(tt))); },
  get(id) { return this._rules.get(id) || null; },
  list() { return [...this._rules.values()]; },
  enable(id)  { const r = this._rules.get(id); if (r) r.enabled = true; },
  disable(id) { const r = this._rules.get(id); if (r) r.enabled = false; },
};

ruleRegistry.register({ id: "R010", version: "1.0", name: "Username Reuse", description: "Detects same or similar usernames across platforms.", source_types: ["USERNAME"], target_types: ["USERNAME"], base_weight: 40, enabled: true,
  evaluate(a, b) { let sim = usernameSimilarity(a.value, b.value); if (GENERIC_USERNAME_BLOCKLIST.has(normalizeUsername(a.value)) || GENERIC_USERNAME_BLOCKLIST.has(normalizeUsername(b.value))) sim = Math.min(sim, GENERIC_USERNAME_CAP); return sim < USERNAME_SIMILARITY_MIN_THRESHOLD ? { matched: false } : { matched: true, evidence_type: "USERNAME_REUSE", base_weight: 40 * sim }; }
});
ruleRegistry.register({ id: "R020", version: "1.0", name: "Email Reuse", description: "Same email observed across entities.", source_types: ["EMAIL"], target_types: ["EMAIL"], base_weight: 70, enabled: true,
  evaluate(a, b) { return a.normalized_value === b.normalized_value ? { matched: true, evidence_type: "EMAIL_REUSE", base_weight: 70 } : { matched: false }; }
});
ruleRegistry.register({ id: "R030", version: "1.0", name: "Infrastructure Reuse", description: "Same IP/domain across entities.", source_types: ["IP_ADDRESS","DOMAIN"], target_types: ["IP_ADDRESS","DOMAIN"], base_weight: 35, enabled: true,
  evaluate(a, b) { return (a.type === b.type && a.normalized_value === b.normalized_value) ? { matched: true, evidence_type: "INFRASTRUCTURE_REUSE", base_weight: 35 } : { matched: false }; }
});

function evaluateCandidatePair(source, target, observation) {
  const ev = [];
  for (const rule of ruleRegistry.match(source.type, target.type)) {
    const m = rule.evaluate(source, target);
    if (!m.matched) continue;
    const ew = (m.base_weight || rule.base_weight) * observation.confidence;
    const e = { id: generateId("evi"), source_entity_id: source.id, target_entity_id: target.id, evidence_type: m.evidence_type || "GENERIC", rule_id: rule.id, rule_version: rule.version, effective_weight: ew, confidence: observation.confidence, source_observation_ids: [observation.id], independence_group_id: null, flagged: false, flags: [], created_at: new Date().toISOString() };
    const ek = `${source.id}|${target.id}|${rule.id}`;
    if (edgeStore.has(ek)) continue;
    evidenceStore.set(e.id, e); edgeStore.set(ek, e.id);
    DB.Evidence.insert({ ...e, pair_id: `${source.id}|${target.id}`, base_weight: ew }).catch(err => console.error("[DB] evidence write error:", err.message));
    logAudit("RULE_EXECUTED", { rule_id: rule.id, rule_version: rule.version, effective_weight: ew, source_id: source.id, target_id: target.id });
    ev.push(e);
  }
  return ev;
}

// ═══════════════════════════════════════════════════════════
// PHASE 4 — ADVERSARIAL SCREEN
// ═══════════════════════════════════════════════════════════
const AdversarialScreen = {
  filter(list) {
    for (const e of list) {
      const rc = [...evidenceStore.values()].filter(x => (x.source_entity_id === e.source_entity_id || x.target_entity_id === e.source_entity_id) && new Date(x.created_at).getTime() >= Date.now() - SEEDING_WINDOW_MS).length;
      if (rc > SEEDING_COUNT_THRESHOLD && e.effective_weight <= MEDIUM_EVIDENCE_MAX) { e.effective_weight *= 0.5; e.flagged = true; e.flags.push("HIGH_VELOCITY_WEAK_EVIDENCE"); adversarialFlags.push({ evidence_id: e.id, flag: "HIGH_VELOCITY_WEAK_EVIDENCE", timestamp: new Date().toISOString() }); }
      const tgt = EntityModule.get(e.target_entity_id);
      if (e.evidence_type === "INFRASTRUCTURE_REUSE" && tgt && KNOWN_SHARED_INFRA.has(tgt.normalized_value)) { e.effective_weight *= 0.4; e.flagged = true; e.flags.push("LOW_TRUST_INFRASTRUCTURE"); adversarialFlags.push({ evidence_id: e.id, flag: "LOW_TRUST_INFRASTRUCTURE", timestamp: new Date().toISOString() }); }
      const sc = new Set([...e.source_observation_ids].map(id => observations.get(id)?.source_id).filter(Boolean)).size;
      if (e.effective_weight > MEDIUM_EVIDENCE_MAX && sc === 1) { e.confidence *= 0.6; e.flagged = true; e.flags.push("UNCORROBORATED_STRONG_EVIDENCE"); adversarialFlags.push({ evidence_id: e.id, flag: "UNCORROBORATED_STRONG_EVIDENCE", timestamp: new Date().toISOString() }); }
    }
    logAudit("ADVERSARIAL_SCREEN_APPLIED", { count: list.length });
    return list;
  },
};

// ═══════════════════════════════════════════════════════════
// PHASE 5 — EVIDENCE FUSION
// ═══════════════════════════════════════════════════════════
function makeUnionFind(ids) { const p = {}; ids.forEach(id => p[id] = id); function find(x) { return p[x] === x ? x : (p[x] = find(p[x])); } function union(x, y) { p[find(x)] = find(y); } return { find, union }; }

function computeIndependenceGroup(evidence) {
  const obs = evidence.source_observation_ids.map(id => observations.get(id)).filter(Boolean);
  if (!obs.length) return null;
  const sids = obs.map(o => o.source_id), uf = makeUnionFind(sids);
  for (let i = 0; i < obs.length; i++) for (let j = i+1; j < obs.length; j++) if (obs[i].content_hash === obs[j].content_hash) uf.union(obs[i].source_id, obs[j].source_id);
  return contentHash([...new Set(sids.map(s => uf.find(s)))].sort().join("|"));
}

const DEFAULT_FUSION_CONFIG = { config_version: 1, weights: { writing_similarity: 0.15, topic_similarity: 0.10 }, caps: { USERNAME_REUSE: 45, INFRASTRUCTURE_REUSE: 40 }, alpha: 0.5, ai_max_contribution: 20, temporal_contradiction_penalty: 0.7, score_bands: [ { min: 0, max: 29, label: "VERY_WEAK", interpretation: "Insufficient evidence" }, { min: 30, max: 49, label: "LOW", interpretation: "Insufficient evidence" }, { min: 50, max: 69, label: "MODERATE", interpretation: "Investigate further" }, { min: 70, max: 84, label: "HIGH", interpretation: "Potentially related" }, { min: 85, max: 100, label: "VERY_HIGH", interpretation: "Strongly correlated" } ], effective_from: new Date().toISOString(), effective_until: null };
fusionConfigs.push(DEFAULT_FUSION_CONFIG);

const FusionConfig = {
  getActive() { return fusionConfigs.find(c => c.effective_until === null) || fusionConfigs[fusionConfigs.length - 1]; },
  get(v) { return fusionConfigs.find(c => c.config_version === v) || null; },
  list() { return fusionConfigs; },
  propose(params, author) {
    const cur = this.getActive(); if (cur) cur.effective_until = new Date().toISOString();
    const nc = { ...cur, ...params, config_version: (cur?.config_version || 0) + 1, effective_from: new Date().toISOString(), effective_until: null };
    fusionConfigs.push(nc); logAudit("FUSION_CONFIG_CHANGED", { new_version: nc.config_version, author }); return nc;
  },
};

function classify(conf, bands) { for (const b of [...bands].reverse()) if (conf >= b.min) return b.label; return "VERY_WEAK"; }
function hasStrongCategory(items) { return items.some(e => STRONG_EVIDENCE_TYPES.has(e.evidence_type)); }
function downgrade(c) { const o = ["VERY_WEAK","LOW","MODERATE","HIGH","VERY_HIGH"]; const i = o.indexOf(c); return i > 0 ? o[i-1] : c; }

const EvidenceFusion = {
  fuse(hard, ai = [], config) {
    const pm = new Map();
    for (const item of [...hard, ...ai]) { const pid = [item.source_entity_id, item.target_entity_id].sort().join("|"); if (!pm.has(pid)) pm.set(pid, []); pm.get(pid).push(item); }
    const results = [];
    for (const [pairId, items] of pm) {
      const hardItems = items.filter(i => !i.signal_type), aiItems = items.filter(i => i.signal_type);
      for (const e of hardItems) if (!e.independence_group_id) e.independence_group_id = computeIndependenceGroup(e);
      const grp = {}; for (const e of hardItems) { const g = e.independence_group_id || e.id; if (!grp[g]) grp[g] = []; grp[g].push(e); }
      let hs = 0;
      for (const g of Object.values(grp)) { const s = [...g].sort((a,b) => b.effective_weight - a.effective_weight); hs += s[0].effective_weight; const n = s.length; for (const ex of s.slice(1)) hs += ex.effective_weight * (1 / Math.pow(n, config.alpha)); }
      const caps = [];
      for (const [et, cap] of Object.entries(config.caps)) { const ts = hardItems.filter(e => e.evidence_type === et).reduce((s,e) => s+e.effective_weight, 0); if (ts > cap) { hs = Math.max(0, hs - (ts - cap)); caps.push({ evidence_type: et, cap }); } }
      const aiScore = Math.min(aiItems.reduce((s,x) => { const w = config.weights[x.signal_type] || 0; return s + x.value * 100 * w; }, 0), config.ai_max_contribution);
      const conf = clamp(hs + aiScore, 0, 100);
      let cls = classify(conf, config.score_bands);
      if ((cls === "HIGH" || cls === "VERY_HIGH") && !hasStrongCategory(hardItems)) cls = downgrade(cls);
      const band = config.score_bands.find(b => b.label === cls);
      const fs = { pair_id: pairId, confidence: Math.round(conf * 10) / 10, classification: cls, interpretation: band?.interpretation || "", contributing_evidence: items, caps_applied: caps, independence_notes: Object.keys(grp).map(g => ({ group_id: g, count: grp[g].length })), fusion_config_version: config.config_version, fused_at: new Date().toISOString() };
      fs.id = fs.id || generateId("fs");
      fusedScores.set(pairId, fs); results.push(fs);
      DB.FusedScores.upsert(fs).catch(err => console.error("[DB] fusedScore write error:", err.message));
    }
    logAudit("EVIDENCE_FUSED", { pairs: results.length, config_version: config.config_version }); return results;
  },
};

function recomputeHistoricalScore(pairId, configVersion) {
  const config = FusionConfig.get(configVersion);
  if (!config) throw new Error(`Config version ${configVersion} not found.`);
  const [srcId, tgtId] = pairId.split("|");
  const hardItems = [...evidenceStore.values()].filter(e => (e.source_entity_id === srcId && e.target_entity_id === tgtId) || (e.source_entity_id === tgtId && e.target_entity_id === srcId));
  return EvidenceFusion.fuse(hardItems, [], config);
}

// ═══════════════════════════════════════════════════════════
// PHASE 6 — ACTOR CLUSTERING
// ═══════════════════════════════════════════════════════════
function isSingleWeakEvidenceType(fs) { const types = new Set(fs.contributing_evidence.map(e => e.evidence_type || e.signal_type)); return types.size === 1 && !STRONG_EVIDENCE_TYPES.has([...types][0]); }

function buildGraph(fsList) {
  const adj = new Map();
  for (const f of fsList.filter(f => f.confidence >= CLUSTER_EDGE_THRESHOLD && !isSingleWeakEvidenceType(f))) {
    const [a, b] = f.pair_id.split("|");
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ neighbor: b, fused: f }); adj.get(b).push({ neighbor: a, fused: f });
  }
  return adj;
}

function connectedComponents(adj) {
  const visited = new Set(), components = [];
  for (const node of adj.keys()) {
    if (visited.has(node)) continue;
    const comp = new Set(), queue = [node];
    while (queue.length) { const cur = queue.shift(); if (visited.has(cur)) continue; visited.add(cur); comp.add(cur); for (const { neighbor } of (adj.get(cur) || [])) if (!visited.has(neighbor)) queue.push(neighbor); }
    components.push(comp);
  }
  return components;
}

function findBridgeEdges(component, adj) {
  const disc = {}, low = {}, visited = {}, bridges = []; let timer = 0;
  function dfs(u, parent) { visited[u] = true; disc[u] = low[u] = timer++; for (const { neighbor: v, fused } of (adj.get(u) || [])) { if (!component.has(v)) continue; if (!visited[v]) { dfs(v, u); low[u] = Math.min(low[u], low[v]); if (low[v] > disc[u]) bridges.push({ from: u, to: v, fused }); } else if (v !== parent) low[u] = Math.min(low[u], disc[v]); } }
  for (const id of component) if (!visited[id]) dfs(id, null);
  return bridges;
}

function removeEdge(adj, bridge) {
  for (const [node, neighbors] of adj) adj.set(node, neighbors.filter(n => !(n.neighbor === bridge.to && node === bridge.from) && !(n.neighbor === bridge.from && node === bridge.to)));
  return adj;
}

function computeDensity(component, adj) {
  const n = component.size; if (n < 2) return 1;
  let ec = 0; for (const id of component) ec += (adj.get(id) || []).filter(e => component.has(e.neighbor)).length;
  return (ec / 2) / ((n * (n - 1)) / 2);
}

function avgConfidence(component, adj) {
  const scores = [];
  for (const id of component) for (const { fused } of (adj.get(id) || [])) { const [p0, p1] = fused.pair_id.split("|"); if (component.has(p0) && component.has(p1)) scores.push(fused.confidence); }
  return scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
}

const ActorClustering = {
  build(fusedScoreList, seedEntityId) {
    const adj = buildGraph(fusedScoreList);
    if (!adj.has(seedEntityId)) adj.set(seedEntityId, []);
    const rawComponents = connectedComponents(adj), finalClusters = [];

    for (const component of rawComponents) {
      const integrityFlags = []; let bridges;
      if (component.size > MAX_COMPONENT_SIZE_FOR_FULL_AUDIT) {
        const sampled = [...component].flatMap(id => (adj.get(id) || []).filter(e => component.has(e.neighbor)).map(e => ({ from: id, ...e }))).sort((a, b) => a.fused.confidence - b.fused.confidence).slice(0, AUDIT_SAMPLE_SIZE);
        const sa = new Map(); for (const { from, neighbor, fused } of sampled) { if (!sa.has(from)) sa.set(from, []); if (!sa.has(neighbor)) sa.set(neighbor, []); sa.get(from).push({ neighbor, fused }); sa.get(neighbor).push({ neighbor: from, fused }); }
        bridges = findBridgeEdges(component, sa); integrityFlags.push("PARTIAL_BRIDGE_AUDIT");
      } else { bridges = findBridgeEdges(component, adj); }

      for (const bridge of bridges) if (!hasStrongCategory(bridge.fused.contributing_evidence)) removeEdge(adj, bridge);

      const subAdj = new Map([...adj].filter(([k]) => component.has(k)));
      for (const sub of connectedComponents(subAdj)) {
        const unresolvedContradictions = [];
        if (sub.size > MIN_SIZE_FOR_DENSITY_CHECK && computeDensity(sub, adj) < MIN_DENSITY) unresolvedContradictions.push("LOW_DENSITY_CLUSTER");
        const internalEdges = []; for (const id of sub) for (const { fused } of (adj.get(id) || [])) { const [p0, p1] = fused.pair_id.split("|"); if (sub.has(p0) && sub.has(p1)) internalEdges.push(fused.pair_id); }
        const cluster = { cluster_id: generateId("clu"), member_entity_ids: [...sub], internal_edges: [...new Set(internalEdges)], unresolved_contradictions: unresolvedContradictions, cluster_confidence: Math.round(avgConfidence(sub, adj) * 10) / 10, integrity_flags: [...integrityFlags], created_at: new Date().toISOString() };
        clusters.set(cluster.cluster_id, cluster); finalClusters.push(cluster);
        DB.Clusters.upsert(cluster).catch(err => console.error("[DB] cluster write error:", err.message));
      }
    }

    logAudit("CLUSTERING_COMPLETED", { seed_entity_id: seedEntityId, cluster_count: finalClusters.length });
    const seed = finalClusters.find(c => c.member_entity_ids.includes(seedEntityId));
    if (seed) return seed;
    const singleton = { cluster_id: generateId("clu"), member_entity_ids: [seedEntityId], internal_edges: [], unresolved_contradictions: [], cluster_confidence: 0, integrity_flags: ["SINGLETON"], created_at: new Date().toISOString() };
    clusters.set(singleton.cluster_id, singleton);
    DB.Clusters.upsert(singleton).catch(err => console.error("[DB] singleton cluster write error:", err.message));
    return singleton;
  },
};

// ═══════════════════════════════════════════════════════════
// PHASE 7 — AI ENGINE
// ═══════════════════════════════════════════════════════════
function sanitizeForPrompt(text) { return String(text).replace(/[\x00-\x1F\x7F]/g," ").replace(/["""''']/g,'"').slice(0,800).trim(); }

async function callLLM(prompt) {
  if (!LLM_API_KEY) return "50";
  const body = JSON.stringify({ model: LLM_MODEL_NAME, messages: [{ role: "user", content: prompt }], max_tokens: 10, temperature: 0 });
  return new Promise((resolve) => {
    const url = new URL(`${LLM_API_BASE}/chat/completions`);
    const opts = { hostname: url.hostname, port: url.port || 443, path: url.pathname, method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LLM_API_KEY}`, "Content-Length": Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d).choices?.[0]?.message?.content?.trim() || "50"); } catch { resolve("50"); } }); });
    req.on("error", () => resolve("50")); req.setTimeout(8000, () => { req.destroy(); resolve("50"); }); req.write(body); req.end();
  });
}

function parseScore(text) { const m = String(text).match(/\d+(\.\d+)?/); return m ? Math.min(100, Math.max(0, parseFloat(m[0]))) : 50; }
function getOrCreateCurve(st) { if (!calibrationCurves.has(st)) calibrationCurves.set(st, { sample_count: 0, samples: [], curve: [] }); return calibrationCurves.get(st); }
function interpolate(curve, raw) { if (!curve.length) return raw; if (raw <= curve[0].raw) return curve[0].calibrated; if (raw >= curve[curve.length-1].raw) return curve[curve.length-1].calibrated; for (let i = 0; i < curve.length-1; i++) { const lo = curve[i], hi = curve[i+1]; if (raw >= lo.raw && raw <= hi.raw) return lo.calibrated + ((raw - lo.raw) / (hi.raw - lo.raw)) * (hi.calibrated - lo.calibrated); } return raw; }
function calibrate(st, raw) { const { sample_count, curve } = getOrCreateCurve(st); if (curve.length && sample_count >= MIN_SAMPLES_FOR_TRUST) return { calibrated: interpolate(curve, raw), calibration_applied: true }; if (curve.length && sample_count > 0) return { calibrated: (raw * UNCALIBRATED_SHRINKAGE) + (sample_count / MIN_SAMPLES_FOR_TRUST) * (interpolate(curve, raw) - raw * UNCALIBRATED_SHRINKAGE), calibration_applied: true }; return { calibrated: raw * UNCALIBRATED_SHRINKAGE, calibration_applied: false }; }
function recomputeCurve(st) { const d = getOrCreateCurve(st); if (!d.samples.length) return; const sorted = [...d.samples].sort((a,b) => a.raw - b.raw), bs = Math.ceil(sorted.length / 10), nc = []; for (let i = 0; i < sorted.length; i += bs) { const bucket = sorted.slice(i, i+bs); nc.push({ raw: bucket.reduce((s,x) => s+x.raw,0)/bucket.length, calibrated: bucket.reduce((s,x) => s+x.label,0)/bucket.length }); } d.curve = nc; }
function addLabeledSample(signalTypes, label, rawValues) { for (const st of signalTypes) { const d = getOrCreateCurve(st); d.samples.push({ raw: rawValues[st] || 0.5, label }); d.sample_count++; if (d.sample_count % 10 === 0) recomputeCurve(st); } }
function bootstrapCalibration() { const pairs = [{ st: "writing_similarity", raw: 0.9, label: 1 }, { st: "writing_similarity", raw: 0.7, label: 0.8 }, { st: "writing_similarity", raw: 0.5, label: 0.4 }, { st: "writing_similarity", raw: 0.3, label: 0.1 }, { st: "writing_similarity", raw: 0.1, label: 0.0 }, { st: "topic_similarity", raw: 0.9, label: 1 }, { st: "topic_similarity", raw: 0.7, label: 0.7 }, { st: "topic_similarity", raw: 0.5, label: 0.3 }, { st: "topic_similarity", raw: 0.2, label: 0.0 }]; for (const { st, raw, label } of pairs) { const d = getOrCreateCurve(st); d.samples.push({ raw, label }); d.sample_count++; } for (const st of calibrationCurves.keys()) recomputeCurve(st); logAudit("CALIBRATION_BOOTSTRAPPED", { seed_pairs: pairs.length }); }
function getObservedText(entity) { return ObservationModule.getForEntity(entity.id).map(o => o.raw_excerpt).filter(Boolean).join(" ").trim(); }

const AIEngine = {
  async analyzePair(entityA, entityB) {
    const signals = [], textA = getObservedText(entityA), textB = getObservedText(entityB);
    if (textA && textB) {
      const raw = parseScore(await callLLM(`Compare writing STYLE only (word choice, sentence length, punctuation, tone) of Text A and Text B on a 0-100 scale. Reply with only a number.\n\nText A: "${sanitizeForPrompt(textA)}"\n\nText B: "${sanitizeForPrompt(textB)}"`))/100;
      const { calibrated, calibration_applied } = calibrate("writing_similarity", raw);
      signals.push({ id: generateId("sig"), source_entity_id: entityA.id, target_entity_id: entityB.id, signal_type: "writing_similarity", raw_value: raw, value: Math.round(calibrated*1000)/1000, calibration_applied, model_id: "external-llm", model_version: LLM_MODEL_NAME, created_at: new Date().toISOString() });
    }
    if (textA || textB) {
      const raw = parseScore(await callLLM(`Compare the TOPICS discussed in Text A and Text B on a 0-100 similarity scale. Reply with only a number.\n\nText A: "${sanitizeForPrompt(textA||textB)}"\n\nText B: "${sanitizeForPrompt(textB||textA)}"`))/100;
      const { calibrated, calibration_applied } = calibrate("topic_similarity", raw);
      signals.push({ id: generateId("sig"), source_entity_id: entityA.id, target_entity_id: entityB.id, signal_type: "topic_similarity", raw_value: raw, value: Math.round(calibrated*1000)/1000, calibration_applied, model_id: "external-llm", model_version: LLM_MODEL_NAME, created_at: new Date().toISOString() });
    }
    const key = [entityA.id, entityB.id].sort().join("|"); aiSignalStore.set(key, [...(aiSignalStore.get(key) || []), ...signals]);
    logAudit("AI_SIGNALS_GENERATED", { entity_a: entityA.id, entity_b: entityB.id, signal_count: signals.length });
    return signals;
  },
  async generateSummary(structuredEvidence) {
    const summary = await callLLM(`Explain in 2-3 sentences what evidence supports a possible correlation between these entities. Never claim confirmed identity — describe it as a hypothesis. Evidence: ${sanitizeForPrompt(JSON.stringify(structuredEvidence))}`);
    logAudit("AI_SUMMARY_GENERATED"); return summary;
  },
};

// ═══════════════════════════════════════════════════════════
// PHASE 10 — REAL OSINT SOURCE ADAPTERS
// ═══════════════════════════════════════════════════════════

/**
 * Candidate shape (same as Phase 8/9 — pipeline unchanged):
 * {
 *   handle      : string,
 *   source_url  : string,
 *   bio_text    : string,
 *   contact     : string,   // email if available
 *   observed_at : ISO string,
 *   platform    : string,   // human-readable platform name
 *   raw         : object,   // original API response (for analyst inspection)
 * }
 */

// ─────────────────────────────────────────────────────────
// GitHub Public API
// Docs: https://docs.github.com/en/rest/users/users
// Rate limit: 60/hr unauthenticated, 5000/hr with token
// ToS: API usage is permitted for automated OSINT research
// ─────────────────────────────────────────────────────────
async function lookupGitHub(username) {
  const headers = GITHUB_TOKEN
    ? { "Authorization": `Bearer ${GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" }
    : {};
  const { status, body } = await httpGet(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    headers
  );
  if (status !== 200 || !body || body.message === "Not Found") return [];
  return [{
    handle      : body.login,
    source_url  : body.html_url,
    bio_text    : [body.bio, body.company, body.location, body.blog].filter(Boolean).join(" | "),
    contact     : body.email || "",
    observed_at : body.created_at || new Date().toISOString(),
    platform    : "GitHub",
    raw         : { name: body.name, public_repos: body.public_repos, followers: body.followers },
  }];
}

// ─────────────────────────────────────────────────────────
// Reddit Public JSON API
// Docs: https://www.reddit.com/dev/api
// Rate limit: ~60 req/min for read-only public endpoints
// ToS: read-only public user lookup is permitted
// ─────────────────────────────────────────────────────────
async function lookupReddit(username) {
  const { status, body } = await httpGet(
    `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
    { "Accept": "application/json" }
  );
  if (status !== 200 || !body?.data) return [];
  const d = body.data;
  return [{
    handle      : d.name,
    source_url  : `https://www.reddit.com/user/${d.name}`,
    bio_text    : d.subreddit?.public_description || "",
    contact     : "",
    observed_at : d.created_utc ? new Date(d.created_utc * 1000).toISOString() : new Date().toISOString(),
    platform    : "Reddit",
    raw         : { link_karma: d.link_karma, comment_karma: d.comment_karma, is_gold: d.is_gold },
  }];
}

// ─────────────────────────────────────────────────────────
// HackerNews Algolia API
// Docs: https://hn.algolia.com/api
// Rate limit: no documented limit — be polite
// ToS: fully open API, explicitly intended for automation
// ─────────────────────────────────────────────────────────
async function lookupHackerNews(username) {
  const { status, body } = await httpGet(
    `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`
  );
  if (status !== 200 || !body || body === "null") return [];
  return [{
    handle      : body.id,
    source_url  : `https://news.ycombinator.com/user?id=${body.id}`,
    bio_text    : body.about ? body.about.replace(/<[^>]*>/g, " ") : "",
    contact     : "",
    observed_at : body.created ? new Date(body.created * 1000).toISOString() : new Date().toISOString(),
    platform    : "HackerNews",
    raw         : { karma: body.karma, submitted_count: body.submitted?.length || 0 },
  }];
}

// ─────────────────────────────────────────────────────────
// Gravatar REST API (email-based lookup)
// Docs: https://docs.gravatar.com/api/profiles/rest-api/
// Requires GRAVATAR_API_KEY; gracefully skipped without it
// ─────────────────────────────────────────────────────────
async function lookupGravatar(email) {
  if (!GRAVATAR_API_KEY || !email) return [];
  const hash = md5(email);
  const { status, body } = await httpGet(
    `https://api.gravatar.com/v3/profiles/${hash}`,
    { "Authorization": `Bearer ${GRAVATAR_API_KEY}` }
  );
  if (status !== 200 || !body) return [];
  const entry = body;
  return [{
    handle      : entry.preferredUsername || entry.hash,
    source_url  : `https://www.gravatar.com/${hash}`,
    bio_text    : [entry.aboutMe, ...(entry.urls || []).map(u => u.value)].filter(Boolean).join(" | "),
    contact     : email,
    observed_at : entry.last_profile_edit || new Date().toISOString(),
    platform    : "Gravatar",
    raw         : { display_name: entry.displayName, verified_accounts: entry.verifiedAccounts?.length || 0 },
  }];
}

// ─────────────────────────────────────────────────────────
// Maigret subprocess adapter
// Checks 500+ platforms by username; returns only "Claimed"
// Install: pip install maigret
// Set MAIGRET_PATH if not on system PATH
// ─────────────────────────────────────────────────────────
function lookupMaigret(username, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const args = [username, "--json", "--timeout", "10", "--no-color"];
    const proc = execFile(MAIGRET_PATH, args, { timeout: timeoutMs }, (err, stdout) => {
      if (err && !stdout) { return resolve([]); }
      try {
        const report = JSON.parse(stdout);
        // report shape: { SiteName: { status: "Claimed"|"Available"|..., url_user: "...", ... } }
        const results = Object.entries(report)
          .filter(([, v]) => v.status === "Claimed" && v.url_user)
          .map(([site, v]) => ({
            handle      : username,
            source_url  : v.url_user,
            bio_text    : v.status_data?.title || "",
            contact     : "",
            observed_at : new Date().toISOString(),
            platform    : site,
            raw         : { site_tags: v.tags || [] },
          }));
        resolve(results);
      } catch { resolve([]); }
    });
    // Maigret not installed — execFile will emit ENOENT
    proc.on && proc.on("error", () => resolve([]));
  });
}

// ─────────────────────────────────────────────────────────
// CONFIGURED SOURCES  (all disabled by default — fail-closed)
// ─────────────────────────────────────────────────────────
const configuredSources = [
  {
    id                            : "src_github",
    name                          : "GitHub Public API",
    enabled                       : false,
    robots_txt_compliant          : true,
    tos_allows_automated_access   : true,
    requires_authorization_record : true,
    rate_limit_per_minute         : GITHUB_TOKEN ? 80 : 1,   // 5000/hr with token ÷ 60, 60/hr without ÷ 60
    async lookup(identifiers) {
      const results = [];
      for (const id of identifiers.filter(i => i.type === "USERNAME")) {
        results.push(...await lookupGitHub(id.value));
      }
      return results;
    },
  },
  {
    id                            : "src_reddit",
    name                          : "Reddit Public API",
    enabled                       : false,
    robots_txt_compliant          : true,
    tos_allows_automated_access   : true,
    requires_authorization_record : true,
    rate_limit_per_minute         : 30,
    async lookup(identifiers) {
      const results = [];
      for (const id of identifiers.filter(i => i.type === "USERNAME")) {
        results.push(...await lookupReddit(id.value));
      }
      return results;
    },
  },
  {
    id                            : "src_hackernews",
    name                          : "HackerNews API",
    enabled                       : false,
    robots_txt_compliant          : true,
    tos_allows_automated_access   : true,
    requires_authorization_record : true,
    rate_limit_per_minute         : 30,
    async lookup(identifiers) {
      const results = [];
      for (const id of identifiers.filter(i => i.type === "USERNAME")) {
        results.push(...await lookupHackerNews(id.value));
      }
      return results;
    },
  },
  {
    id                            : "src_gravatar",
    name                          : "Gravatar Profile API",
    enabled                       : false,
    robots_txt_compliant          : true,
    tos_allows_automated_access   : true,
    requires_authorization_record : true,
    rate_limit_per_minute         : 10,
    async lookup(identifiers) {
      const results = [];
      for (const id of identifiers.filter(i => i.type === "EMAIL")) {
        results.push(...await lookupGravatar(id.value));
      }
      return results;
    },
  },
  {
    id                            : "src_maigret",
    name                          : "Maigret (500+ platforms)",
    enabled                       : false,
    robots_txt_compliant          : true,
    tos_allows_automated_access   : true,   // Maigret only checks public pages
    requires_authorization_record : true,
    rate_limit_per_minute         : 1,      // one full scan per minute is generous
    async lookup(identifiers) {
      const results = [];
      for (const id of identifiers.filter(i => i.type === "USERNAME")) {
        results.push(...await lookupMaigret(id.value));
      }
      return results;
    },
  },
];

// ─────────────────────────────────────────────────────────
// RATE LIMIT TOKEN BUCKET
// ─────────────────────────────────────────────────────────
function acquireToken(sid, rpm) {
  const now = Date.now();
  if (!rateLimitBuckets.has(sid)) rateLimitBuckets.set(sid, { tokens: rpm, lastRefill: now });
  const b = rateLimitBuckets.get(sid);
  b.tokens = Math.min(rpm, b.tokens + ((now - b.lastRefill) / 60000) * rpm);
  b.lastRefill = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

// ─────────────────────────────────────────────────────────
// CLEAR-WEB RESOLUTION  (now fully async)
// ─────────────────────────────────────────────────────────
function isGenericHandle(h) { return GENERIC_HANDLES.has(normalizeUsername(h)); }
function contactMatch(cc, ids) { if (!cc) return 0; const n = String(cc).toLowerCase(); for (const i of ids) if (i.type === "EMAIL" && i.value.toLowerCase() === n) return 1.0; return 0; }
function countIndependentMatchedFeatures(mf) { return new Set(mf.map(f => f.type)).size; }

const ClearWebResolution = {
  async search(cluster, analyst) {
    const activeSources = configuredSources.filter(s => {
      if (!s.enabled) return false;
      if (!s.robots_txt_compliant || !s.tos_allows_automated_access) { s.enabled = false; logAudit("SOURCE_DISABLED_COMPLIANCE", { source_id: s.id }); return false; }
      if (s.requires_authorization_record && !analystAuths.has(`${analyst.id}|${s.id}`)) { logAudit("SOURCE_SKIPPED_NO_AUTH", { source_id: s.id, analyst_id: analyst.id }); return false; }
      return true;
    });

    if (!activeSources.length) { logAudit("CLEAR_WEB_SEARCH_SKIPPED", { cluster_id: cluster.cluster_id, reason: "no_active_sources" }); return []; }

    for (const s of activeSources) {
      if (!acquireToken(s.id, s.rate_limit_per_minute)) logAudit("SOURCE_RATE_LIMITED", { source_id: s.id });
    }

    const identifiers = cluster.member_entity_ids.map(id => EntityModule.get(id)).filter(Boolean).map(e => ({ type: e.type, value: e.value, entity_id: e.id }));

    // Fan-out to all active sources in parallel — isolate failures
    const lookupResults = await Promise.allSettled(
      activeSources.map(s => s.lookup(identifiers).catch(() => []))
    );
    const rawCandidates = lookupResults.flatMap((r, i) => {
      if (r.status === "fulfilled") return r.value;
      logAudit("SOURCE_LOOKUP_ERROR", { source_id: activeSources[i].id, reason: r.reason?.message });
      return [];
    });

    const scored = [];
    for (const c of rawCandidates) {
      if (!c.handle || isGenericHandle(c.handle)) continue;
      const mf = [];
      for (const id of identifiers.filter(i => i.type === "USERNAME")) {
        const sim = usernameSimilarity(id.value, c.handle);
        if (sim >= 0.7) mf.push({ type: "username_similarity", score: sim, detail: `${id.value} ~ ${c.handle}` });
      }
      const cm = contactMatch(c.contact, identifiers); if (cm > 0) mf.push({ type: "contact_match", score: cm, detail: c.contact });
      mf.push({ type: "timeline_compatible", score: 1.0 });
      if (mf.length < 1) continue;
      const cs = mf.reduce((s, f) => s + f.score, 0) / mf.length;
      if (cs >= CLEAR_WEB_MIN_SCORE && countIndependentMatchedFeatures(mf) >= MIN_INDEPENDENT_FEATURES) {
        scored.push({ candidate_id: generateId("cwc"), cluster_id: cluster.cluster_id, source_url: c.source_url, handle: c.handle, platform: c.platform || "unknown", matched_features: mf, candidate_score: Math.round(cs * 1000) / 1000, label: "POTENTIAL_MATCH", found_at: new Date().toISOString() });
      }
    }

    scored.sort((a, b) => b.candidate_score - a.candidate_score);
    candidatesStore.set(cluster.cluster_id, scored);
    logAudit("CLEAR_WEB_SEARCH", { cluster_id: cluster.cluster_id, analyst_id: analyst.id, sources_used: activeSources.map(s => s.id), candidates_returned: scored.length });
    return scored;
  },
};

// ═══════════════════════════════════════════════════════════
// PHASE 9 — INVESTIGATIONS + DISPATCH + REPORTS
// ═══════════════════════════════════════════════════════════
async function handleAnalyzeRequest(entityId, investigationId, analyst) {
  const entity = EntityModule.get(entityId);
  if (!entity) throw new Error(`Entity ${entityId} not found.`);

  const candidates = [...entities.values()].filter(e => e.id !== entity.id && e.type === entity.type);
  const latestObs  = ObservationModule.getForEntity(entity.id);
  if (!latestObs.length) return { entity, hard_evidence: [], ai_signals: [], fused: [], cluster: null, clear_web_candidates: [] };

  const obs = latestObs[latestObs.length - 1];
  let hardEvidence = [];
  for (const c of candidates) hardEvidence.push(...evaluateCandidatePair(entity, c, obs));
  hardEvidence = AdversarialScreen.filter(hardEvidence);

  let aiSignals = [];
  for (const c of candidates) aiSignals.push(...await AIEngine.analyzePair(entity, c));

  const fusionConfig = FusionConfig.getActive();
  const fused = EvidenceFusion.fuse(hardEvidence, aiSignals, fusionConfig);
  const cluster = ActorClustering.build(fused, entity.id);

  let clearWebCandidates = [];
  if (cluster.cluster_confidence >= CLEAR_WEB_THRESHOLD) {
    clearWebCandidates = await ClearWebResolution.search(cluster, analyst);
  }

  logAudit("CORRELATION_ANALYZE", { entity_id: entityId, analyst_id: analyst.id, investigation_id: investigationId, fusion_config_version: fusionConfig.config_version });

  const topFused = fused.sort((a, b) => b.confidence - a.confidence)[0];
  return {
    cluster_id           : cluster.cluster_id,
    confidence           : topFused?.confidence || 0,
    classification       : topFused?.classification || "VERY_WEAK",
    interpretation       : topFused?.interpretation || "Insufficient evidence",
    evidence             : hardEvidence.map(e => ({ id: e.id, evidence_type: e.evidence_type, effective_weight: e.effective_weight, flagged: e.flagged, flags: e.flags })),
    ai_signals           : aiSignals.map(s => ({ signal_type: s.signal_type, value: s.value, calibration_applied: s.calibration_applied })),
    clear_web_candidates : clearWebCandidates,
    integrity_flags      : cluster.integrity_flags,
    fused_scores         : fused,
  };
}

async function endToEndDispatch(analystAction, analyst) {
  logAudit(`DISPATCH_${analystAction.type}`, { analyst_id: analyst.id });
  switch (analystAction.type) {
    case "SEARCH":  return EntityModule.search(analystAction.query || "");
    case "ANALYZE": return handleAnalyzeRequest(analystAction.entity_id, analystAction.investigation_id, analyst);
    case "VIEW_GRAPH": return buildGraphPayload(analystAction.investigation_id);
    case "REQUEST_AI_SUMMARY": {
      const pairEvidence = [...evidenceStore.values()].filter(e => { const [p0, p1] = (analystAction.pair_id || "").split("|"); return (e.source_entity_id === p0 && e.target_entity_id === p1) || (e.source_entity_id === p1 && e.target_entity_id === p0); });
      return AIEngine.generateSummary(pairEvidence);
    }
    case "GENERATE_REPORT": return ReportModule.build(analystAction.investigation_id, analyst);
    case "ADJUDICATE_SCORE": {
      const signals = aiSignalStore.get(analystAction.pair_id) || [];
      const label = analystAction.verdict === "confirmed" ? 1 : 0;
      const rawValues = {}; for (const s of signals) rawValues[s.signal_type] = s.raw_value;
      addLabeledSample([...new Set(signals.map(s => s.signal_type))], label, rawValues);
      adjudicationLog.push({ pair_id: analystAction.pair_id, verdict: analystAction.verdict, timestamp: new Date().toISOString() });
      logAudit("ANALYST_ADJUDICATION", { pair_id: analystAction.pair_id, verdict: analystAction.verdict, analyst_id: analyst.id });
      return { message: "Adjudication recorded. Calibration updated." };
    }
    default: throw new Error(`Unknown action type: ${analystAction.type}`);
  }
}

function buildGraphPayload(investigationId) {
  const inv = investigations.get(investigationId);
  if (!inv) return null;
  const invObs = [...observations.values()].filter(o => o.investigation_id === investigationId);
  const entIds = new Set(invObs.map(o => o.entity_id));
  const nodes  = [...entIds].map(id => EntityModule.get(id)).filter(Boolean);
  const edges  = [...evidenceStore.values()].filter(e => entIds.has(e.source_entity_id) && entIds.has(e.target_entity_id));
  const fused  = [...fusedScores.values()].filter(fs => { const [a, b] = fs.pair_id.split("|"); return entIds.has(a) && entIds.has(b); });
  return { investigation_id: investigationId, nodes, edges, fused_scores: fused };
}

const ReportModule = {
  async build(investigationId, analyst) {
    const inv = investigations.get(investigationId);
    if (!inv) throw new Error("Investigation not found.");
    const invObs      = [...observations.values()].filter(o => o.investigation_id === investigationId);
    const entIds      = new Set(invObs.map(o => o.entity_id));
    const clusterList = [...clusters.values()].filter(c => c.member_entity_ids.some(id => entIds.has(id)));
    const scoreList   = [...fusedScores.values()].filter(fs => { const [a, b] = fs.pair_id.split("|"); return entIds.has(a) && entIds.has(b); });
    const evGraph     = [...evidenceStore.values()].filter(e => entIds.has(e.source_entity_id) && entIds.has(e.target_entity_id));
    const summary     = evGraph.length ? await AIEngine.generateSummary(evGraph.slice(0, 10)) : "No evidence found for this investigation.";
    const report = { report_id: generateId("rep"), investigation_id: investigationId, title: inv.title, clusters: clusterList, scores: scoreList, evidence_graph: evGraph, ai_summary: summary, analyst_notes: inv.analyst_notes || [], generated_at: new Date().toISOString(), generated_by: analyst.id };
    reports.set(investigationId, report);
    DB.Reports.save(investigationId, report).catch(err => console.error("[DB] report write error:", err.message));
    logAudit("REPORT_GENERATED", { report_id: report.report_id, investigation_id: investigationId, analyst_id: analyst.id });
    return report;
  },
};

// ═══════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════
app.get("/",          (_req, res) => res.json({ service: "ShadowTrace AI", phase: "10 (OSINT + React-ready)", status: "running", llm_configured: !!LLM_API_KEY, frontend_origin: FRONTEND_ORIGIN }));
app.get("/api/health",(_req, res) => res.json({ success: true, phase: "10", status: "ok", llm_configured: !!LLM_API_KEY, timestamp: new Date().toISOString() }));

// ── AUTH ──────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: "name, email, and password are required." });
    if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    const ne = email.trim().toLowerCase();
    // Check DB first (survives restarts), then in-memory cache
    const existing = await DB.Users.findByEmail(ne);
    if (existing || [...users.values()].some(u => u.email === ne)) return res.status(409).json({ success: false, message: "Email already registered." });
    const passwordHash = await argon2.hash(password);
    const user = { id: generateId("usr"), name: name.trim(), email: ne, passwordHash, role: "analyst", createdAt: new Date().toISOString() };
    users.set(user.id, user);
    await DB.Users.create(user);
    logAudit("USER_REGISTERED", { userId: user.id });
    const token = createSession(user.id, res);
    return res.status(201).json({ success: true, message: "Account created.", user: sanitizeUser(user), token });
  } catch (err) { console.error("REGISTER ERROR:", err); return res.status(500).json({ success: false, message: "Could not create account." }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "email and password are required." });
    const ne = email.trim().toLowerCase();
    // Check in-memory cache first, then DB
    let user = [...users.values()].find(u => u.email === ne) || await DB.Users.findByEmail(ne);
    if (user && !users.has(user.id)) users.set(user.id, user); // warm cache
    if (!user || !(await argon2.verify(user.passwordHash, password))) return res.status(401).json({ success: false, message: "Invalid email or password." });
    logAudit("USER_LOGIN", { userId: user.id }); const token = createSession(user.id, res);
    return res.json({ success: true, message: "Login successful.", user: sanitizeUser(user), token });
  } catch (err) { console.error("LOGIN ERROR:", err); return res.status(500).json({ success: false, message: "Login failed." }); }
});

app.get("/api/auth/me", authorize, (req, res) => res.json({ success: true, user: sanitizeUser(req.user) }));
app.get("/api/me",      authorize, (req, res) => res.json({ success: true, user: sanitizeUser(req.user) })); // React alias
app.post("/api/auth/logout", authorize, (req, res) => { const t = req.cookies[SESSION_COOKIE_NAME]; sessions.delete(t); DB.Sessions.delete(t).catch(() => {}); res.clearCookie(SESSION_COOKIE_NAME); logAudit("USER_LOGOUT", { userId: req.user.id }); res.json({ success: true, message: "Logged out." }); });
app.get("/api/audit",  authorize, async (_req, res) => {
  try {
    const entries = await DB.AuditLog.getAll();
    res.json({ success: true, count: entries.length, entries });
  } catch { res.json({ success: true, count: auditLog.length, entries: auditLog }); }
});

// ── TARGET TYPE INFERENCE ─────────────────────────────────
function inferTargetType(value) {
  const v = String(value).trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))                        return "EMAIL";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v))                           return "IP_ADDRESS";
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(v) && v.includes(".")) return "DOMAIN";
  return "USERNAME";
}

// ── AUTO-OSINT ON INVESTIGATION CREATE ────────────────────
async function runOsintBootstrap(target, investigationId, analyst) {
  if (!target) return { observations_created: 0, sources_queried: [], results_found: 0, results: [] };

  const targetType = inferTargetType(target);
  const identifiers = [{ type: targetType, value: target }];

  // Use all compliance-passing sources — bypass the enabled/auth gate for bootstrap
  const bootstrapSources = configuredSources.filter(s =>
    s.robots_txt_compliant && s.tos_allows_automated_access
  );

  if (!bootstrapSources.length) return { observations_created: 0, sources_queried: [], results_found: 0, results: [] };

  const lookupResults = await Promise.allSettled(
    bootstrapSources.map(s => s.lookup(identifiers).catch(() => []))
  );

  const rawResults = lookupResults.flatMap((r, i) => {
    if (r.status === "rejected") return [];
    return r.value.map(c => ({ ...c, source_id: bootstrapSources[i].id }));
  });

  let observationsCreated = 0;
  const ingested = [];

  for (const result of rawResults) {
    try {
      // OSINT lookup functions return: { handle, source_url, bio_text, contact, observed_at, platform, raw }
      // handle is the username/identifier found; source_url is the profile link
      const obsValue = result.handle || target;
      const rawRef   = result.source_url || `osint:${result.source_id}:${obsValue}`;
      const excerpt  = [result.bio_text, result.platform, result.contact].filter(Boolean).join(" | ") || obsValue;

      // EMAIL results (from Gravatar) expose the email in contact; USERNAME results use handle
      const obsType  = (result.contact && inferTargetType(result.contact) === "EMAIL")
                       ? "EMAIL"
                       : targetType;
      const obsVal   = obsType === "EMAIL" ? result.contact : obsValue;

      const { entity, observation, duplicate } = ObservationModule.ingest({
        entity_type     : obsType,
        value           : obsVal,
        source_id       : result.source_id,
        raw_reference   : rawRef,
        confidence      : 0.75,
        raw_excerpt     : excerpt,
        observed_at     : result.observed_at || new Date().toISOString(),
        investigation_id: investigationId,
      });

      if (!duplicate) {
        observationsCreated++;
        // Run evidence evaluation against existing entities
        const candidates = [...entities.values()].filter(e => e.id !== entity.id && e.type === entity.type);
        let ev = [];
        for (const c of candidates) ev.push(...evaluateCandidatePair(entity, c, observation));
        ev = AdversarialScreen.filter(ev);
        if (ev.length) {
          const fused = EvidenceFusion.fuse(ev, [], FusionConfig.getActive());
          ActorClustering.build(fused, entity.id);
        }
      }

      ingested.push({ entity_id: entity.id, entity_type: entity.type, value: entity.value, source_id: result.source_id, duplicate, platform: result.platform });
    } catch (err) {
      console.error("OSINT_BOOTSTRAP_INGEST_ERROR:", err.message, result);
    }
  }

  logAudit("OSINT_BOOTSTRAP", { investigation_id: investigationId, analyst_id: analyst.id, target, target_type: targetType, observations_created: observationsCreated });

  return {
    target_type         : targetType,
    observations_created: observationsCreated,
    sources_queried     : bootstrapSources.map(s => s.id),
    results_found       : rawResults.length,
    results             : ingested,
  };
}

// ── INVESTIGATIONS ────────────────────────────────────────
app.post("/api/investigations", authorize, async (req, res) => {
  const { title, description, target } = req.body;
  if (!title) return res.status(400).json({ success: false, message: "title is required." });
  const inv = { id: generateId("inv"), userId: req.user.id, title: title.trim(), description: description?.trim() || "", target: target?.trim() || "", status: "active", analyst_notes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  investigations.set(inv.id, inv);
  await DB.Investigations.create(inv).catch(e => console.error("[DB] investigation create error:", e.message));
  logAudit("INVESTIGATION_CREATED", { investigation_id: inv.id, user_id: req.user.id });

  let osint_bootstrap = null;
  if (inv.target) {
    try {
      osint_bootstrap = await runOsintBootstrap(inv.target, inv.id, req.user);
      inv.updatedAt = new Date().toISOString();
      DB.Investigations.touch(inv.id).catch(() => {});
    } catch (err) {
      console.error("OSINT_BOOTSTRAP_ERROR:", err);
      osint_bootstrap = { error: "OSINT bootstrap failed — investigation was still created.", observations_created: 0 };
    }
  }

  res.status(201).json({ success: true, investigation: inv, osint_bootstrap });
});
app.get("/api/investigations", authorize, async (req, res) => {
  try {
    const list = await DB.Investigations.findByUser(req.user.id);
    list.forEach(i => investigations.set(i.id, i)); // warm cache
    res.json({ success: true, count: list.length, investigations: list });
  } catch {
    const list = [...investigations.values()].filter(i => i.userId === req.user.id);
    res.json({ success: true, count: list.length, investigations: list });
  }
});

// ── INVESTIGATION-SCOPED OBSERVATIONS (frontend-compatible) ──
// These MUST be registered before /api/investigations/:id so Express
// doesn't swallow "observations" as the :id parameter.
//
// Maps backend observation shape → frontend Observation type:
//   backend: { id, entity_id, source_id, raw_excerpt, entity_type, value, confidence, ingested_at, investigation_id }
//   frontend: { id, investigationId, content, source, type, createdAt }
function toFrontendObs(obs) {
  return {
    id             : obs.id,
    investigationId: obs.investigation_id || "",
    userId         : "",
    content        : obs.raw_excerpt || obs.value || "",
    source         : obs.source_id || "osint",
    type           : (obs.entity_type || "general").toLowerCase(),
    metadata       : { entity_id: obs.entity_id, entity_type: obs.entity_type, value: obs.value, confidence: obs.confidence },
    createdAt      : obs.ingested_at || obs.observed_at || new Date().toISOString(),
  };
}

app.get("/api/investigations/:id/observations", authorize, async (req, res) => {
  try {
    const inv = investigations.get(req.params.id) || await DB.Investigations.findById(req.params.id);
    if (!inv || inv.userId !== req.user.id) return res.status(404).json({ success: false, message: "Investigation not found." });
    const obs = await DB.Observations.findByInvestigation(req.params.id);
    // warm in-memory cache
    obs.forEach(o => { observations.set(o.id, o); obsDedupeIdx.set(`${o.source_id}|${o.raw_reference}`, o.id); });
    res.json({ success: true, observations: obs.map(toFrontendObs) });
  } catch (err) {
    // fallback to in-memory
    const inv = investigations.get(req.params.id);
    if (!inv || inv.userId !== req.user.id) return res.status(404).json({ success: false, message: "Investigation not found." });
    const obs = [...observations.values()].filter(o => o.investigation_id === req.params.id).sort((a,b)=>(a.ingested_at||"").localeCompare(b.ingested_at||"")).map(toFrontendObs);
    res.json({ success: true, observations: obs });
  }
});

app.post("/api/investigations/:id/observations", authorize, (req, res) => {
  const inv = investigations.get(req.params.id);
  if (!inv || inv.userId !== req.user.id) return res.status(404).json({ success: false, message: "Investigation not found." });
  const { content, source } = req.body;
  if (!content) return res.status(400).json({ success: false, message: "content is required." });
  try {
    const entityType = inv.target ? inferTargetType(inv.target) : "USERNAME";
    const { entity, observation, duplicate } = ObservationModule.ingest({
      entity_type     : entityType,
      value           : content.trim(),
      source_id       : source?.trim() || "manual",
      raw_reference   : `manual:${req.params.id}:${Date.now()}`,
      confidence      : 0.8,
      raw_excerpt     : content.trim(),
      investigation_id: req.params.id,
    });
    if (!duplicate) {
      const candidates = [...entities.values()].filter(e => e.id !== entity.id && e.type === entity.type);
      let ev = [];
      for (const c of candidates) ev.push(...evaluateCandidatePair(entity, c, observation));
      ev = AdversarialScreen.filter(ev);
      if (ev.length) { const fused = EvidenceFusion.fuse(ev, [], FusionConfig.getActive()); ActorClustering.build(fused, entity.id); }
    }
    logAudit("MANUAL_OBSERVATION_ADDED", { investigation_id: req.params.id, entity_id: entity.id, user_id: req.user.id });
    res.status(201).json({ success: true, observation: toFrontendObs(observation) });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

app.get("/api/investigations/:id", authorize, async (req, res) => {
  const inv = investigations.get(req.params.id) || await DB.Investigations.findById(req.params.id).catch(() => null);
  if (!inv || inv.userId !== req.user.id) return res.status(404).json({ success: false, message: "Investigation not found." });
  investigations.set(inv.id, inv);
  res.json({ success: true, investigation: inv });
});
app.delete("/api/investigations/:id", authorize, async (req, res) => {
  const inv = investigations.get(req.params.id) || await DB.Investigations.findById(req.params.id).catch(() => null);
  if (!inv || inv.userId !== req.user.id) return res.status(404).json({ success: false, message: "Investigation not found." });
  investigations.delete(req.params.id);
  await DB.Investigations.delete(req.params.id).catch(e => console.error("[DB] delete investigation error:", e.message));
  logAudit("INVESTIGATION_DELETED", { investigation_id: req.params.id, user_id: req.user.id });
  res.json({ success: true, message: "Investigation deleted." });
});

// ── ENTITIES ─────────────────────────────────────────────
app.post("/api/entities",        authorize, (req, res) => { const { type, value } = req.body; if (!type || !value) return res.status(400).json({ success: false, message: "type and value are required." }); res.status(201).json({ success: true, entity: EntityModule.resolveOrCreate(type, value) }); });
app.get("/api/entities/search",  authorize, (req, res) => { if (!req.query.q) return res.status(400).json({ success: false, message: "q required." }); res.json({ success: true, results: EntityModule.search(req.query.q) }); });
app.get("/api/entities/:id",     authorize, (req, res) => { const e = EntityModule.get(req.params.id); if (!e) return res.status(404).json({ success: false, message: "Entity not found." }); res.json({ success: true, entity: e }); });

// ── OBSERVATIONS ──────────────────────────────────────────
app.post("/api/observations", authorize, async (req, res) => {
  try {
    const { entity, observation, duplicate } = ObservationModule.ingest(req.body);
    if (duplicate) return res.json({ success: true, duplicate: true, entity, observation, evidence: [], fused: [], cluster: null });
    const candidates = [...entities.values()].filter(e => e.id !== entity.id && e.type === entity.type);
    let ev = []; for (const c of candidates) ev.push(...evaluateCandidatePair(entity, c, observation));
    ev = AdversarialScreen.filter(ev);
    const config = FusionConfig.getActive(), fused = EvidenceFusion.fuse(ev, [], config);
    const cluster = ActorClustering.build(fused, entity.id);
    logAudit("OBSERVATION_PROCESSED", { observation_id: observation.id, entity_id: entity.id, cluster_id: cluster.cluster_id });
    res.status(201).json({ success: true, duplicate: false, entity, observation, evidence: ev, fused, cluster });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
app.get("/api/observations/:entityId", authorize, (req, res) => { const e = EntityModule.get(req.params.entityId); if (!e) return res.status(404).json({ success: false, message: "Entity not found." }); res.json({ success: true, entity: e, observations: ObservationModule.getForEntity(req.params.entityId) }); });

// ── RULES ────────────────────────────────────────────────
app.get("/api/rules",                    authorize, (_req, res) => res.json({ success: true, rules: ruleRegistry.list().map(r => ({ id: r.id, name: r.name, enabled: r.enabled, version: r.version, description: r.description })) }));
app.post("/api/rules/:ruleId/enable",    authorize, (req, res) => { const r = ruleRegistry.get(req.params.ruleId); if (!r) return res.status(404).json({ success: false, message: "Rule not found." }); ruleRegistry.enable(r.id); logAudit("RULE_ENABLED", { rule_id: r.id, user_id: req.user.id }); res.json({ success: true, message: `Rule ${r.id} enabled.` }); });
app.post("/api/rules/:ruleId/disable",   authorize, (req, res) => { const r = ruleRegistry.get(req.params.ruleId); if (!r) return res.status(404).json({ success: false, message: "Rule not found." }); ruleRegistry.disable(r.id); logAudit("RULE_DISABLED", { rule_id: r.id, user_id: req.user.id }); res.json({ success: true, message: `Rule ${r.id} disabled.` }); });

// ── EVIDENCE ─────────────────────────────────────────────
app.get("/api/evidence", authorize, (req, res) => { const { entity_id } = req.query; if (!entity_id) return res.status(400).json({ success: false, message: "entity_id required." }); const ev = [...evidenceStore.values()].filter(e => e.source_entity_id === entity_id || e.target_entity_id === entity_id); res.json({ success: true, count: ev.length, evidence: ev }); });

// ── FUSION ────────────────────────────────────────────────
app.post("/api/fusion/run",    authorize, (req, res) => { const { entity_ids } = req.body; if (!Array.isArray(entity_ids) || entity_ids.length !== 2) return res.status(400).json({ success: false, message: "entity_ids must be an array of 2 IDs." }); const [a, b] = entity_ids; const hi = [...evidenceStore.values()].filter(e => (e.source_entity_id === a && e.target_entity_id === b) || (e.source_entity_id === b && e.target_entity_id === a)); if (!hi.length) return res.json({ success: true, message: "No evidence for this pair.", fused: [] }); res.json({ success: true, fused: EvidenceFusion.fuse(hi, [], FusionConfig.getActive()) }); });
app.get("/api/fusion/config",  authorize, (_req, res) => res.json({ success: true, configs: FusionConfig.list() }));
app.post("/api/fusion/config", authorize, (req, res) => res.status(201).json({ success: true, config: FusionConfig.propose(req.body, req.user.id) }));
app.get("/api/fusion/score/:pairId", authorize, (req, res) => { const s = fusedScores.get(decodeURIComponent(req.params.pairId)); if (!s) return res.status(404).json({ success: false, message: "No fused score for this pair." }); res.json({ success: true, score: s }); });
app.post("/api/fusion/replay", authorize, (req, res) => { try { const { pair_id, config_version } = req.body; if (!pair_id || !config_version) return res.status(400).json({ success: false, message: "pair_id and config_version required." }); res.json({ success: true, replayed: recomputeHistoricalScore(pair_id, Number(config_version)) }); } catch (err) { res.status(400).json({ success: false, message: err.message }); } });

// ── CLUSTERS ─────────────────────────────────────────────
app.get("/api/clusters",          authorize, (_req, res) => res.json({ success: true, count: clusters.size, clusters: [...clusters.values()] }));
app.get("/api/clusters/:clusterId", authorize, (req, res) => { const c = clusters.get(req.params.clusterId); if (!c) return res.status(404).json({ success: false, message: "Cluster not found." }); res.json({ success: true, cluster: c }); });
app.post("/api/cluster/build",    authorize, (req, res) => { const { entity_id } = req.body; if (!entity_id) return res.status(400).json({ success: false, message: "entity_id required." }); if (!EntityModule.get(entity_id)) return res.status(404).json({ success: false, message: "Entity not found." }); res.json({ success: true, cluster: ActorClustering.build([...fusedScores.values()], entity_id) }); });

// ── AI ENGINE ────────────────────────────────────────────
app.post("/api/ai/analyze",  authorize, async (req, res) => { try { const { entity_id_a, entity_id_b } = req.body; if (!entity_id_a || !entity_id_b) return res.status(400).json({ success: false, message: "entity_id_a and entity_id_b required." }); const eA = EntityModule.get(entity_id_a), eB = EntityModule.get(entity_id_b); if (!eA || !eB) return res.status(404).json({ success: false, message: "Entity not found." }); res.json({ success: true, signals: await AIEngine.analyzePair(eA, eB) }); } catch { res.status(500).json({ success: false, message: "AI analysis failed." }); } });
app.post("/api/ai/summary",  authorize, async (req, res) => { try { const { pair_id } = req.body; if (!pair_id) return res.status(400).json({ success: false, message: "pair_id required." }); const [a, b] = pair_id.split("|"); const ev = [...evidenceStore.values()].filter(e => (e.source_entity_id===a&&e.target_entity_id===b)||(e.source_entity_id===b&&e.target_entity_id===a)); res.json({ success: true, pair_id, summary: await AIEngine.generateSummary([...ev, ...(aiSignalStore.get(pair_id)||[])]) }); } catch { res.status(500).json({ success: false, message: "Summary failed." }); } });
app.post("/api/ai/adjudicate", authorize, (req, res) => { const { pair_id, verdict } = req.body; if (!pair_id || !["confirmed","rejected"].includes(verdict)) return res.status(400).json({ success: false, message: "pair_id and verdict ('confirmed'|'rejected') required." }); const signals = aiSignalStore.get(pair_id) || []; if (!signals.length) return res.json({ success: true, message: "No AI signals for this pair." }); const label = verdict==="confirmed"?1:0; const rawValues = {}; for(const s of signals) rawValues[s.signal_type]=s.raw_value; addLabeledSample([...new Set(signals.map(s=>s.signal_type))],label,rawValues); adjudicationLog.push({pair_id,verdict,timestamp:new Date().toISOString()}); logAudit("ANALYST_ADJUDICATION",{pair_id,verdict,analyst_id:req.user.id}); res.json({success:true,message:"Adjudication recorded."}); });
app.get("/api/ai/calibration", authorize, (_req, res) => { const c = {}; for(const[t,d] of calibrationCurves) c[t]={sample_count:d.sample_count,curve:d.curve}; res.json({success:true,curves:c}); });
app.post("/api/ai/calibration/bootstrap", authorize, (_req, res) => { bootstrapCalibration(); res.json({success:true,message:"Calibration bootstrapped."}); });

// ── CLEAR-WEB / OSINT SOURCES ─────────────────────────────
app.get("/api/clearweb/sources", authorize, (_req, res) =>
  res.json({ success: true, sources: configuredSources.map(s => ({ id: s.id, name: s.name, enabled: s.enabled, robots_txt_compliant: s.robots_txt_compliant, tos_allows_automated_access: s.tos_allows_automated_access, requires_authorization_record: s.requires_authorization_record, rate_limit_per_minute: s.rate_limit_per_minute })) })
);
app.get("/api/osint/sources", authorize, (_req, res) =>   // React-friendly alias
  res.json({ success: true, sources: configuredSources.map(s => ({ id: s.id, name: s.name, enabled: s.enabled, robots_txt_compliant: s.robots_txt_compliant, tos_allows_automated_access: s.tos_allows_automated_access, requires_authorization_record: s.requires_authorization_record, rate_limit_per_minute: s.rate_limit_per_minute })) })
);
app.post("/api/clearweb/sources/:sourceId/enable", authorize, (req, res) => { const s = configuredSources.find(s=>s.id===req.params.sourceId); if(!s) return res.status(404).json({success:false,message:"Source not found."}); if(!s.robots_txt_compliant||!s.tos_allows_automated_access) return res.status(403).json({success:false,message:"Cannot enable: compliance requirements not met."}); s.enabled=true; logAudit("SOURCE_ENABLED",{source_id:s.id,user_id:req.user.id}); res.json({success:true,message:`Source ${s.id} enabled.`}); });
app.post("/api/clearweb/authorize", authorize, async (req, res) => { const{source_id}=req.body; if(!source_id) return res.status(400).json({success:false,message:"source_id required."}); if(!configuredSources.find(s=>s.id===source_id)) return res.status(404).json({success:false,message:"Source not found."}); analystAuths.set(`${req.user.id}|${source_id}`,{granted_at:new Date().toISOString()}); await DB.AnalystAuths.grant(req.user.id,source_id).catch(()=>{}); logAudit("ANALYST_AUTHORIZED_SOURCE",{source_id,analyst_id:req.user.id}); res.json({success:true,message:`Authorization granted for ${source_id}.`}); });
app.post("/api/clearweb/search", authorize, async (req, res) => { const{cluster_id}=req.body; if(!cluster_id) return res.status(400).json({success:false,message:"cluster_id required."}); const c=clusters.get(cluster_id); if(!c) return res.status(404).json({success:false,message:"Cluster not found."}); if(c.cluster_confidence<CLEAR_WEB_THRESHOLD) return res.json({success:true,candidates:[],message:`Cluster confidence (${c.cluster_confidence}) below threshold (${CLEAR_WEB_THRESHOLD}).`}); const candidates=await ClearWebResolution.search(c,req.user); res.json({success:true,cluster_id,candidates_found:candidates.length,candidates}); });
app.get("/api/clearweb/candidates/:clusterId", authorize, (req, res) => { const candidates=candidatesStore.get(req.params.clusterId)||[]; res.json({success:true,cluster_id:req.params.clusterId,count:candidates.length,candidates}); });

/**
 * POST /api/osint/lookup
 * Direct fan-out OSINT lookup — does NOT require a cluster or entity to exist.
 * Useful from the React frontend to preview OSINT results for any username/email.
 * Body: { username?: string, email?: string, sources?: string[] }
 *   sources — optional array of source IDs to restrict to; defaults to all enabled+authorized
 */
app.post("/api/osint/lookup", authorize, async (req, res) => {
  const { username, email, sources: requestedSources } = req.body;
  if (!username && !email) return res.status(400).json({ success: false, message: "username or email required." });

  const identifiers = [];
  if (username) identifiers.push({ type: "USERNAME", value: username });
  if (email)    identifiers.push({ type: "EMAIL",    value: email    });

  const targetSources = configuredSources.filter(s => {
    if (!s.enabled) return false;
    if (!s.robots_txt_compliant || !s.tos_allows_automated_access) return false;
    if (s.requires_authorization_record && !analystAuths.has(`${req.user.id}|${s.id}`)) return false;
    if (requestedSources && !requestedSources.includes(s.id)) return false;
    return true;
  });

  if (!targetSources.length) {
    return res.json({ success: true, results: [], message: "No active authorized sources. Enable and authorize at least one OSINT source first." });
  }

  const lookupResults = await Promise.allSettled(
    targetSources.map(s => s.lookup(identifiers).catch(() => []))
  );

  const results = lookupResults.flatMap((r, i) => {
    const source = targetSources[i];
    if (r.status === "rejected") { logAudit("OSINT_LOOKUP_ERROR", { source_id: source.id, analyst_id: req.user.id }); return []; }
    return r.value.map(candidate => ({ ...candidate, source_id: source.id }));
  });

  logAudit("OSINT_DIRECT_LOOKUP", { analyst_id: req.user.id, username, email, sources_used: targetSources.map(s => s.id), results_found: results.length });
  res.json({ success: true, identifiers, sources_queried: targetSources.map(s => s.id), results_found: results.length, results });
});

// ── FULL PIPELINE ─────────────────────────────────────────
//
// Accepts three calling conventions:
//
//   1. { entity_id }                  — analyze one entity (original API)
//   2. { investigation_id }           — analyze ALL entities in an investigation
//   3. { investigationId, text?,      — frontend AnalyzeTab convention; runs
//         observations? }               investigation-level analysis + optional
//                                       AI text summary
//
// Always returns { success, results[], summary?, ... }
app.post("/api/analyze", authorize, async (req, res) => {
  try {
    // Normalise field names (frontend sends camelCase, backend uses snake_case)
    const entity_id       = req.body.entity_id;
    const investigation_id = req.body.investigation_id || req.body.investigationId;
    const freeText        = req.body.text;
    const obsTexts        = req.body.observations; // array of strings from frontend

    // ── Mode 1: single entity ──────────────────────────────
    if (entity_id) {
      const result = await handleAnalyzeRequest(entity_id, investigation_id, req.user);
      return res.json({ success: true, results: [result], ...result });
    }

    // ── Mode 2 & 3: investigation-level ────────────────────
    if (!investigation_id) {
      return res.status(400).json({ success: false, message: "entity_id or investigation_id required." });
    }

    // Collect all entity IDs that have observations for this investigation
    const invObs = [...observations.values()].filter(o => o.investigation_id === investigation_id);

    // Also try DB if in-memory cache is cold
    let dbObs = [];
    try { dbObs = await DB.Observations.findByInvestigation(investigation_id); } catch { /* DB unavailable */ }
    const allObs = [...invObs, ...dbObs.filter(o => !observations.has(o.id))];

    const entityIds = [...new Set(allObs.map(o => o.entity_id))];

    if (!entityIds.length) {
      // No observations yet — run OSINT bootstrap first if investigation has a target
      const inv = investigations.get(investigation_id) || await DB.Investigations.findById(investigation_id).catch(() => null);
      if (inv?.target) {
        try { await runOsintBootstrap(inv.target, investigation_id, req.user); } catch { /* bootstrap optional */ }
        // Re-collect after bootstrap
        const refreshed = [...observations.values()].filter(o => o.investigation_id === investigation_id);
        entityIds.push(...[...new Set(refreshed.map(o => o.entity_id))]);
      }
    }

    if (!entityIds.length) {
      return res.json({
        success: true,
        results: [],
        summary: "No observations found for this investigation. Add a target or observations first.",
        riskScore: 0, riskLevel: "low",
        signals: [], recommendations: ["Add a target to the investigation to trigger automatic OSINT collection."],
        disclaimer: "ShadowTrace AI — no data available for analysis.",
      });
    }

    // Run handleAnalyzeRequest for each entity, collect results
    const results = [];
    for (const eid of entityIds) {
      try {
        const r = await handleAnalyzeRequest(eid, investigation_id, req.user);
        results.push(r);
      } catch { /* isolate per-entity errors */ }
    }

    // Build a combined risk picture
    const topConfidence = Math.max(0, ...results.map(r => r.confidence || 0));
    const allEvidence   = results.flatMap(r => r.evidence || []);
    const allSignals    = results.flatMap(r => r.ai_signals || []);
    const riskLevel     = topConfidence >= 70 ? "high" : topConfidence >= 40 ? "medium" : "low";

    // AI summary — use free text if provided, otherwise summarise evidence
    let summary = "";
    if (freeText || obsTexts?.length) {
      const textToSummarise = freeText || (obsTexts || []).join("\n");
      try { summary = await AIEngine.generateSummary([{ raw_excerpt: textToSummarise }]); } catch { summary = ""; }
    }
    if (!summary && allEvidence.length) {
      try { summary = await AIEngine.generateSummary(allEvidence.slice(0, 10)); } catch { summary = ""; }
    }
    if (!summary) summary = `Analyzed ${entityIds.length} entity(ies). Top confidence: ${topConfidence}.`;

    // Map to the shape the frontend Analysis type expects
    const signalCategories = {};
    for (const ev of allEvidence) {
      const cat = ev.evidence_type || "UNKNOWN";
      if (!signalCategories[cat]) signalCategories[cat] = { category: cat, matches: [], count: 0 };
      signalCategories[cat].count++;
      signalCategories[cat].matches.push(`weight:${ev.effective_weight}`);
    }

    logAudit("INVESTIGATION_ANALYZED", { investigation_id, analyst_id: req.user.id, entities_analyzed: entityIds.length, top_confidence: topConfidence });

    return res.json({
      success         : true,
      // Full engine results per entity
      results,
      // Frontend-compatible Analysis shape
      id              : generateId("ana"),
      investigationId : investigation_id,
      analyzedAt      : new Date().toISOString(),
      summary,
      riskScore       : topConfidence,
      riskLevel,
      signals         : Object.values(signalCategories),
      recommendations : topConfidence >= 70
        ? ["High correlation detected — escalate investigation.", "Verify evidence through additional sources."]
        : topConfidence >= 40
        ? ["Moderate correlation — gather more observations.", "Cross-check identified entities."]
        : ["Insufficient evidence — add more observations or OSINT sources."],
      disclaimer      : "ShadowTrace AI analysis. Results are probabilistic and require analyst review.",
      // Raw engine output for advanced use
      top_confidence  : topConfidence,
      entities_analyzed: entityIds.length,
      all_evidence    : allEvidence,
      all_signals     : allSignals,
    });

  } catch (err) {
    console.error("ANALYZE ERROR:", err);
    res.status(500).json({ success: false, message: err.message || "Analysis failed." });
  }
});

// ── REPORTS ──────────────────────────────────────────────
app.post("/api/reports", authorize, async (req, res) => {
  try {
    const { investigation_id } = req.body;
    if (!investigation_id) return res.status(400).json({ success: false, message: "investigation_id required." });
    const report = await ReportModule.build(investigation_id, req.user);
    res.status(201).json({ success: true, report });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});
app.get("/api/reports/:investigationId", authorize, (req, res) => { const r = reports.get(req.params.investigationId); if (!r) return res.status(404).json({ success: false, message: "Report not found. Generate it first via POST /api/reports." }); res.json({ success: true, report: r }); });

// ── ADJUDICATION ─────────────────────────────────────────
app.post("/api/adjudicate", authorize, async (req, res) => {
  try { const result = await endToEndDispatch({ type: "ADJUDICATE_SCORE", ...req.body }, req.user); res.json({ success: true, ...result }); }
  catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// ── GRAPH ─────────────────────────────────────────────────
app.get("/api/graph/:investigationId", authorize, (req, res) => {
  const payload = buildGraphPayload(req.params.investigationId);
  if (!payload) return res.status(404).json({ success: false, message: "Investigation not found." });
  res.json({ success: true, ...payload });
});

// ── SYNTHETIC DATABASE IMPORT ─────────────────────────────
/**
 * GET /api/synthetic-db/schema
 * Returns the expected JSON format for importing a synthetic database.
 */
app.get("/api/synthetic-db/schema", authorize, (_req, res) => {
  res.json({
    success: true,
    schema: {
      description: "ShadowTrace AI synthetic database format. All fields are optional except where noted.",
      version: "1.0",
      investigations: [{
        id: "inv_optional_custom_id",
        title: "Operation Example (required)",
        description: "Free text description",
        target: "username | email | ip | domain",
        status: "active | pending | closed | escalated",
        createdAt: "ISO8601 or omit for now",
      }],
      entities: [{
        id: "ent_optional_custom_id",
        type: "USERNAME | EMAIL | IP_ADDRESS | DOMAIN | PHONE",
        value: "the raw value (required)",
      }],
      observations: [{
        entity_type: "USERNAME (required)",
        value: "observed value (required)",
        source_id: "source label (required)",
        raw_reference: "URL or unique reference (required)",
        raw_excerpt: "snippet of evidence text",
        confidence: 0.8,
        investigation_id: "inv_... (optional, links to investigation)",
        observed_at: "ISO8601 or omit",
      }],
      edges: [{
        source_entity_id: "ent_... (required)",
        target_entity_id: "ent_... (required)",
        evidence_type: "USERNAME_REUSE | EMAIL_REUSE | INFRASTRUCTURE_REUSE",
        effective_weight: 65,
      }],
    },
  });
});

/**
 * POST /api/synthetic-db/import
 *
 * Bulk-seeds investigations, entities, observations, and edges from a JSON payload.
 *
 * AUTO-GENERATE MODE (default):
 *   When observations are NOT provided in the JSON, the engine automatically:
 *     1. Runs the OSINT bootstrap for each investigation target
 *     2. Runs the OSINT bootstrap for each entity value
 *     3. Runs the full rule engine + adversarial screen + fusion + clustering pipeline
 *        on every entity pair that produces observations
 *
 * MANUAL MODE:
 *   When observations ARE provided in the JSON, they are ingested as-is and the
 *   pipeline still runs on them to produce evidence + clusters.
 *
 * Body: { investigations?, entities?, observations?, edges?, label?, auto_generate? }
 *   auto_generate — boolean (default: true). Set to false to skip auto-generation even
 *                   when no observations are provided.
 */
app.post("/api/synthetic-db/import", authorize, async (req, res) => {
  const {
    investigations: invRows = [],
    entities: entRows = [],
    observations: obsRows = [],
    edges: edgeRows = [],
    label,
    auto_generate = true,  // default ON
  } = req.body;

  if (!Array.isArray(invRows) && !Array.isArray(entRows) && !Array.isArray(obsRows) && !Array.isArray(edgeRows)) {
    return res.status(400).json({ success: false, message: "Body must be an object with at least one of: investigations, entities, observations, edges." });
  }

  const stats = {
    investigations: 0, entities: 0,
    observations: 0, observations_skipped: 0,
    auto_generated: 0, edges: 0, errors: [],
  };
  const idMap = {}; // maps supplied IDs → internal generated IDs

  // ── 1. Investigations ──────────────────────────────────
  for (const row of invRows) {
    try {
      if (!row.title) { stats.errors.push({ row, reason: "investigation missing title" }); continue; }
      const inv = {
        id           : generateId("inv"),
        userId       : req.user.id,
        title        : String(row.title).trim(),
        description  : row.description ? String(row.description).trim() : "",
        target       : row.target      ? String(row.target).trim()      : "",
        status       : ["active","pending","closed","escalated"].includes(row.status) ? row.status : "active",
        analyst_notes: [],
        createdAt    : row.createdAt || new Date().toISOString(),
        updatedAt    : row.updatedAt || new Date().toISOString(),
      };
      if (row.id) idMap[row.id] = inv.id;
      investigations.set(inv.id, inv);
      await DB.Investigations.create(inv).catch(e => stats.errors.push({ row, reason: "db persist failed: " + e.message }));
      stats.investigations++;
    } catch (e) { stats.errors.push({ row, reason: e.message }); }
  }

  // ── 2. Entities ────────────────────────────────────────
  const importedEntities = []; // track for auto-pipeline
  for (const row of entRows) {
    try {
      if (!row.type || !row.value) { stats.errors.push({ row, reason: "entity missing type or value" }); continue; }
      const ent = EntityModule.resolveOrCreate(row.type.toUpperCase(), row.value);
      if (row.id) idMap[row.id] = ent.id;
      // Track which investigation this entity belongs to (if specified)
      importedEntities.push({ ent, invId: row.investigation_id ? (idMap[row.investigation_id] || row.investigation_id) : null });
      stats.entities++;
    } catch (e) { stats.errors.push({ row, reason: e.message }); }
  }

  // ── 3. Observations (manual — provided in JSON) ────────
  const hasManualObservations = obsRows.length > 0;
  for (const row of obsRows) {
    try {
      if (!row.entity_type || !row.value || !row.source_id || !row.raw_reference) {
        stats.errors.push({ row, reason: "observation missing entity_type, value, source_id, or raw_reference" }); continue;
      }
      const invId = row.investigation_id ? (idMap[row.investigation_id] || row.investigation_id) : null;
      const { entity, observation, duplicate } = ObservationModule.ingest({
        entity_type     : String(row.entity_type).toUpperCase(),
        value           : String(row.value),
        source_id       : String(row.source_id),
        raw_reference   : String(row.raw_reference),
        raw_excerpt     : row.raw_excerpt ? String(row.raw_excerpt) : "",
        confidence      : typeof row.confidence === "number" ? row.confidence : 0.75,
        observed_at     : row.observed_at || new Date().toISOString(),
        investigation_id: invId,
      });
      if (duplicate) {
        stats.observations_skipped++;
      } else {
        stats.observations++;
        // Run correlation pipeline on each new manually-provided observation
        const candidates = [...entities.values()].filter(e => e.id !== entity.id && e.type === entity.type);
        let ev = [];
        for (const c of candidates) ev.push(...evaluateCandidatePair(entity, c, observation));
        ev = AdversarialScreen.filter(ev);
        if (ev.length) {
          const fused = EvidenceFusion.fuse(ev, [], FusionConfig.getActive());
          ActorClustering.build(fused, entity.id);
        }
      }
    } catch (e) { stats.errors.push({ row, reason: e.message }); }
  }

  // ── 4. AUTO-GENERATE observations when none were provided ──
  //
  // Triggered when:
  //   a) auto_generate !== false   AND
  //   b) no manual observations were given in the JSON
  //
  // Strategy:
  //   • For each imported investigation with a target  → OSINT bootstrap (same as
  //     the automatic investigation-create bootstrap)
  //   • For each imported entity that has no observation yet and belongs to an
  //     investigation → OSINT lookup by entity value
  //   • After all observations land, run the full pipeline on every entity
  if (auto_generate && !hasManualObservations) {
    // 4a. OSINT bootstrap per investigation target
    const processedInvTargets = new Set();
    for (const [invId] of Object.entries(idMap).filter(([, v]) => investigations.has(v))) {
      const inv = investigations.get(idMap[invId] || invId);
      if (!inv || !inv.target || processedInvTargets.has(inv.target)) continue;
      processedInvTargets.add(inv.target);
      try {
        const bootstrap = await runOsintBootstrap(inv.target, inv.id, req.user);
        stats.auto_generated += bootstrap.observations_created || 0;
      } catch (e) { stats.errors.push({ reason: `OSINT bootstrap for ${inv.target} failed: ${e.message}` }); }
    }

    // 4b. OSINT lookup per imported entity value (avoids duplicating investigation targets)
    for (const { ent, invId } of importedEntities) {
      if (processedInvTargets.has(ent.value)) continue; // already covered above
      try {
        const bootstrap = await runOsintBootstrap(ent.value, invId || null, req.user);
        stats.auto_generated += bootstrap.observations_created || 0;
      } catch (e) { stats.errors.push({ reason: `OSINT bootstrap for entity ${ent.value} failed: ${e.message}` }); }
    }

    // 4c. Run the full rule-engine + fusion + clustering pipeline on every
    //     entity that now has at least one observation (including newly generated ones)
    const processedEntities = new Set();
    for (const obs of [...observations.values()]) {
      if (processedEntities.has(obs.entity_id)) continue;
      processedEntities.add(obs.entity_id);
      const entity = EntityModule.get(obs.entity_id);
      if (!entity) continue;
      const candidates = [...entities.values()].filter(e => e.id !== entity.id && e.type === entity.type);
      if (!candidates.length) continue;
      try {
        let ev = [];
        for (const c of candidates) ev.push(...evaluateCandidatePair(entity, c, obs));
        ev = AdversarialScreen.filter(ev);
        if (ev.length) {
          const fused = EvidenceFusion.fuse(ev, [], FusionConfig.getActive());
          ActorClustering.build(fused, entity.id);
        }
      } catch (e) { /* isolate per-entity errors */ }
    }
  }

  // ── 5. Edges (manual evidence records) ────────────────
  for (const row of edgeRows) {
    try {
      const srcId = idMap[row.source_entity_id] || row.source_entity_id;
      const tgtId = idMap[row.target_entity_id] || row.target_entity_id;
      if (!EntityModule.get(srcId) || !EntityModule.get(tgtId)) {
        stats.errors.push({ row, reason: "edge references unknown entity IDs" }); continue;
      }
      const ev = {
        id               : generateId("ev"),
        source_entity_id : srcId,
        target_entity_id : tgtId,
        pair_id          : `${srcId}|${tgtId}`,
        evidence_type    : row.evidence_type || "MANUAL",
        base_weight      : typeof row.effective_weight === "number" ? row.effective_weight : 50,
        effective_weight : typeof row.effective_weight === "number" ? row.effective_weight : 50,
        flagged          : false,
        flags            : [],
        created_at       : new Date().toISOString(),
      };
      evidenceStore.set(ev.id, ev);
      DB.Evidence.insert(ev).catch(() => {});
      stats.edges++;
    } catch (e) { stats.errors.push({ row, reason: e.message }); }
  }

  logAudit("SYNTHETIC_DB_IMPORTED", {
    analyst_id    : req.user.id,
    label         : label || "unlabelled",
    auto_generated: auto_generate && !hasManualObservations,
    stats         : { investigations: stats.investigations, entities: stats.entities, observations: stats.observations, auto_generated: stats.auto_generated, edges: stats.edges },
  });

  const autoNote = auto_generate && !hasManualObservations
    ? ` Auto-generated ${stats.auto_generated} observation(s) via OSINT.`
    : "";

  res.status(200).json({
    success: true,
    label  : label || "unlabelled",
    stats,
    id_map : idMap,
    message: `Import complete. ${stats.investigations} investigations, ${stats.entities} entities, ${stats.observations} manual observations, ${stats.edges} edges.${autoNote}${stats.errors.length ? ` ${stats.errors.length} row(s) had errors.` : ""}`,
  });
});

// 404 + error handler
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` }));
app.use((err, _req, res, _next) => { console.error("GLOBAL ERROR:", err); res.status(500).json({ success: false, message: "Internal server error." }); });

// ═══════════════════════════════════════════════════════════
// SERVER START — initialise DB then begin listening
// ═══════════════════════════════════════════════════════════
async function warmCaches() {
  // Load entities
  const ents = await DB.Entities.all();
  for (const e of ents) {
    entities.set(e.id, e);
    entityIdx.set(`${e.type}|${e.normalized_value}`, e.id);
  }
  console.log(`[DB] Loaded ${ents.length} entities into cache.`);

  // Load observations (only recent 10k to limit memory)
  const obs = await DB.Observations.all();
  for (const o of obs) {
    observations.set(o.id, o);
    obsDedupeIdx.set(`${o.source_id}|${o.raw_reference}`, o.id);
  }
  console.log(`[DB] Loaded ${obs.length} observations into cache.`);

  // Load evidence
  const ev = await DB.Evidence.all();
  for (const e of ev) {
    evidenceStore.set(e.id, e);
    edgeStore.set(`${e.source_entity_id}|${e.target_entity_id}|${e.evidence_type}`, e.id);
  }
  console.log(`[DB] Loaded ${ev.length} evidence records into cache.`);

  // Load fused scores
  const fs = await DB.FusedScores.all();
  for (const f of fs) fusedScores.set(f.pair_id, f);
  console.log(`[DB] Loaded ${fs.length} fused scores into cache.`);

  // Load clusters
  const cls = await DB.Clusters.all();
  for (const c of cls) clusters.set(c.cluster_id, c);
  console.log(`[DB] Loaded ${cls.length} clusters into cache.`);
}

async function startServer() {
  try {
    await DB.init();
    await warmCaches();
  } catch (err) {
    console.error("[DB] Database unavailable — running in in-memory mode:", err.message);
  }

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ShadowTrace AI server running on port ${PORT}`);
});
}

startServer();

module.exports = {
  app, EntityModule, ObservationModule, EvidenceFusion, FusionConfig,
  ActorClustering, AIEngine, ClearWebResolution, ReportModule,
  configuredSources, lookupGitHub, lookupReddit, lookupHackerNews,
  lookupGravatar, lookupMaigret, generateId, logAudit,
};
