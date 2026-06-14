import { Router } from 'express';
import { ZodError } from 'zod';
import { buildSidebarSpecSchema } from '@dsi/shared';
import type { SidebarVocabulary } from '@dsi/shared';
import type { AppRegistry } from '../app/app-registry';
import type { UnifiedGenerator, SurfaceContext } from '../engine/unified-generator';
import { ValidatorError } from '../engine/spec-validator';

/**
 * POST /api/generate
 *
 * Unified routing + spec-generation endpoint. The frontend sends:
 *   - the user's raw message
 *   - appId + activeSurface (weak hint)
 *   - current specs for all active surfaces
 *   - (optional) forceSurface — set after user resolves a needs_clarification
 *
 * The backend builds all surface vocabularies from the live app registry,
 * calls UnifiedGenerator (which routes and generates in one AI call),
 * validates the returned spec against the target surface's schema,
 * and returns one of:
 *
 *   { status: "applied",              targetSurface, spec, message }
 *   { status: "needs_clarification",  question, options }
 *
 * The frontend applies the spec to the returned surface — it makes no
 * routing decision of its own.
 */
export function generateRouter(
  registry: AppRegistry,
  sidebarVocab: SidebarVocabulary,
  unifiedGen: UnifiedGenerator,
): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const { message, appId, activeSurface, currentSpecs, forceSurface } = req.body as {
      message?: string;
      appId?: string;
      activeSurface?: string;
      currentSpecs?: Record<string, unknown>;
      forceSurface?: string;
    };

    // ── Validate inputs ─────────────────────────────────────────────────────
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Body must include message (non-empty string)' });
      return;
    }
    if (!appId || typeof appId !== 'string') {
      res.status(400).json({ error: 'Body must include appId (string)' });
      return;
    }

    const bundle = registry[appId];
    if (!bundle) {
      res.status(400).json({ error: `Unknown appId: "${appId}"` });
      return;
    }

    const specs   = currentSpecs ?? {};
    const section = typeof activeSurface === 'string' && activeSurface ? activeSurface : 'dashboard';

    // ── Build surface contexts from live app registry ────────────────────────

    // 1. Sidebar surface — vocabulary derived from the registry automatically
    const sidebarSpec = specs['sidebar'] ?? null;
    const sidebarItemLines = sidebarVocab.items.map((item) => {
      const specItem = Array.isArray((sidebarSpec as any)?.items)
        ? (sidebarSpec as any).items.find((s: any) => s.key === item.key)
        : null;
      const isVisible = specItem ? specItem.visible !== false : true;
      const rename    = specItem?.label ? ` (renamed to "${specItem.label}")` : '';
      return `  - key="${item.key}" defaultLabel="${item.label}" currently: ${isVisible ? 'visible' : 'hidden'}${rename}`;
    });

    const sidebarCtx: SurfaceContext = {
      id:      'sidebar',
      label:   'Sidebar navigation',
      purpose: 'Controls which workspace items appear in the left navigation panel. ' +
               'hide/show = display only — no workspace or data is deleted.',
      vocabText:
        'Items (can be hidden, shown, renamed, or reordered):\n' +
        sidebarItemLines.join('\n'),
      currentSpec: sidebarSpec,
    };

    // 2. View surface — active domain vocabulary
    const { vocabulary: vocab, label: domainLabel } = bundle;

    const layoutLines = vocab.layouts.map(
      (l) => `  - "${l.name}": ${l.description}${l.requiresGroupBy ? ' (groupBy required)' : ''}`,
    );

    const fieldLines = vocab.fields.map((f) => {
      const caps: string[] = [];
      if (f.filterable) caps.push('filterable');
      if (f.sortable)   caps.push('sortable');
      if (f.groupable)  caps.push('groupable');
      const vals  = f.enumValues ? ` enumValues=[${f.enumValues.join(', ')}]` : '';
      const flags = caps.length  ? ` [${caps.join(', ')}]`                    : '';
      return `  - key="${f.key}" type=${f.type}${vals} label="${f.description}"${flags}`;
    });

    const viewCtx: SurfaceContext = {
      id:      'view',
      label:   `${domainLabel} · ${section}`,
      purpose: `Controls the data display in the ${domainLabel} workspace: ` +
               'layout, filters, grouping, column visibility, sort order, and value display labels. ' +
               'Filters hide data from the view only — underlying records are never modified.',
      vocabText:
        `Layouts:\n${layoutLines.join('\n')}\n\nFields:\n${fieldLines.join('\n')}`,
      currentSpec: specs[section] ?? null,
    };

    // ── Call unified generator ───────────────────────────────────────────────
    try {
      const result = await unifiedGen.generate(
        message.trim(),
        section,
        [sidebarCtx, viewCtx],
        typeof forceSurface === 'string' ? forceSurface : undefined,
      );

      // Needs clarification — return immediately, frontend renders choice UI
      if (result.status === 'needs_clarification') {
        res.json(result);
        return;
      }

      const { targetSurface, rawSpec, message: confirmMsg } = result;

      // ── Validate the spec against the target surface's schema ──────────────
      let validatedSpec: unknown;

      if (targetSurface === 'sidebar') {
        try {
          validatedSpec = buildSidebarSpecSchema(sidebarVocab).parse(rawSpec);
        } catch (err) {
          const details = err instanceof ZodError
            ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
            : [String(err)];
          res.status(422).json({
            error: 'AI returned an invalid SidebarSpec',
            details,
          });
          return;
        }
      } else {
        // view surface — use domain SpecValidator (built from AppVocabulary)
        try {
          validatedSpec = bundle.validator.assert(rawSpec);
        } catch (err) {
          if (err instanceof ValidatorError) {
            res.status(422).json({
              error: 'AI returned an invalid ViewSpec',
              details: err.errors,
            });
            return;
          }
          throw err;
        }
      }

      res.json({
        status:        'applied',
        targetSurface,
        spec:          validatedSpec,
        message:       confirmMsg,
      });
    } catch (err) {
      console.error('[/api/generate] error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota =
        msg.includes('429') ||
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('rate limit');
      res.status(500).json({
        error: isQuota
          ? 'AI rate limit hit — wait a few seconds and try again'
          : 'Internal error during generation',
      });
    }
  });

  return router;
}
