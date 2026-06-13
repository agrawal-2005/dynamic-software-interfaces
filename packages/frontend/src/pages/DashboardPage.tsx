import { useState, useMemo, useRef } from 'react';
import { Search, X, RotateCcw, Terminal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Item, AppVocabulary } from '@dsi/shared';

type ColumnDef = { value: string; displayName: string; items: Item[] };

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
  open:        'border-t-blue-400',
  todo:        'border-t-gray-400',
  'in-progress': 'border-t-yellow-400',
  active:      'border-t-blue-400',
  build:       'border-t-indigo-400',
  discovery:   'border-t-violet-400',
  definition:  'border-t-blue-400',
  review:      'border-t-amber-400',
  blocked:     'border-t-red-400',
  done:        'border-t-emerald-400',
  launch:      'border-t-emerald-400',
  cancelled:   'border-t-gray-300',
  paid:        'border-t-emerald-400',
  overdue:     'border-t-red-400',
  pending:     'border-t-amber-400',
};

export function DashboardPage() {
  const { items, vocabulary, loading, error } = useApp();

  const [search, setSearch]         = useState('');
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colAliases, setColAliases] = useState<Map<string, string>>(new Map());
  const [command, setCommand]       = useState('');
  const [cmdFeedback, setCmdFeedback] = useState<string | null>(null);
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [editValue, setEditValue]   = useState('');
  const cmdRef = useRef<HTMLInputElement>(null);

  // Primary groupable field
  const groupField = vocabulary?.fields.find((f) => f.groupable);

  // Build columns from items grouped by groupField
  const allColumns: ColumnDef[] = useMemo(() => {
    if (!groupField) return [];

    // Use vocabulary enum order if available, then first-seen order for unlisted values
    const enumOrder = groupField.enumValues ?? [];
    const countMap: Record<string, Item[]> = {};

    for (const item of items) {
      const val = String(item[groupField.key] ?? '(none)');
      if (!countMap[val]) countMap[val] = [];
      countMap[val].push(item);
    }

    const enumCols  = enumOrder.filter((v) => countMap[v]).map((v) => ({ value: v, items: countMap[v] }));
    const extraCols = Object.keys(countMap)
      .filter((v) => !enumOrder.includes(v))
      .map((v) => ({ value: v, items: countMap[v] }));

    return [...enumCols, ...extraCols].map(({ value, items: colItems }) => ({
      value,
      displayName: colAliases.get(value) ?? value,
      items: colItems,
    }));
  }, [items, groupField, colAliases]);

  // Visible columns after hiding + search filter
  const visibleColumns: ColumnDef[] = useMemo(() => {
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

  function hideColumn(value: string) {
    setHiddenCols((prev) => new Set([...prev, value]));
  }

  function showColumn(value: string) {
    setHiddenCols((prev) => { const n = new Set(prev); n.delete(value); return n; });
  }

  function startRename(value: string, displayName: string) {
    setEditingCol(value);
    setEditValue(displayName);
  }

  function commitRename(value: string) {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      setColAliases((prev) => new Map([...prev, [value, trimmed]]));
    }
    setEditingCol(null);
  }

  // ── Natural language command bar ──────────────────────────────────────

  function feedback(msg: string) {
    setCmdFeedback(msg);
    setTimeout(() => setCmdFeedback(null), 2500);
  }

  function processCommand(raw: string) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;

    // "hide/remove [column]" or "don't show [column]"
    const hideMatch = cmd.match(/^(?:hide|remove|don['']?t show|skip)\s+(.+)$/);
    if (hideMatch) {
      const query = hideMatch[1].trim();
      const col = allColumns.find(
        (c) => c.displayName.toLowerCase().includes(query) || c.value.toLowerCase().includes(query)
      );
      if (col) { hideColumn(col.value); feedback(`Hidden "${col.displayName}"`); setCommand(''); return; }
      feedback(`No column matching "${query}" found`);
      return;
    }

    // "show [column]"
    const showMatch = cmd.match(/^show\s+(.+)$/);
    if (showMatch) {
      const query = showMatch[1].trim();
      const match = hiddenList.find(
        (c) => c.displayName.toLowerCase().includes(query) || c.value.toLowerCase().includes(query)
      );
      if (match) { showColumn(match.value); feedback(`Restored "${match.displayName}"`); setCommand(''); return; }
      feedback(`No hidden column matching "${query}"`);
      return;
    }

    // "rename [old] to [new]"
    const renameMatch = cmd.match(/^rename\s+(.+?)\s+to\s+(.+)$/);
    if (renameMatch) {
      const [, from, to] = renameMatch;
      const col = allColumns.find(
        (c) => c.displayName.toLowerCase().includes(from.trim()) || c.value.toLowerCase().includes(from.trim())
      );
      if (col) {
        setColAliases((prev) => new Map([...prev, [col.value, to.trim()]]));
        feedback(`Renamed to "${to.trim()}"`);
        setCommand('');
        return;
      }
      feedback(`No column matching "${from.trim()}" found`);
      return;
    }

    // "reset" or "show all"
    if (/^(?:reset|show all|restore all)$/.test(cmd)) {
      setHiddenCols(new Set());
      setColAliases(new Map());
      feedback('All columns restored');
      setCommand('');
      return;
    }

    feedback('Try: "hide done" · "rename open to backlog" · "show all"');
  }

  function handleCommandSubmit(e: React.FormEvent) {
    e.preventDefault();
    processCommand(command);
  }

  if (loading) return <div className="text-sm text-gray-400 py-16 text-center">Loading…</div>;
  if (error)   return <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!groupField) return (
    <div className="p-8 text-center text-sm text-gray-400">
      No groupable field configured for this domain. Configure vocabulary to enable the board.
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">

      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-2.5 flex items-center gap-3">

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-52"
          />
        </div>

        {/* Command bar */}
        <form onSubmit={handleCommandSubmit} className="flex items-center gap-1.5 flex-1 max-w-md">
          <div className="relative flex-1">
            <Terminal size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={cmdRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder='Command… e.g. "hide done" · "rename open to backlog"'
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            type="submit"
            disabled={!command.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
          >
            Run
          </button>
        </form>

        {/* Feedback toast */}
        {cmdFeedback && (
          <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 font-medium">
            {cmdFeedback}
          </span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* Summary */}
          <span className="text-xs text-gray-400">
            {items.length} items · {visibleColumns.length} columns
          </span>

          {/* Hidden columns restore */}
          {hiddenList.length > 0 && (
            <div className="flex items-center gap-1.5">
              {hiddenList.map((c) => (
                <button
                  key={c.value}
                  onClick={() => showColumn(c.value)}
                  className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-2 py-1 rounded-lg border border-gray-200 transition-colors"
                >
                  <RotateCcw size={10} />
                  {c.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-0 p-4 min-w-max">
          {visibleColumns.length === 0 ? (
            <div className="flex items-center justify-center w-full text-sm text-gray-400">
              No columns to show. Type "show all" in the command bar to restore.
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
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  col, vocabulary, isEditing, editValue,
  onHide, onStartRename, onEditChange, onEditCommit,
}: {
  col: ColumnDef;
  vocabulary: AppVocabulary | null;
  isEditing: boolean;
  editValue: string;
  onHide: () => void;
  onStartRename: () => void;
  onEditChange: (v: string) => void;
  onEditCommit: () => void;
}) {
  const accent = COL_ACCENT[col.value.toLowerCase()] ?? 'border-t-gray-300';

  return (
    <div className={`w-[280px] flex-shrink-0 flex flex-col rounded-xl bg-gray-100/80 border border-gray-200 border-t-[3px] ${accent} mx-2 overflow-hidden`}>

      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-white/60">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isEditing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditCommit();
                if (e.key === 'Escape') onEditCommit();
              }}
              className="flex-1 text-xs font-semibold text-gray-700 uppercase tracking-wide bg-white border border-indigo-300 rounded px-1 focus:outline-none"
            />
          ) : (
            <button
              title="Double-click to rename"
              onDoubleClick={onStartRename}
              className="text-xs font-semibold text-gray-600 uppercase tracking-wide truncate text-left hover:text-gray-900"
            >
              {col.displayName}
            </button>
          )}
          <span className="flex-shrink-0 text-xs font-bold text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {col.items.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={onStartRename}
            title="Rename column"
            className="p-1 text-gray-400 hover:text-gray-600 rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100"
          />
          <button
            onClick={onHide}
            title="Hide this column"
            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors hover:bg-gray-100"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {col.items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-gray-400">
            Empty
          </div>
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
  const idStr    = String(item.id).substring(0, 6).toUpperCase();

  // Find relevant display fields from vocabulary
  const priorityKey = vocabulary?.fields.find(
    (f) => ['priority', 'impact', 'effort'].includes(f.key)
  )?.key;
  const assigneeKey = vocabulary?.fields.find(
    (f) => ['assignee', 'owner', 'author'].includes(f.key)
  )?.key;
  const amountKey = vocabulary?.fields.find((f) => f.type === 'number')?.key;
  const tagKey    = vocabulary?.fields.find((f) => f.type === 'string[]')?.key;

  const priority = priorityKey ? String(item[priorityKey] ?? '') : '';
  const assignee = assigneeKey ? String(item[assigneeKey] ?? '') : '';
  const amount   = amountKey ? item[amountKey] : null;
  const tags     = tagKey && Array.isArray(item[tagKey]) ? (item[tagKey] as string[]).slice(0, 2) : [];

  const priorityCfg = PRIORITY_CONFIG[priority.toLowerCase()];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group">
      {/* Title */}
      <p className="text-[13px] font-medium text-gray-900 leading-snug line-clamp-2 mb-2">
        {title}
      </p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag) => (
            <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {/* Priority badge */}
          {priorityCfg && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${priorityCfg.color}`}>
              {priorityCfg.label}
            </span>
          )}
          {/* Amount */}
          {amount != null && (
            <span className="text-[10px] text-emerald-600 font-medium">
              ${Number(amount).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* ID */}
          <span className="text-[10px] font-mono text-gray-300">#{idStr}</span>
          {/* Assignee avatar */}
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

