import { useEffect } from 'react';
import { useParams, NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Table2, BarChart3, Settings, RotateCcw } from 'lucide-react';
import type { NavSpec } from '@dsi/shared';
import { useApp } from '../context/AppContext';
import { useGlobalSpec } from '../context/GlobalAiContext';
import { DashboardPage } from './DashboardPage';
import { ExplorerPage }  from './ExplorerPage';
import { AnalyticsPage } from './AnalyticsPage';
import { SettingsPage }  from './SettingsPage';

const TABS = [
  { path: '',          label: 'Dashboard', icon: LayoutDashboard },
  { path: 'explorer',  label: 'Explorer',  icon: Table2          },
  { path: 'analytics', label: 'Analytics', icon: BarChart3       },
  { path: 'settings',  label: 'Settings',  icon: Settings        },
];

const DOMAIN_ACCENT: Record<string, string> = {
  engineering: 'text-violet-500',
  product:     'text-blue-500',
  finance:     'text-emerald-500',
};

export function DomainPage() {
  const { appId = 'engineering' } = useParams<{ appId: string }>();
  const { setAppId } = useApp();
  const location = useLocation();
  const [navSpec, setNavSpec] = useGlobalSpec<NavSpec>(appId, 'nav');

  useEffect(() => {
    setAppId(appId);
  }, [appId, setAppId]);

  const label  = appId.charAt(0).toUpperCase() + appId.slice(1);
  const accent = DOMAIN_ACCENT[appId] ?? 'text-indigo-500';

  // Derive active sub-path from URL
  const subPath = location.pathname.replace(`/${appId}`, '').replace(/^\//, '');
  const activeTab = subPath.split('/')[0] ?? '';

  // Whole-navbar visibility (distinct from individual tab hiding)
  const navbarVisible = navSpec?.visible !== false;

  // Filter tabs by nav spec
  const hiddenTabs = new Set(navSpec?.hiddenTabs ?? []);
  const visibleTabs = TABS.filter(({ path }) => {
    const key = path === '' ? 'dashboard' : path;
    return !hiddenTabs.has(key);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Domain name + horizontal tab bar — hidden as a whole when navSpec.visible === false */}
      {navbarVisible && (
      <div className="flex-shrink-0 bg-white border-b border-gray-100">
        <div className="px-6 pt-4">
          <p className={`text-[11px] font-bold uppercase tracking-widest ${accent}`}>{label}</p>

          <div className="flex items-center gap-0.5 mt-3 -mb-px">
            {visibleTabs.map(({ path, label: tabLabel, icon: Icon }) => {
              const isActive = path === activeTab;
              return (
                <NavLink
                  key={path}
                  to={`/${appId}${path ? `/${path}` : ''}`}
                  end={path === ''}
                  className={[
                    'flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap',
                    isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200',
                  ].join(' ')}
                >
                  <Icon size={14} className="flex-shrink-0" />
                  {tabLabel}
                </NavLink>
              );
            })}

            {/* Restore button — only shown when individual tabs are hidden */}
            {hiddenTabs.size > 0 && (
              <button
                onClick={() => setNavSpec(null)}
                title={`${hiddenTabs.size} tab${hiddenTabs.size > 1 ? 's' : ''} hidden — click to restore all`}
                className="ml-1 mb-px flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors"
              >
                <RotateCcw size={10} />
                {hiddenTabs.size} hidden
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Tab content — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route index            element={<DashboardPage />} />
          <Route path="explorer"  element={<ExplorerPage />}  />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings"  element={<SettingsPage />}  />
          <Route path="*"         element={<Navigate to={`/${appId}`} replace />} />
        </Routes>
      </div>
    </div>
  );
}
