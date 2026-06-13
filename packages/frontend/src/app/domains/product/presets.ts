import type { BaseViewSpec } from '@dsi/shared';

export type Preset = { label: string; persona: string; spec: BaseViewSpec };

export const PRODUCT_PRESETS: Preset[] = [
  {
    label: 'PM — My active initiatives',
    persona: 'PM',
    spec: {
      version: '1.0',
      name: 'My Active Initiatives',
      description: "PM's owned initiatives that haven't launched yet, sorted by impact.",
      layout: 'table',
      fields: [
        { key: 'title',   visible: true },
        { key: 'phase',   visible: true },
        { key: 'impact',  visible: true },
        { key: 'effort',  visible: true },
        { key: 'quarter', visible: true },
      ],
      filters: [
        { field: 'owner', op: 'eq',  value: 'priya' },
        { field: 'phase', op: 'neq', value: 'done'  },
      ],
      sort: { field: 'impact', direction: 'desc' },
      limit: 100,
    },
  },
  {
    label: 'Head of Product — Roadmap board',
    persona: 'Head of Product',
    spec: {
      version: '1.0',
      name: 'Roadmap by Phase',
      description: 'All initiatives across phases — the classic product kanban.',
      layout: 'kanban',
      fields: [
        { key: 'title',  visible: true },
        { key: 'owner',  visible: true },
        { key: 'impact', visible: true },
        { key: 'effort', visible: true },
      ],
      groupBy: 'phase',
      filters: [],
      sort: { field: 'updatedAt', direction: 'desc' },
      limit: 100,
    },
  },
  {
    label: 'Exec — High-impact overview',
    persona: 'Exec',
    spec: {
      version: '1.0',
      name: 'High-Impact Overview',
      description: 'Top-10 highest-impact initiatives as summary cards.',
      layout: 'cards',
      fields: [
        { key: 'title',   visible: true },
        { key: 'phase',   visible: true },
        { key: 'owner',   visible: true },
        { key: 'impact',  visible: true },
        { key: 'quarter', visible: true },
      ],
      filters: [{ field: 'impact', op: 'eq', value: 'high' }],
      sort: { field: 'updatedAt', direction: 'desc' },
      limit: 10,
    },
  },
];
