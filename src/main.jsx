import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'
import DriverApp from './DriverApp.jsx'
import './index.css'

const path = window.location.pathname;

let RootComponent = App; // Par défaut, c'est l'application Client
if (path.startsWith('/idara') || path.startsWith('/pos')) {
  RootComponent = AdminApp;
} else if (path.startsWith('/livreur')) {
  RootComponent = DriverApp;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>,
)