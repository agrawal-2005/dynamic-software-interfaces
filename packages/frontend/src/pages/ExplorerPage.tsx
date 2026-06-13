import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, Eye, EyeOff, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function ExplorerPage() {
  const { items, vocabulary, loading, error } = useApp();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);

  // Derive columns from vocabulary fields, falling back to item keys
  const columns = useMemo(() => {
    if (vocabulary?.fields.length) return vocabulary.fields.map((f) => f.key);
    if (items.length === 0) return [];
    return Object.keys(items[0]).filter((k) => k !== 'id');
  }, [vocabulary, items]);

  const visibleCols = columns.filter((c) => !hiddenCols.has(c));

  // Filterable fields from vocabulary
  const filterableFields = useMemo(() => {
    return vocabulary?.fields.filter((f) => f.filterable) ?? [];
  }, [vocabulary]);

  // Apply search + filters
  const filtered = useMemo(() => {
    let result = items;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) =>
        columns.some((col) => String(item[col] ?? '').toLowerCase().includes(q))
      );
    }

    for (const [field, value] of Object.entries(filters)) {
      if (!value) continue;
      result = result.filter((item) => {
        const v = item[field];
        if (Array.isArray(v)) return v.some((x) => String(x) === value);
        return String(v ?? '') === value;
      });
    }

    return result;
  }, [items, search, filters, columns]);

  function setFilter(field: string, value: string) {
    setFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: value };
    });
  }

  function toggleCol(col: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  function clearFilters() {
    setFilters({});
    setSearch('');
  }

  const activeFilterCount = Object.keys(filters).length + (search ? 1 : 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="text-base font-semibold text-gray-900 mr-2">Explorer</h1>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search all fields…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
        </div>

        {/* Vocabulary-aware filters */}
        {filterableFields.map((field) => {
          if (field.type === 'enum' && field.enumValues?.length) {
            return (
              <select
                key={field.key}
                value={filters[field.key] ?? ''}
                onChange={(e) => setFilter(field.key, e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-gray-600"
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

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-2.5 py-1.5"
          >
            <X size={12} /> Clear ({activeFilterCount})
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {filtered.length} / {items.length} items
          </span>

          {/* Column visibility */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu((v) => !v)}
              className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
            >
              <SlidersHorizontal size={13} /> Columns
            </button>
            {showColMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-48">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Visible columns
                </p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {columns.map((col) => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(col)}
                        onChange={() => toggleCol(col)}
                        className="rounded accent-indigo-600"
                      />
                      <span className="text-xs text-gray-700 group-hover:text-gray-900 capitalize truncate">
                        {vocabulary?.fields.find((f) => f.key === col)?.description ?? col}
                      </span>
                      {!hiddenCols.has(col)
                        ? <Eye size={11} className="ml-auto text-gray-300" />
                        : <EyeOff size={11} className="ml-auto text-gray-300" />}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="text-sm text-gray-400 py-12 text-center">Loading items…</div>
        )}
        {error && (
          <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}
        {!loading && !error && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 sticky top-0">
                {visibleCols.map((col) => (
                  <th
                    key={col}
                    className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {vocabulary?.fields.find((f) => f.key === col)?.description ?? col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length} className="text-center py-12 text-gray-400 text-sm">
                    No items match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id as string} className="hover:bg-gray-50 transition-colors">
                    {visibleCols.map((col) => (
                      <td key={col} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-[220px] truncate">
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
    </div>
  );
}

function CellValue({ value, col }: { value: unknown; col: string }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
            {String(v)}
          </span>
        ))}
      </div>
    );
  }
  const str = String(value);

  // Status-like badges
  const statusLike = ['status', 'phase', 'priority', 'impact', 'category', 'department'].includes(col);
  if (statusLike) {
    const colors: Record<string, string> = {
      done: 'bg-green-100 text-green-700',
      launch: 'bg-green-100 text-green-700',
      active: 'bg-blue-100 text-blue-700',
      build: 'bg-blue-100 text-blue-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-gray-100 text-gray-600',
    };
    const cls = colors[str.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
        {str}
      </span>
    );
  }

  // Date-like
  if ((col.includes('At') || col.includes('date') || col.includes('Date')) && str.includes('T')) {
    try {
      return <span className="text-gray-500">{new Date(str).toLocaleDateString()}</span>;
    } catch { /* fall through */ }
  }

  return <span>{str}</span>;
}
