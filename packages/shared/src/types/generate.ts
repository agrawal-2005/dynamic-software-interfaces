/**
 * Shared contract for POST /api/generate — the unified routing + spec-generation endpoint.
 *
 * The backend AI receives all surface vocabularies, reasons about the message,
 * and returns BOTH the target surface AND the validated spec.
 * The frontend sends raw context and applies whatever comes back — it makes no
 * routing decisions of its own.
 */

export interface ClarificationOption {
  /** Surface id this option targets (e.g. 'sidebar', 'view'). */
  surface: string;
  /** Plain-English description of what this option does — shown as a button label. */
  label: string;
}

/**
 * POST /api/generate response.
 *
 * status='applied'
 *   → spec was generated and validated; frontend applies it to targetSurface.
 *
 * status='needs_clarification'
 *   → AI found two or more plausible targets; frontend shows question + option buttons.
 *     The user's pick is sent back as a new request with forceSurface set.
 */
export type GenerateResponse =
  | {
      status: 'applied';
      /** 'sidebar' or 'view' — tells the frontend which slot to write the spec into. */
      targetSurface: string;
      spec: unknown;
      /** Human-readable summary: WHAT changed and WHERE, e.g. "Hid Engineering from the sidebar". */
      message: string;
    }
  | {
      status: 'needs_clarification';
      question: string;
      options: ClarificationOption[];
    };

/** POST /api/generate request body. */
export interface GenerateRequest {
  /** The user's raw message — no preprocessing, no intent extraction. */
  message: string;
  /** Active app domain id, e.g. 'engineering'. */
  appId: string;
  /** Currently visible section, e.g. 'dashboard'. Weak hint only — backend may override. */
  activeSurface: string;
  /**
   * Current spec for each surface, keyed by surface id.
   * 'sidebar' → SidebarSpec | null
   * <sectionName> → BaseViewSpec | null
   */
  currentSpecs: Record<string, unknown>;
  /**
   * Set when the user has resolved a needs_clarification prompt by picking an option.
   * Tells the backend to skip conflict detection and generate for this surface directly.
   */
  forceSurface?: string;
}
