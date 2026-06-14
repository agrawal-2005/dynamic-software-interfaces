import type { AppVocabulary, BaseViewSpec, Item, SidebarSpec } from '@dsi/shared';

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

// ── Agent ─────────────────────────────────────────────────────────────────

export async function generateSidebarSpec(description: string, currentSpec?: SidebarSpec | null): Promise<SidebarSpec> {
  const res = await fetch(`${BASE}/generate-sidebar-spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, ...(currentSpec ? { currentSpec } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `generate-sidebar-spec failed: ${res.status}`);
  }
  const data = await res.json() as { spec: SidebarSpec };
  return data.spec;
}

export async function generateSpec(appId: string, description: string, currentSpec?: BaseViewSpec | null): Promise<BaseViewSpec> {
  const res = await fetch(`${BASE}/generate-spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, description, ...(currentSpec ? { currentSpec } : {}) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; details?: string[] };
    throw new Error(body.error ?? `generate-spec failed: ${res.status}`);
  }
  const data = await res.json() as { spec: BaseViewSpec };
  return data.spec;
}
