# Dynamic Software Interfaces — System Design

> What the system is, why it is built this way, and how each piece connects.

---

## 1. The problem this solves

Every production software tool ships with one fixed interface. The interface is a compromise — designed for an average user who doesn't exist. Power users work around it. New users are overwhelmed by it. Both groups adapt to the tool instead of the tool adapting to them.

The hypothesis: if you separate the data primitives from the rendering layer, an AI agent can generate a personal interface at runtime. Same data, same query API, radically different experience per person — shaped by their role, their vocabulary, and their intent.

This codebase is a working prototype of that hypothesis.

---

## 2. Core architectural decisions

### Decision 1: Engine is domain-agnostic, instantiated per domain

The engine classes (`DataStore`, `SpecValidator`, `SpecGenerator`, `LiveChannel`) contain zero domain-specific strings. All domain knowledge lives in vocabulary files. At startup, `buildAppRegistry()` creates one engine triple per domain by injecting its vocabulary. Adding a new domain is two files and one registry entry — the engine doesn't change.

### Decision 2: The spec is the interface contract

A view spec is a small JSON document describing how to display data: which layout, which fields, how to filter, how to sort, how to group. It is the only thing the AI produces and the only thing the renderer consumes. The AI never touches data; the renderer never calls the AI. They communicate through the spec.

### Decision 3: Routing intelligence lives in the backend

The frontend makes zero routing decisions about which surface a message targets. The backend `UnifiedGenerator` receives all surface vocabularies in a single AI call, routes by vocabulary match, and returns a spec for the correct surface. This keeps the frontend dumb and makes routing consistent across clients, languages, and future surfaces.

### Decision 4: Validation is a hard gate before the spec reaches the client

`SpecValidator.assert()` runs the Zod schema derived from the active vocabulary before any route returns a spec. A spec that references an unknown layout, an unknown field key, or an out-of-range limit is rejected with 422. The model output never reaches the frontend if it fails validation.

### Decision 5: Per-surface, per-user spec storage with no spec state on the server

The backend returns specs and immediately discards them. All spec persistence is in the browser (localStorage), keyed by `appId:section`. The backend is stateless with respect to specs. In a production system, the storage key gains a `userId` prefix and the adapter switches from localStorage to a database — no other change.

---

## 3. The surface model

A **surface** is a named, independently-customisable area of the UI with its own vocabulary.

Current surfaces:

| Surface id | What it controls | Vocabulary source |
|---|---|---|
| `sidebar` | Which workspace items appear in the left nav; their labels and order | Derived from the registry at startup |
| `view` | Data layout, visible fields, filters, grouping, sort order in the active domain | Domain vocabulary file |

The surface model is open. Adding a new surface means adding a `SurfaceContext` to the `generate.ts` route builder — the `UnifiedGenerator` is vocabulary-driven and requires no code changes.

---

## 4. The unified generation request

When the user sends a message, the frontend sends one request:

```
POST /api/generate
{
  "message":       "hide Finance, show only critical bugs",
  "appId":         "engineering",
  "activeSurface": "dashboard",
  "currentSpecs": {
    "sidebar":    { "version": "1.0", "items": […] },
    "dashboard":  { "version": "1.0", "layout": "kanban", … }
  },
  "forceSurface":  undefined
}
```

The backend:
1. Builds `SurfaceContext[]` from the live registry (sidebar vocab + domain vocab).
2. Passes all surface contexts to `UnifiedGenerator.generate()`.
3. The AI routes by vocabulary match and returns a spec.
4. The route validates the spec against the target surface's Zod schema.
5. Returns `{ status: "applied", targetSurface, spec, message }`.

---

## 5. Routing by vocabulary match

The `UnifiedGenerator` system prompt lists all surface vocabularies explicitly:

```
═══ SURFACE id="sidebar" ═══
Items (can be hidden, shown, renamed):
  - key="engineering" defaultLabel="Engineering" currently: visible
  - key="product"     defaultLabel="Product"     currently: visible
  - key="finance"     defaultLabel="Finance"     currently: visible

═══ SURFACE id="view" ═══
Layouts:
  - "kanban": Group items by a field into swimlane columns (groupBy required)
  - "table":  Sortable, filterable spreadsheet view

Fields:
  - key="status" type=string enumValues=[backlog, in-progress, done, blocked] …
  - key="priority" type=string enumValues=[low, medium, high, critical] …
  …
```

