# SYSTEM_WORKING.md — How this project actually works

> Based on the code as it exists today. Where reality differs from the idealized
> description, this document states what the code does, not what was intended.

---

## 1. Component map

### Shared package — `packages/shared/src` (`@dsi/shared`)

| Export | File | Responsibility |
|---|---|---|
| `Item` | `item/item.types.ts` | Generic data unit: `{ id: string; [key: string]: unknown }` |
| `FilterClause`, `QueryParams`, etc. | `item/item.types.ts` | Query primitives (filter op, sort, limit) |
| `AppVocabulary`, `AppFieldDef`, `AppLayoutDef` | `spec/app-vocabulary.ts` | Domain vocabulary shape — fields + layouts, no domain strings |
| `BaseViewSpec`, `SpecVersion` | `spec/view-spec.types.ts` | The view spec contract |
| `buildViewSpecSchema(vocab)` | `spec/view-spec.schema.ts` | Zod schema factory — derives a concrete schema from any vocabulary |
| `SidebarSpec`, `SidebarNavItem`, `SidebarVocabulary`, `SidebarItemSpec` | `spec/sidebar-spec.types.ts` | Sidebar display spec types |
| `buildSidebarSpecSchema(vocab)` | `spec/sidebar-spec.schema.ts` | Zod schema factory for sidebar specs |

### Backend engine — `packages/backend/src/engine/` (domain-agnostic, defined once)

| Class | File | Responsibility |
|---|---|---|
| `DataStore` | `data-store.ts` | Holds `Item[]` in memory; applies `QueryParams` (filter/sort/limit); emits `'change'` event on mutation |
| `SpecValidator` | `spec-validator.ts` | Constructed with a vocabulary; calls `buildViewSpecSchema()` once; `assert(raw)` throws `ValidatorError` if model output fails Zod |
| `SpecGenerator` | `spec-generator.ts` | Calls Gemini 2.5 Flash with a vocabulary-derived system prompt; extracts JSON; calls `SpecValidator.assert()` |
| `LiveChannel` | `live-channel.ts` | One WebSocket server; routes broadcasts to per-domain rooms; attaches to `DataStore` change events |
| `SidebarGenerator` | `sidebar-generator.ts` | Singleton (not per-domain); generates `SidebarSpec` from Gemini; validates with `buildSidebarSpecSchema` |

### Backend app layer — `packages/backend/src/app/`

| Part | Location | Responsibility |
|---|---|---|
| `buildAppRegistry(apiKey)` | `app-registry.ts` | Creates one `(DataStore, SpecValidator, SpecGenerator)` triple per domain at startup; returns `AppRegistry` record |
| `ENGINEERING_VOCABULARY`, seed | `domains/engineering/` | Engineering field + layout definitions; ~20 seed items |
| `PRODUCT_VOCABULARY`, seed | `domains/product/` | Product field + layout definitions; ~15 seed items |
| `FINANCE_VOCABULARY`, seed | `domains/finance/` | Finance field + layout definitions; ~25 seed items |

### Backend routes — `packages/backend/src/routes/`

| File | Path | Responsibility |
|---|---|---|
| `apps.ts` | `GET /api/apps` | Returns domain list `{ apps: [{id, label}] }` |
| `schema.ts` | `GET /api/schema?app=<id>` | Returns vocabulary for a domain |
| `items.ts` | `GET /api/items?app=<id>[&filter=…][&sort=…][&limit=N]` | Read-only item query |
| `agent.ts` | `POST /api/generate-spec` | Runs `SpecGenerator`, returns validated `BaseViewSpec` |
| `sidebar-agent.ts` | `POST /api/generate-sidebar-spec` | Runs `SidebarGenerator`, returns validated `SidebarSpec` |

### Frontend engine — `packages/frontend/src/engine/` (domain-agnostic)

