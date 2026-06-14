import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { BarChart3, Sparkles } from 'lucide-react';
import type { FilterClause, BaseViewSpec } from '@dsi/shared';
import { useApp } from '../context/AppContext';
import { useGlobalSpec } from '../context/GlobalAiContext';

const PALETTE = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#f97316',
  '#84cc16', '#ec4899',
];

function applyFilters(items: ReturnType<typeof useApp>['items'], filters: FilterClause[]) {
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

export function AnalyticsPage() {
  const { appId, items, vocabulary, loading } = useApp();
  const [aiSpec, setAiSpec]     = useGlobalSpec<BaseViewSpec>(appId, 'analytics');

  // Determine which fields to chart — AI spec can narrow this
  const groupableFields = useMemo(() => {
    const all = vocabulary?.fields.filter((f) => f.groupable) ?? [];
    if (!aiSpec) return all;
    // If AI spec specifies visible fields, only chart those that are groupable
    const specKeys = new Set(aiSpec.fields.filter((f) => f.visible !== false).map((f) => f.key));
    const narrowed = all.filter((f) => specKeys.has(f.key));
    return narrowed.length > 0 ? narrowed : all;
  }, [vocabulary, aiSpec]);

  // Items filtered by AI spec
  const chartItems = useMemo(() => {
    let result = items;
    if (aiSpec?.filters?.length) result = applyFilters(result, aiSpec.filters);
    if (aiSpec?.limit)           result = result.slice(0, aiSpec.limit);
    return result;
  }, [items, aiSpec]);

  const distributions = useMemo(() => {
    return groupableFields.map((field) => {
      const counts: Record<string, number> = {};
      for (const item of chartItems) {
        const raw = item[field.key];
        const vals = Array.isArray(raw) ? raw : [raw ?? '(none)'];
        for (const v of vals) { const k = String(v); counts[k] = (counts[k] ?? 0) + 1; }
      }
      const data = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
      return { field, data };
    });
  }, [groupableFields, chartItems]);

  if (loading) return (
    <div className="h-full flex items-center justify-center text-sm text-gray-400">Loading data…</div>
  );

  return (
    <div className="flex h-full overflow-hidden">

      {/* Main analytics area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-indigo-500" />
            <span className="text-sm font-semibold text-gray-700">Analytics</span>
            {aiSpec && (
              <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                AI: {aiSpec.name ?? 'custom view'}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">{chartItems.length} items · {groupableFields.length} dimensions</span>
          <div className="ml-auto flex items-center gap-2">
            {aiSpec && (
              <button onClick={() => setAiSpec(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors">
                <Sparkles size={11} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Charts — scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {groupableFields.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              No groupable fields for this domain.
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Total items</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{chartItems.length}</p>
                </div>
                {distributions.slice(0, 3).map(({ field, data }) => data[0] && (
                  <div key={field.key} className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wide truncate">
                      Top {field.description ?? field.key}
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-1 truncate capitalize">
                      {data[0].name} <span className="text-sm font-normal text-gray-400">({data[0].value})</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Bar charts grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {distributions.map(({ field, data }, idx) => (
                  <ChartCard key={field.key} title={`By ${field.description ?? field.key}`} data={data} colorOffset={idx * 3} />
                ))}
              </div>

              {/* Pie for first field */}
              {distributions[0] && distributions[0].data.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-5 capitalize">
                    Distribution — {distributions[0].field.description ?? distributions[0].field.key}
                  </h2>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ResponsiveContainer width={240} height={200}>
                      <PieChart>
                        <Pie data={distributions[0].data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} innerRadius={48} paddingAngle={2}>
                          {distributions[0].data.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v} items`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 flex-1">
                      {distributions[0].data.map((d, i) => {
                        const pct = Math.round((d.value / chartItems.length) * 100);
                        return (
                          <div key={d.name} className="flex items-center gap-3">
                            <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="text-sm text-gray-700 capitalize flex-1 truncate">{d.name}</span>
                            <span className="text-xs text-gray-400 w-16 text-right">{d.value} · {pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}

function ChartCard({ title, data, colorOffset }: { title: string; data: { name: string; value: number }[]; colorOffset: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 capitalize">{title}</h2>
      {data.length === 0
        ? <p className="text-xs text-gray-400 text-center py-8">No data</p>
        : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={26} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(v: number) => [v, 'items']} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={PALETTE[(i + colorOffset) % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }
    </div>
  );
}
