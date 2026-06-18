import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * One surface's context sent to the AI for routing + spec generation.
 * Assembled per-request from SurfaceDef; contains no hardcoded surface names.
 */
export interface SurfaceContext {
  /** Stable id used in the response. Matches the SurfaceDef id. */
  id: string;
  /** Human-readable label, e.g. "Engineering · dashboard". */
  label: string;
  /** One sentence describing what this surface controls. */
  purpose: string;
  /** Compact text block listing all vocabulary items, fields, layouts, etc. */
  vocabText: string;
  /** The user's current spec for this surface (null = defaults apply). */
  currentSpec: unknown;
  /** JSON schema description for the spec this surface expects. */
  specSchema: string;
  /**
   * Per-surface instructions for generating clarification options when this
   * surface is one of multiple ambiguous matches.
   * The generic prompt defers entirely to this field — no surface-specific
   * option rules live in the prompt itself.
   */
  clarificationGuidance: string;
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
 * UnifiedGenerator — platform-agnostic, instantiated once at server startup.
 *
 * Sends all surface contexts to the AI in a single call.
 * The AI routes the message to the correct surface by vocabulary meaning,
 * generates a spec, and returns either:
 *   - a ready-to-apply spec + target surface, or
 *   - a structured clarification request when two surfaces are plausible targets.
 *
 * The system prompt contains NO surface names, NO surface-specific routing rules,
 * and NO per-surface option generation rules. All surface-specific behavior is
 * carried in each SurfaceContext (purpose, vocabText, clarificationGuidance).
 * Adding a new platform surface type requires only a registry change — not a
 * prompt change.
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

