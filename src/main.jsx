import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'
import DriverApp from './DriverApp.jsx'
import './index.css'

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
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
)