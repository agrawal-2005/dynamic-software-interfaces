import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, RotateCcw } from 'lucide-react';
import { LogoMark } from '../LogoMark';
import type { SidebarSpec } from '@dsi/shared';
import { useApp } from '../../context/AppContext';
import { useGlobalAi, useGlobalSpec } from '../../context/GlobalAiContext';

const DOMAIN_COLORS: Record<string, string> = {
  engineering: 'bg-violet-500',
  product:     'bg-blue-500',
  finance:     'bg-emerald-500',
};

/**
 * Sidebar — spec-driven nav surface.
 *
 * Where the spec lives:   dsi:sidebar-spec (localStorage, global, not per-domain)
 * What it controls:       which workspace items appear, their order, their labels
 * What it cannot do:      delete workspaces, change routes, affect other users' data
 *
 * Vocabulary:             derived from the apps list (same source as app-registry on backend)
 * Generator:              POST /api/generate → UnifiedGenerator → SidebarSpec (Zod-validated)
 * Isolation:              hiding an item = visible:false in spec only, workspace still exists
 */
export function Sidebar() {
  const { apps, connected } = useApp();
  const location = useLocation();
  const navigate  = useNavigate();
  const [sidebarSpec, setSidebarSpec] = useGlobalSpec<SidebarSpec>('global', 'sidebar');
  const { openChat } = useGlobalAi();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dsi:sidebar:collapsed') === 'true');

  // ── Render list: apply spec ordering + visibility ─────────────────────────
  const renderList = buildRenderList(apps, sidebarSpec);

  // ── Redirect when the active workspace is hidden from the sidebar ─────────
  useEffect(() => {
    // Find which domain the current URL is inside
    const activeApp = apps.find((a) => location.pathname.startsWith(`/${a.id}`));
    if (!activeApp) return;
    // If it is no longer in the visible render list, go to the first visible one
    const stillVisible = renderList.some((item) => item.key === activeApp.id);
    if (!stillVisible && renderList.length > 0) {
      navigate(`/${renderList[0].key}`);
    }
  }, [renderList, location.pathname, apps, navigate]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem('dsi:sidebar:collapsed', String(!c));
      return !c;
    });
  }

  const w = collapsed ? 'w-[60px]' : 'w-[200px]';

  return (
    <aside className={`${w} flex-shrink-0 bg-[#0f1117] flex flex-col transition-[width] duration-200 overflow-hidden`}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-5 border-b border-white/5">
        <div className="flex-shrink-0">
          <LogoMark size={32} />
        </div>
        {!collapsed && (
          <div>
            <span className="text-[13px] font-bold text-white leading-tight tracking-tight">
              Dynamically
            </span>
            <span className="block text-[10px] text-gray-600 leading-none mt-0.5">
              AI-powered interfaces
            </span>
          </div>
        )}
      </div>

      {/* Nav items — rendered from spec */}
      <div className="flex-1 px-2 pt-4 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 px-2 mb-2">
            Workspaces
          </p>
        )}
        <div className="space-y-0.5">
          {renderList.map((item) => {
            const dot      = DOMAIN_COLORS[item.key] ?? 'bg-gray-500';
            const isActive = location.pathname.startsWith(`/${item.key}`);
            return (
              <NavLink
                key={item.key}
                to={`/${item.key}`}
                title={collapsed ? item.label : undefined}
                className={[
                  'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all w-full',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300',
                ].join(' ')}
              >
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${dot} ${isActive ? 'shadow-lg' : ''}`} />
                {!collapsed && (
                  <span className="font-medium truncate">{item.label}</span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Reset badge — shown when spec is active */}
        {sidebarSpec && !collapsed && (
          <button
            onClick={() => setSidebarSpec(null)}
            className="mt-3 flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-300 px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors w-full"
            title="Reset sidebar to default"
          >
            <RotateCcw size={9} />
            <span>Reset sidebar</span>
          </button>
        )}
      </div>

      {/* Bottom: AI button + live badge + collapse */}
      <div className="px-2 pb-4 space-y-2 border-t border-white/5 pt-3">

        {/* AI sidebar customiser — opens GlobalChatPanel with sidebar context */}
        {!collapsed && (
          <button
            onClick={() => openChat('sidebar')}
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-gray-600 hover:text-indigo-400 hover:bg-white/5 transition-colors"
          >
            <Sparkles size={11} />
            <span>Customise sidebar</span>
          </button>
        )}

        {/* Collapsed: AI icon only */}
        {collapsed && (
          <button
            onClick={() => { setCollapsed(false); openChat('sidebar'); }}
            className="flex items-center justify-center w-full py-1.5 rounded-xl text-gray-600 hover:text-indigo-400 hover:bg-white/5 transition-colors"
            title="Customise sidebar with AI"
          >
            <Sparkles size={13} />
          </button>
        )}

        {/* Live data badge */}
        {!collapsed && (
          <div className={[
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium',
            connected ? 'bg-emerald-950 text-emerald-400' : 'bg-white/5 text-gray-600',
          ].join(' ')}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            {connected ? 'Live data' : 'Connecting…'}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="flex items-center justify-center w-full py-2 rounded-xl text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type RenderItem = { key: string; label: string };

/**
 * Merges the live apps list with the sidebar spec to produce the final render list.
 *
 * Rules:
 * - If no spec: show all apps in default order with default labels
 * - If spec: use spec ordering, hide items with visible:false, apply custom labels
 * - Items in apps but not in spec (e.g. newly added domain): always shown at the end
 */
function buildRenderList(
  apps: { id: string; label: string }[],
  spec: SidebarSpec | null,
): RenderItem[] {
  if (!spec) return apps.map((a) => ({ key: a.id, label: a.label }));

  const appMap = new Map(apps.map((a) => [a.id, a.label]));

  // Ordered, filtered items from the spec
  const fromSpec: RenderItem[] = spec.items
    .filter((item) => item.visible !== false && appMap.has(item.key))
    .map((item) => ({
      key:   item.key,
      label: item.label ?? appMap.get(item.key) ?? item.key,
    }));

  // Any apps added after the spec was generated — always show at the end
  const specKeys = new Set(spec.items.map((i) => i.key));
  const overflow  = apps
    .filter((a) => !specKeys.has(a.id))
    .map((a) => ({ key: a.id, label: a.label }));

  return [...fromSpec, ...overflow];
}
