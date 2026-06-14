import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSidebarSpecSchema } from '@dsi/shared';
import type { SidebarVocabulary, SidebarSpec } from '@dsi/shared';
import { ZodError } from 'zod';

export class SidebarValidatorError extends Error {
  constructor(public readonly errors: string[]) {
    super(`SidebarSpec validation failed: ${errors.join('; ')}`);
  }
}

/**
 * SidebarGenerator — domain-agnostic, instantiated once at server startup.
 *
 * Translates plain-English sidebar requests into a SidebarSpec:
 * "hide product and finance" → { version:'1.0', items:[{key:'engineering',visible:true},{key:'product',visible:false},...] }
 *
 * Safety boundary: the schema has no verbs for creating, deleting, or
 * re-routing workspaces. Hiding is display-only.
 */
export class SidebarGenerator {
  private readonly schema: ReturnType<typeof buildSidebarSpecSchema>;

  constructor(
    private readonly client: GoogleGenerativeAI,
    private readonly vocab: SidebarVocabulary,
  ) {
    this.schema = buildSidebarSpecSchema(vocab);
  }

  async generate(description: string, currentSpec?: unknown): Promise<SidebarSpec> {
    const model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: this.buildSystemPrompt(),
    });

    const userText = currentSpec
      ? `CURRENT_SPEC:\n${JSON.stringify(currentSpec, null, 2)}\n\nINSTRUCTION: ${description}`
      : description;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.1,
        // @ts-ignore — thinkingConfig supported in gemini-2.5, not yet typed
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = result.response.text();
    const raw  = this.extractJson(text);
    return this.assertValid(raw);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private buildSystemPrompt(): string {
    const itemList = this.vocab.items
      .map((i) => `  - key="${i.key}" label="${i.label}"`)
      .join('\n');

    return `You translate a user's plain-English sidebar customisation request into a SidebarSpec JSON object.

STRICT RULES:
- Output ONLY valid JSON. No markdown fences, no explanation text, just the JSON object.
- Every key must come from the vocabulary below — nothing else.
- visible: false hides the item from the sidebar only — it NEVER deletes, disables, or changes any workspace or its data.
- label is a personal display rename only — it does not change routing or the workspace key.
- You must always include ALL vocabulary items in the output, with visible set appropriately.
- If CURRENT_SPEC is provided, use it as the base and apply only the INSTRUCTION as an incremental change.

AVAILABLE SIDEBAR ITEMS:
${itemList}

OUTPUT SCHEMA (produce exactly this shape):
{
  "version": "1.0",
  "items": [
    { "key": "<item key>", "label": "<optional rename>", "visible": true|false }
  ]
}

Always include every item from the vocabulary in the output items array.`.trim();
  }

  private extractJson(text: string): unknown {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error(`SidebarGenerator returned invalid JSON: ${cleaned.slice(0, 200)}`);
    }
  }

  private assertValid(raw: unknown): SidebarSpec {
    try {
      return this.schema.parse(raw) as SidebarSpec;
    } catch (err) {
      if (err instanceof ZodError) {
        throw new SidebarValidatorError(err.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
      }
      throw err;
    }
  }
}
