import { useEffect, useState } from 'react';
import { fetchApps } from '../../api/client';
import type { AppInfo } from '../../api/client';

type Props = {
  activeAppId: string;
  onChange: (appId: string) => void;
};

/**
 * DomainSelector — shows all registered domains and highlights the active one.
 * Fetches the list from /api/apps at mount; the backend is the single source
 * of truth for which domains are available.
 */
export function DomainSelector({ activeAppId, onChange }: Props) {
  const [apps, setApps] = useState<AppInfo[]>([]);

  useEffect(() => {
    fetchApps().then(setApps).catch(console.error);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-500">Domain:</span>
      <div className="flex gap-1">
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => onChange(app.id)}
            className={[
              'px-3 py-1 rounded-full text-sm font-medium transition-colors',
              app.id === activeAppId
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            ].join(' ')}
          >
            {app.label}
          </button>
        ))}
      </div>
    </div>
  );
}
