import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * One surface's context sent to the AI for routing + spec generation.
 * Built by the route from the live app registry — no hardcoded names here.
 */
export interface SurfaceContext {
  /** Stable id used in the response: 'sidebar' | 'view' | custom. */
  id: string;
  /** Human-readable label, e.g. "Engineering · dashboard". */
  label: string;
  /** One sentence describing what this surface controls. */
  purpose: string;
  /** Compact text block listing all vocabulary items, fields, layouts, etc. */
  vocabText: string;
  /** The user's current spec for this surface (null = defaults apply). */
  currentSpec: unknown;
  /** JSON schema description for the spec this surface expects. Included verbatim in the AI prompt. */
  specSchema: string;
}

export type UnifiedResult =
  | {
      status: 'applied';
      targetSurface: string;
      rawSpec: unknown;
      message: string;
    }
  | {
      status: 'needs_clarification';
      question: string;
      options: Array<{ surface: string; label: string }>;
    };

/**
 * UnifiedGenerator — domain-agnostic, instantiated once at server startup.
 *
 * Sends all surface vocabularies to the AI in a single call.
 * The AI routes the message to the correct surface by meaning and vocabulary match —
 * not by keyword lists, regex, or word-count rules.
 *
 * Returns a validated result: either a ready-to-apply spec + target surface,
 * or a structured clarification request when two surfaces are plausible targets.
 */
export class UnifiedGenerator {
  constructor(private readonly client: GoogleGenerativeAI) {}

  async generate(
    message: string,
    activeSurface: string,
    surfaces: SurfaceContext[],
    forceSurface?: string,
  ): Promise<UnifiedResult> {
    const model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: this.buildSystemPrompt(surfaces, forceSurface),
    });

    const userPayload = JSON.stringify({
      message,
      activeSurface,
      ...(forceSurface ? { forceSurface } : {}),
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPayload }] }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1,
        // @ts-ignore — thinkingConfig is supported in gemini-2.5 but not yet typed
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return this.parse(result.response.text());
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private buildSystemPrompt(surfaces: SurfaceContext[], forceSurface?: string): string {
    const surfaceBlocks = surfaces
      .map((s) => {
        const specNote = s.currentSpec
          ? `Current spec:\n${JSON.stringify(s.currentSpec, null, 2)}`
          : 'Current spec: none (defaults apply)';
        return [
          `═══ SURFACE id="${s.id}" ═══`,
          `Label: ${s.label}`,
          `Controls: ${s.purpose}`,
          specNote,
          `Vocabulary:\n${s.vocabText}`,
          `Spec schema:\n${s.specSchema}`,
        ].join('\n');
      })
      .join('\n\n');

    const forceBlock = forceSurface
      ? `\n⚠ FORCED SURFACE: The user explicitly chose surface="${forceSurface}" after seeing a clarification prompt. ` +
        `Skip conflict detection entirely. Generate a spec for that surface and return status="applied".\n`
      : '';

    return `\
You are a multi-surface dashboard AI that both ROUTES user instructions to the correct surface
AND generates the spec change for that surface in a single call.

You receive a JSON object:
  "message"        — the user's plain-English instruction (no preprocessing applied)
  "activeSurface"  — the surface the user is currently viewing (WEAK HINT — can be overridden)
  "forceSurface"   — (optional) user explicitly chose this surface after clarification
${forceBlock}
════════════════════════════════════
AVAILABLE SURFACES
════════════════════════════════════
${surfaceBlocks}

════════════════════════════════════
ROUTING RULES  (follow in order)
════════════════════════════════════
1. Parse the message: identify the CONCEPTS, NAMES, and VALUES the user references.
2. For each surface, check whether those concepts appear in its vocabulary
   (item key, item label, field key, field label, field enum value, layout name).
3. Exactly one vocabulary match  →  status="applied", targetSurface=<that id>.
4. Two or more vocabulary matches →  status="needs_clarification".
5. No vocabulary match at all    →  fall back to activeSurface as the target.
6. Route by MEANING from the declared vocabulary — NOT by keyword lists, regex,
   word counts, or language. These rules are language-agnostic by design.

Conflict example: "hide product" — if "product" appears in BOTH a navigation surface's
item keys AND a data field's enumValues → needs_clarification with two named options.

Non-conflict example: "group by status" — "status" is a field key in exactly one
surface's vocabulary → route to that surface without asking.

════════════════════════════════════
OUTPUT  (ONLY valid JSON — no markdown fences, no prose)
════════════════════════════════════
On clear routing:
{
  "status": "applied",
  "targetSurface": "<surface id>",
  "spec": <complete spec object>,
  "message": "<plain English: WHAT changed and WHERE — location is mandatory, e.g. 'Hid Engineering from the sidebar', 'Grouped items by priority in the Engineering dashboard', 'Renamed in-progress to Doing in the view'>"
}

On ambiguity (two or more surfaces matched):
{
  "status": "needs_clarification",
  "question": "<specific question that names both candidates precisely>",
  "options": [
    { "surface": "<id>", "label": "<specific plain-English description of option A>" },
    { "surface": "<id>", "label": "<specific plain-English description of option B>" }
  ]
}`.trimEnd();
  }

  private parse(text: string): UnifiedResult {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let obj: Record<string, unknown>;
    try {
      const raw = JSON.parse(cleaned);
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error();
      obj = raw as Record<string, unknown>;
    } catch {
      throw new Error(`UnifiedGenerator returned invalid JSON: ${cleaned.slice(0, 300)}`);
    }

    if (obj.status === 'needs_clarification') {
      return {
        status: 'needs_clarification',
        question: String(obj.question ?? 'Please clarify your intent.'),
        options: Array.isArray(obj.options)
          ? (obj.options as Array<{ surface: string; label: string }>)
          : [],
      };
    }

    if (obj.status === 'applied') {
      const ts = String(obj.targetSurface ?? '');
      if (!ts) throw new Error('UnifiedGenerator: applied status missing targetSurface');
      return {
        status: 'applied',
        targetSurface: ts,
        rawSpec: obj.spec,
        message: String(obj.message ?? 'Applied.'),
      };
    }

    throw new Error(`UnifiedGenerator: unexpected status "${String(obj.status)}"`);
  }
}
