// @dsi/shared — engine contract
// Zero domain-specific strings live here.

export type { Item, FilterOp, FilterClause, SortClause, QueryParams } from './item/item.types';
export type { AppFieldDef, AppLayoutDef, AppVocabulary } from './spec/app-vocabulary';
export { buildViewSpecSchema } from './spec/view-spec.schema';
export type { ViewSpecSchema } from './spec/view-spec.schema';
export type { BaseViewSpec, SpecVersion } from './spec/view-spec.types';
export type { SidebarNavItem, SidebarVocabulary, SidebarItemSpec, SidebarSpec } from './spec/sidebar-spec.types';
export { buildSidebarSpecSchema } from './spec/sidebar-spec.schema';
export type { SidebarSpecSchema } from './spec/sidebar-spec.schema';
export type { GenerateRequest, GenerateResponse, ClarificationOption } from './types/generate';
export type { NavSpec } from './spec/nav-spec.types';
