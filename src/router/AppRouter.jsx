import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

const App = lazy(() => import('../App.jsx'));
const AdminApp = lazy(() => import('../AdminApp.jsx'));
const DriverApp = lazy(() => import('../DriverApp.jsx'));
const ManagerAchatsApp = lazy(() => import('../ManagerAchatsApp.jsx'));

const Loader = () => (
  <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gray-50">
    <div className="w-12 h-12 border-4 border-gray-200 border-t-[#ffbc0d] rounded-full animate-spin"></div>
  </div>
);

function PwaRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only redirect if we are on the root path to avoid infinite loops
    if (location.pathname !== '/') return;

    const pwaMode = localStorage.getItem('pwa_mode');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone || 
                         document.referrer.includes('android-app://');
                         
    if (isStandalone && pwaMode) {
      if (pwaMode === 'livreur') navigate('/livreur', { replace: true });
      else if (pwaMode === 'achats') navigate('/achats', { replace: true });
      else if (pwaMode === 'admin') navigate('/idara', { replace: true });
      else if (pwaMode === 'pos') navigate('/pos', { replace: true });
      else if (pwaMode === 'kds') navigate('/kds', { replace: true });
      else if (pwaMode === 'tv') navigate('/tv', { replace: true });
    }
    
    // Electron environment check
    if (navigator.userAgent.toLowerCase().includes('electron')) {
        const hash = window.location.hash.toLowerCase();
        if (hash.includes('/tv')) navigate('/tv', { replace: true });
        else if (hash.includes('/livreur')) navigate('/livreur', { replace: true });
        // By default Electron launches admin/pos if no specific hash
        else if (!hash || hash === '#/' || hash === '') navigate('/pos', { replace: true });
    }
  }, [navigate, location.pathname]);

  return null;
}

export default function AppRouter() {
  const isElectron = navigator.userAgent.toLowerCase().includes('electron');
  const Router = isElectron ? HashRouter : BrowserRouter;

  return (
    <Router>
      <PwaRedirectHandler />
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Main Client/TV App */}
          <Route path="/" element={<App />} />
          <Route path="/tv/*" element={<App />} />

          {/* Admin / POS / KDS Routes */}
          <Route path="/idara/*" element={<AdminApp />} />
          <Route path="/pos/*" element={<AdminApp />} />
          <Route path="/kds/*" element={<AdminApp />} />
          <Route path="/glovo-reports/*" element={<AdminApp />} />

          {/* Driver Route */}
          <Route path="/livreur/*" element={<DriverApp />} />

          {/* Manager Achats Route */}
          <Route path="/achats/*" element={<ManagerAchatsApp />} />

          {/* Fallback */}
          <Route path="*" element={<App />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
