/**
 * Unit tests for DataStore.
 * Covers filter ops (eq/neq/in/contains), sort (asc/desc, numeric natural order),
 * limit, combined queries, seed isolation, and simulateChange.
 * No network, no Gemini, no vocabulary.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../engine/data-store';
import type { Item } from '@dsi/shared';

// Test dataset — small enough to reason about by hand.
// 'amount' is numeric (as numbers) to test natural sort.
// 'labels' is a string[] to test array-field filter behaviour.
const SEED: Item[] = [
  { id: '1', status: 'done',        priority: 'high',     title: 'Alpha',   labels: ['frontend', 'backend'], amount: 30 },
  { id: '2', status: 'in-progress', priority: 'low',      title: 'Beta',    labels: ['frontend'],            amount: 5  },
  { id: '3', status: 'done',        priority: 'medium',   title: 'Gamma',   labels: ['backend'],             amount: 20 },
  { id: '4', status: 'backlog',     priority: 'critical', title: 'Delta',   labels: ['frontend', 'infra'],   amount: 100 },
  { id: '5', status: 'review',      priority: 'high',     title: 'Epsilon', labels: ['backend', 'infra'],    amount: 10 },
];

// ── Construction ──────────────────────────────────────────────────────────────

describe('DataStore — construction', () => {
  it('query() with no params returns all items', () => {
    const ds = new DataStore(SEED);
    expect(ds.query().length).toBe(5);
  });

  it('getAll() returns a copy, not the live array', () => {
    const ds = new DataStore(SEED);
    const all = ds.getAll();
    all.length = 0; // mutate the returned copy
    expect(ds.getAll().length).toBe(5); // original unaffected
  });

  it('shallow-copies seed items (original mutation does not affect store)', () => {
    const mutable: Item[] = [{ id: 'x', status: 'original' }];
    const ds = new DataStore(mutable);
    (mutable[0] as Record<string, unknown>)['status'] = 'mutated';
    expect(ds.getAll()[0].status).toBe('original');
  });

  it('getById returns the correct item', () => {
    const ds = new DataStore(SEED);
    expect(ds.getById('3')?.title).toBe('Gamma');
  });

  it('getById returns null for unknown id', () => {
    const ds = new DataStore(SEED);
    expect(ds.getById('999')).toBeNull();
  });
});

// ── eq filter ─────────────────────────────────────────────────────────────────

describe('DataStore — filter: eq', () => {
  let ds: DataStore;
  beforeEach(() => { ds = new DataStore(SEED); });

  it('returns only items matching the exact value', () => {
    const items = ds.query({ filters: [{ field: 'status', op: 'eq', value: 'done' }] });
    expect(items.length).toBe(2);
    expect(items.every((i) => i.status === 'done')).toBe(true);
  });

  it('returns empty array when no item matches', () => {
    const items = ds.query({ filters: [{ field: 'status', op: 'eq', value: 'cancelled' }] });
    expect(items.length).toBe(0);
  });

  it('returns all items when value matches every item', () => {
    // Only one distinct priority value: 'high' — matches 2 items
    const items = ds.query({ filters: [{ field: 'priority', op: 'eq', value: 'high' }] });
    expect(items.length).toBe(2);
  });
});

// ── neq filter ────────────────────────────────────────────────────────────────

describe('DataStore — filter: neq', () => {
  let ds: DataStore;
  beforeEach(() => { ds = new DataStore(SEED); });

  it('excludes items with the exact value', () => {
    const items = ds.query({ filters: [{ field: 'status', op: 'neq', value: 'done' }] });
    expect(items.length).toBe(3);
    expect(items.some((i) => i.status === 'done')).toBe(false);
  });

  it('returns all items when nothing matches the exclude value', () => {
    const items = ds.query({ filters: [{ field: 'status', op: 'neq', value: 'cancelled' }] });
    expect(items.length).toBe(5);
  });
});

// ── in filter ─────────────────────────────────────────────────────────────────

describe('DataStore — filter: in', () => {
  let ds: DataStore;
  beforeEach(() => { ds = new DataStore(SEED); });

  it('returns items matching any listed value', () => {
    const items = ds.query({ filters: [{ field: 'status', op: 'in', value: ['done', 'review'] }] });
    expect(items.length).toBe(3); // id=1,3 (done) + id=5 (review)
    expect(items.map((i) => i.id).sort()).toEqual(['1', '3', '5']);
  });

  it('single-value in behaves like eq', () => {
    const byEq = ds.query({ filters: [{ field: 'priority', op: 'eq', value: 'high' }] });
    const byIn = ds.query({ filters: [{ field: 'priority', op: 'in', value: ['high'] }] });
    expect(byIn.map((i) => i.id).sort()).toEqual(byEq.map((i) => i.id).sort());
  });

  it('returns empty when no value matches', () => {
    const items = ds.query({ filters: [{ field: 'status', op: 'in', value: ['cancelled', 'archived'] }] });
    expect(items.length).toBe(0);
  });
});

// ── contains filter ───────────────────────────────────────────────────────────

describe('DataStore — filter: contains', () => {
  let ds: DataStore;
  beforeEach(() => { ds = new DataStore(SEED); });

  it('substring match on scalar string field', () => {
    // 'elt' is in 'Delta' only
    const items = ds.query({ filters: [{ field: 'title', op: 'contains', value: 'elt' }] });
    expect(items.length).toBe(1);
    expect(items[0].id).toBe('4');
  });

  it('is case-insensitive on scalar field', () => {
    const items = ds.query({ filters: [{ field: 'title', op: 'contains', value: 'ALPHA' }] });
    expect(items.length).toBe(1);
    expect(items[0].id).toBe('1');
  });

  it('matches items where array field contains the value', () => {
    // 'infra' appears in labels of id=4 and id=5
    const items = ds.query({ filters: [{ field: 'labels', op: 'contains', value: 'infra' }] });
    expect(items.length).toBe(2);
    expect(items.map((i) => i.id).sort()).toEqual(['4', '5']);
  });

  it('array contains is case-insensitive', () => {
    const items = ds.query({ filters: [{ field: 'labels', op: 'contains', value: 'INFRA' }] });
    expect(items.length).toBe(2);
  });

  it('returns empty when no item matches substring', () => {
    const items = ds.query({ filters: [{ field: 'title', op: 'contains', value: 'zzz' }] });
    expect(items.length).toBe(0);
  });
});

// ── Multiple filters (AND) ────────────────────────────────────────────────────

describe('DataStore — multiple filters (AND semantics)', () => {
  it('two filters both must match', () => {
    const ds = new DataStore(SEED);
    const items = ds.query({
      filters: [
        { field: 'status', op: 'eq', value: 'done' },
        { field: 'priority', op: 'eq', value: 'high' },
      ],
    });
    // Only id=1: status=done AND priority=high
    expect(items.length).toBe(1);
    expect(items[0].id).toBe('1');
  });

  it('three filters narrow down to zero when impossible', () => {
    const ds = new DataStore(SEED);
    const items = ds.query({
      filters: [
        { field: 'status', op: 'eq', value: 'done' },
        { field: 'priority', op: 'eq', value: 'critical' },
        { field: 'title', op: 'contains', value: 'Alpha' },
      ],
    });
    expect(items.length).toBe(0);
  });
});

// ── Sort ──────────────────────────────────────────────────────────────────────

describe('DataStore — sort', () => {
  let ds: DataStore;
  beforeEach(() => { ds = new DataStore(SEED); });

  it('sorts ascending by string field', () => {
    const titles = ds.query({ sort: { field: 'title', direction: 'asc' } }).map((i) => i.title);
    expect(titles).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']);
  });

  it('sorts descending by string field', () => {
    const titles = ds.query({ sort: { field: 'title', direction: 'desc' } }).map((i) => i.title);
    expect(titles).toEqual(['Gamma', 'Epsilon', 'Delta', 'Beta', 'Alpha']);
  });

  it('numeric natural sort ascending (numeric:true) — 5 < 10 < 20 < 30 < 100', () => {
    const amounts = ds.query({ sort: { field: 'amount', direction: 'asc' } }).map((i) => i.amount);
    expect(amounts).toEqual([5, 10, 20, 30, 100]);
  });

  it('numeric natural sort descending', () => {
    const amounts = ds.query({ sort: { field: 'amount', direction: 'desc' } }).map((i) => i.amount);
    expect(amounts).toEqual([100, 30, 20, 10, 5]);
  });
});

// ── Limit ─────────────────────────────────────────────────────────────────────

describe('DataStore — limit', () => {
  let ds: DataStore;
  beforeEach(() => { ds = new DataStore(SEED); });

  it('limit=3 returns exactly 3 items', () => {
    expect(ds.query({ limit: 3 }).length).toBe(3);
  });

  it('limit=1 returns exactly 1 item', () => {
    expect(ds.query({ limit: 1 }).length).toBe(1);
  });

  it('limit greater than total returns all items', () => {
    expect(ds.query({ limit: 999 }).length).toBe(5);
  });

  it('limit preserves insertion order (no implicit sort)', () => {
    const ids = ds.query({ limit: 3 }).map((i) => i.id);
    expect(ids).toEqual(['1', '2', '3']);
  });
});

// ── Combined filter + sort + limit ────────────────────────────────────────────

describe('DataStore — combined filter + sort + limit', () => {
  it('applies filter, then sort, then limit', () => {
    const ds = new DataStore(SEED);
    // Filter: backend label. Matches id=1(30), id=3(20), id=5(10).
    // Sort: amount desc → id=1, id=3, id=5.
    // Limit: 2 → id=1, id=3.
    const items = ds.query({
      filters: [{ field: 'labels', op: 'contains', value: 'backend' }],
      sort: { field: 'amount', direction: 'desc' },
      limit: 2,
    });
    expect(items.length).toBe(2);
    expect(items[0].id).toBe('1');
    expect(items[1].id).toBe('3');
  });

  it('filter that produces 0 items gives empty array even with sort+limit', () => {
    const ds = new DataStore(SEED);
    const items = ds.query({
      filters: [{ field: 'status', op: 'eq', value: 'cancelled' }],
      sort: { field: 'title', direction: 'asc' },
      limit: 10,
    });
    expect(items.length).toBe(0);
  });
});

// ── simulateChange ────────────────────────────────────────────────────────────

describe('DataStore — simulateChange', () => {
  it('updates the target item', () => {
    const ds = new DataStore(SEED);
    ds.simulateChange('3', { status: 'shipped' });
    expect(ds.getById('3')!.status).toBe('shipped');
  });

  it('does not affect other items', () => {
    const ds = new DataStore(SEED);
    ds.simulateChange('3', { status: 'shipped' });
    const others = ds.getAll().filter((i) => i.id !== '3');
    expect(others.every((i) => i.status !== 'shipped')).toBe(true);
  });

  it('emits a change event with the updated items array', () => {
    const ds = new DataStore(SEED);
    let eventFired = false;
    ds.on('change', ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      eventFired = true;
      expect(id).toBe('2');
      expect(patch.priority).toBe('critical');
    });
    ds.simulateChange('2', { priority: 'critical' });
    expect(eventFired).toBe(true);
  });

  it('no-ops silently for unknown id', () => {
    const ds = new DataStore(SEED);
    ds.simulateChange('999', { status: 'done' }); // should not throw
    expect(ds.getAll().length).toBe(5);
  });
});
