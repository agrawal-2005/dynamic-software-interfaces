import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PALETTE = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#f97316',
  '#84cc16', '#ec4899',
];

export function AnalyticsPage() {
  const { items, vocabulary, loading } = useApp();

  // All groupable fields to chart
  const groupableFields = useMemo(() => {
    return vocabulary?.fields.filter((f) => f.groupable) ?? [];
  }, [vocabulary]);

  // Build distribution data per groupable field
  const distributions = useMemo(() => {
    return groupableFields.map((field) => {
      const counts: Record<string, number> = {};
      for (const item of items) {
        const raw = item[field.key];
        const vals = Array.isArray(raw) ? raw : [raw ?? '(none)'];
        for (const v of vals) {
          const key = String(v);
          counts[key] = (counts[key] ?? 0) + 1;
        }
      }
      const data = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }));
      return { field, data };
    });
  }, [groupableFields, items]);

  // Summary stats
  const summary = useMemo(() => {
    if (items.length === 0) return [];
    const stats: { label: string; value: string }[] = [
      { label: 'Total items', value: String(items.length) },
    ];
    // Add top value per groupable field
    for (const { field, data } of distributions) {
      if (data[0]) {
        stats.push({
          label: `Most common ${field.description ?? field.key}`,
          value: `${data[0].name} (${data[0].value})`,
        });
      }
    }
    return stats;
  }, [items, distributions]);

  if (loading) {
    return <div className="text-sm text-gray-400 py-12 text-center">Loading data…</div>;
  }

  if (groupableFields.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        No groupable fields configured for this domain.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={20} className="text-indigo-500" />
          Analytics
        </h1>
        <p className="text-sm text-gray-400 mt-1">{items.length} items across {groupableFields.length} dimensions</p>
      </div>

      {/* Summary stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.slice(0, 4).map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide truncate">{s.label}</p>
            <p className="text-lg font-bold text-gray-900 mt-1 truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {distributions.map(({ field, data }, idx) => (
          <ChartCard
            key={field.key}
            title={`By ${field.description ?? field.key}`}
            data={data}
            colorOffset={idx * 3}
          />
        ))}
      </div>

      {/* Pie breakdown for first groupable field */}
      {distributions[0] && distributions[0].data.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-5">
            <PieIcon size={15} className="text-indigo-500" />
            Distribution — {distributions[0].field.description ?? distributions[0].field.key}
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width={260} height={220}>
              <PieChart>
                <Pie
                  data={distributions[0].data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {distributions[0].data.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} items`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {distributions[0].data.map((d, i) => {
                const pct = Math.round((d.value / items.length) * 100);
                return (
                  <div key={d.name} className="flex items-center gap-3">
                    <span
                      className="flex-shrink-0 w-3 h-3 rounded-full"
                      style={{ background: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="text-sm text-gray-700 capitalize flex-1 truncate">{d.name}</span>
                    <span className="text-xs text-gray-400 w-12 text-right">{d.value} · {pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Trend note */}
      <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 flex items-start gap-3">
        <TrendingUp size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-indigo-800">Live data</p>
          <p className="text-xs text-indigo-600 mt-0.5">
            Charts update in real-time as items change via the live WebSocket connection.
            Switch domains in the sidebar to compare analytics across teams.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title, data, colorOffset,
}: {
  title: string;
  data: { name: string; value: number }[];
  colorOffset: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 capitalize">{title}</h2>
      {data.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">No data</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: '#f3f4f6' }}
              contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
              formatter={(v: number) => [v, 'items']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[(i + colorOffset) % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
