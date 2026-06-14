import type { BaseViewSpec } from '@dsi/shared';

export type HistoryEntry = {
  id: string;
  tab: string;
  spec: BaseViewSpec;
  savedAt: number;
};

const MAX_PER_TAB = 20;

function key(appId: string, tab: string) {
  return `dsi:history:${appId}:${tab}`;
}

export const specHistory = {
  push(appId: string, tab: string, spec: BaseViewSpec): void {
    const existing = this.get(appId, tab);
    // Don't duplicate consecutive identical specs
    if (existing.length > 0 && JSON.stringify(existing[0].spec) === JSON.stringify(spec)) return;
    const entry: HistoryEntry = { id: `${Date.now()}`, tab, spec, savedAt: Date.now() };
    const next = [entry, ...existing].slice(0, MAX_PER_TAB);
    try { localStorage.setItem(key(appId, tab), JSON.stringify(next)); } catch { /* quota */ }
  },

  get(appId: string, tab: string): HistoryEntry[] {
    try {
      const raw = localStorage.getItem(key(appId, tab));
      return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    } catch { return []; }
  },

  getAll(appId: string): HistoryEntry[] {
    return ['dashboard', 'explorer', 'analytics']
      .flatMap((tab) => this.get(appId, tab))
      .sort((a, b) => b.savedAt - a.savedAt);
  },

  restoreTo(appId: string, tab: string, entry: HistoryEntry): void {
    // Write spec back to the current-spec slot so the tab picks it up on mount
    try {
      localStorage.setItem(`dsi:spec:${appId}:${tab}`, JSON.stringify(entry.spec));
    } catch { /* quota */ }
  },

  clear(appId: string, tab: string): void {
    localStorage.removeItem(key(appId, tab));
  },

  clearAll(appId: string): void {
    ['dashboard', 'explorer', 'analytics'].forEach((tab) => this.clear(appId, tab));
  },
};
