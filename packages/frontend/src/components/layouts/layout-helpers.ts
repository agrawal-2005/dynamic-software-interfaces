import type { BaseViewSpec } from '@dsi/shared';

/** Alias for the valueLabels map carried in a ViewSpec. */
export type VL = BaseViewSpec['valueLabels'];

/**
 * Resolve a raw field value through the spec's valueLabels map.
 * Returns the display label if one is configured, or the raw value unchanged.
 * Never mutates data — pure display rename only.
 */
export function display(vl: VL, fieldKey: string, raw: string): string {
  return vl?.[fieldKey]?.[raw] ?? raw;
}
