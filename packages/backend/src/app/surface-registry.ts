import type { SidebarVocabulary } from '@dsi/shared';
import type { AppRegistry } from './app-registry';

// ── Nav tab definitions ───────────────────────────────────────────────────────
// Single source of truth for tab keys and labels.
// Referenced by the surface registry (vocab text) and the route (Zod validation).

export const NAV_TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'explorer',  label: 'Explorer'  },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings',  label: 'Settings'  },
] as const;

export type NavTabKey = typeof NAV_TABS[number]['key'];

// ── Spec schema strings (sent verbatim to the AI) ─────────────────────────────
// Defined once here; each SurfaceDef carries its own schema string.

const SIDEBAR_SPEC_SCHEMA =
  '{\n' +
  '  "version": "1.0",\n' +
  '  "visible": true|false,   // false = hide the ENTIRE panel; true = show it\n' +
  '  "items": [{ "key": "<item key>", "label": "<optional rename, omit if unchanged>", "visible": true|false }]\n' +
  '}\n' +
  'REQUIREMENT: every vocabulary item must appear in items[].\n' +
  'To restore the panel: set visible=true (and keep items as-is or restore them too).';

const NAV_SPEC_SCHEMA =
  '{\n' +
  '  "version": "1.0",\n' +
  '  "visible": true|false,   // false = hide the ENTIRE tab bar; true = show it\n' +
  '  "hiddenTabs": ["<tab key>", ...]\n' +
  '}\n' +
  'To hide the whole tab bar: set visible=false, hiddenTabs=[].\n' +
  'To show it again: set visible=true.\n' +
  'To hide individual tabs only: set visible=true, list the hidden tab keys in hiddenTabs.';

const VIEW_SPEC_SCHEMA =
  '{\n' +
  '  "version": "1.0",\n' +
  '  "name": "<short label ≤80 chars>",\n' +
  '  "layout": "<layout name>",\n' +
  '  "fields": [{ "key": "<field key>", "label": "<optional rename>", "visible": true|false }],\n' +
  '  "groupBy": "<groupable field key — REQUIRED when layout has requiresGroupBy=true (e.g. kanban), omit for other layouts>",\n' +
  '  "filters": [{ "field": "<filterable key>", "op": "eq|neq|in|contains", "value": "<string or string[]>" }],\n' +
  '  "sort": { "field": "<sortable key>", "direction": "asc|desc" },\n' +
  '  "limit": 100,\n' +
  '  "valueLabels": { "<fieldKey>": { "<rawValue>": "<display label ≤40 chars>" } }\n' +
  '}\n' +
  'If the surface has a currentSpec, treat it as the base and apply the message as\n' +
  'an INCREMENTAL modification — carry forward everything not mentioned.';

// ── Request context ───────────────────────────────────────────────────────────

/** Minimal per-request context passed to SurfaceDef methods that vary by request. */
export interface RequestContext {
  readonly appId:   string;
  readonly section: string;
}

// ── SurfaceDef ────────────────────────────────────────────────────────────────

/**
 * Static definition of one customizable surface, built once at startup.
 *
 * Fixed strings (id, label, purpose, specSchema, clarificationGuidance) are set
 * at construction and never change. The three methods that vary per-request are:
 *
 *   specKey       — which key to look up in currentSpecs
 *   buildLabel    — optional label override (e.g. append active section name)
 *   buildVocabText — inject current-spec state (visible/hidden flags) into the
 *                    pre-computed structural vocabulary string
 *
 * Adding a new platform surface type = add a new SurfaceDef to the registry.
 * No changes to the route or the AI prompt are required.
 */
export interface SurfaceDef {
  readonly id:                     string;
  readonly label:                  string;
  readonly purpose:                string;
  readonly specSchema:             string;
  /**
   * Per-surface instructions for generating clarification options when this
   * surface is one of multiple vocabulary matches. Included verbatim in the
   * surface block the AI sees — the generic prompt says "follow each surface's
   * clarificationGuidance". No option-generation rules live in the prompt itself.
   */
  readonly clarificationGuidance:  string;
  /** Return the key used to look up this surface's spec in currentSpecs. */
  specKey(ctx: RequestContext): string;
  /** Optional: build a request-specific label (e.g. "Engineering · dashboard"). */
  buildLabel?(ctx: RequestContext): string;
  /**
   * Build the vocab text for this surface given the current spec.
   * Structural vocabulary (which items/fields/tabs exist) is a pre-computed
   * closure. Only visible/hidden state varies per request.
   */
  buildVocabText(currentSpec: unknown): string;
}

