# Dynamic Software Interfaces

Software that generates its own interface — different for every person, same underlying data.

The thesis: instead of shipping one fixed UI that everyone uses the same way, ship the data and query primitives. An AI agent generates a personal interface from plain-English descriptions. Same data, radically different experience per user.

---

## What it does

Three domains (Engineering, Product, Finance) share one engine. Each domain has its own vocabulary — layouts, fields, enum values — but zero engine changes are needed to add a new one.

The AI understands the vocabulary and translates plain English into a validated spec JSON. "Show only in-progress bugs grouped by assignee" becomes a spec that the renderer applies against live data. The spec shapes the display; it never touches the data.

One AI chat panel handles the whole app. You can customise the **sidebar** ("hide Finance, rename Product to Growth"), the **tab bar** ("hide the Analytics tab"), or any **domain view** ("show only critical items, group by assignee") — all from the same input. The backend routes your message to the right surface by matching it against the declared vocabulary: no keywords, no regex, language-agnostic.

---

## How it works

```
User types a message in the chat panel
       │
       ▼
POST /api/generate
  message + appId + activeSurface + current specs for all surfaces
       │
       ▼
Route calls surfaceRegistry.resolve(appId, section)
  Builds SurfaceContext[] generically — no surface names in the route
       │
       ▼
UnifiedGenerator (Gemini 2.5 Flash)
  Receives all surface contexts in one prompt.
  System prompt is fully surface-agnostic — all surface behavior lives in SurfaceDef metadata.
  Routes by vocabulary match — field keys, enum values, item labels.
  Returns: applied { targetSurface, spec, message }
         | needs_clarification { question, options }
       │
       ▼
Route validates spec against target surface's Zod schema
       │
       ▼
Frontend applies spec → page re-renders with new view
```

When a message matches vocabularies in two surfaces (e.g. "hide product" where "product" is both a sidebar item and a data field value), the backend returns `needs_clarification` with specific option buttons. The user picks one; the choice is sent back with `forceSurface` and the backend skips conflict detection.

---

## Architecture

```
@dsi/shared       — engine contract (types and Zod schema factories; no runtime deps)
packages/backend  — Express + WebSocket server; engine + surface registry; Gemini AI
packages/frontend — React renderer; GlobalAiContext for spec storage; GlobalChatPanel for AI input
```

### Three customizable surfaces

| Surface | Controls | Spec type |
|---|---|---|
| **Sidebar** | Left panel visibility; which workspace items appear | `SidebarSpec` |
| **Nav** | Top tab bar visibility; which section tabs appear | `NavSpec` |
| **View** | Data display: layout, fields, filters, grouping, sort | `BaseViewSpec` |

All three surface contexts are sent to the AI on every request. The AI routes by vocabulary meaning — no hardcoded surface logic in the prompt.

### Safety: you can never be trapped

If you hide both the sidebar and the navbar via AI, the floating AI button (bottom-right corner) remains visible at all times. Opening the chat shows a one-click **"Restore navbar"** / **"Restore sidebar"** escape hatch — no AI call needed.

---

## Adding a new domain

1. Create `packages/backend/src/app/domains/<name>/vocabulary.ts` — declare layouts and fields with synonym-rich descriptions
2. Create `packages/backend/src/app/domains/<name>/seed.ts` — seed data
3. Add one entry to the `configs` array in `app-registry.ts`

Zero engine changes. The AI automatically gains vocabulary for the new domain.

## Adding a new surface type

1. Add a `SurfaceDef` in `surface-registry.ts` with `id`, `label`, `purpose`, `specSchema`, `clarificationGuidance`, `specKey()`, and `buildVocabText()`
2. Include it in the `resolve()` return array
3. Add a Zod validator call for its spec in the validation block in `generate.ts`

Zero prompt changes — the system prompt is fully surface-agnostic by design.

---

## Tech stack

- **Monorepo:** pnpm workspaces
- **Shared:** TypeScript + Zod schema factories
- **Backend:** Node + Express + ws; Google Gemini 2.5 Flash via `@google/generative-ai`
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Persistence:** localStorage (prototype); swappable via `ISpecRepository` interface

---

## Running locally

### 1. Install

```bash
pnpm install
```

### 2. Set the API key

Get a Gemini API key at https://aistudio.google.com/app/apikey, then:

```bash
echo "GEMINI_API_KEY=your_key_here" > packages/backend/.env
```

### 3. Start

```bash
# Terminal 1 — shared types (watch)
pnpm dev:shared

# Terminal 2 — backend (port 4000)
pnpm dev:backend

# Terminal 3 — frontend (port 5173)
pnpm dev:frontend
```

Open `http://localhost:5173`

### Other scripts

```bash
pnpm build        # Full production build (shared → backend → frontend)
pnpm typecheck    # tsc --noEmit across all packages
pnpm test         # Vitest unit tests (backend engine)
pnpm test:ai      # AI prompt battery test — requires GEMINI_API_KEY
```

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Google Generative AI key (Gemini 2.5 Flash) |
| `PORT` | No | `4000` | Backend server port |

---

## Safety

The spec vocabulary contains only display verbs: which layout to use, which fields to show, how to filter (hide from view — never delete), how to sort, how many items to show. No mutation verb exists anywhere in the schema. Validation runs server-side before any spec reaches the client — an out-of-vocabulary spec returns 422 and is discarded. Harm is impossible by construction, not by vigilance.

---

## Scope

No auth, no multi-tenancy, no external data connectors. Single-user prototype. Specs are stored in browser localStorage. The backend holds no spec state — adding a `userId` to the storage key is the only change needed for multi-user support.
