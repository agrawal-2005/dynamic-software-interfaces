/**
 * Unit tests for SpecValidator.
 * No network calls, no Gemini, no DataStore.
 * Exercises buildViewSpecSchema constraints for all three domains.
 */
import { describe, it, expect } from 'vitest';
import { SpecValidator, ValidatorError } from '../engine/spec-validator';
import { ENGINEERING_VOCABULARY } from '../app/domains/engineering/vocabulary';
import { PRODUCT_VOCABULARY } from '../app/domains/product/vocabulary';
import { FINANCE_VOCABULARY } from '../app/domains/finance/vocabulary';

const eng  = new SpecValidator(ENGINEERING_VOCABULARY);
const prod = new SpecValidator(PRODUCT_VOCABULARY);
const fin  = new SpecValidator(FINANCE_VOCABULARY);

// Minimal valid base for each domain.
// Each uses only `id` which is defined (no filterable/sortable/groupable flags) —
// enough to satisfy the Zod schema without touching optional flags.
const ENG_TABLE = {
  version: '1.0' as const,
  layout: 'table',
  fields: [{ key: 'id', visible: true }],
  filters: [],
  limit: 50,
};

const FIN_TABLE = {
  version: '1.0' as const,
  layout: 'table',
  fields: [{ key: 'id', visible: true }],
  filters: [],
  limit: 50,
};

// ── Engineering: valid specs ───────────────────────────────────────────────────

describe('SpecValidator — Engineering: valid specs pass', () => {
  it('minimal table spec', () => {
    expect(eng.validate(ENG_TABLE).ok).toBe(true);
  });

  it('table with multiple fields', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      fields: [
        { key: 'id', visible: true },
        { key: 'title', visible: true },
        { key: 'status', visible: true },
        { key: 'priority', visible: false },
      ],
    }).ok).toBe(true);
  });

  it('kanban with valid groupBy=status', () => {
    expect(eng.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }, { key: 'title', visible: true }],
      groupBy: 'status',
      filters: [], limit: 50,
    }).ok).toBe(true);
  });

  it('kanban with valid groupBy=priority', () => {
    expect(eng.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'priority',
      filters: [], limit: 50,
    }).ok).toBe(true);
  });

  it('kanban with valid groupBy=assignee', () => {
    expect(eng.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'assignee',
      filters: [], limit: 50,
    }).ok).toBe(true);
  });

  it('feed layout', () => {
    expect(eng.validate({ ...ENG_TABLE, layout: 'feed' }).ok).toBe(true);
  });

  it('cards layout', () => {
    expect(eng.validate({ ...ENG_TABLE, layout: 'cards' }).ok).toBe(true);
  });

  it('eq filter on filterable field', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [{ field: 'status', op: 'eq', value: 'done' }],
    }).ok).toBe(true);
  });

  it('neq filter', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [{ field: 'priority', op: 'neq', value: 'low' }],
    }).ok).toBe(true);
  });

  it('in filter with array value', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [{ field: 'status', op: 'in', value: ['done', 'review'] }],
    }).ok).toBe(true);
  });

  it('contains filter on string[] field (labels)', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [{ field: 'labels', op: 'contains', value: 'infra' }],
    }).ok).toBe(true);
  });

  it('multiple filters (ANDed)', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [
        { field: 'status', op: 'eq', value: 'done' },
        { field: 'priority', op: 'neq', value: 'low' },
      ],
    }).ok).toBe(true);
  });

  it('sort asc on sortable field', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      sort: { field: 'createdAt', direction: 'asc' },
    }).ok).toBe(true);
  });

  it('sort desc on sortable field', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      sort: { field: 'updatedAt', direction: 'desc' },
    }).ok).toBe(true);
  });

  it('field with optional label rename', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      fields: [{ key: 'status', visible: true, label: 'State' }],
    }).ok).toBe(true);
  });

  it('valueLabels for display-only aliases', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      valueLabels: { status: { 'in-progress': 'Doing', done: 'Shipped' } },
    }).ok).toBe(true);
  });

  it('limit=1 (minimum)', () => {
    expect(eng.validate({ ...ENG_TABLE, limit: 1 }).ok).toBe(true);
  });

  it('limit=200 (maximum)', () => {
    expect(eng.validate({ ...ENG_TABLE, limit: 200 }).ok).toBe(true);
  });

  it('optional name and description fields', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      name: 'My view',
      description: 'Critical items only',
    }).ok).toBe(true);
  });
});

