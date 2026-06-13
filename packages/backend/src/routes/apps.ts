import { Router } from 'express';
import type { AppRegistry } from '../app/app-registry';

/**
 * GET /api/apps
 * Returns the list of registered domains for the frontend DomainSelector.
 */
export function appsRouter(registry: AppRegistry): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const apps = Object.values(registry).map(({ id, label }) => ({ id, label }));
    res.json({ apps });
  });

  return router;
}
