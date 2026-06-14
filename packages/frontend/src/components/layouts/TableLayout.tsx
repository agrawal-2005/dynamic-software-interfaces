import type { LayoutProps } from '../../engine/layout-registry';
import type { BaseViewSpec } from '@dsi/shared';

type VL = BaseViewSpec['valueLabels'];

function display(vl: VL, fieldKey: string, raw: string): string {
  return vl?.[fieldKey]?.[raw] ?? raw;
}

/** Renders visible fields as a sortable table. Column headings use the
 *  spec's optional per-user label, falling back to the field key.
 *  Cell values are resolved through spec.valueLabels when present. */
export function TableLayout({ spec, items }: LayoutProps) {
  const visibleFields = spec.fields.filter((f) => f.visible);
  const vl = spec.valueLabels;

  if (items.length === 0) {
    return <EmptyState message="No items match the current filters." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {visibleFields.map((f) => (
              <th
                key={f.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
              >
                {f.label ?? f.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => (
            <tr key={item.id as string} className="hover:bg-gray-50 transition-colors">
              {visibleFields.map((f) => (
                <td key={f.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  <CellValue value={item[f.key]} fieldKey={f.key} vl={vl} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellValue({ value, fieldKey, vl }: { value: unknown; fieldKey: string; vl: VL }) {
  if (value == null) return <span className="text-gray-400">—</span>;
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
            {display(vl, fieldKey, String(v))}
          </span>
        ))}
      </div>
    );
  }
  return <span>{display(vl, fieldKey, String(value))}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
      {message}
    </div>
  );
}
