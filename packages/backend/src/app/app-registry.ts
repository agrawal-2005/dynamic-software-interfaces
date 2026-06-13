import type { AppVocabulary, Item } from '@dsi/shared';
import { DataStore } from '../engine/data-store';

// Domain vocabulary + seed imports
import { ENGINEERING_VOCABULARY } from './domains/engineering/vocabulary';
import { ENGINEERING_SEED } from './domains/engineering/seed';
import { PRODUCT_VOCABULARY } from './domains/product/vocabulary';
import { PRODUCT_SEED } from './domains/product/seed';
import { FINANCE_VOCABULARY } from './domains/finance/vocabulary';
import { FINANCE_SEED } from './domains/finance/seed';

/**
 * One AppBundle per registered domain.
 * SpecValidator and SpecGenerator are added in Step 5; DataStore is here now.
 */
export interface AppBundle {
  id: string;
  label: string;
  vocabulary: AppVocabulary;
  store: DataStore;
}

export type AppRegistry = Record<string, AppBundle>;

/**
 * Build one AppBundle per domain config.
 * Called once at server startup — all engine instances are created here.
 * Adding a domain = one new entry in the configs array.
 */
export function buildAppRegistry(): AppRegistry {
  const configs: Array<{
    id: string;
    label: string;
    vocabulary: AppVocabulary;
    seed: Item[];
  }> = [
    { id: 'engineering', label: 'Engineering', vocabulary: ENGINEERING_VOCABULARY, seed: ENGINEERING_SEED },
    { id: 'product',     label: 'Product',     vocabulary: PRODUCT_VOCABULARY,     seed: PRODUCT_SEED     },
    { id: 'finance',     label: 'Finance',     vocabulary: FINANCE_VOCABULARY,     seed: FINANCE_SEED     },
  ];

  return Object.fromEntries(
    configs.map(({ id, label, vocabulary, seed }) => [
      id,
      { id, label, vocabulary, store: new DataStore(seed) },
    ]),
  );
}