Routing rules (applied in order):
1. Parse the message: identify the concepts, names, and values the user references.
2. For each surface, check whether those concepts appear in its vocabulary (item key, item label, field key, field label, field enum value, layout name).
3. Exactly one vocabulary match → `status: "applied"`, route to that surface.
4. Two or more vocabulary matches → `status: "needs_clarification"`.
5. No vocabulary match → fall back to `activeSurface`.

This is language-agnostic by design. The AI matches meaning against declared vocabulary entries — not English keywords.

---

## 6. Conflict detection and clarification

When a message term matches vocabularies in two surfaces, the AI returns:

```json
{
  "status": "needs_clarification",
  "question": "Do you want to hide 'Product' from the sidebar navigation, or filter the data view to show only Product-type items?",
  "options": [
    { "surface": "sidebar", "label": "Hide Product from the sidebar navigation" },
    { "surface": "view",    "label": "Filter the data view to Product items only" }
  ]
}
```

The frontend renders the question as an amber bubble and each option as a clickable button. When the user picks an option, the frontend re-sends the original message with `forceSurface` set to the chosen surface id. The backend skips conflict detection and generates a spec for that surface.

---

## 7. Spec schemas

### Sidebar spec

```json
{
  "version": "1.0",
  "items": [
    { "key": "engineering", "visible": true },
    { "key": "product",     "visible": true,  "label": "Growth" },
    { "key": "finance",     "visible": false }
  ]
}
```

Every sidebar item from the vocabulary must appear in `items[]`. Validated by `buildSidebarSpecSchema(sidebarVocab)`.

### View spec

```json
{
  "version": "1.0",
  "name": "Critical bugs only",
  "layout": "kanban",
  "fields": [
    { "key": "title",    "visible": true  },
    { "key": "priority", "visible": true  },
    { "key": "assignee", "visible": false }
  ],
  "groupBy": "status",
  "filters": [{ "field": "priority", "op": "eq", "value": "critical" }],
  "sort":    { "field": "updatedAt", "direction": "desc" },
  "limit":   100
}
```

Validated by `SpecValidator.assert()` which runs `buildViewSpecSchema(vocab)` — a Zod schema derived entirely from the domain vocabulary at startup.

---

## 8. Incremental modification

If `currentSpecs` contains a spec for the target surface, the AI treats it as the base and applies the message as an incremental modification. Fields, filters, and layout not mentioned in the message are carried forward unchanged. The user's previous customisations survive — "also hide the assignee column" doesn't reset the filters applied by a prior message.

---

## 9. The safety boundary

**Structural, not vigilance-based.**

The spec vocabulary contains only display verbs:
- `layout` — which component to render
- `fields[]` — which columns to show; optional display label rename
- `groupBy` — grouping key (kanban only)
- `filters[]` — hide items from view; ops are `eq`, `neq`, `in`, `contains` — no write ops
- `sort` — display ordering
- `limit` — max items shown (1–200)

No create, update, delete, or mutation verb exists anywhere in `AppVocabulary`, `buildViewSpecSchema`, or `buildSidebarSpecSchema`. There is nowhere in the vocabulary type to express a mutation. An AI that tried to smuggle a write operation into a spec would produce a spec that fails Zod validation at the server — it would never reach the client.

"Mark all as done" is interpreted as the nearest display intent (filter to show only done items). The data is never touched.

---

## 10. Live data

The spec shapes the view. The data flows independently.

```
DataStore.simulateChange(id, patch)
  → emits 'change' event
  → LiveChannel.broadcast(appId, { type: 'items:changed', items })
  → every subscribed client receives the full item array
  → client replaces local state (no diff)
  → ViewRenderer re-applies the current spec client-side (no AI call, no fetch)
```

The two channels — spec (AI, intentional, rare) and data (WebSocket, automatic, frequent) — are completely independent. A live data update never triggers an AI call. A spec change never fetches new data.

---

## 11. Persistence model

**Prototype (current):** browser localStorage, managed by `GlobalAiContext`.

Storage keys:
- `dsi:spec:${appId}:${section}` — per-domain, per-section view spec
- `dsi:sidebar-spec` — global sidebar spec (not per-domain)

The backend holds no spec state. It generates a spec, returns it, and discards it immediately.

**Production extension:** add `userId` to the storage key prefix and implement the `ISpecRepository` interface against a database. The engine, routes, and frontend components require no changes.

---

## 12. Version history

