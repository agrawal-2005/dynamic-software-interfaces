# Dynamic Software Interfaces — Project Context

## What this is
A prototype proving the "Dynamic Software Interfaces" thesis: software ships as
shared primitives (data + query API), and each user's interface is generated to
fit them via an AI agent. Same data, radically different interface per person.

The demo is a **multi-domain dashboard**. Three domains (Engineering, Product,
Finance) each have their own vocabulary (layouts + fields) and seed data. The
user picks a domain; the same engine drives a completely different experience.
Adding a new domain (restaurant, hospital, etc.) requires writing one new
vocabulary file — zero engine changes.

## Architecture (3 layers)

1. **Backend "primitives"** (Node + TypeScript + Express): one server, one engine
   codebase. Per-domain DataStores are isolated instances of the same engine
   class. Typed schema, read-only query API, live updates over WebSocket.

2. **Agent layer**: calls Anthropic API to translate plain English into a view
   spec (JSON). NEVER writes code, NEVER touches data, NEVER renders.

3. **Frontend "personal interface"** (React + TypeScript + Vite + Tailwind):
   a renderer that draws any view spec against live data, saves each user's spec,
   subscribes to live updates. DomainSelector reloads vocabulary + data.

## Engine (domain-neutral, defined once)

The engine speaks only of: items, fields, layouts, view specs, vocabulary.
No domain-specific nouns appear in engine files.

Engine classes — defined once, instantiated per domain at startup:
- **Item**: `{ id: string; [key: string]: unknown }` — the generic data unit
- **DataStore**: holds Item[], emits change events
- **SpecValidator**: validates a ViewSpec against an injected AppVocabulary
- **SpecGenerator**: calls Anthropic API; system prompt built from AppVocabulary
- **LiveChannel**: one instance; manages per-domain WS subscriptions

## The View Spec (the core contract)

A small JSON document describing HOW to display data. Vocabulary is injected
by the domain — the engine schema is built from it at startup, not hardcoded.

Structure:
- version: "1.0"
- layout: one of the domain's declared layout names
- fields: ordered list of { key, label?, visible? }
- groupBy: one of the domain's declared groupable field keys (required for layouts
  that declare requiresGroupBy: true)
- filters: array of { field, op, value } — HIDE only, never delete data
  op values: eq | neq | in | contains  (engine-level constants)
- sort: { field, direction: asc|desc }
- limit: integer 1–200

The Zod schema is built by buildViewSpecSchema(vocab) in @dsi/shared.
Agent emits a spec → SpecValidator rejects anything outside the vocabulary →
renderer draws it.

Two independent channels:
- "Shape" channel: description → AI → spec (rare, intentional user action)
- "Data" channel: backend change → WebSocket → re-render (frequent, no AI call)

## Safety boundary (structural, not vigilance)

The spec vocabulary contains ONLY display verbs. No write/delete/mutation verbs
exist in the vocabulary. The frontend reads data through a read-only lens; the
spec shapes the lens but never writes back. Harm is impossible by construction.

## Multi-domain app layer

Domain configs live in backend/src/app/domains/:
- engineering/  — status-driven kanban + table + feed + cards; ~20 items
- product/      — phase-driven kanban + table + feed + cards; ~15 items
- finance/      — table + feed + cards (no kanban); ~25 items

buildAppRegistry() creates one (DataStore, SpecValidator, SpecGenerator) triple
per domain at server startup. Routes accept ?app=<id>. Frontend DomainSelector
drives which triple is active. Adding a domain = one new vocabulary.ts + seed.ts.

## Persistence & version history

Prototype: localStorage, behind an ISpecRepository interface. Never overwrite —
each change is a new version (survives refresh). Users can preview and one-click
restore past versions. Spec versions are namespaced by appId so switching domains
does not corrupt history. DB adapter replaces localStorage without engine changes.

## UX for the prototype

- Domain selector (Engineering / Product / Finance)
- Persona preset gallery per domain (3 presets each)
- Describe-to-interface loop
- Live preview before commit (accept / reject)
- Version history with restore

## Code architecture

Class-based, single-responsibility, dependency injection throughout.

Backend engine (domain-agnostic, defined once):
  DataStore, SpecValidator, SpecGenerator, LiveChannel

Backend app layer (domain-specific):
  buildAppRegistry, domains/engineering/, domains/product/, domains/finance/

Frontend engine (domain-agnostic):
  ISpecRepository, LocalStorageSpecRepository, SpecStore, LayoutRegistry,
  ViewRenderer

Frontend app layer (domain-specific):
  TableLayout, KanbanLayout, FeedLayout, CardsLayout,
  domains/engineering/presets, domains/product/presets, domains/finance/presets

Program to interfaces — storage and model-provider adapters are swappable.

## Tech stack

- Monorepo: pnpm workspaces
- Shared: @dsi/shared — TypeScript + Zod (buildViewSpecSchema factory)
- Backend: Node + TypeScript + Express + ws library (ONE server)
- Agent: @anthropic-ai/sdk with structured output
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Persistence: localStorage adapter now (ISpecRepository interface)

## API key rule

ANTHROPIC_API_KEY is the APP's runtime key (from console.anthropic.com).
Lives in backend/.env. Never committed. Never sent to the frontend.

## Conventions

- Small, reviewable commits. TypeScript strict mode.
- Engine files contain zero domain-specific strings. All such strings live in
  vocabulary files under domains/.
- No DB, Redis, auth, or multi-tenancy in the prototype. Stateless server +
  swappable storage interface so scaling is a natural extension.

## Out of scope (now)

Auth, multi-tenancy, external data source connectors, agent modifying middleware,
behavior/middleware customization. These come after the core demo works.
