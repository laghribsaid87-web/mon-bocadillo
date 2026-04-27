import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, Mail, Key } from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, setDoc, query, orderBy, limit } from 'firebase/firestore';

import { auth, db, appId, messaging } from './config/firebase';
import { DEFAULT_BRAND, DEFAULT_SETTINGS, DEFAULT_MENU_ITEMS } from './config/constants';
import { printTicket, isDriverOnline, getDistance, setupNotifications } from './utils/helpers';

import AdminDashboard from './views/AdminDashboard';
import PosDashboard from './views/PosDashboard';

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [onlineDrivers, setOnlineDrivers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [notify, setNotify] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [audioObj] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));
  
  const prevOrdersRef = useRef([]);
  const onlineDriversRef = useRef([]);
  const clientsListRef = useRef([]);

  useEffect(() => { onlineDriversRef.current = onlineDrivers; }, [onlineDrivers]);
  useEffect(() => { clientsListRef.current = clientsList; }, [clientsList]);

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
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (s) => {
      if(s.exists()) setSettings(s.data());
    });
    const unsubBrand = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'brand'), (s) => {
      if(s.exists()) setBrand(s.data());
    });
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
            if (pData.isAdmin || pData.isManager) {
              setupNotifications(u.uid, db, messaging, appId);
            }
          }
          else setProfile({});
        });
        return () => unsubProfile();
      } else {
        setUser(null);
        setProfile(null);
      }
    });
    return () => unsub();
  }, []);

  const handleStaffLogin = async () => {
    if (!emailInput || !passwordInput) return showNotify("Dkhel Email w Mot de passe!", "error");
    try {
      const userCred = await signInWithEmailAndPassword(auth, emailInput.trim().toLowerCase(), passwordInput);
      const pSnap = await getDoc(doc(db, 'artifacts', appId, 'users', userCred.user.uid, 'profile', 'data'));
      
      let pData = pSnap.data();
      if (!pSnap.exists() && emailInput.trim().toLowerCase() === 'admin@bocadillo.com') {
         pData = { isAdmin: true, isManager: false, isRegistered: true };
         await setDoc(doc(db, 'artifacts', appId, 'users', userCred.user.uid, 'profile', 'data'), pData, { merge: true });
         showNotify("M'rehba bik a l'Patron ✅", "success");
      } else if (pData?.isAdmin || pData?.isManager) {
         showNotify("M'rehba ✅", "success");
      } else {
         showNotify("Makandkch l'accès!", "error");
         await auth.signOut();
         return;
      }
      setProfile(pData);
    } catch (error) {
      showNotify("Email wla Mot de passe ghalat! ❌", "error");
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Déconnexion ?")) {
      await auth.signOut();
      window.location.reload();
    }
  };

  useEffect(() => {
    if (!user || (!profile?.isAdmin && !profile?.isManager)) return;

    const qOrders = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderBy('createdAt', 'desc'), limit(100));
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

        const newOrds = ords.filter(o => o.status === 'pending' && (!o.notifiedAdmin) && (Date.now() - (o.createdAt?.seconds*1000 || 0) < 60000));
        if (newOrds.length > 0) {
          playNotification();
          newOrds.forEach(o => { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { notifiedAdmin: true }); });
        }
    });

    const unsubClients = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), limit(200)), (snap) => setClientsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubDrivers = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'drivers'), limit(50)), (snap) => {
        const driversList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const uniqueMap = new Map();
        driversList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        driversList.forEach(d => {
            const key = d.phone || d.uid || d.id;
            if (!uniqueMap.has(key)) uniqueMap.set(key, d);
        });
        setOnlineDrivers(Array.from(uniqueMap.values()));
    });

    return () => { unsubOrders(); unsubClients(); unsubDrivers(); };
  }, [user, profile]);

  const updateStatus = async (orderId, newStatus, updates = {}) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), { status: newStatus, updatedAt: serverTimestamp(), ...updates });
  };

  const handleReassignOrder = async (o, rejectingDriverId = null, forceBroadcast = false, isRobot = false) => {
      try {
         let newRejectedBy = [...(o.rejectedBy || [])]; 
         if (rejectingDriverId && !newRejectedBy.includes(rejectingDriverId)) newRejectedBy.push(rejectingDriverId);
         
         const branch = o.nearestBranch; 
         if(!branch) return;

         let bD = null, mD = Infinity, bDObj = null;
         const isFirstAttempt = newRejectedBy.length === 0 && !forceBroadcast;

         onlineDriversRef.current.forEach(d => {
             const cInfo = clientsListRef.current.find(c => c.uid === d.uid || (d.phone && c.id === d.phone));
             if(isDriverOnline(d) && d.isAvailable && cInfo && cInfo.isDriver === true && !newRejectedBy.includes(d.uid)) {
                 if (cInfo.isFreelance && !settings?.freelanceEnabled) return;
                 const dist = (d.lat && d.lng) ? getDistance(branch.lat, branch.lng, d.lat, d.lng) : 9999;
                 
                 if (isFirstAttempt) {
                     if (!cInfo.isFreelance && dist < mD) { mD = dist; bD = d.uid; bDObj = cInfo; }
                 } else {
                     if (dist < mD) { mD = dist; bD = d.uid; bDObj = cInfo; }
                 }
             }
         });

         if (!bD && newRejectedBy.length > 0) {
             newRejectedBy = [];
             onlineDriversRef.current.forEach(d => {
                 const cInfo = clientsListRef.current.find(c => c.uid === d.uid || (d.phone && c.id === d.phone));
                 if(isDriverOnline(d) && d.isAvailable && cInfo && cInfo.isDriver === true) {
                     if (cInfo.isFreelance && !settings?.freelanceEnabled) return;
                     const dist = (d.lat && d.lng) ? getDistance(branch.lat, branch.lng, d.lat, d.lng) : 9999;
                     if (dist < mD) { mD = dist; bD = d.uid; bDObj = cInfo; }
                 }
             });
         }

         if (bD) { 
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { 
                driverId: bD, driverName: bDObj.name || 'Inconnu', isFreelanceDriver: bDObj.isFreelance || false, 
                driverAccepted: false, rejectedBy: newRejectedBy, assignedAtLocal: Date.now(), updatedAt: serverTimestamp(), 
                status: o.status === 'pending' ? 'preparing' : o.status 
             }); 
             if (!isRobot || rejectingDriverId) showNotify(rejectingDriverId ? "Robo dwez l-commande l-livreur akher! 🤖" : "Livreur assigné ✅", "success"); 
         } else { 
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { 
                driverId: null, driverName: null, isFreelanceDriver: false, driverAccepted: false, 
                rejectedBy: [], assignedAtLocal: Date.now(), updatedAt: serverTimestamp() 
             }); 
             if (!isRobot) showNotify("Makayn ta livreur msali daba! ⚠️", "error"); 
         }
     } catch(e) { console.error("Reassign error:", e); }
  };

  const saveSettings = async (newSettings) => {
    setSettings(newSettings);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), newSettings, { merge: true });
  };

  if (!profile?.isAdmin && !profile?.isManager) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: brand?.bgColor || '#f8f9fa'}}>
        {notify && <div className={`fixed top-4 right-4 p-4 rounded-xl z-50 text-white ${notify.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>{notify.msg}</div>}
        <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-black shadow-2xl relative">
          <button onClick={() => window.location.href = '/'} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 bg-gray-100 rounded-full p-2"><X size={20}/></button>
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200"><Lock size={28} className="text-gray-800" /></div>
          <h2 className="text-center font-black uppercase mb-6 text-xl tracking-widest text-gray-800">Accès Idara</h2>
          <div className="space-y-4 mb-6">
              <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input type="email" placeholder="Email (ex: admin@bocadillo.com)" className="w-full bg-gray-50 border border-gray-200 p-4 pl-12 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-colors" value={emailInput} onChange={e => setEmailInput(e.target.value)} />
              </div>
              <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input type="password" placeholder="Mot de passe" className="w-full bg-gray-50 border border-gray-200 p-4 pl-12 rounded-2xl text-sm font-mono outline-none focus:border-blue-500 focus:bg-white transition-colors" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleStaffLogin()} />
              </div>
          </div>
          <button onClick={handleStaffLogin} className="w-full bg-black text-white font-black uppercase py-4 rounded-2xl shadow-lg active:scale-95 transition-all">Se Connecter</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {notify && <div className={`fixed top-4 right-4 p-4 rounded-xl z-50 text-white shadow-lg ${notify.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>{notify.msg}</div>}
      <AdminDashboard 
        role={profile.isAdmin ? 'admin' : 'manager'} 
        managerBranchId={profile.managerBranchId}
        orders={orders} 
        updateStatus={updateStatus} 
        clientsList={clientsList} 
        onlineDrivers={onlineDrivers} 
        settings={settings} 
        brand={brand} 
        setBrand={setBrand} 
        saveSettings={saveSettings} 
        db={db} 
        showNotify={showNotify}
        handleReassignOrder={handleReassignOrder}
        printTicket={printTicket}
        defaultMenu={DEFAULT_MENU_ITEMS}
        onLogout={handleLogout}
        appId={appId}
      />
    </>
  );
}