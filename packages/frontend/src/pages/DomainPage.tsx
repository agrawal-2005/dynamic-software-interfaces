import { useEffect } from 'react';
import { useParams, NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Eye, Table2, BarChart3, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DashboardPage } from './DashboardPage';
import { ViewPage }      from './ViewPage';
import { ExplorerPage }  from './ExplorerPage';
import { AnalyticsPage } from './AnalyticsPage';
import { SettingsPage }  from './SettingsPage';

const TABS = [
  { path: '',          label: 'Dashboard', icon: LayoutDashboard },
  { path: 'view',      label: 'My View',   icon: Eye             },
  { path: 'explorer',  label: 'Explorer',  icon: Table2          },
  { path: 'analytics', label: 'Analytics', icon: BarChart3       },
  { path: 'settings',  label: 'Settings',  icon: Settings        },
];

const DOMAIN_COLORS: Record<string, string> = {
  engineering: 'text-violet-500',
  product:     'text-blue-500',
  finance:     'text-emerald-500',
};

export function DomainPage() {
  const { appId = 'engineering' } = useParams<{ appId: string }>();
  const { setAppId } = useApp();
  const location = useLocation();

  // Sync URL-derived appId into context
  useEffect(() => {
    setAppId(appId);
  }, [appId, setAppId]);

  const label = appId.charAt(0).toUpperCase() + appId.slice(1);
  const accentColor = DOMAIN_COLORS[appId] ?? 'text-indigo-500';

  // Detect active tab from current path
  const subPath = location.pathname.replace(`/${appId}`, '').replace(/^\//, '');
  const activeTabPath = subPath.split('/')[0] ?? '';

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Domain header + horizontal tab bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100">
        <div className="px-6 pt-4">
          {/* Workspace label */}
          <p className={`text-xs font-semibold uppercase tracking-widest ${accentColor} mb-0.5`}>
            {label}
          </p>

          {/* Tab bar */}
          <div className="flex items-center gap-0.5 -mb-px mt-3">
            {TABS.map(({ path, label: tabLabel, icon: Icon }) => {
              const isActive = path === activeTabPath;
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
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route index       element={<DashboardPage />} />
          <Route path="view"      element={<ViewPage />}      />
          <Route path="explorer"  element={<ExplorerPage />}  />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings"  element={<SettingsPage />}  />
          <Route path="*"    element={<Navigate to={`/${appId}`} replace />} />
        </Routes>
      </div>
    </div>
  );
}
