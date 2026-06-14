import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppShell }   from './components/layout/AppShell';
import { DomainPage } from './pages/DomainPage';
import { LandingPage } from './pages/LandingPage';

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Landing page — no AppShell, no AppProvider */}
        <Route path="/" element={<LandingPage />} />

        {/* App — each domain route: AppProvider + AppShell wraps DomainPage */}
        <Route
          path="/:appId/*"
          element={
            <AppProvider>
              <AppShell>
                <DomainPage />
              </AppShell>
            </AppProvider>
          }
        />

        {/* Anything else → landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
