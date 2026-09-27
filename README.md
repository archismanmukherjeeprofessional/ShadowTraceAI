# ShadowTrace AI

ShadowTrace AI is an OSINT correlation and investigation platform. It ingests observations about entities (usernames, emails, infrastructure, etc.) from multiple sources, runs them through a deterministic rule engine and an AI-assisted evidence fusion pipeline, clusters correlated entities into actor profiles, and surfaces the results through a React dashboard.

The backend is built as **10 incremental phases**, each a standalone, independently runnable Express server, culminating in Phase 10 — the production server that the frontend connects to.

## Architecture

```
Shadowtrace_frontend/   React + TypeScript + Vite + Tailwind dashboard
shadowtrace ai/          Node.js/Express backend (10 phases)
```

### Backend pipeline (Phase 10)

1. **Core infrastructure** — auth (session-based), audit logging
2. **Entity & observation pipeline** — deduplication, idempotent ingestion
3. **Rule engine** — deterministic hard evidence (e.g. username-reuse, email match, shared infrastructure)
4. **Adversarial plausibility screen** — flags low-trust infrastructure, high-velocity/weak evidence
5. **Evidence fusion** — combines hard evidence with calibrated AI signals under a versioned fusion config
6. **Actor clustering** — bridge-audited, bounded clustering with contradiction tracking
7. **AI engine** — LLM-backed fuzzy signal generation (pluggable, falls back to mock scores if no key is set)
8. **Clear-web resolution** — opt-in, confidence-gated candidate matching
9. **Full pipeline integration**
10. **OSINT sources** — GitHub, Reddit, Gravatar, and Maigret (500+ platform username checks) integrations

Each earlier phase can be run and tested on its own; see [`PHASES.md`](./PHASES.md) for phase-by-phase curl examples and pass criteria.

### Frontend

- React 19 + TypeScript + Vite
- Tailwind CSS
- Pages: landing, login, dashboard, investigations list, investigation detail

## Getting started

### Prerequisites

- Node.js (LTS)
- PostgreSQL (connection string via `DATABASE_URL`)
- Optional: [Maigret](https://github.com/soxoj/maigret) (`pip install maigret`) for Phase 10 username sweeps

### Backend setup

```bash
cd "shadowtrace ai"
npm install
cp .env.example .env   # then fill in your own values — see note below
npm start               # runs Phase 10 (production server)
```

To run an earlier phase in isolation:

```bash
npm run phase3      # or dev:p3 for live-reload
```

> **⚠️ Before you commit:** this repo currently has no backend `.gitignore`, so a `.env` file in this directory will be picked up by `git add .`. Create a `.gitignore` that excludes `.env`, and make sure `.env.example` only ever contains placeholder values — never real keys.

Environment variables (see `.env.example` for the full list):

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | yes | Server port |
| `SESSION_SECRET` | yes | Signs session cookies |
| `FRONTEND_ORIGIN` | yes | CORS allow-list origin for the React dev server |
| `LLM_API_KEY` / `LLM_MODEL_NAME` / `LLM_API_BASE` | Phase 7+ | AI evidence-fusion signals; omit `LLM_API_KEY` to use mock scores |
| `GITHUB_TOKEN` | optional | Raises GitHub API rate limit from 60/hr to 5000/hr |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | optional | Reddit user lookups |
| `GRAVATAR_API_KEY` | optional | Email-to-profile lookups |
| `MAIGRET_PATH` | optional | Path to the Maigret executable if not on `PATH` |

All OSINT source keys are optional — sources degrade gracefully when absent.

### Frontend setup

```bash
cd Shadowtrace_frontend
npm install
npm run dev       # start Vite dev server
npm run build     # production build
npm run preview   # preview production build
```

## Design docs

- [`PHASES.md`](./PHASES.md) — phase-by-phase run/test instructions
- [`ShadowTrace_System_Algorithm_FINAL.md`](./ShadowTrace_System_Algorithm_FINAL.md) — full system algorithm and data contracts
- [`ShadowTrace_AI_Database_Schema.txt`](./ShadowTrace_AI_Database_Schema.txt) — database schema

## Tech stack

**Backend:** Node.js, Express, PostgreSQL (`pg`), Argon2, JSON Web Tokens, Helmet, express-rate-limit
**Frontend:** React, TypeScript, Vite, Tailwind CSS

## License

ISC
