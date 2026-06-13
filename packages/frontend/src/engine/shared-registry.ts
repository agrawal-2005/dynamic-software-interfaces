/**
 * shared-registry — one LayoutRegistry instance for the whole frontend.
 * Import this wherever ViewRenderer is used outside ViewPage.
 */
import { LayoutRegistry } from './layout-registry';
import { TableLayout  } from '../components/layouts/TableLayout';
import { KanbanLayout } from '../components/layouts/KanbanLayout';
import { FeedLayout   } from '../components/layouts/FeedLayout';
import { CardsLayout  } from '../components/layouts/CardsLayout';

export const sharedRegistry = new LayoutRegistry()
  .register('table',  TableLayout)
  .register('kanban', KanbanLayout)
  .register('feed',   FeedLayout)
  .register('cards',  CardsLayout);
