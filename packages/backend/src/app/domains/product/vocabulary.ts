import type { AppVocabulary } from '@dsi/shared';

export const PRODUCT_VOCABULARY: AppVocabulary = {
  layouts: [
    { name: 'table',  description: 'Tabular list of initiatives with sortable columns', requiresGroupBy: false },
    { name: 'kanban', description: 'Phase board — columns are product phases',           requiresGroupBy: true  },
    { name: 'feed',   description: 'Latest updates stream, most recent first',           requiresGroupBy: false },
    { name: 'cards',  description: 'Grid of initiative cards with key signals',          requiresGroupBy: false },
  ],
  fields: [
    { key: 'id',        type: 'string',   description: 'Unique initiative ID' },
    { key: 'title',     type: 'string',   description: 'Initiative name',                                              sortable: true },
    { key: 'phase',     type: 'enum',     description: 'Current product phase',
      enumValues: ['discovery', 'definition', 'build', 'launch', 'done'],
      filterable: true, sortable: true, groupable: true },
    { key: 'owner',     type: 'string',   description: 'PM responsible for this initiative',     filterable: true, groupable: true },
    { key: 'impact',    type: 'enum',     description: 'Expected business impact',
      enumValues: ['low', 'medium', 'high'],
      filterable: true, sortable: true, groupable: true },
    { key: 'effort',    type: 'enum',     description: 'Estimated engineering effort (t-shirt size)',
      enumValues: ['S', 'M', 'L', 'XL'],
      filterable: true, sortable: true },
    { key: 'quarter',   type: 'enum',     description: 'Target delivery quarter',
      enumValues: ['Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026'],
      filterable: true, sortable: true, groupable: true },
    { key: 'tags',      type: 'string[]', description: 'Topic tags',                              filterable: true },
    { key: 'updatedAt', type: 'date',     description: 'ISO timestamp of the last update',                             sortable: true },
  ],
};
