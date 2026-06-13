import { useState } from 'react';
import { DomainSelector } from './components/app/DomainSelector';
import { useLiveData } from './hooks/useLiveData';

const DEFAULT_APP_ID = 'engineering';

/**
 * App — top-level shell.
 *
 * Holds activeAppId and passes it down. In this step (Step 6) it renders
 * a raw JSON dump of live items to verify the full data pipeline works
 * before the layout components are built in Step 7.
 */
export default function App() {
  const [appId, setAppId] = useState(DEFAULT_APP_ID);
  const { items, connected, loading, error } = useLiveData(appId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <h1 className="text-lg font-semibold text-gray-900">Dynamic Software Interfaces</h1>
        <DomainSelector activeAppId={appId} onChange={setAppId} />
        <span className={[
          'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
          connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
        ].join(' ')}>
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </header>

      {/* Body — Step 6 diagnostic view, replaced in Step 7 */}
      <main className="p-6">
        {loading && (
          <p className="text-sm text-gray-500">Loading {appId} items…</p>
        )}
        {error && (
          <p className="text-sm text-red-600">Error: {error}</p>
        )}
        {!loading && !error && (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              {items.length} items · domain: <strong>{appId}</strong>
            </p>
            <pre className="text-xs bg-white border border-gray-200 rounded-lg p-4 overflow-auto max-h-[70vh]">
              {JSON.stringify(items.slice(0, 5), null, 2)}
              {items.length > 5 && `\n…and ${items.length - 5} more`}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
