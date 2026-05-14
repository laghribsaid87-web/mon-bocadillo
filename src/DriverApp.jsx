import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Lock, X, Download } from 'lucide-react';
import { onAuthStateChanged, signInAnonymously, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, query, limit, orderBy, getDoc, setDoc, where, or, and } from 'firebase/firestore';

import { auth, db, appId, messaging } from './config/firebase';
import { DEFAULT_BRAND, DEFAULT_SETTINGS } from './config/constants';
import { setupNotifications } from './utils/helpers';

import ErrorBoundary from './components/ErrorBoundary';

const DriverDashboard = lazy(() => import('./views/DriverDashboard'));
const Auth = lazy(() => import('./views/Auth'));

function DriverAppInner() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [orderLimit, setOrderLimit] = useState(5);
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
      localStorage.setItem('pwa_mode', 'livreur');
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
    let unsubAuth = null;
    let unsubProfile = null;

    // 🔥 Darna persistence locale bach Firebase y39el 3la l-livreur dima
    setPersistence(auth, browserLocalPersistence).then(() => {
      unsubAuth = onAuthStateChanged(auth, async (u) => {
        if (u) {
          setUser(u);
          const savedPhone = localStorage.getItem('driver_phone');
  
          if (unsubProfile) unsubProfile();
          unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), async (docSnap) => {
            if (docSnap.exists()) {
              const pData = docSnap.data();
              setProfile(pData);
              if (pData.isRegistered) {
                setupNotifications(u.uid, db, messaging, appId);
              }
              setLoading(false);
            }
            else {
              if (savedPhone) {
                try {
                  const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', savedPhone);
                  const clientSnap = await getDoc(clientRef);
                  if (clientSnap.exists() && clientSnap.data().isDriver) {
                     const data = clientSnap.data();
                     localStorage.setItem('pwa_mode', 'livreur');
                     await updateDoc(clientRef, { uid: u.uid });
                     await setDoc(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), { ...data, isRegistered: true, isManager: false, isAdmin: false, isDriver: true, updatedAt: serverTimestamp() }, { merge: true });
                     return;
                  } else {
                     localStorage.removeItem('driver_phone');
                     setProfile({});
                  }
                } catch(e) {
                  setProfile({});
                }
              } else {
                setProfile({});
              }
              setLoading(false);
            }
          });
        } else {
          signInAnonymously(auth).catch(() => setLoading(false));
        }
      });
    }).catch(err => console.error("Erreur Auth Persistence:", err));

    return () => {
      if (unsubAuth) unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    if (!user || !profile?.isDriver) return;

    const limiteDate = new Date();
    limiteDate.setHours(limiteDate.getHours() - 12);

    let qOrders;
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');

    if (profile.isFreelance) {
        qOrders = query(
            ordersRef,
            where('driverId', '==', user.uid),
            where('createdAt', '>=', limiteDate),
            orderBy('createdAt', 'desc'),
            limit(orderLimit)
        );
    } else {
        qOrders = query(
            ordersRef,
            and(
                where('createdAt', '>=', limiteDate),
                or(
                    where('driverId', '==', user.uid),
                    and(where('isFreelanceDriver', '==', true), where('driverAccepted', '==', false))
                )
            ),
            orderBy('createdAt', 'desc'),
            limit(orderLimit)
        );
    }

    const unsubOrders = onSnapshot(qOrders, (snap) => {
        const fetchedOrds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const ords = fetchedOrds.filter(o => o.source !== 'pos');
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
    }, (error) => {
        console.error("🚨 Erreur Firestore (Index manquant) :", error);
        if (error.message && error.message.includes("requires an index")) {
            showNotify("⚠️ Khassk t-creer Index f Firebase! Chouf l-Console (F12)", "error");
        }
    });

    return () => unsubOrders();
  }, [user, profile, orderLimit]);

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
      localStorage.removeItem('driver_phone');
      await auth.signOut();
      window.location.reload();
    }
  };

  if (loading) return <div className="h-screen flex flex-col items-center justify-center space-y-4" style={{backgroundColor: brand?.bgColor || '#f8f9fa'}}><div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-[#ffbc0d] animate-spin" style={{borderTopColor: brand?.color || '#ffbc0d'}}></div></div>;

  if (!profile?.isRegistered) {
    return (
      <>
        {notify && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full text-white shadow-lg font-bold text-xs uppercase tracking-widest ${notify.type === 'error' ? 'bg-red-500' : 'bg-black'}`}>{notify.msg}</div>}
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div></div>}>
          <Auth 
          type="livreur"
          brand={brand}
          loading={loading}
          onLogin={async (phone, pin) => {
            setLoading(true);
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length === 9 && (cleanPhone.startsWith('6') || cleanPhone.startsWith('7'))) cleanPhone = '0' + cleanPhone;
            try {
              const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', cleanPhone);
              const snap = await getDoc(clientRef);
              if (snap.exists()) {
                const data = snap.data();
                if (data.blocked) { showNotify("Had l-compte msouwer (Bloqué) 🚫", "error"); setLoading(false); return; }
                if (data.isDriver && data.otp === pin) {
                  localStorage.setItem('driver_phone', cleanPhone);
                  localStorage.setItem('pwa_mode', 'livreur');
                  await updateDoc(clientRef, { otpVerified: true, uid: user.uid });
                  await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { ...data, isRegistered: true, isManager: false, isAdmin: false, isDriver: true, updatedAt: serverTimestamp() }, { merge: true });
                  showNotify("Mar7ba bik a Livreur! 🛵", "success");
                } else {
                  showNotify("L-Code OTP ghalat awla nta machi livreur.", "error");
                }
              } else {
                showNotify("Had n-nmra ma-mssjlash 3ndna f l-Idara.", "error");
              }
            } catch (error) {
              console.error(error);
              showNotify("Mochkil f l-connexion.", "error");
            }
            setLoading(false);
          }} 
        />
        </Suspense>
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
  <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div></div>}>
    <DriverDashboard orders={orders} user={user} profile={profile} brand={brand} updateStatus={updateStatus} db={db} showNotify={showNotify} onLogout={handleLogout} handleReassignOrder={handleReassignOrder} settings={settings} appId={appId} loadMoreOrders={() => setOrderLimit(prev => prev + 5)} />
  </Suspense>
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