import { useState, useMemo } from 'react';
import { Search, X, RotateCcw, Sparkles, Terminal } from 'lucide-react';
import type { BaseViewSpec, Item, AppVocabulary, FilterClause } from '@dsi/shared';
import { useApp } from '../context/AppContext';
import { ViewRenderer } from '../engine/view-renderer';
import { sharedRegistry } from '../engine/shared-registry';
import { AiChatDrawer, AiResetButton } from '../components/ai/AiChatDrawer';

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' },
  high:     { label: 'High',     color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium:   { label: 'Medium',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:      { label: 'Low',      color: 'bg-gray-100 text-gray-500 border-gray-200' },
  s:        { label: 'S',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  m:        { label: 'M',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  l:        { label: 'L',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
  xl:       { label: 'XL',       color: 'bg-red-100 text-red-700 border-red-200' },
};

const COL_ACCENT: Record<string, string> = {
  open:           'border-t-blue-400',
  todo:           'border-t-gray-400',
  backlog:        'border-t-gray-400',
  'in-progress':  'border-t-yellow-400',
  active:         'border-t-blue-400',
  build:          'border-t-indigo-400',
  discovery:      'border-t-violet-400',
  definition:     'border-t-blue-400',
  review:         'border-t-amber-400',
  blocked:        'border-t-red-400',
  done:           'border-t-emerald-400',
  launch:         'border-t-emerald-400',
  cancelled:      'border-t-gray-300',
  paid:           'border-t-emerald-400',
  overdue:        'border-t-red-400',
  pending:        'border-t-amber-400',
};

function applyFilters(items: Item[], filters: FilterClause[]): Item[] {
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

export function DashboardPage() {
  const { appId, items, vocabulary, loading, error } = useApp();

  const [search, setSearch]           = useState('');
  const [hiddenCols, setHiddenCols]   = useState<Set<string>>(new Set());
  const [colAliases, setColAliases]   = useState<Map<string, string>>(new Map());
  const [command, setCommand]         = useState('');
  const [cmdFeedback, setCmdFeedback] = useState<string | null>(null);
  const [editingCol, setEditingCol]   = useState<string | null>(null);
  const [editValue, setEditValue]     = useState('');
  const [chatOpen, setChatOpen]       = useState(false);
  const [aiSpec, setAiSpec]           = useState<BaseViewSpec | null>(null);

  // Determine group field — AI spec can override vocabulary default
  const groupField = useMemo(() => {
    if (aiSpec?.groupBy) {
      return vocabulary?.fields.find((f) => f.key === aiSpec.groupBy)
        ?? vocabulary?.fields.find((f) => f.groupable);
    }
    return vocabulary?.fields.find((f) => f.groupable);
  }, [vocabulary, aiSpec]);

  // Items after AI spec filters + search
  const baseItems = useMemo(() => {
    let result = items;
    if (aiSpec?.filters?.length) result = applyFilters(result, aiSpec.filters);
    if (aiSpec?.limit)           result = result.slice(0, aiSpec.limit);
    return result;
  }, [items, aiSpec]);

  // Build Kanban columns
  const allColumns = useMemo(() => {
    if (!groupField) return [];
    const enumOrder = groupField.enumValues ?? [];
    const countMap: Record<string, Item[]> = {};
    for (const item of baseItems) {
      const val = String(item[groupField.key] ?? '(none)');
      if (!countMap[val]) countMap[val] = [];
      countMap[val].push(item);
    }
    const enumCols  = enumOrder.filter((v) => countMap[v]).map((v) => ({ value: v, items: countMap[v] }));
    const extraCols = Object.keys(countMap).filter((v) => !enumOrder.includes(v)).map((v) => ({ value: v, items: countMap[v] }));
    return [...enumCols, ...extraCols].map(({ value, items: colItems }) => ({
      value,
      displayName: colAliases.get(value) ?? value,
      items: colItems,
    }));
  }, [baseItems, groupField, colAliases]);

  const visibleColumns = useMemo(() => {
    const q = search.toLowerCase();
    return allColumns
      .filter((col) => !hiddenCols.has(col.value))
      .map((col) => ({
        ...col,
        items: q
          ? col.items.filter((item) =>
              Object.values(item).some((v) => String(v ?? '').toLowerCase().includes(q))
            )
          : col.items,
      }));
  }, [allColumns, hiddenCols, search]);

  const hiddenList = allColumns.filter((c) => hiddenCols.has(c.value));

  // ── Column actions ────────────────────────────────────────────────────

  function hideColumn(value: string) { setHiddenCols((p) => new Set([...p, value])); }
  function showColumn(value: string) { setHiddenCols((p) => { const n = new Set(p); n.delete(value); return n; }); }

  function startRename(value: string, displayName: string) {
    setEditingCol(value); setEditValue(displayName);
  }
  function commitRename(value: string) {
    const trimmed = editValue.trim();
    if (trimmed) setColAliases((p) => new Map([...p, [value, trimmed]]));
    setEditingCol(null);
  }

  // ── Command bar ───────────────────────────────────────────────────────

  function feedback(msg: string) {
    setCmdFeedback(msg);
    setTimeout(() => setCmdFeedback(null), 2500);
  }

  function processCommand(raw: string) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;

    const hideMatch = cmd.match(/^(?:hide|remove|don'?t show|skip)\s+(.+)$/);
    if (hideMatch) {
      const col = allColumns.find(
        (c) => c.displayName.toLowerCase().includes(hideMatch[1]) || c.value.toLowerCase().includes(hideMatch[1])
      );
      if (col) { hideColumn(col.value); feedback(`Hidden "${col.displayName}"`); setCommand(''); return; }
      feedback(`No column matching "${hideMatch[1]}"`); return;
    }

    const showMatch = cmd.match(/^show\s+(.+)$/);
    if (showMatch) {
      const match = hiddenList.find(
        (c) => c.displayName.toLowerCase().includes(showMatch[1]) || c.value.toLowerCase().includes(showMatch[1])
      );
      if (match) { showColumn(match.value); feedback(`Restored "${match.displayName}"`); setCommand(''); return; }
      feedback(`No hidden column matching "${showMatch[1]}"`); return;
    }

    const renameMatch = cmd.match(/^rename\s+(.+?)\s+to\s+(.+)$/);
    if (renameMatch) {
      const [, from, to] = renameMatch;
      const col = allColumns.find(
        (c) => c.displayName.toLowerCase().includes(from.trim()) || c.value.toLowerCase().includes(from.trim())
      );
      if (col) { setColAliases((p) => new Map([...p, [col.value, to.trim()]])); feedback(`Renamed to "${to.trim()}"`); setCommand(''); return; }
      feedback(`No column matching "${from.trim()}"`); return;
    }

    if (/^(?:reset|show all|restore all|clear)$/.test(cmd)) {
      setHiddenCols(new Set()); setColAliases(new Map()); feedback('All columns restored'); setCommand(''); return;
    }

    feedback('Try: "hide done" · "rename open to backlog" · "show all"');
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  if (error)   return <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;

  // ── When AI spec is applied and it's not a kanban-friendly spec, use ViewRenderer ──
  if (aiSpec && aiSpec.layout !== 'kanban') {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* AI view toolbar */}
          <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-2.5 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-indigo-500" />
              <span className="text-sm font-medium text-gray-700">
                AI view: <span className="font-semibold">{aiSpec.name ?? aiSpec.layout}</span>
              </span>
            </div>
            <AiResetButton onClick={() => setAiSpec(null)} />
            <div className="ml-auto">
              <button
                onClick={() => setChatOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${chatOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
              >
                <Sparkles size={12} /> AI chat
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5">
            <ViewRenderer spec={aiSpec} items={items} registry={sharedRegistry} />
          </div>
        </div>
        {chatOpen && (
          <AiChatDrawer
            appId={appId}
            tabHint="kanban board"
            placeholder='e.g. "show only critical items" · "group by assignee"'
            onSpec={(spec) => setAiSpec(spec)}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">

      {/* Main board area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-2.5 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-44"
            />
          </div>

          {/* Quick command bar */}
          <form onSubmit={(e) => { e.preventDefault(); processCommand(command); }} className="flex items-center gap-1.5">
            <div className="relative">
              <Terminal size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder='"hide done" · "rename open to backlog"'
                className="pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-64"
              />
            </div>
            <button
              type="submit"
              disabled={!command.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
            >
              Run
            </button>
          </form>

          {/* Feedback */}
          {cmdFeedback && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 font-medium">
              {cmdFeedback}
            </span>
          )}

          {/* Hidden column restore chips */}
          {hiddenList.map((c) => (
            <button
              key={c.value}
              onClick={() => showColumn(c.value)}
              className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-1 rounded-lg border border-gray-200 transition-colors"
            >
              <RotateCcw size={10} /> {c.displayName}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {baseItems.length} items · {visibleColumns.length} columns
            </span>
            {aiSpec && <AiResetButton onClick={() => setAiSpec(null)} />}
            <button
              onClick={() => setChatOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${chatOpen ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100'}`}
            >
              <Sparkles size={12} /> AI
            </button>
          </div>
        </div>

        {/* Kanban board — horizontally scrollable, columns scroll vertically */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full p-4 gap-3" style={{ minWidth: 'max-content' }}>
            {!groupField ? (
              <div className="flex items-center justify-center w-full text-sm text-gray-400 px-8">
                No groupable field in this domain's vocabulary.
              </div>
            ) : visibleColumns.length === 0 ? (
              <div className="flex items-center justify-center w-full text-sm text-gray-400">
                All columns hidden — type "show all" in the command bar.
              </div>
            ) : (
              visibleColumns.map((col) => (
                <KanbanColumn
                  key={col.value}
                  col={col}
                  vocabulary={vocabulary}
                  isEditing={editingCol === col.value}
                  editValue={editValue}
                  onHide={() => hideColumn(col.value)}
                  onStartRename={() => startRename(col.value, col.displayName)}
                  onEditChange={setEditValue}
                  onEditCommit={() => commitRename(col.value)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI chat drawer */}
      {chatOpen && (
        <AiChatDrawer
          appId={appId}
          tabHint="kanban board"
          placeholder='e.g. "show only critical items" · "group by assignee"'
          onSpec={(spec) => { setAiSpec(spec); }}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

type ColumnDef = { value: string; displayName: string; items: Item[] };

function KanbanColumn({
  col, vocabulary, isEditing, editValue,
  onHide, onStartRename, onEditChange, onEditCommit,
}: {
  col: ColumnDef;
  vocabulary: AppVocabulary | null;
  isEditing: boolean; editValue: string;
  onHide: () => void; onStartRename: () => void;
  onEditChange: (v: string) => void; onEditCommit: () => void;
}) {
  const accent = COL_ACCENT[col.value.toLowerCase()] ?? 'border-t-gray-200';

  return (
    <div className={`w-[272px] flex-shrink-0 flex flex-col rounded-xl bg-white border border-gray-200 border-t-[3px] ${accent} overflow-hidden h-full`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50/80 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isEditing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditCommit}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onEditCommit(); }}
              className="flex-1 text-xs font-bold text-gray-700 uppercase tracking-wide bg-white border border-indigo-300 rounded px-1.5 py-0.5 focus:outline-none"
            />
          ) : (
            <button
              onDoubleClick={onStartRename}
              title="Double-click to rename"
              className="text-xs font-bold text-gray-600 uppercase tracking-wide truncate hover:text-gray-900 transition-colors"
            >
              {col.displayName}
            </button>
          )}
          <span className="flex-shrink-0 text-xs font-bold text-gray-400 bg-gray-200 rounded-full px-1.5 min-w-[22px] text-center py-0.5">
            {col.items.length}
          </span>
        </div>
        <button
          onClick={onHide}
          title="Hide column"
          className="ml-1 p-1 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {col.items.length === 0 ? (
          <div className="text-xs text-gray-300 text-center py-6">Empty</div>
        ) : (
          col.items.map((item) => (
            <ItemCard key={item.id as string} item={item} vocabulary={vocabulary} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, vocabulary }: { item: Item; vocabulary: AppVocabulary | null }) {
  const title    = String(item['title'] ?? item['name'] ?? item.id);
  const idStr    = String(item.id).slice(0, 6).toUpperCase();

  const priorityKey = vocabulary?.fields.find((f) => ['priority','impact','effort'].includes(f.key))?.key;
  const assigneeKey = vocabulary?.fields.find((f) => ['assignee','owner','author'].includes(f.key))?.key;
  const amountKey   = vocabulary?.fields.find((f) => f.type === 'number')?.key;
  const tagKey      = vocabulary?.fields.find((f) => f.type === 'string[]')?.key;

  const priority = priorityKey ? String(item[priorityKey] ?? '') : '';
  const assignee = assigneeKey ? String(item[assigneeKey] ?? '') : '';
  const amount   = amountKey ? item[amountKey] : null;
  const tags     = tagKey && Array.isArray(item[tagKey]) ? (item[tagKey] as string[]).slice(0, 2) : [];

  const priorityCfg = PRIORITY_CONFIG[priority.toLowerCase()];

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group">
      <p className="text-[13px] font-medium text-gray-900 leading-snug line-clamp-2">{title}</p>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tags.map((tag) => (
            <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {priorityCfg && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${priorityCfg.color}`}>
              {priorityCfg.label}
            </span>
          )}
          {amount != null && (
            <span className="text-[10px] text-emerald-600 font-medium">
              ${Number(amount).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-300">#{idStr}</span>
          {assignee && (
            <div
              className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-600"
              title={assignee}
            >
              {assignee.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
