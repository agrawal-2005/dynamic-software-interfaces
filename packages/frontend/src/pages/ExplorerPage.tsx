import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Eye, EyeOff, X, Sparkles } from 'lucide-react';
import type { BaseViewSpec, FilterClause } from '@dsi/shared';
import { useApp } from '../context/AppContext';
import { ViewRenderer } from '../engine/view-renderer';
import { sharedRegistry } from '../engine/shared-registry';
import { AiChatDrawer, AiResetButton } from '../components/ai/AiChatDrawer';

function applySpecFilters(items: ReturnType<typeof useApp>['items'], filters: FilterClause[]) {
  return items.filter((item) =>
    filters.every((f) => {
      const val = item[f.field];
      if (f.op === 'eq')       return String(val ?? '') === String(f.value);
      if (f.op === 'neq')      return String(val ?? '') !== String(f.value);
      if (f.op === 'contains') return String(val ?? '').toLowerCase().includes(String(f.value).toLowerCase());
      if (f.op === 'in')       return Array.isArray(f.value) ? f.value.includes(String(val)) : String(val) === String(f.value);
      return true;
    })
  );
}

export function ExplorerPage() {
  const { appId, items, vocabulary, loading, error } = useApp();

  const [search, setSearch]       = useState('');
  const [filters, setFilters]     = useState<Record<string, string>>({});
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const [chatOpen, setChatOpen]   = useState(false);
  const [aiSpec, setAiSpec]       = useState<BaseViewSpec | null>(null);

  const columns = useMemo(() => {
    if (aiSpec) {
      // AI spec defines field order + visibility
      return aiSpec.fields
        .filter((f) => f.visible !== false)
        .map((f) => f.key);
    }
    if (vocabulary?.fields.length) return vocabulary.fields.map((f) => f.key);
    if (items.length === 0) return [];
    return Object.keys(items[0]).filter((k) => k !== 'id');
  }, [vocabulary, items, aiSpec]);

  const visibleCols = columns.filter((c) => !hiddenCols.has(c));
  const filterableFields = useMemo(() => vocabulary?.fields.filter((f) => f.filterable) ?? [], [vocabulary]);

  // Items after AI spec + manual filters + search
  const filtered = useMemo(() => {
    let result = items;

    // Apply AI spec filters first
    if (aiSpec?.filters?.length) result = applySpecFilters(result, aiSpec.filters);

    // Manual search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        columns.some((col) => String(item[col] ?? '').toLowerCase().includes(q))
      );
    }

    // Manual dropdown filters
    for (const [field, value] of Object.entries(filters)) {
      if (!value) continue;
      result = result.filter((item) => {
        const v = item[field];
        if (Array.isArray(v)) return v.some((x) => String(x) === value);
        return String(v ?? '') === value;
      });
    }

    if (aiSpec?.sort) {
      const { field, direction } = aiSpec.sort;
      result = [...result].sort((a, b) => {
        const av = String(a[field] ?? '');
        const bv = String(b[field] ?? '');
        return direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    if (aiSpec?.limit) result = result.slice(0, aiSpec.limit);

    return result;
  }, [items, aiSpec, search, filters, columns]);

  function setFilter(field: string, value: string) {
    setFilters((prev) => {
      if (!value) { const next = { ...prev }; delete next[field]; return next; }
      return { ...prev, [field]: value };
    });
  }
  function clearFilters() { setFilters({}); setSearch(''); }

  const activeFilterCount = Object.keys(filters).length + (search ? 1 : 0);

  return (
    <div className="flex h-full overflow-hidden">

      {/* Main explorer */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-2.5 flex items-center gap-3 flex-wrap">

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search all fields…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-44"
            />
          </div>

          {/* Vocabulary-aware filter dropdowns */}
          {filterableFields.map((field) => {
            if (field.type === 'enum' && field.enumValues?.length) {
              return (
                <select
                  key={field.key}
                  value={filters[field.key] ?? ''}
                  onChange={(e) => setFilter(field.key, e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-gray-600"
                >
                  <option value="">{field.description ?? field.key}</option>
                  {field.enumValues.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              );
            }
            return null;
          })}

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-2.5 py-1.5"
            >
              <X size={11} /> Clear ({activeFilterCount})
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400">{filtered.length} / {items.length} items</span>

            {/* Column picker */}
            <div className="relative">
              <button
                onClick={() => setShowColMenu((v) => !v)}
                className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
              >
                <SlidersHorizontal size={12} /> Columns
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-48">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Visible columns</p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {columns.map((col) => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!hiddenCols.has(col)}
                          onChange={() => setHiddenCols((p) => {
                            const n = new Set(p);
                            if (n.has(col)) n.delete(col); else n.add(col);
                            return n;
                          })}
                          className="rounded accent-indigo-600"
                        />
                        <span className="text-xs text-gray-700 capitalize truncate flex-1">
                          {vocabulary?.fields.find((f) => f.key === col)?.description ?? col}
                        </span>
                        {!hiddenCols.has(col) ? <Eye size={10} className="text-gray-300" /> : <EyeOff size={10} className="text-gray-300" />}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {aiSpec && <AiResetButton onClick={() => setAiSpec(null)} />}

            <button
              onClick={() => setChatOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chatOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100'}`}
            >
              <Sparkles size={12} /> AI
            </button>
          </div>
        </div>

        {/* AI spec view OR custom table */}
        {aiSpec && ['kanban','feed','cards'].includes(aiSpec.layout) ? (
          <div className="flex-1 overflow-auto p-5">
            <ViewRenderer spec={aiSpec} items={filtered} registry={sharedRegistry} />
          </div>
        ) : (
          /* Data table */
          <div className="flex-1 overflow-auto">
            {loading && <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>}
            {error && <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {!loading && !error && (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
                    {visibleCols.map((col) => (
                      <th key={col} className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {vocabulary?.fields.find((f) => f.key === col)?.description ?? col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={visibleCols.length} className="text-center py-12 text-gray-400 text-sm">
                        No items match your filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id as string} className="hover:bg-gray-50/80 transition-colors">
                        {visibleCols.map((col) => (
                          <td key={col} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-[240px] truncate">
                            <CellValue value={item[col]} col={col} />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* AI chat drawer */}
      {chatOpen && (
        <AiChatDrawer
          appId={appId}
          tabHint="table explorer"
          placeholder='e.g. "show title and status only" · "filter high priority"'
          onSpec={(spec) => setAiSpec(spec)}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

function CellValue({ value, col }: { value: unknown; col: string }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{String(v)}</span>
        ))}
      </div>
    );
  }
  const str = String(value);
  const statusLike = ['status','phase','priority','impact','category','department'].includes(col);
  if (statusLike) {
    const colors: Record<string, string> = {
      done: 'bg-green-100 text-green-700', launch: 'bg-green-100 text-green-700',
      active: 'bg-blue-100 text-blue-700', build: 'bg-blue-100 text-blue-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 text-gray-600',
    };
    const cls = colors[str.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>{str}</span>;
  }
  if ((col.includes('At') || col.includes('date')) && str.includes('T')) {
    try { return <span className="text-gray-500">{new Date(str).toLocaleDateString()}</span>; } catch { /* fall */ }
  }
  return <span>{str}</span>;
}
