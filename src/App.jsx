import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BellRing, X, Download, Truck, Ban } from 'lucide-react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, setDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { onMessage } from 'firebase/messaging';

import { auth, db, appId, messaging } from './config/firebase';
import { DEFAULT_BRAND, DEFAULT_SETTINGS, DEFAULT_MENU_ITEMS } from './config/constants';
import { setupNotifications } from './utils/helpers';

const AuthView = lazy(() => import('./views/AuthView'));
const ClientView = lazy(() => import('./views/ClientView'));
const ClientScreen = lazy(() => import('./views/ClientScreen'));

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [orderLimit, setOrderLimit] = useState(10);

  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [notify, setNotify] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      localStorage.setItem('pwa_mode', 'client');
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    }
  };
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [audioObj] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  const prevOrdersRef = React.useRef([]);

  const playNotification = () => {
    try {
      audioObj.play().catch(e=>console.log('Audio bloqué', e));
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch(err){}
  };

  useEffect(() => {
    const handleSWMessage = (e) => {
      if (e.data && e.data.type === 'FCM_MESSAGE') {
        playNotification();
      }
    };
    if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', handleSWMessage);
    return () => {
      if (navigator.serviceWorker) navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, []);

  const showNotify = (msg, type = 'info') => {
    setNotify({ msg, type });
    setTimeout(() => setNotify(null), 3000);
  };

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (s) => {
      if(s.exists()) setSettings(s.data());
    });
    const unsubBrand = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'brand'), (s) => {
      if(s.exists()) setBrand(s.data());
    });
    return () => {
      unsubConfig();
      unsubBrand();
    };
  }, []);

  const saveSettings = async (newSettings) => {
    setSettings(newSettings);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), newSettings, { merge: true });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile(data);
            if (data.isRegistered) {
              setupNotifications(u.uid, db, messaging, appId);
            }
          }
          else setProfile({});
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        signInAnonymously(auth).catch(err => {
          showNotify("Erreur de connexion", "error");
          setLoading(false);
        });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qOrders = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'orders'), 
      where('userId', '==', user.uid), 
      orderBy('createdAt', 'desc'), 
      limit(orderLimit)
    );

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const ords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(ords);
      
      let hasStatusChange = false;
      const prevOrds = prevOrdersRef.current;
      if (prevOrds.length > 0) {
        ords.forEach(newO => {
          const oldO = prevOrds.find(o => o.id === newO.id);
          if (oldO && oldO.status !== newO.status) hasStatusChange = true;
        });
      }
      if (hasStatusChange) playNotification();
      prevOrdersRef.current = ords;
    });

    return () => unsubOrders();
  }, [user, orderLimit]);

  const updateStatus = async (id, currentStatus, updates = {}) => {
    let newStatus = currentStatus;
    if (currentStatus === 'pending') newStatus = 'preparing';
    else if (currentStatus === 'preparing' && !updates.prepTime && updates.prepTime !== 0) newStatus = 'ready';
    
    if (updates.status) newStatus = updates.status; 
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
      ...updates
    });
  };

  const handleLogout = async () => {
    if (window.confirm('Voulez-vous vraiment vous déconnecter?')) {
      await auth.signOut();
      window.location.reload();
    }
  };

  // 🔥 Route directe vers l'Écran TV (Support Electron w Web)
  if (window.location.pathname === '/tv' || window.location.hash.includes('/tv')) {
    return (
      <Suspense fallback={<div className="h-screen flex items-center justify-center bg-gray-900 text-white font-bold">Chargement de l'Écran TV...</div>}>
        <ClientScreen brand={brand} db={db} appId={appId} />
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center space-y-4" style={{backgroundColor: brand?.bgColor || '#f8f9fa'}}>
        <div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-[#ffbc0d] animate-spin" style={{borderTopColor: brand?.color || '#ffbc0d'}}></div>
        <p className="text-xs font-black uppercase text-gray-400 tracking-widest">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="relative font-sans text-gray-800 selection:bg-black selection:text-white" style={{ fontFamily: brand?.fontFamily || "'Poppins', sans-serif" }}>
      
      {deferredPrompt && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] bg-white p-3 rounded-2xl shadow-2xl border-2 flex items-center gap-3 w-[90%] max-w-md animate-in slide-in-from-top-5" style={{borderColor: brand?.color || '#ffbc0d'}}>
          <div className="bg-gray-100 p-2 rounded-xl shrink-0"><Download size={20} style={{color: brand?.color || '#ffbc0d'}}/></div>
          <div className="flex-1 text-left">
            <p className="text-[11px] font-black uppercase leading-tight text-gray-800">Installer l'Application</p>
            <p className="text-[9px] font-bold text-gray-500 leading-tight">Accès rapide et meilleur suivi</p>
          </div>
          <button onClick={handleInstallClick} className="px-4 py-2 text-[10px] font-black uppercase rounded-xl text-black shadow-md shrink-0" style={{backgroundColor: brand?.color || '#ffbc0d'}}>Installer</button>
          <button onClick={() => setDeferredPrompt(null)} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-lg shrink-0"><X size={14}/></button>
        </div>
      )}

      {notify && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-5 w-[90%] max-w-md">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-3 border-2 ${notify.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-black text-white border-white/20'}`}>
            {notify.type === 'error' ? <div className="bg-red-200 p-1.5 rounded-full"><X size={14} className="text-red-700"/></div> : <BellRing size={16} className="text-yellow-400 animate-bounce"/>}
            <span className="leading-tight">{notify.msg}</span>
          </div>
        </div>
      )}

      {profile?.blocked && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50" style={{ fontFamily: brand?.fontFamily || "'Poppins', sans-serif" }}>
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl border-2 border-red-100">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Ban size={36} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-red-800 mb-2">Accès Refusé</h2>
            <p className="text-sm font-bold text-gray-500 mb-8">Votre compte a été bloqué par l'administration.</p>
            <button onClick={handleLogout} className="w-full bg-black text-white font-black uppercase py-4 rounded-xl shadow-lg active:scale-95 transition-all">
              Se Déconnecter
            </button>
          </div>
        </div>
      )}

      {profile?.isDriver && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-blue-50" style={{ fontFamily: brand?.fontFamily || "'Poppins', sans-serif" }}>
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl border-2 border-blue-100">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Truck size={36} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-blue-800 mb-2">Espace Livreur</h2>
            <p className="text-sm font-bold text-gray-500 mb-8">Votre numéro est enregistré comme livreur. Vous ne pouvez pas utiliser l'application client.</p>
            <button onClick={() => window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#/livreur' : '/livreur'} className="w-full bg-blue-600 text-white font-black uppercase py-4 rounded-xl shadow-lg active:scale-95 transition-all mb-3">
              Aller à l'App Livreur
            </button>
            <button onClick={handleLogout} className="w-full bg-gray-100 text-gray-600 font-bold uppercase py-3 rounded-xl shadow-sm active:scale-95 transition-all border border-gray-200">
              Se Déconnecter
            </button>
          </div>
        </div>
      )}

  <Suspense fallback={
    <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-[#ffbc0d] rounded-full animate-spin" style={{borderTopColor: brand?.color || '#ffbc0d'}}></div>
    </div>
  }>
      {(!profile?.isRegistered) ? (
        <AuthView 
          brand={brand} 
          settings={settings} 
          showNotify={showNotify} 
          db={db}
          onComplete={async (data) => {
            const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', data.phone);
            const snap = await getDoc(clientRef);
            let roleData = { isAdmin: false, isManager: false, managerBranchId: null, isDriver: false, isFreelance: false, blocked: false };
            
            if (snap.exists()) {
              const c = snap.data();
              if (c.blocked) { showNotify("Had l-compte msouwer (Bloqué) 🚫", "error"); return; }
              if (c.isDriver) { 
                  showNotify("Nta livreur! Dkhol mn l-lien dyal livreur.", "error"); 
                  window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#/livreur' : '/livreur'; 
                  return; 
              }
              await updateDoc(clientRef, { uid: user.uid });
            } else {
              await setDoc(clientRef, { name: data.name, phone: data.phone, blocked: false, isDriver: false, uid: user.uid, createdAt: serverTimestamp() });
            }
            
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { ...data, ...roleData, isRegistered: true, updatedAt: serverTimestamp() }, { merge: true });
            showNotify("Mar7ba bik! ✅", "success");
          }} 
        />
      ) : (
        <ClientView 
          cart={cart} 
          setCart={setCart} 
          orders={orders} 
          user={user} 
          showNotify={showNotify} 
          settings={settings} 
          brand={brand} 
          db={db} 
          onLogout={handleLogout} 
          defaultMenu={DEFAULT_MENU_ITEMS}
          loadMoreOrders={() => setOrderLimit(prev => prev + 10)}
        />
      )}
  </Suspense>
    </div>
  );
}