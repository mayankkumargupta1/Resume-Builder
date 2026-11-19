# Resume Builder & ATS Engine

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

A self-hosted, multi-user **AI Resume Builder**, **Zero-Hallucination Job Tailoring Studio**, **Application Tracker**, and **Enterprise ATS Diagnostic Engine** powered by **Next.js 15**, **TypeScript**, and **PostgreSQL** (`pg`).

Built to keep a verified **Master Career Dossier** pristine while generating tailored, print-ready resumes with deterministic ATS scoring across major enterprise Applicant Tracking Systems.

---

## Key Capabilities

### 1. Master Career Profile & Print-Precision Studio (`/profile` & `/resume`)
- **Complete Structured Dossier**: Manage Basics, Profile Summary, Work Experience, First-Class Projects (live/repo links & dates), Grouped Skills, Certifications, Education, Languages, References, and Key Facts.
- **12 Built-in Typographic Themes + Custom Theme Builder**: `Editorial`, `Classic`, `Modern`, `Minimal`, `Technical`, `Ledger`, `Signal`, `Studio`, `Chronicle`, `Folio`, `Console`, and `Atlas` — plus full theme customization and JSON import/export.
- **Offline Bundled Typography**: 14 variable & multilingual fonts bundled locally under `src/fonts/` (Geist, Inter, Newsreader, IBM Plex Sans/Mono, JetBrains Mono, Playfair Display, Source Serif 4, Space Grotesk, Fraunces, Lora, Manrope, Work Sans, Libre Caslon Text).
- **Exact Screen-to-PDF Fidelity**: Proportional `--u` unit frame geometry with **US Letter** & **A4** paper support, configurable density (`Compact`, `Regular`, `Airy`), page limits, and clean browser print stylesheets (`/print/base`, `/print/tailored/[id]`).

### 2. Zero-Hallucination AI Job Tailoring (`/tailor`)
- **Dual Input Modes**: Paste a **Job Posting URL** (auto-extracted via HTML metadata & structured parser) or a **Raw Job Description**.
- **Strict Fact-Guard Architecture**: To preserve 100% factual authenticity across job applications, the tailoring agent optimizes the **Target Headline** and **Profile Summary** (enforced healthy 45–90 word / 2–5 sentence density) while keeping all verified Experience, Projects, Certifications, and Skills intact.
- **Pluggable AI Providers**: Works with **OpenAI-compatible AI Gateways** (DeepSeek v4.1 / Flash / R1, OpenAI, Cloudflare Workers AI), **Anthropic**, **Local Ollama** (`gemma4:12b`), and automatically falls back to **deterministic rule-based curation** when offline or unconfigured.

### 3. Deterministic ATS Scoring & Enterprise Parser Audits
Every tailored resume receives an objective ATS evaluation modeled after real-world enterprise parsers:

```text
Overall ATS Score = (Hard Skills Match      × 0.40)
                  + (Experience Context     × 0.30)
                  + (Role & Title Alignment × 0.15)
                  + (Parsing Compliance     × 0.15)
```

- **Matched vs. Missing JD Keywords**: Transparently surfaces matched skills using synonym-aware matching (`TS` ↔ `TypeScript`, `Postgres` ↔ `PostgreSQL`, `LLM` ↔ `AI`, etc.) and flags missing job requirements without inventing skills.
- **5 Platform Simulation Audits**: Evaluates candidate readiness across **Workday**, **Oracle Taleo**, **Greenhouse**, **Lever**, and **iCIMS**, displaying per-platform grades, verdicts, and pass/warn diagnostics in an interactive **Complete ATS Report Modal** with one-click clipboard export.

### 4. Dedicated Job Application Tracker (`/applications`)
- Separates generated job-specific resumes cleanly from your base resume.
- Searchable pipeline dashboard with status tracking (`generated` → `applied` → `interviewing` → `offered` → `rejected` → `archived`), match score KPIs, application follow-up notes, standalone print views, and one-click ATS diagnostic reports.

### 5. Multi-User Authentication & Root Admin Console (`/login`, `/signup`, `/admin`)
- Isolated per-user profiles, themes, settings, and tailored application drafts stored in **PostgreSQL**.
- Secure **scrypt** password hashing with random salts and timing-safe verification + HTTP-only cookie sessions.
- Dedicated Root Administrator dashboard (`/admin`) for user provisioning, role inspection, and account enable/disable lifecycle controls.

---

## Architecture Overview

