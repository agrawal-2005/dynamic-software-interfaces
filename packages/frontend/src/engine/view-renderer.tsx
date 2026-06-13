import type { Item, BaseViewSpec } from '@dsi/shared';
import type { LayoutRegistry } from './layout-registry';

type Props = {
  spec: BaseViewSpec;
  items: Item[];
  registry: LayoutRegistry;
};

/**
 * ViewRenderer — engine component, domain-agnostic.
 *
 * 1. Applies the spec's filters, sort, and limit client-side so the view
 *    stays current as items change without a new fetch.
 * 2. Looks up the layout component from the registry.
 * 3. Passes the shaped item list and spec to the layout component.
 *
 * The renderer knows nothing about which layouts exist or what fields mean.
 */
export function ViewRenderer({ spec, items, registry }: Props) {
  const Layout = registry.get(spec.layout);

  if (!Layout) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Unknown layout: <strong>{spec.layout}</strong>. Registered: {registry.names().join(', ')}.
      </div>
    );
  }

  const shaped = applySpec(spec, items);
  return <Layout spec={spec} items={shaped} />;
}

// ── Client-side spec application ─────────────────────────────────────────

function applySpec(spec: BaseViewSpec, items: Item[]): Item[] {
  let result = [...items];

  if (spec.filters.length > 0) {
    result = result.filter((item) => spec.filters.every((f) => matchFilter(item, f)));
  }

  if (spec.sort) {
    const { field, direction } = spec.sort;
    result = result.sort((a, b) => {
      const av = a[field] ?? '';
      const bv = b[field] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return direction === 'asc' ? cmp : -cmp;
    });
  }

  return result.slice(0, spec.limit);
}

function matchFilter(
  item: Item,
  filter: BaseViewSpec['filters'][number],
): boolean {
  const raw = item[filter.field];
  const cell = Array.isArray(raw) ? raw.map(String) : raw != null ? String(raw) : '';

  switch (filter.op) {
    case 'eq':
      return String(cell) === String(filter.value);
    case 'neq':
      return String(cell) !== String(filter.value);
    case 'in': {
      const allowed = Array.isArray(filter.value) ? filter.value : [filter.value];
      return allowed.includes(String(cell));
    }
    case 'contains': {
      const needle = String(filter.value).toLowerCase();
      if (Array.isArray(cell)) return cell.some((v) => v.toLowerCase().includes(needle));
      return String(cell).toLowerCase().includes(needle);
    }
    default:
      return true;
  }
}
