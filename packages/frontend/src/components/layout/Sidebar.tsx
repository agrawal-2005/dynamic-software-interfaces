import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Eye, Table2, BarChart3, Settings,
  ChevronLeft, ChevronRight, Cpu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/view',      icon: Eye,             label: 'My View'     },
  { to: '/explorer',  icon: Table2,          label: 'Explorer'    },
  { to: '/analytics', icon: BarChart3,       label: 'Analytics'   },
  { to: '/settings',  icon: Settings,        label: 'Settings'    },
];

const DOMAIN_COLORS: Record<string, string> = {
  engineering: 'bg-violet-500',
  product:     'bg-blue-500',
  finance:     'bg-emerald-500',
};

export function Sidebar() {
  const { appId, setAppId, apps, connected } = useApp();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Persist sidebar collapse state
  useEffect(() => {
    const saved = localStorage.getItem('dsi:sidebar:collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);
  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem('dsi:sidebar:collapsed', String(!c));
      return !c;
    });
  }

  const w = collapsed ? 'w-[60px]' : 'w-[220px]';

  return (
    <aside className={`${w} flex-shrink-0 bg-gray-900 flex flex-col transition-[width] duration-200 overflow-hidden`}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-4 border-b border-gray-700/60">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
          <Cpu size={14} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-sm font-bold text-white leading-tight tracking-tight">
              Dynamically
            </span>
            <span className="block text-[10px] text-gray-500 leading-none">
              AI-powered interfaces
            </span>
          </div>
        )}
      </div>

      {/* Domain switcher */}
      <div className="px-2 py-3 border-b border-gray-700/60">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-1.5 mb-1.5">
            Domain
          </p>
        )}
        <div className={`flex ${collapsed ? 'flex-col items-center' : 'flex-col'} gap-1`}>
          {apps.map((app) => {
            const dot = DOMAIN_COLORS[app.id] ?? 'bg-gray-500';
            const active = app.id === appId;
            return (
              <button
                key={app.id}
                title={collapsed ? app.label : undefined}
                onClick={() => setAppId(app.id)}
                className={[
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors w-full',
                  active
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
                ].join(' ')}
              >
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${dot}`} />
                {!collapsed && <span className="truncate">{app.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-1.5 mb-1.5">
            Navigate
          </p>
        )}
        {NAV.map(({ to, icon: Icon, label }) => {
          const exact = to === '/';
          const isActive = exact
            ? location.pathname === '/'
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={[
                'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
              ].join(' ')}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom: live badge + collapse */}
      <div className="px-2 pb-4 space-y-2 border-t border-gray-700/60 pt-3">
        {!collapsed && (
          <div className={[
            'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium',
            connected ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500',
          ].join(' ')}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {connected ? 'Live' : 'Connecting…'}
          </div>
        )}
        <button
          onClick={toggle}
          className="flex items-center justify-center w-full py-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
}
