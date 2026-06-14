import { Router } from 'express';
import type { AppRegistry } from '../app/app-registry';
import { ValidatorError } from '../engine/spec-validator';

/**
 * POST /api/generate-spec
 * Body: { appId: string; description: string }
 *
 * Calls SpecGenerator for the requested domain, returns a validated ViewSpec.
 * The ANTHROPIC_API_KEY lives server-side only — never touches the frontend.
 */
export function agentRouter(registry: AppRegistry): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const { appId, description, currentSpec } = req.body as { appId?: string; description?: string; currentSpec?: unknown };

    if (!appId || typeof appId !== 'string') {
      res.status(400).json({ error: 'Body must include appId (string)' });
      return;
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ error: 'Body must include description (non-empty string)' });
      return;
    }

    const bundle = registry[appId];
    if (!bundle) {
      res.status(400).json({ error: `Unknown appId: "${appId}"` });
      return;
    }

    try {
      const spec = await bundle.generator.generate(description.trim(), currentSpec);
      res.json({ appId, spec });
    } catch (err) {
      if (err instanceof ValidatorError) {
        // The model returned JSON that failed Zod validation
        res.status(422).json({
          error: 'Agent returned an invalid ViewSpec',
          details: err.errors,
        });
        return;
      }
      console.error('SpecGenerator error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
      res.status(500).json({
        error: isQuota
          ? 'AI rate limit hit — wait a few seconds and try again'
          : 'Internal error during spec generation',
      });
    }
  });

  return router;
}
