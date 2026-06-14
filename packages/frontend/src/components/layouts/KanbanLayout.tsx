import type { LayoutProps } from '../../engine/layout-registry';
import type { Item, BaseViewSpec } from '@dsi/shared';

type VL = BaseViewSpec['valueLabels'];

/** Resolve a raw value through valueLabels for a given field. Never mutates data. */
function display(vl: VL, fieldKey: string, raw: string): string {
  return vl?.[fieldKey]?.[raw] ?? raw;
}

/**
 * KanbanLayout — groups items by the spec's groupBy field into columns.
 * Column headers and card field values are resolved through spec.valueLabels
 * when present — display-only, data is never changed.
 */
export function KanbanLayout({ spec, items }: LayoutProps) {
  const groupField = spec.groupBy;
  const visibleFields = spec.fields.filter((f) => f.visible && f.key !== groupField);
  const vl = spec.valueLabels;

  if (!groupField) {
    return <ErrorMessage message="KanbanLayout requires a groupBy field." />;
  }

  // Build ordered columns from items (preserves semantic order from seed)
  const columnOrder: string[] = [];
  const columns = new Map<string, Item[]>();
  for (const item of items) {
    const group = item[groupField] != null ? String(item[groupField]) : '(none)';
    if (!columns.has(group)) {
      columnOrder.push(group);
      columns.set(group, []);
    }
    columns.get(group)!.push(item);
  }

  if (columnOrder.length === 0) {
    return <ErrorMessage message="No items match the current filters." />;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 items-start">
      {columnOrder.map((group) => {
        const columnItems = columns.get(group) ?? [];
        return (
          <div key={group} className="flex-shrink-0 w-64">
            {/* Column header — resolved through valueLabels */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm font-semibold text-gray-700 capitalize">
                {display(vl, groupField, group)}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                {columnItems.length}
              </span>
            </div>
            {/* Cards */}
            <div className="space-y-2">
              {columnItems.map((item) => (
                <KanbanCard key={item.id as string} item={item} fields={visibleFields} vl={vl} />
              ))}
              {columnItems.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type FieldSpec = { key: string; label?: string; visible: boolean };

function KanbanCard({ item, fields, vl }: { item: Item; fields: FieldSpec[]; vl: VL }) {
  const title = item['title'] ?? item['name'] ?? item['id'];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-sm font-medium text-gray-800 mb-2">{String(title)}</p>
      <div className="space-y-1">
        {fields.filter((f) => f.key !== 'title' && f.key !== 'name').map((f) => {
          const val = item[f.key];
          if (val == null) return null;
          return (
            <div key={f.key} className="flex items-start gap-1 text-xs text-gray-500">
              <span className="font-medium capitalize">{f.label ?? f.key}:</span>
              <ArrayOrScalar value={val} fieldKey={f.key} vl={vl} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArrayOrScalar({ value, fieldKey, vl }: { value: unknown; fieldKey: string; vl: VL }) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-0.5">
        {value.map((v, i) => (
          <span key={i} className="bg-gray-100 rounded px-1">
            {display(vl, fieldKey, String(v))}
          </span>
        ))}
      </div>
    );
  }
  return <span>{display(vl, fieldKey, String(value))}</span>;
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
      {message}
    </div>
  );
}
