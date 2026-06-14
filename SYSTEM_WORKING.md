# SYSTEM_WORKING.md — How this project actually works

> Based on the code as it exists today. Where reality differs from idealized
> descriptions, this document states what the code does, not what was intended.

---

## 1. Component map

### Shared package — `packages/shared/src` (`@dsi/shared`)

| Export | File | Responsibility |
|---|---|---|
| `Item` | `item/item.types.ts` | Generic data unit: `{ id: string; [key: string]: unknown }` |
| `FilterClause`, `QueryParams`, etc. | `item/item.types.ts` | Query primitives: filter op, sort, limit |
| `AppVocabulary`, `AppFieldDef`, `AppLayoutDef` | `spec/app-vocabulary.ts` | Domain vocabulary shape — fields + layouts, no domain strings |
| `BaseViewSpec`, `SpecVersion` | `spec/view-spec.types.ts` | View spec contract |
| `buildViewSpecSchema(vocab)` | `spec/view-spec.schema.ts` | Zod schema factory — derives a concrete schema from any vocabulary |
| `SidebarSpec`, `SidebarNavItem`, `SidebarVocabulary`, `SidebarItemSpec` | `spec/sidebar-spec.types.ts` | Sidebar display spec types |
| `buildSidebarSpecSchema(vocab)` | `spec/sidebar-spec.schema.ts` | Zod schema factory for sidebar specs |
| `NavSpec` | `spec/nav-spec.types.ts` | `{ version: '1.0'; visible?: boolean; hiddenTabs: string[] }` |
| `GenerateRequest`, `GenerateResponse`, `ClarificationOption` | `types/generate.ts` | Unified generate request/response contract |

`ClarificationOption` is `{ surface: string; label: string; hint?: string }`. The `hint` field carries the exact message to re-send when the user picks an option — making the re-send self-contained and unambiguous.

---

### Backend engine — `packages/backend/src/engine/` (domain-agnostic, defined once)

| Class | File | Responsibility |
|---|---|---|
| `DataStore` | `data-store.ts` | Holds `Item[]` in memory; applies `QueryParams` (filter/sort/limit); emits `'change'` event on mutation |
| `SpecValidator` | `spec-validator.ts` | Constructed with a vocabulary; calls `buildViewSpecSchema()` once; `assert(raw)` throws `ValidatorError` if AI output fails Zod |
| `UnifiedGenerator` | `unified-generator.ts` | Single Gemini 2.5 Flash client; receives all `SurfaceContext[]`; routes by vocabulary meaning; returns `applied` or `needs_clarification` |
| `LiveChannel` | `live-channel.ts` | One WebSocket server; routes broadcasts to per-domain rooms; attaches to `DataStore` change events |

There is no longer a `SpecGenerator` or `SidebarGenerator` class. Both legacy per-surface generators were replaced by `UnifiedGenerator` in a single call.

---

### Backend app layer — `packages/backend/src/app/`

| Part | Location | Responsibility |
|---|---|---|
| `buildAppRegistry()` | `app-registry.ts` | Creates one `{ DataStore, SpecValidator }` pair per domain at startup; returns `AppRegistry` record |
| `buildSurfaceRegistry(sidebarVocab, appRegistry)` | `surface-registry.ts` | Declares every customizable surface once at startup as a `SurfaceDef`; returns `SurfaceRegistry` with `resolve()` |
| `ENGINEERING_VOCABULARY`, seed | `domains/engineering/` | Layouts + fields with synonym-rich descriptions; ~20 seed items |
| `PRODUCT_VOCABULARY`, seed | `domains/product/` | Layouts + fields; ~15 seed items |
| `FINANCE_VOCABULARY`, seed | `domains/finance/` | Layouts + fields (no kanban); ~25 seed items |

#### `SurfaceDef` — the unit of the surface registry

```typescript
interface SurfaceDef {
  readonly id:                    string;        // stable id matching AI response targetSurface
  readonly label:                 string;        // human-readable name
  readonly purpose:               string;        // describes what this surface controls; injected into AI prompt
  readonly specSchema:            string;        // JSON schema description sent verbatim to the AI
  readonly clarificationGuidance: string;        // per-surface option-generation instructions for the AI
  specKey(ctx: RequestContext): string;          // key used to look up this surface's spec in currentSpecs
  buildLabel?(ctx: RequestContext): string;      // optional request-specific label (e.g. "Engineering · dashboard")
  buildVocabText(currentSpec: unknown): string;  // injects current visible/hidden state into pre-computed vocab text
}
```

`clarificationGuidance` was previously hardcoded in the system prompt as per-surface rules. It now lives as data on each `SurfaceDef`. The system prompt says "follow each surface's clarification guidance" — naming no surface itself.

