import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BellRing, X, Download, Truck, Ban, Lock } from 'lucide-react';
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
      const ords = snap.docs.map(d => {
        let orderData = d.data();
        if (orderData.source === 'glovo' && orderData.raw_text && !orderData.parsedGlovo) {
          try {
            let rawJson = typeof orderData.raw_text === 'string' ? JSON.parse(orderData.raw_text) : orderData.raw_text;
            let phoneJson = orderData.phone_text ? (typeof orderData.phone_text === 'string' ? JSON.parse(orderData.phone_text) : orderData.phone_text) : null;
            
            let content = rawJson.tout || rawJson;
            let phoneContent = phoneJson ? (phoneJson.tout || phoneJson) : {};
            
            let items = [];
            let name = "Client Glovo";
            let phone = "";
            let orderNumber = "";
            let total = "";
            
            // Extract phone
            for (let key in phoneContent) {
              let val = phoneContent[key];
              if (typeof val === 'string' && (val.includes('+212') || val.match(/^0[67]\d{8}$/))) {
                phone = val.trim();
              }
            }
            if(!phone && phoneContent["com.deliveryhero.rps.restaurantandroidapp:id/phone_number"]) {
               phone = phoneContent["com.deliveryhero.rps.restaurantandroidapp:id/phone_number"];
            }

            // Extract order details
            let itemsMap = {};
            for (let key in content) {
              let val = content[key];
              if (typeof val !== 'string') continue;
              
              if (key.includes('customer_name')) name = val;
              if (key.includes('order_number')) orderNumber = val;
              if (key.includes('total_price')) total = val.replace('DH', '').trim();
              
              let m = key.match(/item_name\$(\d+)/);
              if (m) {
                let idx = m[1];
                if (!itemsMap[idx]) itemsMap[idx] = {};
                itemsMap[idx].name = val;
              }
              m = key.match(/multiplier_label\$(\d+)/);
              if (m) {
                let idx = m[1];
                if (!itemsMap[idx]) itemsMap[idx] = {};
                itemsMap[idx].qty = parseInt(val.replace('x', '').trim()) || 1;
              }
              m = key.match(/item_price\$(\d+)/);
              if (m) {
                let idx = m[1];
                if (!itemsMap[idx]) itemsMap[idx] = {};
                itemsMap[idx].price = parseFloat(val.replace(',', '.').replace('DH', '').trim()) || 0;
              }
            }
            
            Object.values(itemsMap).forEach(item => {
               if(item.name) {
                  items.push({
                     name: item.name,
                     qty: item.qty || 1,
                     price: item.price || 0
                  });
               }
            });
            
            orderData.customerName = name;
            orderData.phone = phone || "Inconnu";
            orderData.orderNumber = orderNumber;
            orderData.total = total || "0";
            orderData.items = items;
            orderData.customerName = name;
            orderData.phone = phone || "Inconnu";
            orderData.orderNumber = orderNumber;
            orderData.total = total || "0";
            orderData.items = items;
            orderData.parsedGlovo = true; // Flag to prevent re-parsing
            
            // 🔥 VERY IMPORTANT: Assign a branch so it shows up in KDS!
            if (!orderData.nearestBranch) {
               orderData.nearestBranch = { id: "laymoune", name: "Laymoune" }; 
            }
            
          } catch(e) {
            console.error("Erreur parsing Glovo JSON:", e);
          }
        }
        
        // Also fix any already existing ones
        if (orderData.source === 'glovo' && !orderData.nearestBranch) {
           orderData.nearestBranch = { id: "laymoune", name: "Laymoune" };
        }
        
        return { id: d.id, ...orderData };
      });
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
    
    let isTvDisabled = brand && brand.isTvEnabled === false;
    
    if (!isTvDisabled) {
        const params = new URLSearchParams(window.location.search);
        const urlBranch = params.get('branch');
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const hashBranch = hashParams?.get('branch');
        const branchFromUrl = urlBranch || hashBranch;
        
        if (branchFromUrl && branchFromUrl !== 'ALL' && settings && settings.branches) {
             const currentBranch = settings.branches.find(b => b.id === branchFromUrl);
             if (currentBranch && currentBranch.posButtons && !currentBranch.posButtons.includes('tv')) {
                 isTvDisabled = true;
             }
        }
    }

    if (isTvDisabled) {
      return (
        <div className="h-screen flex items-center justify-center bg-black text-white font-bold text-2xl flex-col gap-4">
           <span>📺 L'Écran TV est actuellement désactivé.</span>
           <span className="text-sm text-gray-500 font-normal">Activez-le depuis l'Idara (Admin) pour reprendre l'affichage.</span>
        </div>
      );
    }
    
    return (
      <Suspense fallback={<div className="h-screen flex items-center justify-center bg-gray-900 text-white font-bold">Chargement de l'Écran TV...</div>}>
        <ClientScreen brand={brand} db={db} appId={appId} />
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-hidden" style={{ backgroundColor: brand?.bgColor || '#f8f9fa', fontFamily: brand?.fontFamily || "'Poppins', sans-serif" }}>
        {/* Effets de lumière en arrière-plan */}
        <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-black/5 to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 opacity-40" style={{ backgroundColor: brand?.color || '#ffbc0d' }}></div>
        <div className="absolute top-1/4 left-0 w-48 h-48 rounded-full blur-3xl -translate-x-1/2 opacity-30" style={{ backgroundColor: brand?.color || '#ffbc0d' }}></div>

        {/* Contenu Principal */}
        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000">
          
          <div className="relative w-28 h-28 flex items-center justify-center mb-8">
            {/* Cercle tournant externe */}
            <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 opacity-50"></div>
            <div className="absolute inset-0 rounded-full border-[3px] border-t-transparent border-l-transparent animate-spin" style={{ borderColor: brand?.color || '#ffbc0d', borderTopColor: 'transparent', borderLeftColor: 'transparent', animationDuration: '1.5s' }}></div>
            
            {/* Logo / Icône central avec effet pulse */}
            <div className="w-20 h-20 bg-white rounded-full shadow-2xl flex items-center justify-center animate-pulse overflow-hidden border border-gray-50">
              {brand?.logo ? (
                 <img src={brand?.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                 <span className="text-4xl font-black" style={{ color: brand?.color || '#ffbc0d' }}>{brand?.name ? brand.name.charAt(0).toUpperCase() : 'B'}</span>
              )}
            </div>
          </div>

          {/* Texte de Bienvenue */}
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-[0.2em] text-gray-900 mb-4 drop-shadow-sm text-center px-4">
            {brand?.name || 'Mon Bocadillo'}
          </h1>
          
          {/* Indicateur de progression élégant */}
          <div className="flex items-center justify-center gap-1.5 bg-white/50 backdrop-blur-sm py-2 px-4 rounded-full border border-white/40 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: brand?.color || '#ffbc0d', animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: brand?.color || '#ffbc0d', animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: brand?.color || '#ffbc0d', animationDelay: '300ms' }}></span>
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-2 leading-none mt-0.5">Démarrage</p>
          </div>
        </div>
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
            <button onClick={() => {
                localStorage.setItem('pwa_mode', 'livreur');
                const route = `/livreur?phone=${profile?.phone || ''}`;
                window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#' + route : route;
            }} className="w-full bg-blue-600 text-white font-black uppercase py-4 rounded-xl shadow-lg active:scale-95 transition-all mb-3">
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
                  localStorage.setItem('pwa_mode', 'livreur');
                  showNotify("Nta livreur! Dkhol mn l-lien dyal livreur.", "error"); 
                  const route = `/livreur?phone=${data.phone}`;
                  window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#' + route : route; 
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

      {(profile?.isAdmin || profile?.isManager) && !sessionStorage.getItem('test_client') && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900" style={{ fontFamily: brand?.fontFamily || "'Poppins', sans-serif" }}>
          <div className="bg-slate-800 p-8 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl border-2 border-slate-700">
            <div className="w-20 h-20 bg-slate-700 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Lock size={36} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2">Espace Idara</h2>
            <p className="text-sm font-bold text-slate-400 mb-8">Vous êtes connecté en tant qu'administrateur. L'application client est désactivée par défaut pour vous.</p>
            <button onClick={() => {
                localStorage.setItem('pwa_mode', 'admin');
                const route = `/idara`;
                window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#' + route : route;
            }} className="w-full bg-blue-600 text-white font-black uppercase py-4 rounded-xl shadow-lg active:scale-95 transition-all mb-3">
              Ouvrir l'Idara
            </button>
            <button onClick={() => { sessionStorage.setItem('test_client', 'true'); window.location.reload(); }} className="w-full bg-slate-700 text-slate-300 font-bold uppercase py-3 rounded-xl shadow-sm active:scale-95 transition-all border border-slate-600 mb-4">
              Tester l'App Client
            </button>
            <button onClick={handleLogout} className="text-red-400 font-bold uppercase text-xs hover:underline">Se Déconnecter</button>
          </div>
        </div>
      )}
  </Suspense>
    </div>
  );
}