# Dynamically

Software that generates its own interface — different for every person, same underlying data.

The thesis: instead of shipping one fixed UI that everyone uses the same way, ship the data and query primitives. An AI agent generates a personal interface from plain-English descriptions. Same data, radically different experience per user.

## What it does

Three domains (Engineering, Product, Finance) share one engine. Each domain has its own vocabulary — layouts, fields, enum values — but zero engine changes are needed to add a new one.

The AI understands the vocabulary and translates plain English into a view spec. "Show only in-progress items grouped by assignee" becomes a validated JSON spec that the renderer applies against live data. The spec shapes the display; it never touches the data.

One AI chat panel handles the whole app. You can customise the sidebar ("hide Finance, rename Product to Growth") or any domain view ("show only critical bugs, group by assignee") from the same input. The backend routes your message to the right surface by matching it against the declared vocabulary — no keywords, no regex, language-agnostic.

## How it works

```
User types a message in the chat panel
       │
       ▼
POST /api/generate
  message + appId + activeSurface + current specs for all surfaces
       │
       ▼
UnifiedGenerator (Gemini 2.5 Flash)
  Receives all surface vocabularies in one prompt.
  Routes by vocabulary match — field keys, enum values, sidebar item keys.
  Returns: applied { targetSurface, spec, message }
         | needs_clarification { question, options }
       │
       ▼
Route validates spec against target surface's Zod schema
       │
       ▼
Frontend applies spec → page re-renders with new view
```

When a message matches vocabularies in two surfaces (e.g. "hide product" where "product" is both a sidebar item and a data field enum value), the backend returns `needs_clarification` with specific option buttons. The user picks one; the choice is sent back with `forceSurface` and the backend skips conflict detection.

## Architecture

```
@dsi/shared       — engine contract (Item, AppVocabulary, ViewSpec, SidebarSpec, GenerateRequest/Response)
packages/backend  — Express + WebSocket server; one engine per domain; UnifiedGenerator for routing
packages/frontend — React renderer; GlobalAiContext for spec storage; GlobalChatPanel for AI input
```

Adding a new domain requires two files:
- `packages/backend/src/app/domains/<name>/vocabulary.ts`
- `packages/backend/src/app/domains/<name>/seed.ts`

Plus one entry in `buildAppRegistry()` and frontend presets. The AI automatically gains vocabulary for the new domain — zero engine changes.

## Tech stack

- **Monorepo:** pnpm workspaces
- **Shared:** TypeScript + Zod schema factories
- **Backend:** Node + Express + ws; Google Gemini 2.5 Flash via `@google/generative-ai`
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Persistence:** localStorage (prototype); swappable via `ISpecRepository` interface

## Running locally

### 1. Install

```bash
pnpm install
```

### 2. Set the API key

```bash
cp packages/backend/.env.example packages/backend/.env
# Edit packages/backend/.env and set GEMINI_API_KEY=...
```

### 3. Start

```bash
# Terminal 1 — backend (port 4000)
pnpm dev:backend

# Terminal 2 — frontend (port 3000)
pnpm dev:frontend
```

Open http://localhost:3000

## Safety

The spec vocabulary contains only display verbs: which layout to use, which fields to show, how to filter (hide-only, never delete), how to sort, how many items to show. There are no mutation verbs anywhere in the schema. Validation runs server-side before any spec reaches the client — an out-of-vocabulary spec returns 422 and is discarded. A request like "delete all done items" is interpreted as the nearest display intent (show only done items). Harm is impossible by construction, not by vigilance.

## Scope

No auth, no multi-tenancy, no external data connectors. Single-user prototype. Specs are stored in browser localStorage — adding a `userId` to the storage key is the only change needed for multi-user support. The backend holds no spec state.