The vocab text's structural part (field listings, layout listings, tab listings) is pre-computed at startup and captured in a closure. `buildVocabText` only recomputes the visible/hidden state lines per request.

#### `SurfaceRegistry`

```typescript
interface SurfaceRegistry {
  readonly sidebar: SurfaceDef;
  readonly nav:     SurfaceDef;
  readonly views:   Readonly<Record<string, SurfaceDef>>;  // keyed by appId
  resolve(appId: string, section: string): SurfaceDef[];  // returns [sidebar, views[appId], nav]
}
```

`resolve()` is the only entry point the generate route uses. It returns all surfaces for the request in prompt order. Adding a new surface type = add a `SurfaceDef` + include it in `resolve()`. The route and the AI prompt require no changes.

---

### Backend routes — `packages/backend/src/routes/`

| File | Path | Responsibility |
|---|---|---|
| `apps.ts` | `GET /api/apps` | Returns domain list `{ apps: [{id, label}] }` |
| `schema.ts` | `GET /api/schema?app=<id>` | Returns vocabulary for a domain |
| `items.ts` | `GET /api/items?app=<id>[&filter=…][&sort=…][&limit=N]` | Read-only item query |
| `generate.ts` | `POST /api/generate` | Calls `surfaceRegistry.resolve()`, assembles `SurfaceContext[]` generically, calls `UnifiedGenerator`, validates result, returns `applied` \| `needs_clarification` |

The legacy per-surface routes (`POST /api/generate-spec`, `POST /api/generate-sidebar-spec`) have been removed.

---

### Frontend engine — `packages/frontend/src/engine/` (domain-agnostic)

| File | Status | Responsibility |
|---|---|---|
| `layout-registry.ts` | **Active** | Maps layout name string → React component |
| `view-renderer.tsx` | **Active** | Applies spec filters/sort/limit client-side; dispatches to layout |
| `shared-registry.ts` | **Active** | Singleton `LayoutRegistry` pre-populated with table, kanban, feed, cards |
| `spec-history.ts` | **Active** | Stores up to 20 versions per `appId:tab` in localStorage; view specs only (nav and sidebar excluded) |

---

### Frontend app layer

| Part | Location | Responsibility |
|---|---|---|
| `AppContext` | `context/AppContext.tsx` | Active `appId`, `apps` list, `items`, `vocabulary`, live connection state |
| `GlobalAiContext` | `context/GlobalAiContext.tsx` | In-memory spec cache (Map ref) + localStorage write-through; chat open/close + section override |
| `useGlobalSpec(appId, section)` | same file | Per-surface spec accessor: `[spec, setSpec]` |
| `useCurrentSection()` | `hooks/useCurrentSection.ts` | Derives section string from URL pathname |
| `useLiveData(appId)` | `hooks/useLiveData.ts` | REST initial fetch + WebSocket subscription; auto-reconnects |
| `GlobalChatPanel` | `components/ai/GlobalChatPanel.tsx` | Shared chat UI; sends all messages to `POST /api/generate`; renders `needs_clarification` as option buttons; shows escape hatch banner when sidebar/navbar is hidden as a whole |
| `AppShell` | `components/layout/AppShell.tsx` | Root layout: conditionally renders `<Sidebar />` based on `sidebarSpec.visible !== false` |
| `Sidebar` | `components/layout/Sidebar.tsx` | Spec-driven nav; redirects to first visible workspace when active domain is hidden |
| `DomainPage` | `pages/DomainPage.tsx` | Domain header + tab bar; hides entire tab bar when `navSpec.visible === false`; shows "N hidden" restore button when individual tabs are hidden |

---

## 2. What data is sent to the backend — exact shapes

### `GET /api/apps`
**Request:** no body, no params.
**Response:** `{ apps: [{ id: string; label: string }] }`

---

### `GET /api/schema?app=<id>`
**Request:** query param `app=engineering`.
**Response:** `{ appId: string; vocabulary: AppVocabulary }`
`AppVocabulary` = `{ layouts: AppLayoutDef[]; fields: AppFieldDef[] }`

---

### `GET /api/items?app=<id>`
**Request:** query param `app=engineering`. The frontend client sends only `?app=<id>` — all item shaping (filter/sort/limit) is done client-side via `ViewRenderer` applying the current spec.
**Response:** `{ appId: string; count: number; items: Item[] }`

---

### `POST /api/generate`

