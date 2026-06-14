import { useState, useEffect } from 'react';
import type { BaseViewSpec } from '@dsi/shared';
import { specHistory } from '../engine/spec-history';

/**
 * Like useState<BaseViewSpec | null> but automatically persists to localStorage.
 * Key format: dsi:spec:<appId>:<tab>
 */
export function usePersistedSpec(appId: string, tab: string) {
  const key = `dsi:spec:${appId}:${tab}`;

  const [spec, setSpecState] = useState<BaseViewSpec | null>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as BaseViewSpec) : null;
    } catch {
      return null;
    }
  });

  // When appId or tab changes, reload from the new key
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setSpecState(raw ? (JSON.parse(raw) as BaseViewSpec) : null);
    } catch {
      setSpecState(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function setSpec(next: BaseViewSpec | null) {
    setSpecState(next);
    if (next === null) {
      localStorage.removeItem(key);
    } else {
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota */ }
      specHistory.push(appId, tab, next);
    }
  }

  return [spec, setSpec] as const;
}
