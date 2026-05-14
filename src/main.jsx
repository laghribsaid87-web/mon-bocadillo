import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

import L from 'leaflet';
window.L = window.L || L;

// 🔥 NOUVEAU: Lazy Loading (Code Splitting). Kola wa7ed kay-téléchargi ghir dakchi li ghaykhdem bih!
const App = lazy(() => import('./App.jsx'));
const AdminApp = lazy(() => import('./AdminApp.jsx'));
const DriverApp = lazy(() => import('./DriverApp.jsx'));

// 🔥 NOUVEAU: Capture globale de l'événement PWA (bach mayzgelhach React)
window.deferredPWAInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPWAInstall = e;
});

// 🔥 Enregistrement du Service Worker pour le cache PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .catch(err => console.log('Service Worker failed:', err));
  });
}

const path = window.location.pathname;
const hash = window.location.hash;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     window.matchMedia('(display-mode: fullscreen)').matches ||
                     window.matchMedia('(display-mode: minimal-ui)').matches ||
                     window.navigator.standalone || 
                     document.referrer.includes('android-app://');
const pwaMode = localStorage.getItem('pwa_mode');

let RootComponent = App; // Par défaut, c'est l'application Client

// Vérifier si on compile pour une application spécifique (APK)
if (import.meta.env.VITE_APP_TYPE === 'DRIVER') {
  RootComponent = DriverApp;
} else if (import.meta.env.VITE_APP_TYPE === 'CLIENT') {
  RootComponent = App;
} else if (navigator.userAgent.toLowerCase().includes('electron')) {
  if (hash.includes('/tv')) {
    RootComponent = App; // App.jsx fih l'écran TV
  } else if (hash.includes('/livreur')) {
    RootComponent = DriverApp;
  } else {
    RootComponent = AdminApp; // Par défaut Idara / KDS / POS
  }
} else {
  // Mode Web classique avec routage par URL
  if (path.startsWith('/idara') || path.startsWith('/pos') || path.startsWith('/kds') || hash.includes('/idara') || hash.includes('/kds') || hash.includes('/pos')) {
    RootComponent = AdminApp;
  } else if (path.startsWith('/livreur') || hash.includes('/livreur')) {
    RootComponent = DriverApp;
  } else if (isStandalone && pwaMode === 'livreur') {
    RootComponent = DriverApp;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-yellow-500 rounded-full animate-spin"></div>
      </div>
    }>
      <RootComponent />
    </Suspense>
  </React.StrictMode>,
)