**Request body:**
```json
{
  "message":       "show only critical bugs grouped by assignee",
  "appId":         "engineering",
  "activeSurface": "dashboard",
  "currentSpecs": {
    "sidebar":   { "version": "1.0", "visible": true, "items": [{ "key": "engineering", "visible": true }, …] },
    "nav":       { "version": "1.0", "visible": true, "hiddenTabs": [] },
    "dashboard": { "version": "1.0", "layout": "kanban", "fields": […], … }
  },
  "forceSurface": "view"
}
```

`forceSurface` is omitted on normal sends; set when the user picks an option after `needs_clarification`.
`currentSpecs` always includes `sidebar`, `nav`, and the key matching `activeSurface`; any may be `null`.

**Response — applied:**
```json
{
  "status":        "applied",
  "targetSurface": "view",
  "targetAppId":   "engineering",
  "targetSection": "dashboard",
  "spec":          { "version": "1.0", "layout": "kanban", "groupBy": "assignee", "filters": [{ "field": "priority", "op": "eq", "value": "critical" }], … },
  "message":       "Filtered to critical priority, grouped by assignee."
}
```

`targetAppId` is `"global"` when `targetSurface === "sidebar"` (sidebar is global, not per-domain).
`targetSection` is `"sidebar"`, `"nav"`, or the active section string.

**Response — needs clarification:**
```json
{
  "status":   "needs_clarification",
  "question": "Did you want to hide the Finance tab in the navbar, or hide the Finance workspace from the sidebar?",
  "options": [
    { "surface": "nav",     "label": "Hide Finance tab",             "hint": "Hide Finance tab" },
    { "surface": "sidebar", "label": "Hide Finance from the panel",  "hint": "Hide Finance from the sidebar" }
  ]
}
```

The `hint` on each option is the exact message the frontend re-sends when the user clicks it, with `forceSurface` set to that option's surface. The backend skips conflict detection when `forceSurface` is present.

**Response — validation failure:** `422 { error: "AI returned an invalid SidebarSpec"|"AI returned an invalid NavSpec"|"AI returned an invalid ViewSpec", details: string[] }`
**Response — transient AI error:** `503 { error: "Gemini is temporarily overloaded — please try again in a moment" }`
**Response — quota:** `500 { error: "AI rate limit hit — wait a few seconds and try again" }`

---

### WebSocket `ws://host/live?app=<id>`
**On connect:** client sends nothing beyond `?app=<id>`.
**Server → client on connect:** `{ "type": "connected", "appId": "engineering" }`
**Server → client on data change:** `{ "type": "items:changed", "appId": "engineering", "items": [/* full item array */] }`
Live events carry the full item list — no diffing. The client replaces its local state entirely.
`useLiveData` validates `event.appId === activeAppId.current` before accepting to guard against stale messages during domain switches.

---

## 3. How requests flow

### Generate-a-spec flow (unified)

```
1. User types in GlobalChatPanel → handleSend() → sendToBackend(message)

2. Frontend collects context — makes NO routing decision:
   - appId from AppContext
   - activeSection from useCurrentSection() (URL) or sectionOverride
   - currentSpecs: { sidebar: sidebarSpec, nav: navSpec, [activeSection]: getSpec(appId, activeSection) }

3. POST /api/generate { message, appId, activeSurface, currentSpecs, forceSurface? }

4. Route (generate.ts) resolves surfaces generically:
   ctx = { appId, section }
   surfaces = surfaceRegistry.resolve(appId, section).map(def => ({
     id, label: def.buildLabel?.(ctx) ?? def.label,
     purpose, specSchema, clarificationGuidance,
     vocabText: def.buildVocabText(specs[def.specKey(ctx)] ?? null),
     currentSpec: specs[def.specKey(ctx)] ?? null,
   }))
   → produces [sidebarCtx, viewCtx, navCtx] without naming any surface

5. UnifiedGenerator.generate() — single Gemini 2.5 Flash call:
   - thinkingBudget: 0, maxOutputTokens: 2048, temperature: 0.1
   - System prompt: surface-agnostic routing rules + all surface blocks with clarificationGuidance
   - Each surface's vocabText includes QUALIFIER NOTE if disambiguation is needed
   - Returns { status: "applied", targetSurface, spec, message }
           | { status: "needs_clarification", question, options[] }

6a. needs_clarification:
   - Route returns immediately: { status, question, options }
   - GlobalChatPanel renders amber question bubble + indigo option buttons
   - User clicks option → sendToBackend(opt.hint ?? originalMessage, opt.surface)
     with forceSurface set; UnifiedGenerator skips conflict detection

6b. applied — spec validation:
   targetSurface === "sidebar" → buildSidebarSpecSchema(sidebarVocab).parse(rawSpec)
   targetSurface === "nav"     → navSpecSchema.parse(rawSpec)   [Zod, tab keys from NAV_TABS]
   else (view)                 → bundle.validator.assert(rawSpec)  [SpecValidator, vocab-derived Zod]
   Invalid spec → 422, never reaches frontend

7. Route returns { status: "applied", targetSurface, targetAppId, targetSection, spec, message }

8. GlobalChatPanel: setSpec(targetAppId, targetSection, spec)
   GlobalAiContext: updates in-memory cache + localStorage + specHistory (view specs only)
   → all useGlobalSpec() consumers re-render

9. Page re-renders: useGlobalSpec returns new spec → layout component draws updated view
```

