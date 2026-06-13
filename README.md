# Dynamic Software Interfaces

A prototype demonstrating the "Dynamic Software Interfaces" thesis:
software ships as shared primitives (data + query API), and each user's
interface is generated to fit them via an AI agent.

**Same data — radically different interface per person.**

## Demo

Three domains, nine personas, one engine:

| Domain | Personas |
|---|---|
| Engineering | IC (table), Tech Lead (kanban), Manager (feed) |
| Product | PM (table), Head of Product (kanban), Exec (cards) |
| Finance | Accountant (table), CFO (cards), AP Team (feed) |

## Quick start

### 1. Install

```bash
pnpm install
```

### 2. Set up the API key

```bash
cp packages/backend/.env.example packages/backend/.env
# Edit packages/backend/.env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run (two terminals)

```bash
# Terminal 1 — backend (port 4000)
pnpm dev:backend

# Terminal 2 — frontend (port 3000)
pnpm dev:frontend
```

Open http://localhost:3000

## How to use

1. **Pick a domain** — Engineering / Product / Finance in the top bar.
2. **Click "Customise view"** to open the sidebar.
3. **Load a preset** (instant, no AI call) or **describe your view** in plain English.
4. For AI-generated views: review the preview → **Apply view** or **Discard**.
5. **Version history** lets you restore any past spec with one click.
6. Switch domains — history is namespaced per domain.

## Architecture

```
@dsi/shared       — engine contract (Item, AppVocabulary, buildViewSpecSchema)
packages/backend  — Express + WebSocket server; one engine per domain instance
packages/frontend — React renderer; SpecStore with localStorage persistence
```

Adding a new domain requires two files:
- `packages/backend/src/app/domains/<name>/vocabulary.ts`
- `packages/backend/src/app/domains/<name>/seed.ts`

Plus one entry in `buildAppRegistry()` and frontend presets — zero engine changes.

## Tech stack

pnpm workspaces · TypeScript strict · Node + Express + ws · React 18 + Vite + Tailwind · Anthropic SDK
