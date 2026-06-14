import type { AppVocabulary, Item } from '@dsi/shared';
import { DataStore } from '../engine/data-store';
import { SpecValidator } from '../engine/spec-validator';

// Domain vocabulary + seed imports
import { ENGINEERING_VOCABULARY } from './domains/engineering/vocabulary';
import { ENGINEERING_SEED } from './domains/engineering/seed';
import { PRODUCT_VOCABULARY } from './domains/product/vocabulary';
import { PRODUCT_SEED } from './domains/product/seed';
import { FINANCE_VOCABULARY } from './domains/finance/vocabulary';
import { FINANCE_SEED } from './domains/finance/seed';

/** One AppBundle per registered domain. All engine instances live here. */
export interface AppBundle {
  id: string;
  label: string;
  vocabulary: AppVocabulary;
  store: DataStore;
  validator: SpecValidator;
}

export type AppRegistry = Record<string, AppBundle>;

/**
 * Build one AppBundle per domain config.
 * Called once at server startup. Adding a domain = one new entry in configs.
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
    configs.map(({ id, label, vocabulary, seed }) => {
      const store     = new DataStore(seed);
      const validator = new SpecValidator(vocabulary);
      return [id, { id, label, vocabulary, store, validator }];
    }),
  );
}
