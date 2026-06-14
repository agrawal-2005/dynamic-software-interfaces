import type { AppVocabulary, Item, GenerateRequest, GenerateResponse } from '@dsi/shared';

const BASE = '/api';

export type AppInfo = { id: string; label: string };

// ── Domain discovery ──────────────────────────────────────────────────────

export async function fetchApps(): Promise<AppInfo[]> {
  const res = await fetch(`${BASE}/apps`);
  if (!res.ok) throw new Error(`fetchApps failed: ${res.status}`);
  const data = await res.json() as { apps: AppInfo[] };
  return data.apps;
}

export async function fetchSchema(appId: string): Promise<AppVocabulary> {
  const res = await fetch(`${BASE}/schema?app=${encodeURIComponent(appId)}`);
  if (!res.ok) throw new Error(`fetchSchema failed: ${res.status}`);
  const data = await res.json() as { vocabulary: AppVocabulary };
  return data.vocabulary;
}

// ── Items ─────────────────────────────────────────────────────────────────

export async function fetchItems(appId: string): Promise<Item[]> {
  const res = await fetch(`${BASE}/items?app=${encodeURIComponent(appId)}`);
  if (!res.ok) throw new Error(`fetchItems failed: ${res.status}`);
  const data = await res.json() as { items: Item[] };
  return data.items;
}

/**
 * Unified routing + spec-generation endpoint.
 * The backend AI receives all surface vocabularies, determines the target surface
 * by meaning alone, and returns either a ready-to-apply spec or a clarification prompt.
 * The frontend makes no routing decision.
 */
export async function generate(req: GenerateRequest): Promise<GenerateResponse> {
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `generate failed: ${res.status}`);
  }
  return res.json() as Promise<GenerateResponse>;
}
