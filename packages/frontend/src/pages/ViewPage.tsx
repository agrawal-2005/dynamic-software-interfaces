import { useState } from 'react';
import type { BaseViewSpec } from '@dsi/shared';
import { Sparkles, History, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LayoutRegistry }   from '../engine/layout-registry';
import { ViewRenderer }     from '../engine/view-renderer';
import { TableLayout }      from '../components/layouts/TableLayout';
import { KanbanLayout }     from '../components/layouts/KanbanLayout';
import { FeedLayout }       from '../components/layouts/FeedLayout';
import { CardsLayout }      from '../components/layouts/CardsLayout';
import { useSpecStore }     from '../hooks/useSpecStore';
import { InterfaceBuilder } from '../components/builder/InterfaceBuilder';
import { SpecPreview }      from '../components/builder/SpecPreview';
import { PersonaSelector }  from '../components/app/PersonaSelector';
import { VersionHistory }   from '../components/app/VersionHistory';

const registry = new LayoutRegistry()
  .register('table',  TableLayout)
  .register('kanban', KanbanLayout)
  .register('feed',   FeedLayout)
  .register('cards',  CardsLayout);

type Panel = 'builder' | 'history' | null;

export function ViewPage() {
  const { appId, items, loading, error } = useApp();
  const [panel, setPanel] = useState<Panel>('builder');

  const {
    current, currentVersionId, pending, history,
    setPending, acceptPending, rejectPending, restoreVersion,
  } = useSpecStore(appId);

  const activeSpec = pending ?? current;

  async function handlePresetSelect(spec: BaseViewSpec) {
    setPending(spec);
    await acceptPending();
  }

  function togglePanel(p: Panel) {
    setPanel((prev) => (prev === p ? null : p));
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-3.5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              {activeSpec?.name ?? 'My View'}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeSpec
                ? `${activeSpec.layout} · ${activeSpec.fields.filter(f => f.visible).length} fields · ${items.length} items`
                : 'No view saved yet — pick a preset or describe your view'}
            </p>
          </div>

          {/* Persona presets inline */}
          <PersonaSelector appId={appId} onSelect={handlePresetSelect} />

          {/* Panel toggles */}
          <div className="flex gap-1 border border-gray-200 rounded-lg p-0.5">
            <PanelToggle
              active={panel === 'builder'}
              onClick={() => togglePanel('builder')}
              icon={<Sparkles size={13} />}
              label="Builder"
            />
            <PanelToggle
              active={panel === 'history'}
              onClick={() => togglePanel('history')}
              icon={<History size={13} />}
              label={`History${history.length ? ` (${history.length})` : ''}`}
            />
          </div>
        </div>

        {/* Pending preview */}
        {pending && (
          <div className="flex-shrink-0 px-5 pt-3">
            <SpecPreview spec={pending} onAccept={acceptPending} onReject={rejectPending} />
          </div>
        )}

        {/* Renderer */}
        <div className="flex-1 overflow-auto p-5">
          {loading && <Spinner />}
          {error  && <ErrorBox msg={error} />}
          {!loading && !error && activeSpec && (
            <ViewRenderer spec={activeSpec} items={items} registry={registry} />
          )}
          {!loading && !error && !activeSpec && (
            <EmptyState />
          )}
        </div>
      </div>

      {/* Right panel */}
      {panel !== null && (
        <aside className="flex-shrink-0 w-80 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              {panel === 'builder' ? 'Interface builder' : 'Version history'}
            </h2>
            <button onClick={() => setPanel(null)} className="text-gray-400 hover:text-gray-600">
              <ChevronRight size={15} />
            </button>
          </div>

          {panel === 'builder' && (
            <div className="p-4 space-y-5">
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Describe the view you want and the AI will generate a spec for you to preview.
                </p>
                <InterfaceBuilder appId={appId} onGenerated={setPending} />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Or start with a preset
                </p>
                <div className="flex flex-col gap-1.5">
                  <PersonaSelector appId={appId} onSelect={handlePresetSelect} vertical />
                </div>
              </div>
            </div>
          )}

          {panel === 'history' && (
            <div className="p-4">
              <VersionHistory history={history} currentVersionId={currentVersionId} onRestore={restoreVersion} />
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function PanelToggle({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
        active ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700',
      ].join(' ')}
    >
      {icon}{label}
    </button>
  );
}

function Spinner() {
  return <div className="text-sm text-gray-400 py-12 text-center">Loading items…</div>;
}
function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{msg}</div>
  );
}
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
        <Sparkles size={22} className="text-indigo-400" />
      </div>
      <p className="text-sm font-medium text-gray-700">No view configured yet</p>
      <p className="text-xs text-gray-400 max-w-xs">
        Open the builder panel and describe your ideal interface, or pick a persona preset.
      </p>
    </div>
  );
}