```mermaid
flowchart LR
    JD[Job URL or Raw JD] --> Scraper[HTML Job Scraper]
    Scraper --> Agent[AI Curation Agent]
    Profile[(Master PostgreSQL Profile)] --> Agent
    Agent -->|"DeepSeek / OpenAI / Anthropic / Ollama / Heuristic"| Tailored[Tailored Headline & Summary]
    Tailored --> ATS[Deterministic ATS Engine]
    Profile --> ATS
    ATS --> Report[5-Platform ATS Diagnostic Modal]
    Tailored --> Drafts[(tailored_drafts Table)]
    Drafts --> Tracker[/applications Pipeline Tracker]
    Drafts --> Print[/print/tailored PDF Export]
```

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router, Server Actions, Force-Dynamic SSR) |
| **Language** | TypeScript 5 (Strict Mode) |
| **UI & Styling** | React 19, Tailwind CSS v4, Radix UI, Lucide Icons, `@dnd-kit` |
| **Database** | PostgreSQL via `pg` (connection pooling, JSONB storage, foreign keys) |
| **AI & Parsing** | OpenAI-compatible Gateway (`DeepSeek` / `GPT`), Anthropic, Local `ollama`, `node-html-parser`, `zod` |
| **Runtime** | [Bun](https://bun.sh) or Node.js 18+ |

---

## Getting Started

### Prerequisites
- **[Bun](https://bun.sh)** v1.1+ (recommended) or **Node.js** v18+
- *(Optional)* **[Ollama](https://ollama.com)** running locally for private offline inference

### 1. Clone & Install

```bash
git clone https://github.com/mayankkumargupta1/Resume-Builder.git
cd Resume-Builder
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your preferred inference endpoint and admin credentials (if omitted, job curation gracefully falls back to local Ollama or built-in heuristic scoring):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AI_GATEWAY_URL` | OpenAI-compatible `/v1` base URL | `https://api.openai.com/v1` |
| `AI_GATEWAY_KEY` | API key for the configured AI provider/gateway | `""` (triggers fallback) |
| `AI_MODEL` | Default model identifier (supports DeepSeek, GPT, etc.) | `gpt-4o-mini` |
| `OLLAMA_HOST` | Local Ollama daemon URL | `http://localhost:11434` |
| `ROOT_ADMIN_USERNAME` | Email identifier for the root administrator (`/admin`) | `admin@resumepipeline.com` |
| `ROOT_ADMIN_PASSWORD` | Bootstrap admin password (hashed via scrypt at startup) | Random one-time key if unset |
| `ROOT_ADMIN_PASSWORD_HASH` | Pre-computed `salt:hex` scrypt hash (overrides plaintext) | `""` |
| `POSTGRES_USER` | PostgreSQL database user | `resume_builder` |
| `POSTGRES_PASSWORD` | PostgreSQL database password (required for Docker Compose) | `""` |
| `POSTGRES_DB` | PostgreSQL database name | `resume_builder` |
| `POSTGRES_HOST` | PostgreSQL host (`postgres` in Docker Compose, `localhost` locally) | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `DATABASE_URL` | Optional full PostgreSQL connection string override | `""` |

### 3. Run with Docker Compose (Recommended) or Manually

```bash
# Spin up PostgreSQL (with persistent volume) + Next.js app
docker compose up -d --build
```

Or run locally against PostgreSQL:

```bash
# Development server
bun run dev

# Typecheck & Production build
bun run typecheck
bun run build
bun run start
```

Open [http://localhost:3000](http://localhost:3000) (or [http://localhost:4000](http://localhost:4000) via Docker Compose) to sign up or log in. PostgreSQL tables initialize automatically on first boot following [`schema.sql`](./schema.sql).

---

## Project Structure

```text
├── schema.sql                       # PostgreSQL relational schema reference
├── .env.example                     # Environment configuration template
├── src/
│   ├── middleware.ts                # Auth protection for application routes
│   ├── app/
│   │   ├── page.tsx                 # Landing redirect to resume studio
│   │   ├── resume/page.tsx          # Base Resume Studio & Theme Customizer
│   │   ├── profile/page.tsx         # Master Career Dossier Editor
│   │   ├── tailor/page.tsx          # AI Job Tailoring Workbench
│   │   ├── applications/page.tsx    # Tailored Applications Pipeline Tracker
│   │   ├── print/                   # Print/PDF routes (/base & /tailored/[id])
│   │   ├── login/, signup/, admin/  # Auth & Root Admin console routes
│   │   └── api/
│   │       ├── curate/route.ts      # AI curation & ATS draft generator
│   │       ├── profile/route.ts     # Profile & settings persistence API
│   │       ├── scrape-job/route.ts  # Job URL scraper & extractor
│   │       └── tailored-drafts/     # CRUD API for tracked applications
│   ├── components/
│   │   ├── ats-report-modal.tsx     # Full 5-platform ATS diagnostic modal
│   │   ├── job-tailor-view.tsx      # Tailoring workbench UI
│   │   ├── applications-tracker-view.tsx # Application CRM tracker UI
│   │   ├── resume-workspace.tsx     # Interactive resume preview & theme switcher
│   │   ├── documents/               # Print-accurate geometric resume renderer
│   │   ├── profile/                 # Section editors (experience, projects, certs, etc.)
│   │   ├── themes/                  # Theme picker & custom theme builder
│   │   └── admin/                   # Admin login & user management dashboard
│   ├── fonts/                       # Bundled local WOFF2 variable fonts & OFL licenses
│   └── lib/
│       ├── ai-agent.ts              # Zero-hallucination prompt & LLM gateway client
│       ├── ats-engine.ts            # Deterministic multi-factor ATS scoring & platform audits
│       ├── auth.ts                  # Session management & auth helpers
│       ├── db.ts                    # PostgreSQL pool, schema init & data access layer
│       ├── job-scraper.ts           # URL job description extractor
│       ├── themes.ts                # 12 curated themes & token system
│       └── profile.ts               # Core TypeScript dossier interfaces & normalization
```

---

## License

Released under the [MIT License](./LICENSE). Bundled typography fonts remain subject to their respective SIL Open Font Licenses located inside `src/fonts/*/OFL.txt`.
