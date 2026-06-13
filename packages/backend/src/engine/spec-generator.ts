import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AppVocabulary, BaseViewSpec } from '@dsi/shared';
import type { SpecValidator } from './spec-validator';

/**
 * SpecGenerator — engine class, domain-agnostic.
 *
 * Translates a plain-English description into a validated ViewSpec by:
 * 1. Building a system prompt entirely from the injected AppVocabulary.
 * 2. Calling the Gemini API (gemini-2.0-flash).
 * 3. Parsing the JSON response and running it through SpecValidator.assert().
 *
 * All domain strings (layout names, field keys, enum values) enter through
 * the vocabulary — this class contains no domain-specific literals.
 * The model provider is fully encapsulated: swapping it means touching only
 * this file and the constructor call in app-registry.ts.
 */
export class SpecGenerator {
  constructor(
    private readonly client: GoogleGenerativeAI,
    private readonly validator: SpecValidator,
    private readonly vocab: AppVocabulary,
  ) {}

  async generate(description: string): Promise<BaseViewSpec> {
    const model = this.client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: this.buildSystemPrompt(),
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: description }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
    });

    const text = result.response.text();
    const raw  = this.extractJson(text);
    // validator.assert() throws ValidatorError if the model output is invalid
    return this.validator.assert(raw);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * System prompt built entirely from AppVocabulary — no hardcoded domain strings.
   * The vocabulary descriptions, field types, and enum values teach the model
   * about this specific domain at runtime.
   */
  private buildSystemPrompt(): string {
    const layoutList = this.vocab.layouts
      .map((l) => {
        const note = l.requiresGroupBy ? ' (groupBy is required for this layout)' : '';
        return `  - "${l.name}": ${l.description}${note}`;
      })
      .join('\n');

    const fieldList = this.vocab.fields
      .map((f) => {
        const caps: string[] = [];
        if (f.filterable) caps.push('filterable');
        if (f.sortable)   caps.push('sortable');
        if (f.groupable)  caps.push('groupable');
        const vals  = f.enumValues ? ` Allowed values: [${f.enumValues.join(', ')}].` : '';
        const flags = caps.length ? ` [${caps.join(', ')}]` : '';
        return `  - "${f.key}" (${f.type}): ${f.description}.${vals}${flags}`;
      })
      .join('\n');

    const groupableKeys  = this.vocab.fields.filter((f) => f.groupable).map((f) => f.key);
    const filterableKeys = this.vocab.fields.filter((f) => f.filterable).map((f) => f.key);
    const sortableKeys   = this.vocab.fields.filter((f) => f.sortable).map((f) => f.key);

    return `You translate a user's plain-English interface description into a ViewSpec JSON object.

STRICT RULES:
- Output ONLY valid JSON. No markdown fences, no explanation text, just the JSON object.
- Every value must come from the allowed vocabulary below — nothing else.
- Filters HIDE data from view; they never delete or modify it.
- "label" on a field is a personal display rename only — it does not change the underlying key.
- If a layout requires groupBy, you MUST include a valid groupBy value.

ALLOWED VOCABULARY
==================

Layouts:
${layoutList}

Fields (key → type: description):
${fieldList}

groupBy — allowed keys: ${groupableKeys.join(', ') || '(none)'}
filters[].field — allowed keys: ${filterableKeys.join(', ') || '(none)'}
filters[].op — allowed values: eq, neq, in, contains
  eq/neq: value is a single string
  in: value is an array of strings
  contains: value is a single string (substring / tag match)
sort.field — allowed keys: ${sortableKeys.join(', ') || '(none)'}
sort.direction — allowed values: asc, desc
limit — integer between 1 and 200 (default 100)

OUTPUT SCHEMA (produce exactly this shape):
{
  "version": "1.0",
  "name": "<short descriptive label, max 80 chars>",
  "description": "<one sentence rationale, max 300 chars>",
  "layout": "<layout name>",
  "fields": [
    { "key": "<fieldKey>", "label": "<optional rename>", "visible": true }
  ],
  "groupBy": "<groupable key or omit entirely>",
  "filters": [
    { "field": "<filterable key>", "op": "<op>", "value": "<string or array>" }
  ],
  "sort": { "field": "<sortable key>", "direction": "asc|desc" },
  "limit": 100
}`.trim();
  }

  private extractJson(text: string): unknown {
    // Strip accidental markdown fences if the model adds them despite instructions
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error(`Model returned invalid JSON: ${cleaned.slice(0, 200)}`);
    }
  }
}
