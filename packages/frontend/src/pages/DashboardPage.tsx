import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Box, Zap, ArrowRight, TrendingUp, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function DashboardPage() {
  const { appId, items, vocabulary, loading, connected } = useApp();
  const navigate = useNavigate();

  // Pick the first groupable field for the primary breakdown
  const primaryField = vocabulary?.fields.find((f) => f.groupable);

  // Count items by the primary groupable field
  const breakdown = useMemo(() => {
    if (!primaryField) return [];
    const counts: Record<string, number> = {};
    for (const item of items) {
      const val = item[primaryField.key] != null ? String(item[primaryField.key]) : '(none)';
      counts[val] = (counts[val] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [items, primaryField]);

  // Recent activity — top 8 by updatedAt
  const recent = useMemo(() => {
    return [...items]
      .sort((a, b) => String(b['updatedAt'] ?? '').localeCompare(String(a['updatedAt'] ?? '')))
      .slice(0, 8);
  }, [items]);

  // "Needs attention" — items matching urgent signals per domain
  const urgent = useMemo(() => {
    return items.filter((item) => {
      const priority = String(item['priority'] ?? item['impact'] ?? '');
      const status = String(item['status'] ?? item['phase'] ?? '');
      return (priority === 'critical' || priority === 'high') && status !== 'done' && status !== 'launch';
    }).slice(0, 5);
  }, [items]);

  const domainLabel = vocabulary ? appId.charAt(0).toUpperCase() + appId.slice(1) : appId;

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-400'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{domainLabel} Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {items.length} total items · {vocabulary?.layouts.length ?? 0} layouts available
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Box size={18} className="text-indigo-500" />}
          label="Total items"
          value={loading ? '…' : items.length.toString()}
          bg="bg-indigo-50"
        />
        {breakdown.slice(0, 3).map((b) => (
          <StatCard
            key={b.name}
            icon={<Activity size={18} className="text-blue-500" />}
            label={`${primaryField?.description ?? primaryField?.key ?? 'Group'}: ${b.name}`}
            value={b.count.toString()}
            bg="bg-blue-50"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Primary breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <TrendingUp size={15} className="text-indigo-500" />
              Breakdown by {primaryField?.description ?? primaryField?.key ?? 'field'}
            </h2>
            <button
              onClick={() => navigate('/analytics')}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              Full analytics <ArrowRight size={12} />
            </button>
          </div>
          {breakdown.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Loading…</p>
          ) : (
            <div className="space-y-2">
              {breakdown.map((b) => {
                const pct = Math.round((b.count / items.length) * 100);
                return (
                  <div key={b.name}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span className="font-medium capitalize">{b.name}</span>
                      <span>{b.count} · {pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Needs attention */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
            <AlertCircle size={15} className="text-amber-500" />
            Needs attention
          </h2>
          {urgent.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">Nothing urgent 🎉</p>
          ) : (
            <div className="space-y-2">
              {urgent.map((item) => (
                <div key={item.id as string} className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {String(item['title'] ?? item['id'])}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5 capitalize">
                    {String(item['priority'] ?? item['impact'] ?? '')}
                    {item['assignee'] ? ` · ${item['assignee']}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Activity size={15} className="text-gray-400" />
            Recent activity
          </h2>
          <button
            onClick={() => navigate('/explorer')}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </button>
        </div>
        <div className="space-y-0 divide-y divide-gray-50">
          {recent.map((item) => (
            <div key={item.id as string} className="flex items-center justify-between py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {String(item['title'] ?? item['id'])}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[
                    item['status'] ?? item['phase'] ?? item['category'],
                    item['assignee'] ?? item['owner'],
                  ].filter(Boolean).map(String).join(' · ')}
                </p>
              </div>
              <span className="flex-shrink-0 text-xs text-gray-400 ml-4">
                {fmtDate(String(item['updatedAt'] ?? ''))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <QuickAction
          icon={<Zap size={16} />}
          title="Customise your view"
          desc="Describe the interface you want in plain English"
          onClick={() => navigate('/view')}
          accent="indigo"
        />
        <QuickAction
          icon={<TrendingUp size={16} />}
          title="Explore the data"
          desc="Search, filter and browse all items with full columns"
          onClick={() => navigate('/explorer')}
          accent="blue"
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-white`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 truncate capitalize">{label}</p>
    </div>
  );
}

function QuickAction({ icon, title, desc, onClick, accent }: {
  icon: React.ReactNode; title: string; desc: string;
  onClick: () => void; accent: 'indigo' | 'blue';
}) {
  const colors = {
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
    blue:   'bg-blue-600 hover:bg-blue-700',
  };
  return (
    <button
      onClick={onClick}
      className={`${colors[accent]} text-left text-white rounded-xl p-5 transition-colors flex items-start gap-3`}
    >
      <span className="mt-0.5 opacity-80">{icon}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-70 mt-1">{desc}</p>
      </div>
    </button>
  );
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)  return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return iso; }
}
