/**
 * Per-domain / per-surface / per-user spec isolation tests.
 *
 * These verify that three SpecValidator instances built from different
 * vocabularies are completely independent, and that three DataStore instances
 * built from different seeds are completely isolated.
 *
 * No network, no Gemini.
 */
import { describe, it, expect } from 'vitest';
import { SpecValidator } from '../engine/spec-validator';
import { DataStore } from '../engine/data-store';
import { ENGINEERING_VOCABULARY } from '../app/domains/engineering/vocabulary';
import { PRODUCT_VOCABULARY }     from '../app/domains/product/vocabulary';
import { FINANCE_VOCABULARY }     from '../app/domains/finance/vocabulary';
import { ENGINEERING_SEED }       from '../app/domains/engineering/seed';
import { PRODUCT_SEED }           from '../app/domains/product/seed';

// Mirroring what buildAppRegistry() does: one validator + one store per domain.
const engValidator = new SpecValidator(ENGINEERING_VOCABULARY);
const prodValidator = new SpecValidator(PRODUCT_VOCABULARY);
const finValidator  = new SpecValidator(FINANCE_VOCABULARY);

const engStore  = new DataStore(ENGINEERING_SEED);
const prodStore = new DataStore(PRODUCT_SEED);

// ── SpecValidator isolation ───────────────────────────────────────────────────

