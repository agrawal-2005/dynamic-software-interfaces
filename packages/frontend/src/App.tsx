import { useState } from 'react';
import type { BaseViewSpec } from '@dsi/shared';
import { DomainSelector } from './components/app/DomainSelector';
import { TableLayout }  from './components/layouts/TableLayout';
import { KanbanLayout } from './components/layouts/KanbanLayout';
import { FeedLayout }   from './components/layouts/FeedLayout';
import { CardsLayout }  from './components/layouts/CardsLayout';
import { LayoutRegistry } from './engine/layout-registry';
import { ViewRenderer }   from './engine/view-renderer';
import { useLiveData }    from './hooks/useLiveData';

const DEFAULT_APP_ID = 'engineering';

// Registry is created once and shared for the app's lifetime.
// Adding a layout requires only a new register() call here.
const registry = new LayoutRegistry()
  .register('table',  TableLayout)
  .register('kanban', KanbanLayout)
  .register('feed',   FeedLayout)
  .register('cards',  CardsLayout);

// Hardcoded demo specs — replaced in Step 9 by the InterfaceBuilder.
const DEMO_SPECS: Record<string, BaseViewSpec> = {
  engineering: {
    version: '1.0',
    name: 'Team Kanban',
    layout: 'kanban',
    fields: [
      { key: 'title',    visible: true },
      { key: 'assignee', visible: true },
      { key: 'priority', visible: true },
    ],
    groupBy: 'status',
    filters: [],
    sort: { field: 'updatedAt', direction: 'desc' },
    limit: 100,
  },
  product: {
    version: '1.0',
    name: 'Roadmap by Phase',
    layout: 'kanban',
    fields: [
      { key: 'title',  visible: true },
      { key: 'owner',  visible: true },
      { key: 'impact', visible: true },
      { key: 'effort', visible: true },
    ],
    groupBy: 'phase',
    filters: [],
    sort: { field: 'updatedAt', direction: 'desc' },
    limit: 100,
  },
  finance: {
    version: '1.0',
    name: 'Pending Approvals',
    layout: 'table',
    fields: [
      { key: 'title',       visible: true },
      { key: 'category',    visible: true },
      { key: 'amount',      visible: true, label: 'Amount (USD)' },
      { key: 'department',  visible: true },
      { key: 'dueDate',     visible: true, label: 'Due' },
    ],
    filters: [{ field: 'status', op: 'eq', value: 'pending' }],
    sort: { field: 'amount', direction: 'desc' },
    limit: 100,
  },
};

export default function App() {
  const [appId, setAppId] = useState(DEFAULT_APP_ID);
  const { items, connected, loading, error } = useLiveData(appId);

  const spec = DEMO_SPECS[appId] ?? DEMO_SPECS['engineering'];

  function handleDomainChange(newAppId: string) {
    setAppId(newAppId);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
          Dynamic Software Interfaces
        </h1>
        <DomainSelector activeAppId={appId} onChange={handleDomainChange} />
        <span className={[
          'ml-auto text-xs font-medium px-2.5 py-1 rounded-full',
          connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400',
        ].join(' ')}>
          {connected ? '● Live' : '○ Connecting…'}
        </span>
      </header>

      {/* Sub-header: current spec name */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">{spec.name}</span>
        <span className="text-xs text-gray-400">
          {spec.layout} · {items.length} items
        </span>
      </div>

      {/* Main */}
      <main className="p-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="animate-spin">⟳</span> Loading…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && (
          <ViewRenderer spec={spec} items={items} registry={registry} />
        )}
      </main>
    </div>
  );
}
