import type { LayoutProps } from '../../engine/layout-registry';
import type { Item, BaseViewSpec } from '@dsi/shared';

type VL = BaseViewSpec['valueLabels'];

function display(vl: VL, fieldKey: string, raw: string): string {
  return vl?.[fieldKey]?.[raw] ?? raw;
}

/**
 * CardsLayout — renders items as a responsive card grid.
 * Optionally groups cards by spec.groupBy if provided.
 * Group headers and field values are resolved through spec.valueLabels.
 */
export function CardsLayout({ spec, items }: LayoutProps) {
  const visibleFields = spec.fields.filter((f) => f.visible);
  const vl = spec.valueLabels;

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No items match the current filters.
      </div>
    );
  }

  if (!spec.groupBy) {
    return <CardGrid items={items} fields={visibleFields} vl={vl} />;
  }

  // Build groups in first-seen order
  const groupField = spec.groupBy;
  const groupOrder: string[] = [];
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const g = item[groupField] != null ? String(item[groupField]) : '(none)';
    if (!groups.has(g)) { groupOrder.push(g); groups.set(g, []); }
    groups.get(g)!.push(item);
  }

  return (
    <div className="space-y-6">
      {groupOrder.map((g) => (
        <div key={g}>
          {/* Group header resolved through valueLabels */}
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">
            {display(vl, groupField, g)}
          </h3>
          <CardGrid items={groups.get(g) ?? []} fields={visibleFields} vl={vl} />
        </div>
      ))}
    </div>
  );
}

type FieldSpec = { key: string; label?: string; visible: boolean };

function CardGrid({ items, fields, vl }: { items: Item[]; fields: FieldSpec[]; vl: VL }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <ItemCard key={item.id as string} item={item} fields={fields} vl={vl} />
      ))}
    </div>
  );
}

function ItemCard({ item, fields, vl }: { item: Item; fields: FieldSpec[]; vl: VL }) {
  const titleField = fields.find((f) => f.key === 'title' || f.key === 'name');
  const title = titleField ? item[titleField.key] : item['title'] ?? item['id'];
  const otherFields = fields.filter((f) => f !== titleField);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <p className="font-medium text-gray-900 text-sm mb-3 leading-snug">{String(title ?? '—')}</p>
      <dl className="space-y-1">
        {otherFields.map((f) => {
          const val = item[f.key];
          if (val == null) return null;
          const rendered = Array.isArray(val)
            ? val.map((v) => display(vl, f.key, String(v))).join(', ')
            : typeof val === 'number'
              ? val.toLocaleString()
              : display(vl, f.key, String(val));
          return (
            <div key={f.key} className="flex items-start gap-1 text-xs">
              <dt className="text-gray-400 capitalize flex-shrink-0">{f.label ?? f.key}:</dt>
              <dd className="text-gray-700">{rendered}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
