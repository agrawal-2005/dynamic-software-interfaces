import { useState, useCallback } from 'react';
import type { BaseViewSpec } from '@dsi/shared';
import { generateSpec } from '../api/client';

type State = {
  loading: boolean;
  error: string | null;
};

type UseSpecGenerator = State & {
  generate: (appId: string, description: string) => Promise<BaseViewSpec | null>;
};

/**
 * useSpecGenerator — thin React wrapper around POST /api/generate-spec.
 * Returns the spec on success so the caller can route it to SpecStore.setPending().
 */
export function useSpecGenerator(): UseSpecGenerator {
  const [state, setState] = useState<State>({ loading: false, error: null });

  const generate = useCallback(async (
    appId: string,
    description: string,
  ): Promise<BaseViewSpec | null> => {
    setState({ loading: true, error: null });
    try {
      const spec = await generateSpec(appId, description);
      setState({ loading: false, error: null });
      return spec;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setState({ loading: false, error: msg });
      return null;
    }
  }, []);

  return { ...state, generate };
}
