/**
 * BaseViewSpec is the loose structural type for a ViewSpec used across
 * packages (frontend engine, SpecStore, hooks) where the concrete domain
 * vocabulary is not available.
 *
 * At runtime the domain's SpecValidator enforces the vocabulary constraints;
 * TypeScript uses this type for cross-package sharing.
 */
export type BaseViewSpec = {
  version: '1.0';
  name?: string;
  description?: string;
  layout: string;
  fields: Array<{
    key: string;
    label?: string;
    visible: boolean;
  }>;
  groupBy?: string;
  filters: Array<{
    field: string;
    op: 'eq' | 'neq' | 'in' | 'contains';
    value: string | string[];
  }>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit: number;
  /**
   * Per-user display aliases for individual field values.
   * { fieldKey: { rawValue: displayLabel } }
   * Display-only — the underlying data is never modified.
   * Unknown rawValues are silently ignored at render time.
   */
  valueLabels?: Record<string, Record<string, string>>;
};

/**
 * A saved version of a ViewSpec, stored by ISpecRepository.
 */
export type SpecVersion = {
  id: string;
  savedAt: string; // ISO 8601
  spec: BaseViewSpec;
};
