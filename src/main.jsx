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

const path = window.location.pathname.toLowerCase();
const hash = window.location.hash.toLowerCase();
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     window.matchMedia('(display-mode: fullscreen)').matches ||
                     window.matchMedia('(display-mode: minimal-ui)').matches ||
                     window.navigator.standalone || 
                     document.referrer.includes('android-app://');

// Mémoriser l'interface visitée dans le navigateur (pour l'ajout manuel à l'écran d'accueil)
if (!isStandalone) {
  if (path.includes('/kds') || hash.includes('/kds')) {
    localStorage.setItem('pwa_mode', 'kds');
  } else if (path.includes('/pos') || hash.includes('/pos')) {
    localStorage.setItem('pwa_mode', 'pos');
  } else if (path.includes('/tv') || hash.includes('/tv')) {
    localStorage.setItem('pwa_mode', 'tv');
  } else if (path.includes('/idara') || hash.includes('/idara')) {
    localStorage.setItem('pwa_mode', 'admin');
  } else if (path.includes('/livreur') || hash.includes('/livreur')) {
    localStorage.setItem('pwa_mode', 'livreur');
  } else {
    // Ne pas écraser si c'est déjà configuré pour Idara/KDS/POS !
    if (!localStorage.getItem('pwa_mode')) {
      localStorage.setItem('pwa_mode', 'client');
    }
  }
}

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
  } else if (path.startsWith('/tv') || hash.includes('/tv')) {
    RootComponent = App;
  } else if (isStandalone && pwaMode) {
    if (pwaMode === 'livreur') {
      RootComponent = DriverApp;
    } else if (['admin', 'pos', 'kds'].includes(pwaMode)) {
      RootComponent = AdminApp;
      if (pwaMode === 'kds' && !hash.includes('/kds') && !path.includes('/kds')) {
          window.history.replaceState(null, '', '#/kds');
      } else if (pwaMode === 'pos' && !hash.includes('/pos') && !path.includes('/pos')) {
          window.history.replaceState(null, '', '#/pos');
      } else if (pwaMode === 'admin' && !hash.includes('/idara') && !path.includes('/idara')) {
          window.history.replaceState(null, '', '#/idara');
      }
    } else if (pwaMode === 'tv') {
      RootComponent = App;
      if (!hash.includes('/tv') && !path.includes('/tv')) {
          window.history.replaceState(null, '', '#/tv');
      }
    }
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