import { AuthProvider, useAuth } from './context/AuthContext';
import { type User } from './api/client';
import { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import InvestigationsList from './components/InvestigationsList';
import InvestigationDetail from './components/InvestigationDetail';
import LoginPage from './components/LoginPage';
import LandingPage from './components/LandingPage';
import SyntheticDb from './components/SyntheticDb';

type Page = 'landing' | 'login' | 'dashboard' | 'investigations' | 'investigation-detail' | 'synthetic-db';

interface RouteState {
  page: Page;
  params: Record<string, string>;
}

const fullscreenPages: Page[] = ['landing', 'login'];

function AppShell() {
  const { user, loading, setUser, logout } = useAuth();
  const [route, setRoute] = useState<RouteState>({ page: 'landing', params: {} });

  const navigate = (page: string, params: Record<string, string> = {}) => {
    setRoute({ page: page as Page, params });
  };

  // While restoring session, show nothing (avoids flash)
  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          background: '#0F172A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          fontSize: '13px',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        Loading…
      </div>
    );
  }

  // If a session was restored, jump straight to dashboard
  const effectivePage: Page =
    user && (route.page === 'landing' || route.page === 'login')
      ? 'dashboard'
      : route.page;

  const isFullscreen = fullscreenPages.includes(effectivePage);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    navigate('dashboard');
  };

  const handleLogout = async () => {
    await logout();
    navigate('landing');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0F172A',
        color: '#F1F5F9',
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: isFullscreen ? 'auto' : 'hidden',
      }}
    >
      {effectivePage === 'landing' && (
        <LandingPage onLogin={() => navigate('login')} />
      )}

      {effectivePage === 'login' && (
        <LoginPage onLogin={handleLogin} onBack={() => navigate('landing')} />
      )}

      {!isFullscreen && (
        <>
          <Navbar
            currentPage={effectivePage === 'investigation-detail' ? 'investigations' : effectivePage}
            onNavigate={navigate}
            user={user}
            onLogout={handleLogout}
          />
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            {effectivePage === 'dashboard' && <Dashboard onNavigate={navigate} />}
            {effectivePage === 'investigations' && <InvestigationsList onNavigate={navigate} />}
            {effectivePage === 'investigation-detail' && (
              <InvestigationDetail id={route.params.id || ''} onNavigate={navigate} />
            )}
            {effectivePage === 'synthetic-db' && <SyntheticDb />}
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
