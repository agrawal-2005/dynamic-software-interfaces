/**
 * NavSpec — per-domain navigation tab visibility spec.
 * Controls which section tabs (Dashboard, Explorer, Analytics, Settings)
 * appear in the domain navigation bar.
 */
export interface NavSpec {
  version: '1.0';
  /**
   * false = collapse the ENTIRE navbar (all tabs hidden, bar not rendered).
   * Defaults to true. Set to true to restore after hiding.
   */
  visible?: boolean;
  /** Keys of individual tabs to hide while the navbar is visible. */
  hiddenTabs: string[];
}
