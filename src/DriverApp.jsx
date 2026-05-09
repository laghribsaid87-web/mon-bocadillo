import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, Download } from 'lucide-react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, query, limit, orderBy, getDoc, setDoc } from 'firebase/firestore';

import { auth, db, appId, messaging } from './config/firebase';
import { DEFAULT_BRAND, DEFAULT_SETTINGS } from './config/constants';
import { setupNotifications } from './utils/helpers';
import DriverDashboard from './views/DriverDashboard';
import AuthView from './views/AuthView';
import ErrorBoundary from './components/ErrorBoundary';

function DriverAppInner() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
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
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    }
  };
  const [loading, setLoading] = useState(true);
  const [audioObj] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  const prevOrdersRef = useRef([]);

  const playNotification = () => {
    try {
      audioObj.play().catch(e=>console.log('Audio bloqué', e));
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch(err){}
  };

  const showNotify = (msg, type = 'info') => {
    setNotify({ msg, type });
    setTimeout(() => setNotify(null), 3000);
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

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (s) => { if(s.exists()) setSettings(s.data()); });
    const unsubBrand = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'brand'), (s) => { if(s.exists()) setBrand(s.data()); });
    return () => { unsubConfig(); unsubBrand(); };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), (docSnap) => {
          if (docSnap.exists()) {
            const pData = docSnap.data();
            setProfile(pData);
            if (pData.isRegistered) {
              setupNotifications(u.uid, db, messaging, appId);
            }
          }
          else setProfile({});
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        signInAnonymously(auth).catch(() => setLoading(false));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !profile?.isDriver) return;

    const qOrders = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderBy('createdAt', 'desc'), limit(50));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
        const ords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(ords);
        
        let hasStatusChange = false;
        const prevOrds = prevOrdersRef.current;
        if (prevOrds.length > 0) {
            ords.forEach(newO => {
                const oldO = prevOrds.find(o => o.id === newO.id);
                if (oldO && oldO.status !== newO.status && (newO.driverId === user.uid || newO.status === 'pending')) hasStatusChange = true;
                if (oldO && oldO.adminMessage !== newO.adminMessage && newO.adminMessage === 'jawbak' && newO.driverId === user.uid) hasStatusChange = true;
            });
        }
        if (hasStatusChange) playNotification();
        prevOrdersRef.current = ords;

        const myNewOrds = ords.filter(o => o.driverId === user.uid && !o.driverAccepted && (!o.notifiedDriver));
        if (myNewOrds.length > 0) {
          playNotification();
          myNewOrds.forEach(o => { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { notifiedDriver: true }); });
        }
    });

    const unsubClients = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), limit(200)), (snap) => setClientsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubOrders(); unsubClients(); };
  }, [user, profile]);

  const updateStatus = async (orderId, newStatus, updates = {}) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), { status: newStatus, updatedAt: serverTimestamp(), ...updates }); };

  const handleReassignOrder = async (o, rejectingDriverId) => {
      let newRejectedBy = [...(o.rejectedBy || [])]; 
      if (rejectingDriverId && !newRejectedBy.includes(rejectingDriverId)) newRejectedBy.push(rejectingDriverId);
      
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { 
         driverId: null, driverName: null, driverAccepted: false, rejectedBy: newRejectedBy, assignedAtLocal: Date.now(), updatedAt: serverTimestamp() 
      }); 
      showNotify("Commande refusée", "info");
  };

  const handleLogout = async () => {
    if (window.confirm("Déconnexion ?")) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user.uid), { isOnline: false, isAvailable: false });
      await auth.signOut();
      window.location.reload();
    }
  };

  if (loading) return <div className="h-screen flex flex-col items-center justify-center space-y-4" style={{backgroundColor: brand?.bgColor || '#f8f9fa'}}><div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-[#ffbc0d] animate-spin" style={{borderTopColor: brand?.color || '#ffbc0d'}}></div></div>;

  if (!profile?.isRegistered) {
    return (
      <>
        {notify && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full text-white shadow-lg font-bold text-xs uppercase tracking-widest ${notify.type === 'error' ? 'bg-red-500' : 'bg-black'}`}>{notify.msg}</div>}
        <AuthView 
          brand={brand} 
          settings={settings} 
          showNotify={showNotify} 
          db={db}
          onComplete={async (data) => {
            const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', data.phone);
            const snap = await getDoc(clientRef);
            let roleData = { isAdmin: false, isManager: false, managerBranchId: null, isDriver: true, isFreelance: true, blocked: false };
            let finalData = { ...data };
            
            if (snap.exists()) {
              const c = snap.data();
              if (c.blocked) { showNotify("Had l-compte msouwer (Bloqué) 🚫", "error"); return; }
              finalData.name = c.name || data.name;
              roleData.isFreelance = c.isFreelance !== undefined ? c.isFreelance : true;
              await updateDoc(clientRef, { isDriver: true, isFreelance: roleData.isFreelance, uid: user.uid });
            } else {
              await setDoc(clientRef, { name: data.name, phone: data.phone, blocked: false, isDriver: true, isFreelance: true, uid: user.uid, createdAt: serverTimestamp() });
            }
            
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { ...finalData, ...roleData, isRegistered: true, updatedAt: serverTimestamp() }, { merge: true });
            showNotify("Mar7ba bik a Livreur! 🛵", "success");
          }} 
        />
      </>
    );
  }

  if (!profile?.isDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-black shadow-2xl relative text-center">
          <button onClick={() => window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#/' : '/'} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 bg-gray-100 rounded-full p-2"><X size={20}/></button>
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100"><Lock size={28} className="text-red-500" /></div>
          <h2 className="font-black uppercase mb-2 text-xl tracking-widest text-gray-800">Accès Refusé</h2>
          <p className="text-sm text-gray-500 mb-6 font-bold">Vous n'êtes pas enregistré comme livreur.</p>
          <p className="text-xs text-gray-400 bg-gray-50 p-4 rounded-xl border border-gray-100">Demandez à l'administration de vous donner l'accès livreur sur votre numéro.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {deferredPrompt && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] bg-white p-3 rounded-2xl shadow-2xl border-2 flex items-center gap-3 w-[90%] max-w-md animate-in slide-in-from-top-5" style={{borderColor: brand?.color || '#ffbc0d'}}>
          <div className="bg-gray-100 p-2 rounded-xl shrink-0"><Download size={20} style={{color: brand?.color || '#ffbc0d'}}/></div>
          <div className="flex-1 text-left">
            <p className="text-[11px] font-black uppercase leading-tight text-gray-800">Installer l'Application</p>
            <p className="text-[9px] font-bold text-gray-500 leading-tight">Accès rapide pour les coursiers</p>
          </div>
          <button onClick={handleInstallClick} className="px-4 py-2 text-[10px] font-black uppercase rounded-xl text-black shadow-md shrink-0" style={{backgroundColor: brand?.color || '#ffbc0d'}}>Installer</button>
          <button onClick={() => setDeferredPrompt(null)} className="p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-lg shrink-0"><X size={14}/></button>
        </div>
      )}
      {notify && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full text-white shadow-lg font-bold text-xs uppercase tracking-widest ${notify.type === 'error' ? 'bg-red-500' : 'bg-black'}`}>{notify.msg}</div>}
      <DriverDashboard orders={orders} user={user} profile={profile} brand={brand} updateStatus={updateStatus} db={db} showNotify={showNotify} onLogout={handleLogout} clientsList={clientsList} handleReassignOrder={handleReassignOrder} settings={settings} appId={appId} />
    </>
  );
}

export default function DriverApp(props) {
    return (
        <ErrorBoundary>
            <DriverAppInner {...props} />
        </ErrorBoundary>
    );
}