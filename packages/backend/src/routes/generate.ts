import { Router } from 'express';
import { z, ZodError } from 'zod';
import { buildSidebarSpecSchema } from '@dsi/shared';
import type { SidebarVocabulary } from '@dsi/shared';
import type { AppRegistry } from '../app/app-registry';
import type { SurfaceRegistry } from '../app/surface-registry';
import { NAV_TABS } from '../app/surface-registry';
import type { RequestContext } from '../app/surface-registry';
import type { UnifiedGenerator } from '../engine/unified-generator';
import { ValidatorError } from '../engine/spec-validator';

// Zod schema for NavSpec validation — tab keys derived from the single source of truth.
const navTabKeys = NAV_TABS.map((t) => t.key) as [string, ...string[]];
const navSpecSchema = z.object({
  version:    z.literal('1.0'),
  visible:    z.boolean().optional(),
  hiddenTabs: z.array(z.enum(navTabKeys)),
});

/**
 * POST /api/generate
 *
 * Unified routing + spec-generation endpoint. The frontend sends:
 *   - the user's raw message
 *   - appId + activeSurface (weak hint)
 *   - current specs for all active surfaces
 *   - (optional) forceSurface — set after user resolves a needs_clarification
 *
 * Surface contexts are assembled from pre-built SurfaceDefs in the SurfaceRegistry
 * (defined once at startup). The route's only per-request work is injecting
 * currentSpec into each def and forwarding to UnifiedGenerator.
 *
 * Returns:
 *   { status: "applied",              targetSurface, spec, message }
 *   { status: "needs_clarification",  question, options }
 */
export function generateRouter(
  registry:        AppRegistry,
  surfaceRegistry: SurfaceRegistry,
  sidebarVocab:    SidebarVocabulary,
  unifiedGen:      UnifiedGenerator,
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

    // ── Assemble surface contexts generically from the registry ─────────────
    //
    // surfaceRegistry.resolve() returns all surface definitions for this request.
    // Each def knows its own spec key and label strategy — the route names nothing.
    // Adding a new surface type requires only a change in surface-registry.ts.

    const ctx: RequestContext = { appId, section };
    const surfaces = surfaceRegistry.resolve(appId, section).map((def) => {
      const spec = specs[def.specKey(ctx)] ?? null;
      return {
        id:                    def.id,
        label:                 def.buildLabel?.(ctx) ?? def.label,
        purpose:               def.purpose,
        specSchema:            def.specSchema,
        clarificationGuidance: def.clarificationGuidance,
        vocabText:             def.buildVocabText(spec),
        currentSpec:           spec,
      };
    });

    // ── Pre-filter surfaces to prevent hallucinated clarification options ─────
    //
    // The AI can infer that any word "sounds like" a sidebar item even when it
    // isn't declared. Guard against this deterministically: exclude the sidebar
    // surface from the AI's context when the message cannot plausibly reference
    // it (no declared item key/label match, no panel-visibility keywords).
    // forceSurface always bypasses this check.

    const activeSurfaces = forceSurface
      ? surfaces
      : (() => {
          const msgLower = message.toLowerCase().trim();

          // Keep sidebar only if the message references a declared item or panel keywords.
          const couldTargetSidebar =
            sidebarVocab.items.some(
              (item) =>
                msgLower.includes(item.key.toLowerCase()) ||
                msgLower.includes(item.label.toLowerCase()),
            ) ||
            ['sidebar', 'panel', 'left', 'navigation'].some((kw) => msgLower.includes(kw));

          // Keep nav only if the message references a declared tab or nav-bar keywords.
          const couldTargetNav =
            NAV_TABS.some(
              (tab) =>
                msgLower.includes(tab.key.toLowerCase()) ||
                msgLower.includes(tab.label.toLowerCase()),
            ) ||
            ['navbar', 'tab bar', 'tab', 'top bar'].some((kw) => msgLower.includes(kw));

          return surfaces.filter((s) => {
            if (s.id === 'sidebar') return couldTargetSidebar;
            if (s.id === 'nav')     return couldTargetNav;
            return true;
          });
        })();

    // ── Call unified generator ───────────────────────────────────────────────
    try {
      const result = await unifiedGen.generate(
        message.trim(),
        section,
        activeSurfaces,
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
          res.status(422).json({ error: 'AI returned an invalid SidebarSpec', details });
          return;
        }
      } else if (targetSurface === 'nav') {
        try {
          validatedSpec = navSpecSchema.parse(rawSpec);
        } catch (err) {
          const details = err instanceof ZodError
            ? err.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
            : [String(err)];
          res.status(422).json({ error: 'AI returned an invalid NavSpec', details });
          return;
        }
      } else {
        // view surface — domain SpecValidator (built from AppVocabulary)
        try {
          validatedSpec = bundle.validator.assert(rawSpec);
        } catch (err) {
          if (err instanceof ValidatorError) {
            res.status(422).json({ error: 'AI returned an invalid ViewSpec', details: err.errors });
            return;
          }
          throw err;
        }
      }

      // Compute storage coordinates so the frontend needs no surface-name knowledge.
      const targetAppId   = targetSurface === 'sidebar' ? 'global' : appId;
      const targetSection = targetSurface === 'sidebar' ? 'sidebar'
                          : targetSurface === 'nav'     ? 'nav'
                          : section;

      res.json({
        status:        'applied',
        targetSurface,
        targetAppId,
        targetSection,
        spec:          validatedSpec,
        message:       confirmMsg,
      });
    } catch (err) {
      console.error('[/api/generate] error:', err);
      const msg  = err instanceof Error ? err.message : String(err);
      const lmsg = msg.toLowerCase();
      const isQuota     = msg.includes('429') || lmsg.includes('quota') || lmsg.includes('rate limit');
      const isTransient = msg.includes('503') || lmsg.includes('service unavailable') || lmsg.includes('high demand') || lmsg.includes('try again later');
      res.status(isTransient ? 503 : 500).json({
        error: isQuota
          ? 'AI rate limit hit — wait a few seconds and try again'
          : isTransient
          ? 'Gemini is temporarily overloaded — please try again in a moment'
          : 'Internal error during generation',
      });
    }
  });

  return router;
}
