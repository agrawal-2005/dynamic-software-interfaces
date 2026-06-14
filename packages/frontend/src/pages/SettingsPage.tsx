import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Database, Layout, Trash2, RotateCcw, ChevronDown, ChevronRight, History } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { specHistory, type HistoryEntry } from '../engine/spec-history';

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  explorer: 'Explorer',
  analytics: 'Analytics',
};

export function SettingsPage() {
  const { appId, vocabulary } = useApp();
  const navigate = useNavigate();
  const [layoutsOpen, setLayoutsOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [, forceRender] = useState(0);

  // Only show view specs — nav specs have no layout/fields and should not appear here
  const allHistory = specHistory.getAll(appId).filter(
    (e) => e.tab !== 'nav' && e.spec.layout !== undefined,
  );

  function handleRestore(entry: HistoryEntry) {
    specHistory.restoreTo(appId, entry.tab, entry);
    // Navigate to the tab so it picks up the restored spec
    navigate(`/${appId}/${entry.tab === 'dashboard' ? '' : entry.tab}`);
  }

  function handleClearHistory() {
    if (!window.confirm('Clear all saved view history for this domain? This cannot be undone.')) return;
    specHistory.clearAll(appId);
    forceRender((n) => n + 1);
  }

  return (
    <div className="h-full overflow-y-auto"><div className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings size={20} className="text-gray-500" />
          Settings
        </h1>
        <p className="text-sm text-gray-400 mt-1">Domain vocabulary and view management for <strong>{appId}</strong></p>
      </div>


      {/* Layouts vocabulary */}
      {vocabulary && (
        <Collapsible
          title={`Layouts (${vocabulary.layouts.length})`}
          icon={<Layout size={15} className="text-blue-500" />}
          open={layoutsOpen}
          onToggle={() => setLayoutsOpen((v) => !v)}
        >
          <div className="space-y-2">
            {vocabulary.layouts.map((l) => (
              <div key={l.name} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-0.5">
                  {l.name}
                </span>
                <div>
                  <p className="text-sm text-gray-700">{l.description}</p>
                  {l.requiresGroupBy && (
                    <p className="text-xs text-amber-600 mt-0.5">Requires groupBy field</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Fields vocabulary */}
      {vocabulary && (
        <Collapsible
          title={`Fields (${vocabulary.fields.length})`}
          icon={<Database size={15} className="text-emerald-500" />}
          open={fieldsOpen}
          onToggle={() => setFieldsOpen((v) => !v)}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Key</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Capabilities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vocabulary.fields.map((f) => {
                  const caps: string[] = [
                    f.filterable ? 'filterable' : '',
                    f.sortable   ? 'sortable'   : '',
                    f.groupable  ? 'groupable'  : '',
                  ].filter(Boolean);
                  return (
                    <tr key={f.key} className="hover:bg-gray-50">
                      <td className="py-2 pr-4">
                        <span className="font-mono text-xs text-gray-700">{f.key}</span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                          {f.type}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-600">{f.description}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {caps.map((c) => (
                            <span key={c} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {c}
                            </span>
                          ))}
                          {f.enumValues && (
                            <span
                              className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded cursor-default"
                              title={f.enumValues.join(', ')}
                            >
                              {f.enumValues.length} values
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Collapsible>
      )}

      {/* Version history */}
      <Collapsible
        title={`View history (${allHistory.length} versions)`}
        icon={<History size={15} className="text-gray-500" />}
        open={historyOpen}
        onToggle={() => setHistoryOpen((v) => !v)}
      >
        {allHistory.length === 0 ? (
          <p className="text-sm text-gray-400">No saved versions yet. Use the AI chat on any tab to generate views — they'll appear here.</p>
        ) : (
          <div className="space-y-2">
            {allHistory.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 truncate">
                      {entry.spec.name ?? 'Untitled view'}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded flex-shrink-0">
                      {TAB_LABELS[entry.tab] ?? entry.tab}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                      {entry.spec.layout}
                    </span>
                    {entry.spec.filters?.length ? (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        {entry.spec.filters.length} filter{entry.spec.filters.length > 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(entry.savedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(entry)}
                  className="ml-3 flex-shrink-0 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <RotateCcw size={11} /> Restore
                </button>
              </div>
            ))}
            <button
              onClick={handleClearHistory}
              className="mt-2 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Trash2 size={12} /> Clear all history
            </button>
          </div>
        )}
      </Collapsible>

      {/* App info */}
      <Section title="About" icon={<Settings size={15} className="text-gray-400" />}>
        <div className="space-y-2 text-sm text-gray-600">
          <Row label="Domain" value={appId} />
          <Row label="Spec storage" value="localStorage (per-domain namespace)" />
          <Row label="Data source" value="WebSocket + REST API" />
          <Row
            label="Engine"
            value="LayoutRegistry + ViewRenderer — zero domain strings in engine code"
          />
        </div>
      </Section>
    </div></div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
        {icon}{title}
      </h2>
      {children}
    </div>
  );
}

function Collapsible({
  title, icon, open, onToggle, children,
}: {
  title: string; icon: React.ReactNode;
  open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-xl"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-xs text-gray-400 uppercase tracking-wide w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-700 break-all">{value}</span>
    </div>
  );
}