describe('SpecValidator — cross-domain field rejection', () => {
  it('engineering validator rejects product-only field "phase"', () => {
    expect(engValidator.validate({
      version: '1.0', layout: 'table',
      fields: [{ key: 'phase', visible: true }],
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('product validator rejects engineering-only field "priority"', () => {
    expect(prodValidator.validate({
      version: '1.0', layout: 'table',
      fields: [{ key: 'priority', visible: true }],
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('finance validator rejects engineering-only field "assignee"', () => {
    expect(finValidator.validate({
      version: '1.0', layout: 'table',
      fields: [{ key: 'assignee', visible: true }],
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('finance validator rejects product-only field "phase"', () => {
    expect(finValidator.validate({
      version: '1.0', layout: 'table',
      fields: [{ key: 'phase', visible: true }],
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('engineering validator rejects finance-only field "amount"', () => {
    expect(engValidator.validate({
      version: '1.0', layout: 'table',
      fields: [{ key: 'amount', visible: true }],
      filters: [], limit: 50,
    }).ok).toBe(false);
  });
});

describe('SpecValidator — cross-domain layout rejection', () => {
  it('finance validator rejects kanban (absent from finance vocabulary)', () => {
    expect(finValidator.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'status',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('engineering validator accepts kanban (present in engineering vocabulary)', () => {
    expect(engValidator.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'status',
      filters: [], limit: 50,
    }).ok).toBe(true);
  });

  it('product validator accepts kanban grouped by phase', () => {
    expect(prodValidator.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'phase',
      filters: [], limit: 50,
    }).ok).toBe(true);
  });
});

describe('SpecValidator — cross-domain groupBy field rejection', () => {
  it('engineering validator rejects groupBy="phase" (product-only groupable)', () => {
    expect(engValidator.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'phase',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('product validator rejects groupBy="priority" (not a product field)', () => {
    expect(prodValidator.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'priority',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('product validator rejects groupBy="effort" (effort not groupable in product vocab)', () => {
    // effort is filterable+sortable but NOT groupable
    expect(prodValidator.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'effort',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });
});

describe('SpecValidator — cross-domain filter field rejection', () => {
  it('product validator rejects filter on "assignee" (engineering-only filterable)', () => {
    expect(prodValidator.validate({
      version: '1.0', layout: 'table',
      fields: [{ key: 'id', visible: true }],
      filters: [{ field: 'assignee', op: 'eq', value: 'alice' }],
      limit: 50,
    }).ok).toBe(false);
  });

  it('finance validator rejects filter on "labels" (engineering-only filterable)', () => {
    expect(finValidator.validate({
      version: '1.0', layout: 'table',
      fields: [{ key: 'id', visible: true }],
      filters: [{ field: 'labels', op: 'contains', value: 'infra' }],
      limit: 50,
    }).ok).toBe(false);
  });
});

describe('SpecValidator — spec valid for one domain is invalid for another', () => {
  const productKanbanSpec = {
    version: '1.0' as const,
    layout: 'kanban',
    fields: [
      { key: 'id', visible: true },
      { key: 'phase', visible: true },
      { key: 'title', visible: true },
    ],
    groupBy: 'phase',
    filters: [] as [],
    limit: 50,
  };

  it('product validator accepts the product kanban spec', () => {
    expect(prodValidator.validate(productKanbanSpec).ok).toBe(true);
  });

  it('engineering validator rejects the same spec (phase is not eng field)', () => {
    expect(engValidator.validate(productKanbanSpec).ok).toBe(false);
  });

  it('finance validator rejects the same spec (kanban not in finance + phase unknown)', () => {
    expect(finValidator.validate(productKanbanSpec).ok).toBe(false);
  });
});

// ── DataStore isolation ───────────────────────────────────────────────────────

describe('DataStore — item ID namespaces do not overlap', () => {
  it('engineering and product seeds have no shared IDs', () => {
    const engIds = new Set(engStore.getAll().map((i) => i.id));
    const prodIds = new Set(prodStore.getAll().map((i) => i.id));
    const overlap = [...engIds].filter((id) => prodIds.has(id));
    expect(overlap.length).toBe(0);
  });

  it('engineering seed IDs are prefixed ENG-', () => {
    expect(engStore.getAll().every((i) => String(i.id).startsWith('ENG-'))).toBe(true);
  });

  it('product seed IDs are prefixed PRD-', () => {
    expect(prodStore.getAll().every((i) => String(i.id).startsWith('PRD-'))).toBe(true);
  });
});

describe('DataStore — mutations do not cross domain boundaries', () => {
  it('simulateChange on engineering store does not affect product store', () => {
    const freshEng  = new DataStore(ENGINEERING_SEED);
    const freshProd = new DataStore(PRODUCT_SEED);

    const prodCountBefore = freshProd.getAll().length;
    freshEng.simulateChange('ENG-001', { status: 'isolation-test' });

    // Product store unchanged
    expect(freshProd.getAll().length).toBe(prodCountBefore);
    expect(freshProd.getAll().every((i) => i.status !== 'isolation-test')).toBe(true);
  });

  it('two DataStore instances built from the same seed are independent', () => {
    const ds1 = new DataStore(ENGINEERING_SEED);
    const ds2 = new DataStore(ENGINEERING_SEED);

    ds1.simulateChange('ENG-001', { status: 'modified-in-ds1' });

    expect(ds1.getById('ENG-001')!.status).toBe('modified-in-ds1');
    expect(ds2.getById('ENG-001')!.status).not.toBe('modified-in-ds1');
  });
});

describe('DataStore — per-user spec does not mutate underlying store', () => {
  it('querying with filters returns a subset but store still holds all items', () => {
    const ds = new DataStore(ENGINEERING_SEED);
    const total = ds.getAll().length;

    const filtered = ds.query({
      filters: [{ field: 'status', op: 'eq', value: 'done' }],
    });

    expect(filtered.length).toBeLessThan(total);
    expect(ds.getAll().length).toBe(total); // unchanged
  });

  it('applying different specs to the same store produces different views but same data', () => {
    const ds = new DataStore(ENGINEERING_SEED);

    const viewA = ds.query({ filters: [{ field: 'status', op: 'eq', value: 'done' }] });
    const viewB = ds.query({ filters: [{ field: 'status', op: 'eq', value: 'backlog' }] });

    // Different views
    expect(viewA.map((i) => i.id)).not.toEqual(viewB.map((i) => i.id));

    // Same underlying data
    expect(ds.getAll().length).toBe(ENGINEERING_SEED.length);
  });
});