| Class/file | Status | Responsibility |
|---|---|---|
| `LayoutRegistry` | **Active** | Maps layout name string → React component; populated once at startup |
| `ViewRenderer` | **Active** | Looks up layout in registry; applies spec filters/sort/limit client-side; renders |
| `sharedRegistry` | **Active** | Singleton `LayoutRegistry` pre-populated with table, kanban, feed, cards |
| `spec-history.ts` | **Active** | Stores up to 20 versions per `appId:tab` in localStorage; used by SettingsPage |
| `ISpecRepository`, `LocalStorageSpecRepository` | **Exists but unused** | Legacy interface from an earlier design; no page currently instantiates it |
| `SpecStore` | **Exists but unused** | Legacy engine class with pending/accept/reject/history slots; no page currently uses it |

### Frontend app layer

| Part | Location | Responsibility |
|---|---|---|
| `AppContext` | `context/AppContext.tsx` | Active `appId`, `apps` list, `items`, `vocabulary`, WebSocket `connected` state |
| `GlobalAiContext` | `context/GlobalAiContext.tsx` | In-memory spec cache (Map ref) + localStorage write-through; chat open/close + section override |
| `useGlobalSpec(appId, section)` | same file | Per-surface spec accessor: `[spec, setSpec]` |
| `useCurrentSection()` | `hooks/useCurrentSection.ts` | Derives section string (`dashboard`, `explorer`, `analytics`) from URL pathname |
| `useLiveData(appId)` | `hooks/useLiveData.ts` | REST initial fetch + WebSocket subscription; auto-reconnects |
| `GlobalChatPanel` | `components/ai/GlobalChatPanel.tsx` | Single shared chat UI; context-aware; routes to correct API; detects context changes |
| `AppShell` | `components/layout/AppShell.tsx` | Root layout: Sidebar + content + GlobalChatPanel |
| `Sidebar` | `components/layout/Sidebar.tsx` | Spec-driven nav; renders from `SidebarSpec` via `useGlobalSpec('global','sidebar')` |
| `DomainPage`, `DashboardPage`, `ExplorerPage`, `AnalyticsPage`, `SettingsPage` | `pages/` | Per-section views; use `useGlobalSpec(appId, section)` |
| Layout components | `components/layouts/` | `TableLayout`, `KanbanLayout`, `FeedLayout`, `CardsLayout` — each accepts `{spec, items}` |

---

## 2. What data is sent to the backend — exact shapes

### `GET /api/apps`
**Request:** no body, no params.  
**Response:** `{ apps: [{ id: string; label: string }] }`  
Example: `{ apps: [{ id: "engineering", label: "Engineering" }, …] }`

---

### `GET /api/schema?app=<id>`
**Request:** query param `app=engineering`.  
**Response:** `{ appId: string; vocabulary: AppVocabulary }`  
`AppVocabulary` = `{ layouts: AppLayoutDef[]; fields: AppFieldDef[] }`  
`AppLayoutDef` = `{ name, description, requiresGroupBy? }`  
`AppFieldDef` = `{ key, type, description, filterable?, sortable?, groupable?, enumValues? }`

---

### `GET /api/items?app=<id>`
**Request:** query param `app=engineering`. No filters/sort/limit are sent by the frontend client (`fetchItems` only passes `app=`). The backend supports filter/sort/limit query params but `client.ts` does not use them — all item shaping is done client-side.  
**Response:** `{ appId: string; count: number; items: Item[] }`

---

### `POST /api/generate-spec`
**Request body:**
```json
{
  "appId": "engineering",
  "description": "show only in-progress items (for Dashboard view)",
  "currentSpec": { "version": "1.0", "layout": "kanban", "fields": […], … }
}
```
`currentSpec` is omitted on the first call; included on subsequent calls so the model makes incremental modifications.  
The section label ("for Dashboard view") is appended to `description` by `GlobalChatPanel` before sending — the backend does NOT receive a separate `section` field.  
**Response (success):** `{ appId: string; spec: BaseViewSpec }`  
```json
{
  "appId": "engineering",
  "spec": {
    "version": "1.0",
    "name": "In-progress items",
    "description": "Shows only items currently in progress",
    "layout": "kanban",
    "fields": [{ "key": "title", "visible": true }, …],
    "groupBy": "status",
    "filters": [{ "field": "status", "op": "eq", "value": "in-progress" }],
    "sort": { "field": "updatedAt", "direction": "desc" },
    "limit": 100
  }
}
```
**Response (validation failure):** `422 { error: "Agent returned an invalid ViewSpec", details: string[] }`  
**Response (quota):** `500 { error: "AI rate limit hit — wait a few seconds and try again" }`

