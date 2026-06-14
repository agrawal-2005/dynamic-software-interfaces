import type { AppVocabulary } from '@dsi/shared';

export const ENGINEERING_VOCABULARY: AppVocabulary = {
  layouts: [
    { name: 'table',  description: 'Tabular rows with sortable columns',                requiresGroupBy: false },
    { name: 'kanban', description: 'Columns grouped by a field, cards in each column',  requiresGroupBy: true  },
    { name: 'feed',   description: 'Chronological activity stream, newest first',        requiresGroupBy: false },
    { name: 'cards',  description: 'Grid of summary cards',                              requiresGroupBy: false },
  ],
  fields: [
    { key: 'id',          type: 'string',   description: 'Unique ticket ID' },
    { key: 'title',       type: 'string',   description: 'Short summary of the ticket',   filterable: true,             sortable: true },
    { key: 'status',      type: 'enum',     description: 'Current workflow state',
      enumValues: ['backlog', 'in-progress', 'review', 'done'],
      filterable: true, sortable: true, groupable: true },
    { key: 'priority',    type: 'enum',     description: 'Urgency level',
      enumValues: ['low', 'medium', 'high', 'critical'],
      filterable: true, sortable: true, groupable: true },
    { key: 'assignee',    type: 'string',   description: 'Username of the assigned engineer',   filterable: true, groupable: true },
    { key: 'labels',      type: 'string[]', description: 'Topic tags attached to the ticket',   filterable: true },
    { key: 'createdAt',   type: 'date',     description: 'ISO timestamp when the ticket was created',                  sortable: true },
    { key: 'updatedAt',   type: 'date',     description: 'ISO timestamp of the most recent change',                    sortable: true },
    { key: 'description', type: 'string',   description: 'Long-form ticket details' },
  ],
};
