import type { AppVocabulary } from '@dsi/shared';

export const PRODUCT_VOCABULARY: AppVocabulary = {
  layouts: [
    { name: 'table',  description: 'Tabular list / spreadsheet / rows and columns — all initiatives in a sortable table', requiresGroupBy: false },
    { name: 'kanban', description: 'Phase board / roadmap board — sticky-note cards in columns by phase; also called "board" or "roadmap"', requiresGroupBy: true  },
    { name: 'feed',   description: 'Activity feed / update stream / timeline of latest changes, most recent first',       requiresGroupBy: false },
    { name: 'cards',  description: 'Grid of tiles / panels / boxes / initiative cards — one card per item at a glance',   requiresGroupBy: false },
  ],
  fields: [
    { key: 'id',        type: 'string',   description: 'Unique initiative ID / reference number' },
    { key: 'title',     type: 'string',   description: 'Initiative name / project name / the headline',
      filterable: true, sortable: true },
    { key: 'phase',     type: 'enum',     description: 'Current product phase / stage / where it is in the lifecycle',
      enumValues: ['discovery', 'definition', 'build', 'launch', 'done'],
      filterable: true, sortable: true, groupable: true },
    { key: 'owner',     type: 'string',   description: 'The PM responsible / who owns it / the person leading this initiative',
      filterable: true, groupable: true },
    { key: 'impact',    type: 'enum',     description: 'Expected business impact / value / how big a deal it is',
      enumValues: ['low', 'medium', 'high'],
      filterable: true, sortable: true, groupable: true },
    { key: 'effort',    type: 'enum',     description: 'Estimated engineering effort / size / how much work it is (t-shirt sizes)',
      enumValues: ['S', 'M', 'L', 'XL'],
      filterable: true, sortable: true },
    { key: 'quarter',   type: 'enum',     description: 'Target delivery quarter / when it is due / planned release window',
      enumValues: ['Q1-2026', 'Q2-2026', 'Q3-2026', 'Q4-2026'],
      filterable: true, sortable: true, groupable: true },
    { key: 'tags',      type: 'string[]', description: 'Topic tags / categories / labels attached to the initiative',
      filterable: true },
    { key: 'updatedAt', type: 'date',     description: 'Last modified date / most recently updated / latest activity timestamp',
      sortable: true },
  ],
};