---

### `POST /api/generate-sidebar-spec`
**Request body:**
```json
{
  "description": "hide finance",
  "currentSpec": { "version": "1.0", "items": [{ "key": "engineering", "visible": true }, …] }
}
```
`currentSpec` omitted on first call.  
**Response (success):** `{ spec: SidebarSpec }`  
```json
{
  "spec": {
    "version": "1.0",
    "items": [
      { "key": "engineering", "visible": true },
      { "key": "product",     "visible": true },
      { "key": "finance",     "visible": false }
    ]
  }
}
```

---

### WebSocket `ws://host/live?app=<id>`
**On connect:** client sends nothing beyond the query param `?app=<id>`.  
**Server → client on connect:** `{ "type": "connected", "appId": "engineering" }`  
**Server → client on data change:** `{ "type": "items:changed", "appId": "engineering", "items": [/* full item array */] }`  
Live events carry the full item list — no diffing. The client replaces its local state entirely.  
The frontend `useLiveData` validates `event.appId === activeAppId.current` before accepting to guard against stale messages during domain switches.

---

## 3. How requests flow

### Generate-a-spec flow

```
1. User types in GlobalChatPanel input → presses Enter or Send
   File: GlobalChatPanel.tsx → handleSend()

2. Frontend reads current context:
   - appId from AppContext
   - activeSection from useCurrentSection() (URL) or sectionOverride
   File: GlobalChatPanel.tsx lines 118–128

3. Frontend reads current spec for (appId, section) from GlobalAiContext cache
   File: GlobalAiContext.tsx → getSpec()

4. If section === 'sidebar':
     POST /api/generate-sidebar-spec  { description, currentSpec? }
   Else:
     POST /api/generate-spec  { appId, description: "…(for Dashboard view)", currentSpec? }
   File: api/client.ts → generateSpec() / generateSidebarSpec()

5. Backend receives request → agent.ts or sidebar-agent.ts:
   - Validates appId exists in registry (agent.ts line 28)
   - Calls bundle.generator.generate(description, currentSpec) or sidebarGen.generate(...)

6. SpecGenerator.generate() (spec-generator.ts):
   - Builds system prompt entirely from AppVocabulary (buildSystemPrompt())
   - If currentSpec present, prepends "CURRENT_SPEC:\n…\n\nINSTRUCTION: " to user text
   - Calls Gemini 2.5 Flash (thinkingBudget: 0, maxOutputTokens: 1024, temperature: 0.1)
   - Strips accidental markdown fences from response
   - Calls SpecValidator.assert(raw) — throws ValidatorError on Zod failure

7. SpecValidator.assert() (spec-validator.ts):
   - Runs the pre-built Zod schema (buildViewSpecSchema(vocab))
   - Schema enforces: layout ∈ vocabulary layouts, field keys ∈ vocabulary fields,
     filter fields ∈ filterable fields, groupBy ∈ groupable fields, limit 1–200
   - Layouts with requiresGroupBy:true must have groupBy present
   - Returns validated BaseViewSpec or throws ValidatorError

8. Backend returns { appId, spec } (200) or error (422 / 500)

9. Frontend GlobalChatPanel receives spec:
   - Calls setSpec(appId, section, newSpec) in GlobalAiContext
   - setSpec: updates in-memory cache, writes to localStorage, pushes to specHistory
   - setSpecVersion counter bumps → all useGlobalSpec consumers re-render

10. Page component (DashboardPage etc.) re-renders:
    - useGlobalSpec returns the new spec
    - Passes spec + items to existing logic (kanban groups, table columns, etc.)
    - ViewRenderer (when used) re-applies filters/sort/limit client-side and draws
```

---

### Live-update flow

