import { useLocation } from 'react-router-dom';

const KNOWN_SECTIONS = new Set(['explorer', 'analytics', 'settings', 'sidebar']);

/**
 * Derives the active section from the current URL path.
 *
 * URL → section mapping:
 *   /#/engineering           → 'dashboard'
 *   /#/engineering/explorer  → 'explorer'
 *   /#/engineering/analytics → 'analytics'
 *   /#/engineering/settings  → 'settings'
 *
 * 'sidebar' is never set by the URL — it's injected via openChat('sidebar').
 */
export function useCurrentSection(): string {
  const { pathname } = useLocation();
  const parts  = pathname.split('/').filter(Boolean);
  const second = parts[1]; // parts[0] = appId
  return second && KNOWN_SECTIONS.has(second) ? second : 'dashboard';
}
