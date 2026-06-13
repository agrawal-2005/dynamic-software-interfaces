import { Router } from 'express';
import type { AppRegistry } from '../app/app-registry';
import type { QueryParams, FilterClause } from '@dsi/shared';

/**
 * GET /api/items?app=<id>[&filter=field:op:value]...[&sort=field:dir][&limit=N]
 *
 * Query string encoding (kept simple for a prototype):
 *   filter=status:eq:done           → { field:'status', op:'eq', value:'done' }
 *   filter=labels:contains:infra    → { field:'labels', op:'contains', value:'infra' }
 *   filter=status:in:done,review    → { field:'status', op:'in', value:['done','review'] }
 *   sort=updatedAt:desc
 *   limit=50
 *
 * Multiple filter params are AND'd together.
 */
export function itemsRouter(registry: AppRegistry): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const appId = String(req.query['app'] ?? '');
    const bundle = registry[appId];
    if (!bundle) {
      res.status(400).json({ error: `Unknown app: "${appId}"` });
      return;
    }

    const params: QueryParams = {};

    // Parse filter params
    const rawFilters = req.query['filter'];
    const filterStrings: string[] = rawFilters == null
      ? []
      : Array.isArray(rawFilters) ? rawFilters.map(String) : [String(rawFilters)];

    if (filterStrings.length > 0) {
      params.filters = filterStrings.map(parseFilter).filter((f): f is FilterClause => f !== null);
    }

    // Parse sort param
    const rawSort = req.query['sort'];
    if (rawSort) {
      const [field, dir] = String(rawSort).split(':');
      if (field && (dir === 'asc' || dir === 'desc')) {
        params.sort = { field, direction: dir };
      }
    }

    // Parse limit param
    const rawLimit = req.query['limit'];
    if (rawLimit) {
      const n = parseInt(String(rawLimit), 10);
      if (!isNaN(n) && n > 0) params.limit = Math.min(n, 200);
    }

    const items = bundle.store.query(params);
    res.json({ appId, count: items.length, items });
  });

  // Dev-only: mutate a single item to trigger live update events.
  // Removed in production; used by Step 4 to test the LiveChannel.
  router.post('/dev/mutate', (req, res) => {
    const appId = String(req.query['app'] ?? '');
    const bundle = registry[appId];
    if (!bundle) {
      res.status(400).json({ error: `Unknown app: "${appId}"` });
      return;
    }
    const { id, patch } = req.body as { id: string; patch: Record<string, unknown> };
    if (!id || typeof patch !== 'object') {
      res.status(400).json({ error: 'Body must be { id: string, patch: object }' });
      return;
    }
    bundle.store.simulateChange(id, patch);
    res.json({ ok: true });
  });

  return router;
}

function parseFilter(raw: string): FilterClause | null {
  // format: field:op:value  (value may contain colons)
  const idx1 = raw.indexOf(':');
  const idx2 = raw.indexOf(':', idx1 + 1);
  if (idx1 === -1 || idx2 === -1) return null;

  const field = raw.slice(0, idx1);
  const op = raw.slice(idx1 + 1, idx2) as FilterClause['op'];
  const rawValue = raw.slice(idx2 + 1);

  if (!['eq', 'neq', 'in', 'contains'].includes(op)) return null;

  const value = op === 'in' ? rawValue.split(',') : rawValue;
  return { field, op, value };
}
