import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AppShell }   from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { ViewPage }      from './pages/ViewPage';
import { ExplorerPage }  from './pages/ExplorerPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage }  from './pages/SettingsPage';

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <AppShell>
          <Routes>
            <Route path="/"          element={<DashboardPage />} />
            <Route path="/view"      element={<ViewPage />} />
            <Route path="/explorer"  element={<ExplorerPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings"  element={<SettingsPage />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </AppProvider>
    </HashRouter>
  );
}
