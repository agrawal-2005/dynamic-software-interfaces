import { z } from 'zod';
import type { SidebarVocabulary } from './sidebar-spec.types';

/**
 * Builds a Zod schema for SidebarSpec from a given SidebarVocabulary.
 * Same pattern as buildViewSpecSchema — no sidebar item keys hardcoded here.
 *
 * Safety contract (same as ViewSpec):
 * - `key` must be one of the declared vocabulary keys
 * - `label` is a display-only rename, max 40 chars
 * - `visible: false` hides from the sidebar — never destroys workspace or data
 * - No create / delete / route-change verbs exist in this schema
 */
export function buildSidebarSpecSchema(vocab: SidebarVocabulary) {
  if (vocab.items.length === 0) {
    throw new Error('SidebarVocabulary must declare at least one item');
  }

  const keys = vocab.items.map((i) => i.key) as [string, ...string[]];

  return z.object({
    version: z.literal('1.0'),
    /** false = hide the entire sidebar panel; true (default) = visible. */
    visible: z.boolean().optional(),
    items: z
      .array(
        z.object({
          key:     z.enum(keys),
          label:   z.string().max(40).optional(),
          visible: z.boolean().default(true),
        }),
      )
      .min(1)
      .refine(
        (items) => new Set(items.map((i) => i.key)).size === items.length,
        { message: 'items must not contain duplicate keys' },
      ),
  });
}

export type SidebarSpecSchema = ReturnType<typeof buildSidebarSpecSchema>;
