import type { BaseViewSpec } from '@dsi/shared';

export type Preset = { label: string; persona: string; spec: BaseViewSpec };

export const ENGINEERING_PRESETS: Preset[] = [
  {
    label: 'IC — My open work',
    persona: 'IC',
    spec: {
      version: '1.0',
      name: 'My Open Work',
      description: 'Tickets assigned to me that are not yet done, sorted by priority.',
      layout: 'table',
      fields: [
        { key: 'title',    visible: true },
        { key: 'status',   visible: true },
        { key: 'priority', visible: true },
        { key: 'labels',   visible: true },
      ],
      filters: [
        { field: 'assignee', op: 'eq',  value: 'alice' },
        { field: 'status',   op: 'neq', value: 'done'  },
      ],
      sort: { field: 'priority', direction: 'asc' },
      limit: 100,
    },
  },
  {
    label: 'Tech Lead — Team kanban',
    persona: 'Tech Lead',
    spec: {
      version: '1.0',
      name: 'Team Kanban',
      description: 'All team tickets grouped by status — track flow at a glance.',
      layout: 'kanban',
      fields: [
        { key: 'title',    visible: true },
        { key: 'assignee', visible: true },
        { key: 'priority', visible: true },
      ],
      groupBy: 'status',
      filters: [],
      sort: { field: 'updatedAt', direction: 'desc' },
      limit: 100,
    },
  },
  {
    label: 'Manager — Weekly movement',
    persona: 'Manager',
    spec: {
      version: '1.0',
      name: 'Weekly Movement',
      description: 'What moved recently — sorted by last update, capped at 30.',
      layout: 'feed',
      fields: [
        { key: 'title',     visible: true },
        { key: 'status',    visible: true },
        { key: 'assignee',  visible: true },
        { key: 'updatedAt', visible: true, label: 'Last moved' },
      ],
      filters: [],
      sort: { field: 'updatedAt', direction: 'desc' },
      limit: 30,
    },
  },
];
