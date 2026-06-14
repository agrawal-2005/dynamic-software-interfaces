import {
  createContext, useContext, useState, useEffect,
  type ReactNode,
} from 'react';
import type { Item, AppVocabulary } from '@dsi/shared';
import type { AppInfo } from '../api/client';
import { useLiveData } from '../hooks/useLiveData';
import { fetchApps, fetchSchema } from '../api/client';

type AppContextValue = {
  appId: string;
  setAppId: (id: string) => void;
  apps: AppInfo[];
  items: Item[];
  vocabulary: AppVocabulary | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
};

const AppContext = createContext<AppContextValue>({
  appId: 'engineering',
  setAppId: () => {},
  apps: [],
  items: [],
  vocabulary: null,
  connected: false,
  loading: true,
  error: null,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [appId, setAppId] = useState('engineering');
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [vocabulary, setVocabulary] = useState<AppVocabulary | null>(null);

  const { items, connected, loading, error } = useLiveData(appId);

  useEffect(() => {
    fetchApps().then(setApps).catch(console.error);
  }, []);

  useEffect(() => {
    // Cancel the previous fetch if appId changes before it resolves.
    // Without this, a slow Engineering fetch arriving after a fast Product
    // fetch would overwrite the correct Product vocabulary.
    let cancelled = false;
    setVocabulary(null);
    fetchSchema(appId)
      .then((v) => { if (!cancelled) setVocabulary(v); })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [appId]);

  return (
    <AppContext.Provider value={{ appId, setAppId, apps, items, vocabulary, connected, loading, error }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
