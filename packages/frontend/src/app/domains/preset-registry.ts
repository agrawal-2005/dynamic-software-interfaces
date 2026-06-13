import type { Preset } from './engineering/presets';
import { ENGINEERING_PRESETS } from './engineering/presets';
import { PRODUCT_PRESETS }     from './product/presets';
import { FINANCE_PRESETS }     from './finance/presets';

export type { Preset };

const PRESET_MAP: Record<string, Preset[]> = {
  engineering: ENGINEERING_PRESETS,
  product:     PRODUCT_PRESETS,
  finance:     FINANCE_PRESETS,
};

export function getPresets(appId: string): Preset[] {
  return PRESET_MAP[appId] ?? [];
}
