import type { BaseViewSpec } from '@dsi/shared';

export type Preset = { label: string; persona: string; spec: BaseViewSpec };

export const FINANCE_PRESETS: Preset[] = [
  {
    label: 'Accountant — Pending approvals',
    persona: 'Accountant',
    spec: {
      version: '1.0',
      name: 'Pending Approvals',
      description: 'All spend items awaiting approval, soonest due first.',
      layout: 'table',
      fields: [
        { key: 'title',       visible: true },
        { key: 'category',    visible: true },
        { key: 'amount',      visible: true, label: 'Amount (USD)' },
        { key: 'department',  visible: true },
        { key: 'submittedBy', visible: true, label: 'Submitted by' },
        { key: 'dueDate',     visible: true, label: 'Due date' },
      ],
      filters: [{ field: 'status', op: 'eq', value: 'pending' }],
      sort: { field: 'dueDate', direction: 'asc' },
      limit: 100,
    },
  },
  {
    label: 'CFO — Largest spends',
    persona: 'CFO',
    spec: {
      version: '1.0',
      name: 'Top Spend Items',
      description: 'Approved and paid items sorted by amount — quick budget pulse.',
      layout: 'cards',
      fields: [
        { key: 'title',      visible: true },
        { key: 'amount',     visible: true, label: 'USD' },
        { key: 'category',   visible: true },
        { key: 'status',     visible: true },
        { key: 'department', visible: true },
      ],
      filters: [{ field: 'status', op: 'in', value: ['approved', 'paid'] }],
      sort: { field: 'amount', direction: 'desc' },
      limit: 20,
    },
  },
  {
    label: 'AP Team — Outstanding payments',
    persona: 'AP Team',
    spec: {
      version: '1.0',
      name: 'Outstanding Payments',
      description: 'Pending and approved items that still need payment action.',
      layout: 'feed',
      fields: [
        { key: 'title',      visible: true },
        { key: 'amount',     visible: true, label: 'Amount' },
        { key: 'status',     visible: true },
        { key: 'department', visible: true },
        { key: 'dueDate',    visible: true, label: 'Due' },
      ],
      filters: [{ field: 'status', op: 'in', value: ['pending', 'approved'] }],
      sort: { field: 'dueDate', direction: 'asc' },
      limit: 100,
    },
  },
];
