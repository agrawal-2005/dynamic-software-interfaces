import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppShell }   from './components/layout/AppShell';
import { DomainPage } from './pages/DomainPage';

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <AppShell>
          <Routes>
            <Route path="/:appId/*" element={<DomainPage />} />
            <Route path="*"         element={<Navigate to="/engineering" replace />} />
          </Routes>
        </AppShell>
      </AppProvider>
    </HashRouter>
  );
}
