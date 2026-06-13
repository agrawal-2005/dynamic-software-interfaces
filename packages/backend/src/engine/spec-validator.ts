import { buildViewSpecSchema } from '@dsi/shared';
import type { AppVocabulary, BaseViewSpec } from '@dsi/shared';

export type ValidationResult =
  | { ok: true;  spec: BaseViewSpec }
  | { ok: false; errors: string[] };

export class ValidatorError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid ViewSpec:\n${errors.join('\n')}`);
    this.name = 'ValidatorError';
  }
}

/**
 * SpecValidator — engine class, domain-agnostic.
 *
 * Constructed with an AppVocabulary; calls buildViewSpecSchema() once to
 * freeze the concrete Zod schema. Subsequent validate() calls are cheap.
 * The validator knows no domain strings — the vocabulary carries them.
 */
export class SpecValidator {
  private readonly schema: ReturnType<typeof buildViewSpecSchema>;

  constructor(vocab: AppVocabulary) {
    this.schema = buildViewSpecSchema(vocab);
  }

  validate(raw: unknown): ValidationResult {
    const result = this.schema.safeParse(raw);
    if (result.success) {
      return { ok: true, spec: result.data as BaseViewSpec };
    }
    const errors = result.error.errors.map(
      (e) => `${e.path.join('.') || '(root)'}: ${e.message}`,
    );
    return { ok: false, errors };
  }

  /** Throws ValidatorError on failure — used inside SpecGenerator. */
  assert(raw: unknown): BaseViewSpec {
    const r = this.validate(raw);
    if (!r.ok) throw new ValidatorError(r.errors);
    return r.spec;
  }
}
