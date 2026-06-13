/**
 * The engine's only knowledge of data: every record has an id;
 * all other fields are unknown at the engine level and declared
 * by the domain's AppVocabulary.
 */
export type Item = {
  id: string;
  [key: string]: unknown;
};

/**
 * Parameters for querying a DataStore. Field names are plain strings
 * because the engine does not know which fields exist — those come
 * from the domain's AppVocabulary.
 */
export type FilterOp = 'eq' | 'neq' | 'in' | 'contains';

export type FilterClause = {
  field: string;
  op: FilterOp;
  value: string | string[];
};

export type SortClause = {
  field: string;
  direction: 'asc' | 'desc';
};

export type QueryParams = {
  filters?: FilterClause[];
  sort?: SortClause;
  limit?: number;
};
