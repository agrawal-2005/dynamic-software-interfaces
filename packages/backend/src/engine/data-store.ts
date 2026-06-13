import { EventEmitter } from 'events';
import type { Item, QueryParams, FilterClause } from '@dsi/shared';

/**
 * DataStore — engine class, domain-agnostic.
 *
 * Holds an in-memory array of Items, applies QueryParams (filter/sort/limit),
 * and emits a 'change' event whenever data mutates. The engine knows nothing
 * about what the items represent; field names come from the domain's
 * AppVocabulary at query time.
 */
export class DataStore extends EventEmitter {
  private items: Item[];

  constructor(seed: Item[]) {
    super();
    // Shallow-copy the seed so callers can't mutate the source array.
    this.items = seed.map((item) => ({ ...item }));
  }

  query(params: QueryParams = {}): Item[] {
    let result = [...this.items];
    if (params.filters?.length) {
      result = this.applyFilters(result, params.filters);
    }
    if (params.sort) {
      result = this.applySort(result, params.sort.field, params.sort.direction);
    }
    if (params.limit != null) {
      result = result.slice(0, params.limit);
    }
    return result;
  }

  getById(id: string): Item | null {
    return this.items.find((item) => item.id === id) ?? null;
  }

  /**
   * Apply a partial update to one item and emit 'change'.
   * Exposed only for the dev simulation endpoint — not a real write path.
   */
  simulateChange(id: string, patch: Record<string, unknown>): void {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return;
    this.items[index] = { ...this.items[index], ...patch };
    this.emit('change', { id, patch, items: this.items });
  }

  getAll(): Item[] {
    return [...this.items];
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private applyFilters(items: Item[], filters: FilterClause[]): Item[] {
    return items.filter((item) => filters.every((f) => this.matchFilter(item, f)));
  }

  private matchFilter(item: Item, filter: FilterClause): boolean {
    const raw = item[filter.field];
    const cellValue = Array.isArray(raw)
      ? raw.map(String)
      : raw != null ? String(raw) : '';

    switch (filter.op) {
      case 'eq':
        return String(cellValue) === String(filter.value);

      case 'neq':
        return String(cellValue) !== String(filter.value);

      case 'in': {
        const allowed = Array.isArray(filter.value) ? filter.value : [filter.value];
        return allowed.includes(String(cellValue));
      }

      case 'contains': {
        const needle = String(filter.value).toLowerCase();
        if (Array.isArray(cellValue)) {
          return cellValue.some((v) => v.toLowerCase().includes(needle));
        }
        return String(cellValue).toLowerCase().includes(needle);
      }

      default:
        return true;
    }
  }

  private applySort(items: Item[], field: string, direction: 'asc' | 'desc'): Item[] {
    return [...items].sort((a, b) => {
      const av = a[field] ?? '';
      const bv = b[field] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return direction === 'asc' ? cmp : -cmp;
    });
  }
}
