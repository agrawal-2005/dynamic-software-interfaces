// @dsi/shared — engine contract
// Zero domain-specific strings live here.

export type { Item, FilterOp, FilterClause, SortClause, QueryParams } from './item/item.types';
export type { AppFieldDef, AppLayoutDef, AppVocabulary } from './spec/app-vocabulary';
export { buildViewSpecSchema } from './spec/view-spec.schema';
export type { ViewSpecSchema } from './spec/view-spec.schema';
export type { BaseViewSpec, SpecVersion } from './spec/view-spec.types';
