import { Router } from 'express';
import type { SidebarGenerator } from '../engine/sidebar-generator';
import { SidebarValidatorError } from '../engine/sidebar-generator';

/**
 * POST /api/generate-sidebar-spec
 * Body: { description: string; currentSpec?: SidebarSpec }
 *
 * Returns a validated SidebarSpec. The sidebar generator is a singleton
 * (not per-domain) — the sidebar is a user-level surface, not domain-scoped.
 */
export function sidebarAgentRouter(generator: SidebarGenerator): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const { description, currentSpec } = req.body as {
      description?: string;
      currentSpec?: unknown;
    };

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({ error: 'Body must include description (non-empty string)' });
      return;
    }

    try {
      const spec = await generator.generate(description.trim(), currentSpec);
      res.json({ spec });
    } catch (err) {
      if (err instanceof SidebarValidatorError) {
        res.status(422).json({ error: 'Agent returned an invalid SidebarSpec', details: err.errors });
        return;
      }
      console.error('SidebarGenerator error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
      res.status(500).json({
        error: isQuota
          ? 'AI rate limit hit — wait a few seconds and try again'
          : 'Internal error during sidebar spec generation',
      });
    }
  });

  return router;
}