export interface SurfaceRegistry {
  readonly sidebar: SurfaceDef;
  readonly nav:     SurfaceDef;
  readonly views:   Readonly<Record<string, SurfaceDef>>;
  /**
   * Return all surface definitions relevant for this request, in prompt order.
   * The route calls this to build SurfaceContext[] without naming any surface —
   * adding a new surface type requires only a registry change here.
   */
  resolve(appId: string, section: string): SurfaceDef[];
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Build the complete surface registry at server startup.
 *
 * After this call returns every surface definition is fully constructed.
 * The generate route calls `registry.resolve(appId, section)` and maps the
 * result to SurfaceContext[] — it names no surface itself.
 */
export function buildSurfaceRegistry(
  sidebarVocab: SidebarVocabulary,
  appRegistry:  AppRegistry,
): SurfaceRegistry {

  // ── Sidebar ────────────────────────────────────────────────────────────────
  // Item listing is pre-formatted at startup. Per request, only the
  // visible/hidden state of each item (from currentSpec) is injected.
  // All surface-specific behavior (option format, restore vocab) lives here
  // as clarificationGuidance and purpose — not in the AI prompt.

  const sidebar: SurfaceDef = {
    id:    'sidebar',
    label: 'Workspace navigation panel',
    purpose:
      'Controls the panel on the left side of the screen: ' +
      '(a) whether the entire panel is shown or hidden, and ' +
      '(b) which workspace items appear inside it. ' +
      'Phrases like "hide the sidebar", "remove the left panel", or "collapse the panel" ' +
      'map to hiding this surface (visible=false). ' +
      'Phrases like "show the sidebar", "bring back the panel", or "restore the sidebar" ' +
      'map to restoring it (visible=true). ' +
      'Hiding items is display-only — no workspace or data is deleted.',
    specSchema: SIDEBAR_SPEC_SCHEMA,
    clarificationGuidance:
      'List ONE option per currently-visible workspace item that could match the request, ' +
      'plus ONE option for the entire panel. Limit to 3 most relevant. Use this format:\n' +
      '  { label: "Hide [Item Name] from the panel",  hint: "Hide [Item Name] from the sidebar" }\n' +
      '  { label: "Hide the entire panel",            hint: "Hide the sidebar" }\n' +
      '  { label: "Restore [Item Name] in the panel", hint: "Show [Item Name] in the sidebar" }\n' +
      '  { label: "Restore the entire panel",         hint: "Show the sidebar" }',

    specKey(_ctx: RequestContext): string { return 'sidebar'; },

    buildVocabText(currentSpec: unknown): string {
      const panelVisible = (currentSpec as any)?.visible !== false;
      const itemLines = sidebarVocab.items.map((item) => {
        const specItem = Array.isArray((currentSpec as any)?.items)
          ? (currentSpec as any).items.find((s: any) => s.key === item.key)
          : null;
        const isVisible = specItem ? specItem.visible !== false : true;
        const rename    = specItem?.label ? ` (renamed to "${specItem.label}")` : '';
        return (
          `  - key="${item.key}" defaultLabel="${item.label}" ` +
          `currently: ${isVisible ? 'visible' : 'hidden'}${rename}`
        );
      });
      return (
        `Panel: currently ${panelVisible ? 'visible' : 'HIDDEN (entire panel is not shown)'}\n` +
        'Workspace items inside the panel (can be hidden, shown, renamed, or reordered):\n' +
        itemLines.join('\n')
      );
    },
  };

  // ── Nav ────────────────────────────────────────────────────────────────────
  // Tab listing is fixed. Per request, only hidden/visible state per tab
  // is injected. The QUALIFIER NOTE in vocabText teaches the AI when tab names
  // are section qualifiers (not targets) — this was previously a hardcoded rule
  // in the system prompt; it now lives as surface data.

  const nav: SurfaceDef = {
    id:    'nav',
    label: 'Section tab bar',
    purpose:
      'Controls the horizontal tab bar at the top: ' +
      '(a) whether the ENTIRE tab bar is shown or hidden, and ' +
      '(b) which individual section tabs appear inside it. ' +
      'Phrases like "hide the navbar", "remove the tab bar", or "collapse the top bar" ' +
      'map to hiding this surface (visible=false). ' +
      'Phrases like "show the navbar", "bring back the tabs", or "restore the nav" ' +
      'map to restoring it (visible=true). ' +
      'Hiding this surface or individual tabs is display-only — data is never deleted.',
    specSchema: NAV_SPEC_SCHEMA,
    clarificationGuidance:
      'List ONE option per currently-visible tab that could match the request, ' +
      'plus ONE option for the entire tab bar. Limit to 3 most relevant. Use this format:\n' +
      '  { label: "Hide [Tab Name] tab",          hint: "Hide [Tab Name] tab" }\n' +
      '  { label: "Hide the entire tab bar",       hint: "Hide the navbar" }\n' +
      '  { label: "Restore [Tab Name] tab",        hint: "Show [Tab Name] tab" }\n' +
      '  { label: "Restore the entire tab bar",    hint: "Show the navbar" }',

    specKey(_ctx: RequestContext): string { return 'nav'; },

    buildVocabText(currentSpec: unknown): string {
      const barVisible = (currentSpec as any)?.visible !== false;
      const tabLines = NAV_TABS.map((tab) => {
        const hidden =
          Array.isArray((currentSpec as any)?.hiddenTabs) &&
          (currentSpec as any).hiddenTabs.includes(tab.key);
        return `  - key="${tab.key}" label="${tab.label}" currently: ${hidden ? 'hidden' : 'visible'}`;
      });
      return (
        `Tab bar: currently ${barVisible ? 'visible' : 'HIDDEN (entire tab bar is not shown)'}\n` +
        'Individual section tabs (can be hidden or shown):\n' +
        tabLines.join('\n') +
        '\nQUALIFIER NOTE: The tab labels above also appear as section names in user messages. ' +
        'When a message references a tab label alongside a layout name, a display verb, or a ' +
        'data operation (not a visibility verb), the tab label is acting as a SECTION QUALIFIER ' +
        '— identifying which section to change — not as a target of this surface. ' +
        'Route to the view surface in that case. ' +
        'Only route to this surface when the operation is a VISIBILITY verb: ' +
        'hide, show, remove, restore, bring back, collapse, expand.'
      );
    },
  };

  // ── Views (one per registered domain) ─────────────────────────────────────
  // Layout + field text is pre-formatted once per domain at startup and
  // captured in a closure. specKey returns the active section (request-specific).
  // buildLabel appends the section name so the AI knows which tab is active.

  const views: Record<string, SurfaceDef> = {};

  for (const [appId, bundle] of Object.entries(appRegistry)) {
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

    // Pre-computed once; captured in closure — never recomputed at request time.
    const staticVocabText =
      `Layouts:\n${layoutLines.join('\n')}\n\nFields:\n${fieldLines.join('\n')}`;

    views[appId] = {
      id:    'view',
      label: domainLabel,
      purpose:
        `Controls the data display in the ${domainLabel} workspace: ` +
        'layout, filters, grouping, column visibility, sort order, and value display labels. ' +
        'Filters hide data from the view only — underlying records are never modified.',
      specSchema: VIEW_SPEC_SCHEMA,
      clarificationGuidance:
        'Include one option that names the specific layout or field the message implies. ' +
        'Use complete, self-contained hints:\n' +
        '  { label: "Change this view to [layout name] layout", hint: "Make it a [layout name]" }\n' +
        '  { label: "Group items by [field description]",       hint: "Group by [field key]" }\n' +
        '  { label: "Filter to [field description] = [value]",  hint: "Show only [value] [field description]" }',

      specKey(ctx: RequestContext): string { return ctx.section; },

      buildLabel(ctx: RequestContext): string { return `${domainLabel} · ${ctx.section}`; },

      buildVocabText(_currentSpec: unknown): string {
        // View vocabulary is purely structural — layouts and fields are fixed at startup.
        return staticVocabText;
      },
    };
  }

  return {
    sidebar,
    nav,
    views,
    /**
     * Return all surfaces for this request in prompt order.
     * Extend this method (and add surface defs above) to add new surface types —
     * the route and the AI prompt require no changes.
     */
    resolve(appId: string, _section: string): SurfaceDef[] {
      const view = views[appId];
      return view ? [sidebar, view, nav] : [sidebar, nav];
    },
  };
}
