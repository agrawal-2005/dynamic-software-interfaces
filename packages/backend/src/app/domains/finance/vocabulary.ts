import type { AppVocabulary } from '@dsi/shared';

// Finance has no kanban layout — the domain doesn't think in swimlanes.
// The engine adapts automatically: no requiresGroupBy rule fires, the
// agent system prompt lists only the declared layouts.
export const FINANCE_VOCABULARY: AppVocabulary = {
  layouts: [
    { name: 'table', description: 'Detailed ledger / spreadsheet / list view — all spend items in a sortable table', requiresGroupBy: false },
    { name: 'feed',  description: 'Chronological activity feed / transaction log / recent approvals and spend events',requiresGroupBy: false },
    { name: 'cards', description: 'Summary tiles / panels / boxes — at-a-glance cards for each spend item',          requiresGroupBy: false },
  ],
  fields: [
    { key: 'id',          type: 'string', description: 'Request or invoice ID / reference number' },
    { key: 'title',       type: 'string', description: 'Short description of the spend item / expense name / what it is for',
      filterable: true, sortable: true },
    { key: 'category',    type: 'enum',   description: 'Spend category / expense type / what kind of cost it is',
      enumValues: ['salary', 'vendor', 'infrastructure', 'travel', 'marketing'],
      filterable: true, groupable: true },
    { key: 'amount',      type: 'number', description: 'Amount / cost / value in USD',
      sortable: true },
    { key: 'status',      type: 'enum',   description: 'Approval status / where it is in the approval flow / current state',
      enumValues: ['pending', 'approved', 'paid', 'rejected'],
      filterable: true, sortable: true, groupable: true },
    { key: 'department',  type: 'string', description: 'Requesting department / team / which group submitted it',
      filterable: true, groupable: true },
    { key: 'submittedBy', type: 'string', description: 'Person who submitted the request / who filed it / the requester',
      filterable: true },
    { key: 'dueDate',     type: 'date',   description: 'Payment or approval due date / deadline / when it must be resolved',
      sortable: true },
    { key: 'updatedAt',   type: 'date',   description: 'Last status change date / most recently updated / latest activity',
      sortable: true },
  ],
};
