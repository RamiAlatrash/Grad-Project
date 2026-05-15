# THRAX — LLM prompt injection security lab

Research-oriented full-stack platform for **tiered prompt-injection attacks**, **multi-layer defenses**, and **automated evaluation** (including stress testing and metrics) against a live LLM backend.

## What it does

- Simulates and catalogs attacks while orchestrating defense pipelines (encoding checks, semantic triggers, canary words, sandwiching, LLM judge, DLP, session tracking, and more).
- Uploads and scans **InfoBank** documents (clean vs poisoned fixtures) to exercise retrieval and injection scenarios.
- Persists test runs, results, and analytics in **PostgreSQL (Neon)**.
- Ships with a **React + Vite** dashboard for chat, documents, testing, analytics, and admin flows.

## Main features

- Attack library and defense configuration aligned in shared TypeScript (`shared/`)
- Defense pipeline and LLM integration on **Express**
- **Better Auth** session-based access control
- Programmatic DB migrations and seeds (including default lab accounts)
- Stress-testing API with streaming/progress feedback and metrics export concepts (see `docs/testing_framework.md`)
- **Stress Test** result stream **auto-scrolls only while you stay near the bottom** of the pane, so you can scroll up to stop or inspect rows during long batches
- **Test Traces** defaults to the **latest saved run**, supports **all traces** with **per-run group headers** on each page, chronological order **within** a selected run, and a **compact searchable run picker** (not a long native dropdown)

## Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Radix UI, TanStack Table, Recharts |
| Backend | Node.js, Express, TypeScript, `pg`, Better Auth, Zod |
| Database | PostgreSQL (Neon) |
| LLM | Cerebras API (primary); optional keys for comparison providers (`backend/env.example`) |
| Secrets | **Doppler** (recommended) or local `backend/.env` |

## Prerequisites

- **Node.js 18+**
- **Neon** (or compatible Postgres) connection string
- **Cerebras** API key for full LLM functionality
- **[Doppler CLI](https://docs.doppler.com/docs/install-cli)** if you use the Doppler workflow

## Setup

### 1. Install dependencies

Install **per package** (there is no root `npm install` workspace):

```bash
cd backend && npm install
cd ../frontend && npm install
```

Optional helper (Git Bash / WSL):

```bash
./dopplersetup.sh install
```

### 2. Environment variables

**Template:** copy `backend/env.example` and fill in real values:

```bash
cp backend/env.example backend/.env
```

**Recommended (Doppler):** follow **[`docs/setup.md`](./docs/setup.md)** — login, link the project, and run the backend with secrets injected:

```bash
cd backend
doppler run -- npm run dev
```

Important keys (see `backend/env.example` for the full list):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `CEREBRAS_API_KEY` | LLM calls |
| `CEREBRAS_BASE_URL` | API base (default in template) |
| `LLM_MODEL` | Model id |
| `PORT` | API port (default **3001**) |
| `FRONTEND_URL` | CORS origin (default `http://localhost:3000`) |
| `DB_DEBUG_QUERIES` | Optional: `1` for verbose SQL / pool logs (default off) |

### 3. Database

Migrations run on server startup; you can also run them explicitly:

```bash
cd backend
npx tsx src/db/migrate.ts
```

## How to run

**Terminal 1 — backend**

```bash
cd backend
# With Doppler:
doppler run -- npm run dev
# Or with local .env (dotenv loads automatically):
npm run dev
```

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

- **App:** [http://localhost:3000](http://localhost:3000)  
- **API:** [http://localhost:3001](http://localhost:3001) (per `PORT`)

Production-style backend after build:

```bash
cd backend
npm run build
npm start
```

## Demo login (seeded accounts)

After migrations/seeds (see `docs/setup.md`):

| Role | Email | Password |
|------|--------|----------|
| Admin | `admin@lab.com` | `admin1234` |
| User | `user@lab.com` | `user1234` |

## Project structure (overview)

```text
├── backend/           # Express API, auth, defense pipeline, migrations
├── frontend/          # Vite + React UI (`src/`, static assets in `public/`)
├── shared/            # Types, attacks, defenses, prompts, constants
├── InfoBank/          # Clean / poisoned text fixtures for document testing
├── testing/framework/ # Shared test-runner utilities (compiled with backend)
├── database/          # Reference `schema.sql`
├── docs/              # Setup, architecture, testing framework
├── PROJECT_DOCUMENTATION.md   # Full technical reference
├── AttackLogic.md / DefenseLogic.md  # Design notes
├── what-rami-did.md   # Contribution / changelog notes
```

## Documentation index

| Doc | Description |
|-----|-------------|
| [`docs/setup.md`](./docs/setup.md) | Doppler, Neon, run commands |
| [`docs/architecture.md`](./docs/architecture.md) | System architecture |
| [`docs/testing_framework.md`](./docs/testing_framework.md) | Testing / metrics concepts |
| [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) | Deep dive |

## Safety and ethics

> **Warning:** This codebase implements real adversarial patterns. Use only on systems and API accounts you are authorized to test. Do not expose the dashboard to the public internet without strict isolation and review.

## Checks before submission

From the repo root, install per package if needed, then:

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

There is no root `lint` / `typecheck` script; `frontend` build runs `tsc && vite build`, and `backend` build runs `tsc`.

## License

See [`LICENSE`](./LICENSE).
