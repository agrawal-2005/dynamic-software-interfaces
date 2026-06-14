import type { AppVocabulary } from '@dsi/shared';

export const ENGINEERING_VOCABULARY: AppVocabulary = {
  layouts: [
    { name: 'table',  description: 'Tabular list / spreadsheet / rows and columns view with sortable columns',                                           requiresGroupBy: false },
    { name: 'kanban', description: 'Board / swimlane view — sticky-note cards in columns, each column is a group; also called "board" or "swimlanes"',   requiresGroupBy: true  },
    { name: 'feed',   description: 'Activity log / timeline / stream of recent changes, newest first; also called "log", "history", or "recent"',        requiresGroupBy: false },
    { name: 'cards',  description: 'Grid of tiles / panels / boxes / rectangles — one card per ticket at a glance',                                      requiresGroupBy: false },
  ],
  fields: [
    { key: 'id',          type: 'string',   description: 'Unique ticket ID / reference number' },
    { key: 'title',       type: 'string',   description: 'Short summary of the ticket — the name or headline',
      filterable: true, sortable: true },
    { key: 'status',      type: 'enum',     description: 'Current workflow state / stage / where it is in the process',
      enumValues: ['backlog', 'in-progress', 'review', 'done'],
      filterable: true, sortable: true, groupable: true },
    { key: 'priority',    type: 'enum',     description: 'Urgency level / importance / how critical it is',
      enumValues: ['low', 'medium', 'high', 'critical'],
      filterable: true, sortable: true, groupable: true },
    { key: 'assignee',    type: 'string',   description: 'The person doing it / who is responsible / the assigned engineer / who owns it',
      filterable: true, groupable: true },
    { key: 'labels',      type: 'string[]', description: 'Topic tags / categories attached to the ticket',
      filterable: true },
    { key: 'createdAt',   type: 'date',     description: 'Creation date / when the ticket was opened / date added',
      sortable: true },
    { key: 'updatedAt',   type: 'date',     description: 'Last modified date / most recently changed / latest activity',
      sortable: true },
    { key: 'description', type: 'string',   description: 'Long-form ticket details / full description / body text' },
  ],
};