// ── Engineering: invalid layout → rejected ────────────────────────────────────

describe('SpecValidator — Engineering: invalid layout', () => {
  it('rejects unknown layout name', () => {
    expect(eng.validate({ ...ENG_TABLE, layout: 'timeline' }).ok).toBe(false);
  });

  it('rejects empty string layout', () => {
    expect(eng.validate({ ...ENG_TABLE, layout: '' }).ok).toBe(false);
  });

  it('rejects kanban without groupBy (requiresGroupBy rule)', () => {
    expect(eng.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      filters: [], limit: 50,
      // no groupBy
    }).ok).toBe(false);
  });
});

// ── Engineering: invalid fields → rejected ────────────────────────────────────

describe('SpecValidator — Engineering: invalid fields', () => {
  it('rejects unknown field key', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      fields: [{ key: 'nonexistent_field', visible: true }],
    }).ok).toBe(false);
  });

  it('rejects product-only field "phase" in engineering context', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      fields: [{ key: 'phase', visible: true }],
    }).ok).toBe(false);
  });

  it('rejects finance-only field "amount" in engineering context', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      fields: [{ key: 'amount', visible: true }],
    }).ok).toBe(false);
  });

  it('rejects empty fields array', () => {
    expect(eng.validate({ ...ENG_TABLE, fields: [] }).ok).toBe(false);
  });

  it('rejects duplicate field keys', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      fields: [
        { key: 'id', visible: true },
        { key: 'id', visible: false },
      ],
    }).ok).toBe(false);
  });
});

// ── Engineering: invalid groupBy → rejected ───────────────────────────────────

describe('SpecValidator — Engineering: invalid groupBy', () => {
  it('rejects non-groupable field "labels" as groupBy', () => {
    // labels is filterable but NOT groupable
    expect(eng.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'labels',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('rejects non-groupable field "title" as groupBy', () => {
    // title is filterable+sortable but NOT groupable
    expect(eng.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'title',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('rejects unknown field as groupBy', () => {
    expect(eng.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'nonexistent',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });
});

// ── Engineering: invalid filters → rejected ───────────────────────────────────

describe('SpecValidator — Engineering: invalid filters', () => {
  it('rejects filter on non-filterable field "description"', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [{ field: 'description', op: 'contains', value: 'foo' }],
    }).ok).toBe(false);
  });

  it('rejects filter on non-filterable field "id"', () => {
    // id has no filterable flag in the vocabulary
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [{ field: 'id', op: 'eq', value: 'ENG-001' }],
    }).ok).toBe(false);
  });

  it('rejects filter on unknown field', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [{ field: 'velocity', op: 'eq', value: '5' }],
    }).ok).toBe(false);
  });

  it('rejects invalid filter op', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      filters: [{ field: 'status', op: 'like', value: 'done' }],
    }).ok).toBe(false);
  });
});

// ── Engineering: invalid sort → rejected ─────────────────────────────────────

describe('SpecValidator — Engineering: invalid sort', () => {
  it('rejects sort on non-sortable field "labels"', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      sort: { field: 'labels', direction: 'asc' },
    }).ok).toBe(false);
  });

  it('rejects sort on non-sortable field "assignee"', () => {
    // assignee is filterable+groupable but NOT sortable
    expect(eng.validate({
      ...ENG_TABLE,
      sort: { field: 'assignee', direction: 'asc' },
    }).ok).toBe(false);
  });

  it('rejects sort on unknown field', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      sort: { field: 'velocity', direction: 'asc' },
    }).ok).toBe(false);
  });

  it('rejects invalid sort direction', () => {
    expect(eng.validate({
      ...ENG_TABLE,
      sort: { field: 'title', direction: 'random' },
    }).ok).toBe(false);
  });
});

// ── Engineering: invalid limit → rejected ─────────────────────────────────────