```
1. Dev endpoint called: POST /api/items/dev/mutate?app=engineering
   Body: { id: "bug-001", patch: { status: "done" } }
   File: items.ts line 62–76

2. bundle.store.simulateChange(id, patch)
   File: data-store.ts → simulateChange()
   - Mutates items[index] in-place with spread
   - Emits 'change' event: { id, patch, items: fullArray }

3. LiveChannel receives 'change':
   File: live-channel.ts → attachStore() listener
   - Calls broadcast(appId, { type: 'items:changed', appId, items })
   - Iterates the domain's room Set; sends JSON to every open WebSocket

4. Each connected client's useLiveData receives 'items:changed':
   File: hooks/useLiveData.ts line 76–82
   - Validates appId matches current activeAppId ref
   - Calls setState({ items: event.items })  ← full replace, no diff

5. AppContext propagates new items to all consumers via React re-render

6. Each page re-renders with new items:
   - ViewRenderer.applySpec() re-applies the current spec's filters/sort/limit
     (client-side, no AI call, no new fetch)
   - Every open section (dashboard, explorer, analytics) updates simultaneously
   - No spec changes — only the data changes
```

---

### Initial load flow

```
1. App mounts → AppProvider fetches GET /api/apps → sets apps list
   AppProvider fetches GET /api/schema?app=engineering → sets vocabulary
   useLiveData fetches GET /api/items?app=engineering → sets items
   useLiveData opens WebSocket ws://host/live?app=engineering

2. User navigates to /#/engineering/explorer:
   - useCurrentSection() reads 'explorer' from URL
   - ExplorerPage mounts, calls useGlobalSpec('engineering', 'explorer')

3. useGlobalSpec calls getSpec('engineering', 'explorer'):
   - Checks in-memory cache: cache.current.get('engineering:explorer')
   - On cold miss: reads localStorage key 'dsi:spec:engineering:explorer'
   - Parses and caches the stored spec (or null if none)

4. ExplorerPage renders using stored spec:
   - If spec: columns from spec.fields, filters applied, sort from spec.sort
   - If null: default — all vocabulary columns, no filters, no sort

5. User selects a different domain (Product):
   - setAppId('product') → AppContext refetches schema + items for 'product'
   - useLiveData closes old WebSocket, opens new one for 'product'
   - All pages still use useGlobalSpec but now with appId='product'
   - 'product:explorer' is a separate cache slot — spec is independent
```

---

## 4. Per-context separation — what the code actually does

**Storage key:** `dsi:spec:${appId}:${section}` for content surfaces; `dsi:sidebar-spec` for sidebar.

**Isolation guarantee:** `engineering:dashboard` and `product:dashboard` are different keys in both the in-memory cache Map and localStorage. A change in one slot never touches another.

**What is NOT separated:** there is no userId. This is a single-user prototype. All specs for a given `appId:section` on the same browser share the same localStorage key. If multi-user support is added, the key must incorporate a userId.

**Known cache-staleness bug in spec restore:**  
`specHistory.restoreTo()` writes directly to `localStorage['dsi:spec:${appId}:${tab}']` but does NOT call `GlobalAiContext.setSpec()`. The in-memory cache in `GlobalAiContext` is therefore NOT invalidated. If the cache already holds a value for that `appId:section` slot (because the user visited that page earlier in the same session), navigating to that page after restoring will serve the stale cached value — the restored spec is ignored until the user hard-refreshes.  
The fix: call `setSpec(appId, tab, entry.spec)` from `SettingsPage.handleRestore()` instead of calling `specHistory.restoreTo()` directly.

---

## 5. The safety boundary

**The spec vocabulary contains only display verbs.** Looking at `buildViewSpecSchema`:
- `layout` — which component to render (table, kanban, feed, cards)
- `fields[]` — which columns to show and in what order; optional display label
- `groupBy` — which field to group columns by (kanban only)
- `filters[]` — hide items from view (`eq`, `neq`, `in`, `contains`); the schema comment says explicitly "HIDE items from view — they never delete or mutate data"
- `sort` — display ordering
- `limit` — how many items to show (max 200)

No verb for create, update, delete, or any state mutation exists anywhere in the Zod schema. The schema is derived from the vocabulary at server startup; no mutation verb can be smuggled in via the vocabulary file because there is nowhere in `AppVocabulary` for mutation operations.

**Where validation rejects out-of-vocabulary specs:**  
`SpecValidator.assert()` in `spec-validator.ts` runs the Zod schema before any spec reaches the frontend. A spec with an unknown layout name, an unknown field key, or an out-of-range limit will throw `ValidatorError` and the route returns 422. The model output never reaches the client if it fails validation.

