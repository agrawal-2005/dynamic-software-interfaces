import type { LayoutProps } from '../../engine/layout-registry';
import { type VL, display } from './layout-helpers';

/**
 * FeedLayout — renders items as a chronological activity stream.
 * Uses the first date field in the visible fields as the timestamp;
 * falls back to displaying all visible fields if none is a date.
 * Field values are resolved through spec.valueLabels when present.
 */
export function FeedLayout({ spec, items }: LayoutProps) {
  const visibleFields = spec.fields.filter((f) => f.visible);
  const vl = spec.valueLabels;

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-400">
        No items match the current filters.
      </div>
    );
  }

  // Heuristic: a field whose key contains 'at' or 'date' is a timestamp
  const timeField = visibleFields.find(
    (f) => f.key.toLowerCase().includes('at') || f.key.toLowerCase().includes('date'),
  );
  const titleField = visibleFields.find(
    (f) => f.key === 'title' || f.key === 'name',
  );
  const metaFields = visibleFields.filter(
    (f) => f !== timeField && f !== titleField,
  );

  return (
    <div className="space-y-0">
      {items.map((item, i) => {
        const title = titleField ? item[titleField.key] : item['title'] ?? item['id'];
        const time = timeField ? item[timeField.key] : null;
        const isLast = i === items.length - 1;

        return (
          <div key={item.id as string} className="flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-400 ring-2 ring-white flex-shrink-0" />
              {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
            </div>

            {/* Content */}
            <div className="pb-5">
              <p className="text-sm font-medium text-gray-800">{String(title ?? '—')}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                {time != null && (
                  <span className="font-medium text-gray-400">
                    {formatTime(String(time))}
                  </span>
                )}
                {metaFields.map((f) => {
                  const val = item[f.key];
                  if (val == null) return null;
                  const rendered = Array.isArray(val)
                    ? val.map((v) => display(vl, f.key, String(v))).join(', ')
                    : display(vl, f.key, String(val));
                  return (
                    <span key={f.key}>
                      <span className="capitalize">{f.label ?? f.key}:</span>{' '}
                      {rendered}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(raw: string): string {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return raw;
  }
}
