import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Cpu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const DOMAIN_COLORS: Record<string, string> = {
  engineering: 'bg-violet-500',
  product:     'bg-blue-500',
  finance:     'bg-emerald-500',
};

export function Sidebar() {
  const { apps, connected } = useApp();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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

  const w = collapsed ? 'w-[60px]' : 'w-[200px]';

  return (
    <aside className={`${w} flex-shrink-0 bg-[#0f1117] flex flex-col transition-[width] duration-200 overflow-hidden`}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-5 border-b border-white/5">
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
          <Cpu size={15} className="text-white" />
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

      {/* Domain navigation */}
      <div className="flex-1 px-2 pt-4">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 px-2 mb-2">
            Workspaces
          </p>
        )}
        <div className="space-y-0.5">
          {apps.map((app) => {
            const dot = DOMAIN_COLORS[app.id] ?? 'bg-gray-500';
            const isActive = location.pathname.startsWith(`/${app.id}`);
            return (
              <NavLink
                key={app.id}
                to={`/${app.id}`}
                title={collapsed ? app.label : undefined}
                className={[
                  'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all w-full',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300',
                ].join(' ')}
              >
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${dot} ${isActive ? 'shadow-lg' : ''}`} />
                {!collapsed && (
                  <span className="font-medium truncate">{app.label}</span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom: live badge + collapse */}
      <div className="px-2 pb-4 space-y-2 border-t border-white/5 pt-3">
        {!collapsed && (
          <div className={[
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium',
            connected
              ? 'bg-emerald-950 text-emerald-400'
              : 'bg-white/5 text-gray-600',
          ].join(' ')}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            {connected ? 'Live data' : 'Connecting…'}
          </div>
        )}
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
