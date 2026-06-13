import { Router } from 'express';
import type { AppRegistry } from '../app/app-registry';

/**
 * GET /api/schema?app=<id>
 * Returns the vocabulary (layouts + fields) for a domain.
 * The frontend uses this to show field hints in the InterfaceBuilder.
 */
export function schemaRouter(registry: AppRegistry): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const appId = String(req.query['app'] ?? '');
    const bundle = registry[appId];
    if (!bundle) {
      res.status(400).json({ error: `Unknown app: "${appId}". Valid apps: ${Object.keys(registry).join(', ')}` });
      return;
    }
    res.json({ appId, vocabulary: bundle.vocabulary });
  });

  return router;
}
