import type { AppVocabulary } from '@dsi/shared';

// Finance has no kanban layout — the domain doesn't think in swimlanes.
// The engine adapts automatically: no requiresGroupBy rule fires, the
// agent system prompt lists only the declared layouts.
export const FINANCE_VOCABULARY: AppVocabulary = {
  layouts: [
    { name: 'table', description: 'Detailed ledger-style table with sortable columns',  requiresGroupBy: false },
    { name: 'feed',  description: 'Chronological spend / approval activity feed',        requiresGroupBy: false },
    { name: 'cards', description: 'Summary cards for at-a-glance review',               requiresGroupBy: false },
  ],
  fields: [
    { key: 'id',          type: 'string', description: 'Request or invoice ID' },
    { key: 'title',       type: 'string', description: 'Short description of the spend item',                     sortable: true },
    { key: 'category',    type: 'enum',   description: 'Spend category',
      enumValues: ['salary', 'vendor', 'infrastructure', 'travel', 'marketing'],
      filterable: true, groupable: true },
    { key: 'amount',      type: 'number', description: 'Amount in USD (numeric)',                                  sortable: true },
    { key: 'status',      type: 'enum',   description: 'Approval status',
      enumValues: ['pending', 'approved', 'paid', 'rejected'],
      filterable: true, sortable: true, groupable: true },
    { key: 'department',  type: 'string', description: 'Requesting department',           filterable: true, groupable: true },
    { key: 'submittedBy', type: 'string', description: 'Person who submitted the request', filterable: true },
    { key: 'dueDate',     type: 'date',   description: 'Payment or approval due date',                            sortable: true },
    { key: 'updatedAt',   type: 'date',   description: 'ISO timestamp of the last status change',                 sortable: true },
  ],
};