Each `setSpec()` call appends to a per-slot version history (up to 20 entries) stored alongside the spec in localStorage. The SettingsPage renders all versions with timestamps and a one-click restore. Each version is immutable — restoring always creates a new current entry, never overwrites history.

Known limitation: `specHistory.restoreTo()` currently writes to localStorage directly without calling `GlobalAiContext.setSpec()`. The in-memory cache is not invalidated. If the cache already holds a value for that slot, navigating to the page after restoring serves the stale cached value until hard-refresh. Fix: call `setSpec(appId, tab, entry.spec)` from `SettingsPage.handleRestore()` instead.

---

## 13. Domain vocabulary

Each domain defines its interface contract as a static TypeScript object:

```typescript
export const ENGINEERING_VOCABULARY: AppVocabulary = {
  layouts: [
    { name: 'kanban', description: 'Group by swimlane', requiresGroupBy: true },
    { name: 'table',  description: 'Sortable spreadsheet' },
    { name: 'feed',   description: 'Activity log' },
    { name: 'cards',  description: 'Card grid' },
  ],
  fields: [
    { key: 'title',    type: 'string', description: 'Item title', sortable: true },
    { key: 'status',   type: 'string', description: 'Workflow status',
      filterable: true, sortable: true, groupable: true,
      enumValues: ['backlog', 'in-progress', 'done', 'blocked'] },
    …
  ],
};
```

The vocabulary is used for three things simultaneously:
1. Build the Zod validation schema (`buildViewSpecSchema(vocab)`)
2. Build the AI system prompt (field and layout descriptions become the AI's vocabulary)
3. Serve the frontend schema (`GET /api/schema`) so the renderer knows column labels

---

## 14. The engine is defined once

Backend engine classes live in `packages/backend/src/engine/` and are instantiated per domain by `buildAppRegistry()`. The classes contain zero domain-specific strings.

| Class | Responsibility |
|---|---|
| `DataStore` | Holds `Item[]`; applies `QueryParams`; emits `'change'` |
| `SpecValidator` | Wraps `buildViewSpecSchema(vocab)`; `assert(raw)` throws `ValidatorError` on failure |
| `SpecGenerator` | Per-domain Gemini call with vocabulary-derived system prompt; used by legacy `/api/generate-spec` route |
| `SidebarGenerator` | Singleton; generates `SidebarSpec`; used by legacy `/api/generate-sidebar-spec` route |
| `UnifiedGenerator` | Singleton; routes + generates across all surfaces in one call; used by `/api/generate` |
| `LiveChannel` | Singleton; manages per-domain WebSocket rooms; broadcasts `items:changed` |

---

## 15. Frontend component model

The frontend is a renderer, not a decision-maker. It:
- Holds current specs in `GlobalAiContext` (in-memory Map + localStorage write-through)
- Sends user messages verbatim to the backend
- Applies the returned spec to the surface the backend specified
- Renders the spec via layout components (`TableLayout`, `KanbanLayout`, `FeedLayout`, `CardsLayout`)

`GlobalChatPanel` contains no routing logic. It does not examine the message, does not detect keywords, does not decide which API to call based on message content. It calls `POST /api/generate` for every message and applies whatever the backend returns.

---

## 16. What is not in scope (prototype)

- **Auth / sessions** — no userId, single-user prototype
- **Multi-tenancy** — all localStorage keys are unscoped
- **External data connectors** — all data is in-memory seed data
- **Agent modifying middleware or behavior** — the AI generates display specs only
- **Write operations from the AI** — structurally impossible (no mutation verbs in vocabulary)
- **Server-side spec storage** — prototype uses localStorage; production needs a DB adapter

---

## 17. How to extend

**Add a domain:**
1. Create `packages/backend/src/app/domains/<name>/vocabulary.ts`
2. Create `packages/backend/src/app/domains/<name>/seed.ts`
3. Register in `buildAppRegistry()`
4. Add frontend presets (optional)

The `UnifiedGenerator` and all engine classes automatically gain the new domain's vocabulary. No prompts, no schemas, no route changes needed.

**Add a surface:**
1. Build a `SurfaceContext` for the new surface in `packages/backend/src/routes/generate.ts`
2. Add the surface's Zod schema validation in the same route
3. Add spec application logic in `GlobalChatPanel.tsx`

**Add a storage backend:**
1. Implement `ISpecRepository` against a database
2. Wire it into `GlobalAiContext` (currently uses raw localStorage calls — the interface is in `frontend/src/engine/`)
