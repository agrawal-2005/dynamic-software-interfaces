/**
 * The contract every domain must satisfy to plug into the engine.
 * Both SpecValidator and SpecGenerator are constructed from this;
 * neither class contains any domain-specific strings.
 */

export interface AppFieldDef {
  /** The field key as it appears in Item records and ViewSpec field lists. */
  key: string;

  /** Data type — used to describe the field in the agent's system prompt. */
  type: 'string' | 'string[]' | 'number' | 'date' | 'enum';

  /** Human-readable description injected into the agent system prompt. */
  description: string;

  /**
   * For enum fields: the allowed values, injected into the agent system prompt.
   * Also used when filter ops validate against known values.
   */
  enumValues?: string[];

  /** Whether this field can appear in filters[].field. */
  filterable?: boolean;

  /** Whether this field can appear in sort.field. */
  sortable?: boolean;

  /** Whether this field can appear in groupBy. */
  groupable?: boolean;
}

export interface AppLayoutDef {
  /** The layout name as it appears in ViewSpec.layout. */
  name: string;

  /** Human-readable description injected into the agent system prompt. */
  description: string;

  /**
   * When true, buildViewSpecSchema adds a .refine() rule requiring groupBy
   * to be set whenever this layout is chosen. The engine expresses the rule
   * without knowing the layout name.
   */
  requiresGroupBy?: boolean;
}

export interface AppVocabulary {
  layouts: AppLayoutDef[];
  fields: AppFieldDef[];
}
