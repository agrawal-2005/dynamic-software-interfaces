import { type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { SidebarSpec } from '@dsi/shared';
import { Sidebar } from './Sidebar';
import { GlobalAiProvider, useGlobalAi, useGlobalSpec } from '../../context/GlobalAiContext';
import { GlobalChatPanel } from '../ai/GlobalChatPanel';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <GlobalAiProvider>
      <AppShellContent>{children}</AppShellContent>
    </GlobalAiProvider>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const { isChatOpen, openChat } = useGlobalAi();
  const [sidebarSpec] = useGlobalSpec<SidebarSpec>('global', 'sidebar');
  const isSidebarVisible = sidebarSpec?.visible !== false;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {isSidebarVisible && <Sidebar />}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
        {/* One chat panel for the whole app — context-aware */}
        <GlobalChatPanel />
      </div>

      {/* Single floating AI button — hidden while chat is open */}
      {!isChatOpen && (
        <button
          onClick={() => openChat()}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center"
          title="Open AI assistant"
        >
          <Sparkles size={18} />
        </button>
      )}
    </div>
  );
}
