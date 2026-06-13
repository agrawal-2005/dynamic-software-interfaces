import { useState, useEffect, useRef, useCallback } from 'react';
import type { BaseViewSpec, SpecVersion } from '@dsi/shared';
import { SpecStore } from '../engine/spec-store';
import { LocalStorageSpecRepository } from '../engine/spec-repository';

type SpecStoreState = {
  current:  BaseViewSpec | null;
  pending:  BaseViewSpec | null;
  history:  SpecVersion[];
  setPending:    (spec: BaseViewSpec) => void;
  acceptPending: () => Promise<void>;
  rejectPending: () => void;
  restoreVersion:(id: string) => Promise<void>;
};

/**
 * useSpecStore — React wrapper around SpecStore.
 *
 * Creates a new SpecStore (namespaced LocalStorageSpecRepository) whenever
 * appId changes, initialises it from persisted state, and re-renders on
 * every store notification.
 */
export function useSpecStore(appId: string): SpecStoreState {
  const storeRef = useRef<SpecStore | null>(null);

  // Snapshot of the store's state — what React actually renders
  const [snapshot, setSnapshot] = useState<Pick<SpecStoreState, 'current' | 'pending' | 'history'>>({
    current: null,
    pending: null,
    history: [],
  });

  useEffect(() => {
    const repo  = new LocalStorageSpecRepository(appId);
    const store = new SpecStore(repo);
    storeRef.current = store;

    const unsub = store.subscribe(() => {
      setSnapshot({
        current: store.getCurrent(),
        pending: store.getPending(),
        history: store.getHistory(),
      });
    });

    store.init().catch(console.error);

    return () => {
      unsub();
      storeRef.current = null;
    };
  }, [appId]);

  const setPending = useCallback((spec: BaseViewSpec) => {
    storeRef.current?.setPending(spec);
  }, []);

  const acceptPending = useCallback(async () => {
    await storeRef.current?.acceptPending();
  }, []);

  const rejectPending = useCallback(() => {
    storeRef.current?.rejectPending();
  }, []);

  const restoreVersion = useCallback(async (id: string) => {
    await storeRef.current?.restoreVersion(id);
  }, []);

  return { ...snapshot, setPending, acceptPending, rejectPending, restoreVersion };
}
