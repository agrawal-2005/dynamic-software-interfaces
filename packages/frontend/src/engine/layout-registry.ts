import type { ComponentType } from 'react';
import type { Item, BaseViewSpec } from '@dsi/shared';

export type LayoutProps = {
  spec: BaseViewSpec;
  items: Item[];
};

export type LayoutComponent = ComponentType<LayoutProps>;

/**
 * LayoutRegistry — engine class, domain-agnostic.
 *
 * Maps layout name strings to React components. Populated at app startup
 * before the first render. ViewRenderer calls get() and delegates; adding
 * a new layout requires only a register() call — the renderer is untouched.
 */
export class LayoutRegistry {
  private readonly map = new Map<string, LayoutComponent>();

  register(name: string, component: LayoutComponent): this {
    this.map.set(name, component);
    return this; // fluent for chaining at startup
  }

  get(name: string): LayoutComponent | undefined {
    return this.map.get(name);
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  names(): string[] {
    return [...this.map.keys()];
  }
}