**Destructive-sounding requests ("mark all as done", "delete done items"):**  
There is no explicit intent-detection layer. The safety is structural: the model is constrained to output a valid spec shape, and that shape has no mutation verbs. "Mark all as done" is interpreted by the model as the nearest display change (e.g., `filters: [{ field: "status", op: "eq", value: "done" }]` — showing only done items). The system prompt says "Filters HIDE data from view; they never delete or modify it." Data is never mutated on behalf of the AI by construction.

---

## 6. What the backend is and is NOT responsible for

### What the backend IS responsible for

1. **Owning domain data.** Each domain's `DataStore` holds the authoritative in-memory item array. All reads go through `DataStore.query()`. The backend is the single source of truth for item data.

2. **Serving read-only item queries.** `GET /api/items` applies `QueryParams` (filter, sort, limit) server-side and returns items. No item write path exists except the dev simulation endpoint (`POST /api/items/dev/mutate`) which is a test harness, not a production feature.

3. **Holding each domain's vocabulary.** `AppVocabulary` for each domain lives in the backend domain files. It is served to the frontend via `GET /api/schema` and used to build both the model system prompt and the Zod validation schema.

4. **Running the AI call and validating the result.** `SpecGenerator.generate()` calls Gemini 2.5 Flash, then `SpecValidator.assert()` runs the Zod schema. The model output is validated before the route returns it. This is the safety gate — an invalid spec never reaches the frontend.

5. **Selecting the correct domain bundle per request.** Both `agentRouter` and `itemsRouter` index into `AppRegistry` by `appId`. An unknown `appId` returns 400 immediately.

6. **Managing WebSocket connections and broadcasting live data.** `LiveChannel` maintains per-domain socket rooms and delivers `items:changed` events to every subscribed client whenever `DataStore` emits `'change'`.

### What the backend does NOT do

- **Does not store user specs.** In the prototype, specs are stored entirely in the browser's `localStorage` managed by `GlobalAiContext`. The backend returns a spec on request and immediately discards it — it holds no spec state whatsoever. In a production system, spec storage would move to a backend database keyed by `userId + appId + section`.

- **Does not render anything.** The backend returns data (items) and instructions (specs). All rendering is done by React components in the browser.

- **Does not mutate data on behalf of the AI.** Spec generation produces a display-only JSON object. There is no path from the AI output to a `DataStore` write.

- **Does not track users.** No auth, no sessions, no multi-tenancy. Every request is treated identically regardless of who made it.

- **Does not push initial item state on WebSocket connect.** On WebSocket connect, the backend sends `{ type: "connected", appId }` only. The client fetches initial items via REST independently; the WebSocket is used only for incremental change events.

---

## Additional discrepancies from the idealized description

| What the description said | What the code does |
|---|---|
| "calls Anthropic API" / "ANTHROPIC_API_KEY" | Uses **Google Gemini 2.5 Flash** via `@google/generative-ai`. `GEMINI_API_KEY` in `backend/.env`. |
| SpecGenerator docstring says "gemini-2.0-flash" | Actual model string in code: `'gemini-2.5-flash'` (stale comment). |
| "stored per user, per domain, per section" | **No userId in the prototype.** Storage key is `dsi:spec:${appId}:${section}` only. |
| "`ISpecRepository`, `LocalStorageSpecRepository`, `SpecStore`" are active frontend engine classes | They **exist** in `frontend/src/engine/` but are **not used** by any page. Active spec storage is `GlobalAiContext` + raw localStorage reads. |
| Section is part of the AI request context | Section is **not sent as a field** to the backend. It is appended as a suffix to the description string: `"show only high priority (for Explorer view)"`. |
| Two GoogleGenerativeAI clients | `buildAppRegistry()` creates one client for all `SpecGenerator` instances. `index.ts` creates a **second separate client** for `SidebarGenerator`. Both use the same API key. |
| `fetchItems` passes filters/sort | `client.ts` `fetchItems()` sends only `?app=<id>`. Server-side filtering capability exists but the frontend client never uses it. |
