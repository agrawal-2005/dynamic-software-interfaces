import { useState } from 'react';
import type { BaseViewSpec } from '@dsi/shared';

// Engine
import { LayoutRegistry } from './engine/layout-registry';
import { ViewRenderer }   from './engine/view-renderer';

// Layout components (app-specific)
import { TableLayout }  from './components/layouts/TableLayout';
import { KanbanLayout } from './components/layouts/KanbanLayout';
import { FeedLayout }   from './components/layouts/FeedLayout';
import { CardsLayout }  from './components/layouts/CardsLayout';

// Hooks
import { useLiveData }    from './hooks/useLiveData';
import { useSpecStore }   from './hooks/useSpecStore';

// Components
import { DomainSelector }    from './components/app/DomainSelector';
import { PersonaSelector }   from './components/app/PersonaSelector';
import { VersionHistory }    from './components/app/VersionHistory';
import { InterfaceBuilder }  from './components/builder/InterfaceBuilder';
import { SpecPreview }       from './components/builder/SpecPreview';

const DEFAULT_APP_ID = 'engineering';

// Registry created once for the app's lifetime.
const registry = new LayoutRegistry()
  .register('table',  TableLayout)
  .register('kanban', KanbanLayout)
  .register('feed',   FeedLayout)
  .register('cards',  CardsLayout);

export default function App() {
  const [appId, setAppId] = useState(DEFAULT_APP_ID);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Live data (WS-backed, keyed to appId)
  const { items, connected, loading: dataLoading, error: dataError } = useLiveData(appId);

  // Spec state (persisted per domain)
  const {
    current, pending, history,
    setPending, acceptPending, rejectPending, restoreVersion,
  } = useSpecStore(appId);

  // The rendered spec: pending (preview) takes priority over current
  const activeSpec = pending ?? current;

  function handleDomainChange(newAppId: string) {
    setAppId(newAppId);
    setSidebarOpen(false);
  }

  async function handlePresetSelect(spec: BaseViewSpec) {
    // Preset bypasses the AI and applies instantly — no preview step.
    // setPending() sets store.pending synchronously, then acceptPending()
    // reads it and persists in one awaited call.
    setPending(spec);
    await acceptPending();
  }

  function handleGenerated(spec: BaseViewSpec) {
    setPending(spec);
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-4">
        <h1 className="text-base font-semibold text-gray-900 tracking-tight whitespace-nowrap">
          Dynamic Software Interfaces
        </h1>
        <DomainSelector activeAppId={appId} onChange={handleDomainChange} />

        <div className="ml-auto flex items-center gap-3">
          <span className={[
            'text-xs font-medium px-2 py-0.5 rounded-full',
            connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400',
          ].join(' ')}>
            {connected ? '● Live' : '○ …'}
          </span>
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5"
          >
            {sidebarOpen ? 'Hide builder' : 'Customise view'}
          </button>
        </div>
      </header>

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Content pane */}
        <main className="flex-1 overflow-auto p-5">

          {/* Spec name + meta */}
          {activeSpec && (
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-800">
                {activeSpec.name ?? 'Untitled view'}
              </h2>
              <span className="text-xs text-gray-400">
                {activeSpec.layout} · {items.length} items
                {pending ? ' · preview' : ''}
              </span>
            </div>
          )}

          {/* Pending spec preview banner */}
          {pending && (
            <div className="mb-4">
              <SpecPreview
                spec={pending}
                onAccept={acceptPending}
                onReject={rejectPending}
              />
            </div>
          )}

          {/* Data states */}
          {dataLoading && (
            <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
          )}
          {dataError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {dataError}
            </div>
          )}

          {/* Renderer */}
          {!dataLoading && !dataError && activeSpec && (
            <ViewRenderer spec={activeSpec} items={items} registry={registry} />
          )}

          {/* No spec yet */}
          {!dataLoading && !dataError && !activeSpec && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-gray-500 text-sm max-w-sm">
                Pick a persona preset or describe the view you want in the builder →
              </p>
              <PersonaSelector appId={appId} onSelect={handlePresetSelect} />
            </div>
          )}
        </main>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="flex-shrink-0 w-80 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Describe your view</h3>
              <InterfaceBuilder appId={appId} onGenerated={handleGenerated} />
            </div>

            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Persona presets</h3>
              <PersonaSelector appId={appId} onSelect={handlePresetSelect} />
            </div>

            <div className="p-4 flex-1">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Version history</h3>
              <VersionHistory
                history={history}
                currentSpec={current}
                onRestore={restoreVersion}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
