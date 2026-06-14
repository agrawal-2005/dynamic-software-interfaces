import { useState } from 'react';
import type { SidebarSpec } from '@dsi/shared';

const STORAGE_KEY = 'dsi:sidebar-spec';

function load(): SidebarSpec | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SidebarSpec) : null;
  } catch { return null; }
}

function save(spec: SidebarSpec | null): void {
  try {
    if (spec === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(spec));
  } catch { /* quota */ }
}

/**
 * Persists the sidebar spec to localStorage under dsi:sidebar-spec.
 * Stored once globally — not per-domain, because the sidebar is a
 * user-level surface that spans all workspaces.
 */
export function useSidebarSpec() {
  const [spec, setSpecState] = useState<SidebarSpec | null>(load);

  function setSpec(next: SidebarSpec | null) {
    setSpecState(next);
    save(next);
  }

  return [spec, setSpec] as const;
}