    const MAX_ATTEMPTS = 3;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: userPayload }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.1,
            responseMimeType: 'application/json',
            // @ts-ignore — thinkingConfig is supported in gemini-2.5 but not yet in SDK types
            thinkingConfig: { thinkingBudget: 0 },
          },
        });
        return this.parse(result.response.text());
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient =
          msg.includes('503') ||
          msg.toLowerCase().includes('service unavailable') ||
          msg.toLowerCase().includes('high demand');

        if (isTransient && attempt < MAX_ATTEMPTS) {
          const delayMs = attempt * 1500; // 1.5s, 3s
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }

    throw lastErr;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private buildSystemPrompt(surfaces: SurfaceContext[], forceSurface?: string): string {
    // Each surface block includes all per-surface metadata so the prompt itself
    // needs no surface-specific rules. clarificationGuidance is emitted here and
    // the generic CLARIFICATION section below references it by name.
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
          `Clarification guidance:\n${s.clarificationGuidance}`,
        ].join('\n');
      })
      .join('\n\n');

    const forceBlock = forceSurface
      ? `\n⚠ FORCED SURFACE: The user explicitly chose surface="${forceSurface}" after seeing a ` +
        `clarification prompt. Skip conflict detection entirely. Generate a spec for that surface ` +
        `and return status="applied".\n`
      : '';

    return `\
You are a multi-surface AI that both ROUTES user instructions to the correct surface
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
   Map non-technical language to vocabulary by MEANING — not by keyword matching.
   Each surface's vocabulary descriptions contain synonym hints; use them.
   Examples of meaning-mapping (apply the same reasoning to any vocabulary):
     "the person doing it" / "who's responsible" → the field whose description means "owner/assignee"
     "what stage" / "where it is in the process" → the field whose description means "status/phase"
     "tiles" / "boxes" / "rectangles" → the layout whose description mentions "grid" or "cards"
     "board" / "swimlanes" / "sticky notes" → the layout whose description mentions "columns"
     "list" / "spreadsheet" / "rows" → the layout whose description mentions "table" or "tabular"
     "feed" / "log" / "recent activity" → the layout whose description mentions "stream" or "feed"
2. For each surface, check whether those concepts appear in its vocabulary
   (item key, item label, field key, field label, field enum value, layout name).
   STRICT MATCH RULE: a surface matches only when the user's concept maps to a term
   EXPLICITLY DECLARED in that surface's vocabulary. Semantic inference (rule 1) is
   for translating user phrasing into declared terms — it CANNOT create new vocabulary
   items. If a concept does not appear in a surface's declared vocabulary, that surface
   does NOT match, regardless of how plausible it sounds.
   Example: if a surface lists items [A, B, C] and the user says "hide D", D is NOT
   a match for that surface even if D sounds like it could belong there.
3. Exactly one vocabulary match  →  status="applied", targetSurface=<that id>.
4. Two or more vocabulary matches →  status="needs_clarification".
5. No vocabulary match at all    →  fall back to activeSurface as the target.
6. Route by MEANING from the declared vocabulary — NOT by keyword lists, regex,
   word counts, or language. These rules are language-agnostic by design.
7. Each surface's vocabulary text may include QUALIFIER NOTES. Read them before
   routing. A term that appears in a surface's vocabulary may sometimes act as a
   qualifier (identifying the context for the change) rather than as a target
   (the thing being changed). The surface's vocabulary notes specify when this applies.

════════════════════════════════════
CLARIFICATION OPTIONS
════════════════════════════════════
When two or more surfaces match (status="needs_clarification"):
  - For each matching surface, follow THAT SURFACE'S "Clarification guidance" to
    determine exactly what options to generate.
  - Each option must include:
      surface — the surface id
      label   — a specific plain-English description of what this option does
      hint    — the complete, self-contained message to send when the user picks it
  - The hint IS the message the system will re-send — make it unambiguous and actionable.
  - Limit total options to the 3–5 most relevant across all matching surfaces.

When the message is a bare verb with NO specific target:
  Generate options across ALL surfaces using each surface's clarification guidance.
  Never restrict options to only one surface.

════════════════════════════════════
UNMAPPABLE REQUESTS — graceful fallback
════════════════════════════════════
If you cannot map the user's request to any surface vocabulary after honest effort:
  - Return status="applied" with the UNCHANGED currentSpec for the active surface.
  - Write a helpful message that:
    (a) Acknowledges what you CANNOT do.
    (b) Offers the CLOSEST supported alternative using field DESCRIPTIONS, not raw keys.
        BAD:  "I can filter by 'priority' or group by 'assignee'."
        GOOD: "I can highlight by urgency level, or group items by who they're assigned to."
    (c) Ends with a question: "Want me to try that?"
  - NEVER expose raw field keys in the message.
    Always use their human-readable descriptions from the vocabulary.

════════════════════════════════════
OUTPUT  (ONLY valid JSON — no markdown fences, no prose)
════════════════════════════════════
On clear routing:
{
  "status": "applied",
  "targetSurface": "<surface id>",
  "spec": <complete spec object>,
  "message": "<plain English: WHAT changed and WHERE — location is mandatory>"
}

On ambiguity (two or more surfaces matched):
{
  "status": "needs_clarification",
  "question": "<specific question that names both candidates precisely>",
  "options": [
    {
      "surface": "<id>",
      "label": "<specific plain-English description>",
      "hint": "<the complete, self-contained message to act on>"
    }
  ]
}`.trimEnd();
  }

  private parse(text: string): UnifiedResult {
    // Strip markdown fences if present
    let cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    // Fallback: extract the outermost {...} block in case the model prepended prose
    if (!cleaned.startsWith('{')) {
      const start = cleaned.indexOf('{');
      const end   = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
    }

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
        status:   'needs_clarification',
        question: String(obj.question ?? 'Please clarify your intent.'),
        options:  Array.isArray(obj.options)
          ? (obj.options as Array<{ surface: string; label: string }>)
          : [],
      };
    }

    if (obj.status === 'applied') {
      const ts = String(obj.targetSurface ?? '');
      if (!ts) throw new Error('UnifiedGenerator: applied status missing targetSurface');
      return {
        status:        'applied',
        targetSurface: ts,
        rawSpec:       obj.spec,
        message:       String(obj.message ?? 'Applied.'),
      };
    }

    throw new Error(`UnifiedGenerator: unexpected status "${String(obj.status)}"`);
  }
}
