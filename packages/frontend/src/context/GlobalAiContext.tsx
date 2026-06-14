/**
 * GlobalAiContext — two responsibilities in one provider:
 *
 * 1. SPEC STORE — a cache-through store keyed by "appId:section".
 *    Each slot maps to one localStorage key. No slot ever touches another.
 *    Storage key contract:
 *      content surfaces → dsi:spec:<appId>:<section>
 *      sidebar          → dsi:sidebar-spec   (global, not per-domain)
 *
 * 2. CHAT PANEL STATE — open/closed + optional section override.
 *    Normally the panel's active section == current URL section.
 *    openChat('sidebar') overrides it so the user can customise the
 *    sidebar from anywhere without navigating away.
 */

import {
  createContext, useContext, useRef, useState, useCallback,
  type ReactNode,
} from 'react';
import type { BaseViewSpec, SidebarSpec } from '@dsi/shared';
import { specHistory } from '../engine/spec-history';

// ── Storage key mapping ───────────────────────────────────────────────────────

function storageKey(appId: string, section: string): string {
  return section === 'sidebar' ? 'dsi:sidebar-spec' : `dsi:spec:${appId}:${section}`;
}

// ── Context type ─────────────────────────────────────────────────────────────

export type AnySpec = BaseViewSpec | SidebarSpec;

interface GlobalAiContextValue {
  // Spec store
  getSpec<T extends AnySpec>(appId: string, section: string): T | null;
  setSpec<T extends AnySpec>(appId: string, section: string, spec: T | null): void;

  // Chat panel
  isChatOpen:      boolean;
  sectionOverride: string | null; // non-null when explicitly set (e.g. 'sidebar')
  openChat(sectionOverride?: string): void;
  closeChat(): void;
}

const GlobalAiContext = createContext<GlobalAiContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function GlobalAiProvider({ children }: { children: ReactNode }) {
  // Spec cache: Map<"appId:section", spec | null>
  // Using a ref so mutations don't trigger renders; specVersion drives re-renders.
  const cache = useRef<Map<string, AnySpec | null>>(new Map());
  const [specVersion, setSpecVersion] = useState(0);

  // Chat state
  const [isChatOpen,      setIsChatOpen]      = useState(false);
  const [sectionOverride, setSectionOverride] = useState<string | null>(null);

  // ── Spec store ─────────────────────────────────────────────────────────────

  const getSpec = useCallback(<T extends AnySpec>(appId: string, section: string): T | null => {
    const cacheKey = `${appId}:${section}`;
    if (!cache.current.has(cacheKey)) {
      // Cold miss → load from localStorage
      try {
        const raw = localStorage.getItem(storageKey(appId, section));
        cache.current.set(cacheKey, raw ? (JSON.parse(raw) as AnySpec) : null);
      } catch {
        cache.current.set(cacheKey, null);
      }
    }
    return cache.current.get(cacheKey) as T | null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specVersion]); // re-memoize when version bumps so consumers get fresh reads

  const setSpec = useCallback(<T extends AnySpec>(appId: string, section: string, spec: T | null) => {
    const cacheKey = `${appId}:${section}`;
    cache.current.set(cacheKey, spec);

    // Persist to localStorage
    const lsKey = storageKey(appId, section);
    try {
      if (spec === null) localStorage.removeItem(lsKey);
      else localStorage.setItem(lsKey, JSON.stringify(spec));
    } catch { /* quota */ }

    // Push to history (view specs only, not sidebar)
    if (spec !== null && section !== 'sidebar') {
      specHistory.push(appId, section, spec as BaseViewSpec);
    }

    // Trigger re-render for all consumers
    setSpecVersion((v) => v + 1);
  }, []);

  // ── Chat panel ─────────────────────────────────────────────────────────────

  const openChat = useCallback((override?: string) => {
    setSectionOverride(override ?? null);
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setSectionOverride(null);
  }, []);

  return (
    <GlobalAiContext.Provider value={{
      getSpec, setSpec,
      isChatOpen, sectionOverride, openChat, closeChat,
    }}>
      {children}
    </GlobalAiContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useGlobalAi(): GlobalAiContextValue {
  const ctx = useContext(GlobalAiContext);
  if (!ctx) throw new Error('useGlobalAi must be used inside GlobalAiProvider');
  return ctx;
}

/**
 * Per-surface spec accessor — replaces usePersistedSpec.
 * Returns [currentSpec, setSpec]. Reads from the global cache;
 * writes propagate to localStorage and re-render all consumers.
 *
 * Isolation guarantee: (appId, section) is the full key.
 * engineering:dashboard and product:dashboard are different slots.
 */
export function useGlobalSpec<T extends AnySpec>(
  appId: string,
  section: string,
): [T | null, (spec: T | null) => void] {
  const { getSpec, setSpec } = useGlobalAi();
  const spec = getSpec<T>(appId, section);
  const set  = useCallback(
    (next: T | null) => setSpec(appId, section, next),
    [appId, section, setSpec],
  );
  return [spec, set];
}