describe('SpecValidator — Engineering: invalid limit', () => {
  it('rejects limit=0', () => {
    expect(eng.validate({ ...ENG_TABLE, limit: 0 }).ok).toBe(false);
  });

  it('rejects limit=201', () => {
    expect(eng.validate({ ...ENG_TABLE, limit: 201 }).ok).toBe(false);
  });

  it('rejects non-integer limit', () => {
    expect(eng.validate({ ...ENG_TABLE, limit: 10.5 }).ok).toBe(false);
  });
});

// ── Engineering: wrong version → rejected ─────────────────────────────────────

describe('SpecValidator — Engineering: version', () => {
  it('rejects version "2.0"', () => {
    expect(eng.validate({ ...ENG_TABLE, version: '2.0' }).ok).toBe(false);
  });

  it('rejects missing version', () => {
    const { version: _v, ...noVersion } = ENG_TABLE;
    expect(eng.validate(noVersion).ok).toBe(false);
  });
});

// ── Finance: no kanban in vocabulary ─────────────────────────────────────────

describe('SpecValidator — Finance: kanban absent from vocabulary', () => {
  it('rejects kanban layout (not in finance vocabulary)', () => {
    expect(fin.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'status',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('accepts table layout', () => {
    expect(fin.validate(FIN_TABLE).ok).toBe(true);
  });

  it('accepts feed layout', () => {
    expect(fin.validate({ ...FIN_TABLE, layout: 'feed' }).ok).toBe(true);
  });

  it('accepts cards layout', () => {
    expect(fin.validate({ ...FIN_TABLE, layout: 'cards' }).ok).toBe(true);
  });

  it('rejects filter on engineering-only field "assignee"', () => {
    expect(fin.validate({
      ...FIN_TABLE,
      filters: [{ field: 'assignee', op: 'eq', value: 'alice' }],
    }).ok).toBe(false);
  });
});

// ── Product: domain-specific constraints ──────────────────────────────────────

describe('SpecValidator — Product: domain-specific constraints', () => {
  const PROD_TABLE = {
    version: '1.0' as const,
    layout: 'table',
    fields: [{ key: 'id', visible: true }],
    filters: [],
    limit: 50,
  };

  it('accepts kanban grouped by phase', () => {
    expect(prod.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'phase',
      filters: [], limit: 50,
    }).ok).toBe(true);
  });

  it('rejects engineering-only field "priority" in product context', () => {
    expect(prod.validate({
      ...PROD_TABLE,
      fields: [{ key: 'priority', visible: true }],
    }).ok).toBe(false);
  });

  it('rejects engineering-only filter field "priority"', () => {
    expect(prod.validate({
      ...PROD_TABLE,
      filters: [{ field: 'priority', op: 'eq', value: 'high' }],
    }).ok).toBe(false);
  });

  it('rejects kanban without groupBy', () => {
    expect(prod.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      filters: [], limit: 50,
    }).ok).toBe(false);
  });

  it('rejects kanban grouped by non-groupable field "effort"', () => {
    // effort is filterable+sortable but NOT groupable
    expect(prod.validate({
      version: '1.0', layout: 'kanban',
      fields: [{ key: 'id', visible: true }],
      groupBy: 'effort',
      filters: [], limit: 50,
    }).ok).toBe(false);
  });
});

// ── assert() throws ValidatorError ────────────────────────────────────────────

describe('SpecValidator — assert() method', () => {
  it('throws ValidatorError for invalid spec', () => {
    expect(() =>
      eng.assert({ version: '1.0', layout: 'nonexistent', fields: [{ key: 'id', visible: true }], filters: [], limit: 50 }),
    ).toThrow(ValidatorError);
  });

  it('thrown ValidatorError lists errors', () => {
    try {
      eng.assert({ version: '1.0', layout: 'bad', fields: [], filters: [], limit: 0 });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidatorError);
      expect((e as ValidatorError).errors.length).toBeGreaterThan(0);
    }
  });

  it('returns validated spec for valid input', () => {
    const spec = eng.assert(ENG_TABLE);
    expect(spec.layout).toBe('table');
    expect(spec.version).toBe('1.0');
    expect(spec.limit).toBe(50);
  });

  it('validate() returns ok:true with spec on success', () => {
    const result = eng.validate(ENG_TABLE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.layout).toBe('table');
    }
  });

  it('validate() returns ok:false with errors array on failure', () => {
    const result = eng.validate({ ...ENG_TABLE, layout: 'bad' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
