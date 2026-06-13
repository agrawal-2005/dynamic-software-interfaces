import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