---

### Live-update flow

```
1. POST /api/items/dev/mutate?app=engineering  { id: "ENG-001", patch: { status: "done" } }

2. bundle.store.simulateChange(id, patch)
   → mutates item in-place; emits 'change' event with full item array

3. LiveChannel broadcast(appId, { type: 'items:changed', appId, items })
   → sends JSON to every WebSocket in the domain's room Set

4. useLiveData receives 'items:changed'
   → validates appId matches; calls setState({ items: event.items }) — full replace

5. AppContext propagates new items; all pages re-render
   ViewRenderer re-applies current spec filters/sort/limit — no AI call, no fetch
```

---

### Initial load flow

```
1. App mounts → AppProvider fetches GET /api/apps → sets apps list
   AppProvider fetches GET /api/schema?app=<first> → sets vocabulary
   useLiveData fetches GET /api/items?app=<first> → sets items
   useLiveData opens WebSocket ws://host/live?app=<first>
   AppContext uses cancelled-flag pattern to guard against vocabulary race on domain switch

2. User navigates to /#/engineering/explorer:
   useCurrentSection() reads 'explorer' from URL
   ExplorerPage mounts → useGlobalSpec('engineering', 'explorer')

3. useGlobalSpec calls getSpec('engineering', 'explorer'):
   → checks in-memory cache: cache.current.get('engineering:explorer')
   → cold miss: reads localStorage 'dsi:spec:engineering:explorer'
   → parses and caches (or null)

4. ExplorerPage renders using stored spec:
   spec present → apply columns/filters/sort from spec
   null → default (all vocabulary columns, no filters)

5. User switches domain (Product):
   setAppId('product') → AppContext refetches schema + items for 'product'
   useLiveData closes old WebSocket, opens new for 'product'
   'product:explorer' is a separate cache slot — completely independent spec
```

---

## 4. Per-context separation

**Storage key:** `dsi:spec:${appId}:${section}` for view surfaces; `dsi:spec:global:sidebar` for sidebar; `dsi:spec:${appId}:nav` for nav.

**Isolation guarantee:** each `appId:section` combination is an independent slot in both the in-memory cache Map and localStorage. A change in one slot never affects another.

**What is NOT separated:** there is no userId. This is a single-user prototype. All specs for a given `appId:section` on the same browser share the same localStorage key.

**specHistory isolation:** only view specs are pushed to history. The `GlobalAiContext.setSpec` call guards with `section !== 'sidebar' && section !== 'nav'` before pushing. SettingsPage filters history entries to `e.spec.layout !== undefined` as a secondary guard, preventing nav/sidebar entries from appearing in the restore UI.

---

## 5. The safety boundary

**The spec vocabulary contains only display verbs.** In `buildViewSpecSchema`:
- `layout` — which component to render (table, kanban, feed, cards)
- `fields[]` — which columns to show, in what order, optional display label rename
- `groupBy` — field to group by (kanban only; must be a `groupable` field)
- `filters[]` — hide items from view (eq/neq/in/contains); never delete or mutate data
- `sort` — display ordering
- `limit` — how many items to show (1–200)

No create, update, or delete verb exists anywhere in the Zod schema. The schema is derived from `AppVocabulary` at startup; no mutation verb can enter via the vocabulary file because `AppVocabulary` has no mutation field type.

**Where validation rejects invalid specs:**
`SpecValidator.assert()` in `spec-validator.ts` runs the vocabulary-derived Zod schema before the route returns. Unknown layout names, unknown field keys, non-groupable fields in `groupBy`, or out-of-range `limit` all throw `ValidatorError` → 422 response. The AI output never reaches the frontend if it fails validation.

The same enforcement applies to sidebar and nav specs via their own Zod schemas (`buildSidebarSpecSchema`, `navSpecSchema`).

**Destructive-sounding requests ("delete done items"):** the system prompt tells the AI that filters hide data from view — they never delete. The spec shape has no mutation verbs. The model is constrained to produce a valid spec, and valid specs can only shape the display. Harm is impossible by construction.

---

## 6. The surface-agnostic AI design

### System prompt

The system prompt in `unified-generator.ts` contains **no surface names** (no "sidebar", "nav", "view", "dashboard", "explorer", etc.). Verified at build time via the prompt template.

Generic sections that remain:
- Routing rules (parse by meaning → check vocabulary → 1 match → apply; 2+ → clarify; 0 → fallback)
- "Follow each surface's clarification guidance" — no per-surface option rules
- "Read qualifier notes in vocabText before routing"
- Unmappable fallback instructions
- Output JSON schema

### Surface-specific behavior as data

| Behavior | Was in prompt | Now in |
|---|---|---|
| "ONE option per sidebar item + one for whole panel" | Hardcoded rule | `sidebar.clarificationGuidance` |
| "ONE option per tab + one for whole navbar" | Hardcoded rule | `nav.clarificationGuidance` |
| "Tab names are qualifiers not layout names" | ⚠ CRITICAL block | `nav.buildVocabText()` QUALIFIER NOTE |
| `"show the navbar"` maps to nav surface | RESTORE commands block | `nav.purpose` (declares restore phrases) |
| `"show the sidebar"` maps to sidebar surface | RESTORE commands block | `sidebar.purpose` (declares restore phrases) |
| View option hint format | Hardcoded rule | `view.clarificationGuidance` |

### Extending with a new surface type

The generate route loop:
```typescript
const surfaces = surfaceRegistry.resolve(appId, section).map((def) => {
  const spec = specs[def.specKey(ctx)] ?? null;
  return { id, label, purpose, specSchema, clarificationGuidance, vocabText, currentSpec };
});
```

Adding a new surface:
1. Create a `SurfaceDef` in `surface-registry.ts`
2. Include it in `resolve()`
3. Add its Zod validation in the `generate.ts` validation block

Route changes: 3 lines (validation block). Prompt changes: zero.

---

## 7. What the backend is and is NOT responsible for

### Is responsible for

1. **Owning domain data.** Each domain's `DataStore` holds the authoritative in-memory item array.
2. **Serving read-only item queries.** `GET /api/items` applies `QueryParams` server-side.
3. **Holding each domain's vocabulary.** Served via `GET /api/schema`; used to build the Gemini prompt and the Zod validation schema.
4. **Running the AI call and validating the result.** `UnifiedGenerator` calls Gemini; spec validation runs before the route returns. This is the safety gate.
5. **Selecting the correct domain bundle per request.** An unknown `appId` returns 400 immediately.
6. **Managing WebSocket connections.** `LiveChannel` delivers `items:changed` to every subscribed client.

### Is NOT responsible for

- **Storing user specs.** Specs are in the browser's `localStorage` (`GlobalAiContext`). The backend holds no spec state.
- **Rendering anything.** Data and specs are returned; all rendering is done in React.
- **Mutating data on behalf of the AI.** There is no path from AI output to a `DataStore` write.
- **Tracking users.** No auth, sessions, or multi-tenancy.
- **Pushing initial item state on WebSocket connect.** The client fetches items via REST independently.

---

## 8. Known discrepancies / notes

| What earlier docs said | What the code does |
|---|---|
| "calls Anthropic API" / `ANTHROPIC_API_KEY` | Uses **Google Gemini 2.5 Flash** via `@google/generative-ai`. Key is `GEMINI_API_KEY` in `backend/.env`. |
| `SpecGenerator`, `SidebarGenerator` classes | **Removed.** Replaced entirely by `UnifiedGenerator`. |
| Legacy routes `/api/generate-spec`, `/api/generate-sidebar-spec` | **Removed.** Only `POST /api/generate` exists. |
| `ClarificationOption` is `{ surface, label }` | Now `{ surface, label, hint? }`. `hint` is the exact re-send message for the chosen option. |
| `ISpecRepository`, `LocalStorageSpecRepository`, `SpecStore` | **Exist** in `frontend/src/engine/` but are **not used** by any page. Active spec storage is `GlobalAiContext`. |
| `fetchItems` passes filters/sort | `client.ts` `fetchItems()` sends only `?app=<id>`. Server-side filtering capability exists but the client does not use it — all item shaping is done client-side. |
| SurfaceContext has 5 fields | Now has 7 fields: adds `clarificationGuidance` and keeps all previous fields. |
| Route hardcodes 3 surfaces | Route calls `surfaceRegistry.resolve(appId, section).map(...)` — generic, no surface names. |
| System prompt names surfaces | System prompt is fully surface-agnostic. All surface-specific rules live in `SurfaceDef` metadata. |
