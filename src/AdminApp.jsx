import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Lock, X, Mail, Key, ChefHat, Monitor } from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, setDoc, query, orderBy, limit, where, deleteDoc } from 'firebase/firestore';

import { auth, db, appId, messaging } from './config/firebase';
import { DEFAULT_BRAND, DEFAULT_SETTINGS, DEFAULT_MENU_ITEMS } from './config/constants';
import { printTicket, isDriverOnline, getDistance, setupNotifications } from './utils/helpers';

import ErrorBoundary from './components/ErrorBoundary';

const AdminDashboard = lazy(() => import('./views/AdminDashboard'));
const KitchenDashboard = lazy(() => import('./components/admin/KitchenDashboard'));
const GlovoReports = lazy(() => import('./views/GlovoReports'));

function AdminAppInner() {
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
  const [kdsEmailInput, setKdsEmailInput] = useState('');
  const [kdsPasswordInput, setKdsPasswordInput] = useState('');
  const [rememberAdmin, setRememberAdmin] = useState(localStorage.getItem('admin_remember') === 'true');
  const [rememberKds, setRememberKds] = useState(localStorage.getItem('kds_remember') === 'true');
  
  const prevOrdersRef = useRef([]);
  const onlineDriversRef = useRef([]);
  const clientsListRef = useRef([]);
  const autoLoginAttempted = useRef(false);

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
    if (autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;

    const isKdsRoute = window.location.pathname.startsWith('/kds') || window.location.hash.includes('/kds');

    if (isKdsRoute) {
        const savedKdsEmail = localStorage.getItem('kds_email');
        const savedKdsPwd = localStorage.getItem('kds_pwd_enc');
        if (savedKdsEmail && savedKdsPwd) {
            setKdsEmailInput(savedKdsEmail);
            try { 
                const decoded = atob(savedKdsPwd);
                setKdsPasswordInput(decoded); 
                setTimeout(() => handleKdsLogin(savedKdsEmail, decoded), 300);
            } catch(e) {}
        }
    } else {
        const savedAdminEmail = localStorage.getItem('admin_email');
        const savedAdminPwd = localStorage.getItem('admin_pwd_enc');
        if (savedAdminEmail && savedAdminPwd) {
            setEmailInput(savedAdminEmail);
            try { 
                const decoded = atob(savedAdminPwd);
                setPasswordInput(decoded); 
                setTimeout(() => handleStaffLogin(savedAdminEmail, decoded), 300);
            } catch(e) {}
        }
    }
  }, []);

  const [posStatuses, setPosStatuses] = useState({});

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), (s) => {
      if(s.exists()) setSettings(s.data());
    });
    const unsubBrand = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'brand'), (s) => {
      if(s.exists()) setBrand(s.data());
    });
    const unsubPos = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'pos_status'), (snap) => {
      const statuses = {};
      snap.forEach(d => { statuses[d.id] = d.data(); });
      setPosStatuses(statuses);
    });
    return () => { unsubConfig(); unsubBrand(); unsubPos(); };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', u.uid, 'profile', 'data'), (docSnap) => {
          if (docSnap.exists()) {
            const pData = docSnap.data();
            setProfile(pData);
            if (pData.isAdmin || pData.isManager || pData.isKds) {
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
      // SYSTEME DE RECUPERATION: Ila l-compte lowel tmsa7 wla tboka, ghadi n-creyiw wa7d jdid (admin2)
      if (emailInput.trim().toLowerCase() === 'admin2@bocadillo.com' && passwordInput === '123456') {
          try {
             const { createUserWithEmailAndPassword } = await import('firebase/auth');
             const newUser = await createUserWithEmailAndPassword(auth, 'admin2@bocadillo.com', '123456');
             const pData = { isAdmin: true, isManager: false, isRegistered: true };
             await setDoc(doc(db, 'artifacts', appId, 'users', newUser.user.uid, 'profile', 'data'), pData, { merge: true });
             showNotify("Compte admin2 mssawb mn jdid! M'rehba ✅", "success");
             setProfile(pData);
             return;
          } catch(err2) {
             console.log("Erreur récupération:", err2);
          }
      }
      showNotify("Email wla Mot de passe ghalat! ❌", "error");
    }
  };

  const handleKdsLogin = async () => {
    if (!kdsEmailInput || !kdsPasswordInput) return showNotify("Dkhel Email w Mot de passe!", "error");
    try {
      const userCred = await signInWithEmailAndPassword(auth, kdsEmailInput.trim().toLowerCase(), kdsPasswordInput);
      const pSnap = await getDoc(doc(db, 'artifacts', appId, 'users', userCred.user.uid, 'profile', 'data'));
      const pData = pSnap.data();
      if (pData?.isAdmin || pData?.isManager || pData?.isKds) {
         showNotify("Accès Cuisine autorisé ✅", "success");
      } else {
         showNotify("Makandkch l'accès lel kuzina!", "error");
         await auth.signOut();
      }
    } catch (e) {
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
    const isAuthorized = (profile?.isAdmin || profile?.isManager || profile?.isKds);
    if (!user || !isAuthorized) return;

    // 🔥 OPTIMISATION FIREBASE (QUOTA FIX):
    // N-jibo ghir les commandes dyal lyoum (Shift kybda m3a 4 d-sbah)
    // Hadchi ghay-na9es l-Lectures (Reads) f Firebase b ktr mn 70%
    const limiteDate = new Date();
    if (limiteDate.getHours() < 4) limiteDate.setDate(limiteDate.getDate() - 1);
    limiteDate.setHours(4, 0, 0, 0);
    const qOrders = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), where('createdAt', '>=', limiteDate), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
        const ords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // 🔥 PARSING GLOVO & ENREGISTREMENT CLIENT
        ords.forEach(async (orderData) => {
            if (orderData.source === 'glovo' && !orderData.parsedGlovo) {
                try {
                    let name = "Client Glovo";
                    let phone = "Inconnu";
                    let items = [];
                    let hasParsedSomething = false;

                    // 1. Détection de l'ancien format (JSON) vs nouveau format (Texte Brut)
                    let isOldJsonFormat = false;
                    try {
                        if (orderData.raw_text) {
                            if (typeof orderData.raw_text === 'object') {
                                isOldJsonFormat = true;
                            } else if (typeof orderData.raw_text === 'string') {
                                const t = orderData.raw_text.trim();
                                if (t.startsWith('{') || t.startsWith('[')) isOldJsonFormat = true;
                            }
                        }
                    } catch(e) {}

                    if (isOldJsonFormat) {
                        let rawJson = typeof orderData.raw_text === 'string' ? JSON.parse(orderData.raw_text) : orderData.raw_text;
                        let phoneJson = orderData.phone_text ? (typeof orderData.phone_text === 'string' ? JSON.parse(orderData.phone_text) : orderData.phone_text) : null;
                        let content = rawJson.tout || rawJson;
                        let phoneContent = phoneJson ? (phoneJson.tout || phoneJson) : {};
                        
                        for (let key in phoneContent) {
                          let val = phoneContent[key];
                          if (typeof val === 'string') {
                              let cleanVal = val.replace(/[\s\-]/g, '');
                              if (cleanVal.match(/^(\+|0)\d{8,15}$/)) phone = val.trim();
                          }
                        }
                        if(!phone && phoneContent["com.deliveryhero.rps.restaurantandroidapp:id/phone_number"]) {
                           phone = phoneContent["com.deliveryhero.rps.restaurantandroidapp:id/phone_number"];
                        }

                        let itemsMap = {};
                        for (let key in content) {
                          let val = content[key];
                          if (typeof val !== 'string') continue;
                          if (key.includes('customer_name')) name = val;
                          let m = key.match(/item_name\$(\d+)/);
                          if (m) { if (!itemsMap[m[1]]) itemsMap[m[1]] = {}; itemsMap[m[1]].name = val; }
                          m = key.match(/multiplier_label\$(\d+)/);
                          if (m) { if (!itemsMap[m[1]]) itemsMap[m[1]] = {}; itemsMap[m[1]].qty = parseInt(val.replace('x', '').trim()) || 1; }
                          m = key.match(/item_price\$(\d+)/);
                          if (m) { if (!itemsMap[m[1]]) itemsMap[m[1]] = {}; itemsMap[m[1]].price = parseFloat(val.replace(',', '.').replace('DH', '').trim()) || 0; }
                        }
                        Object.values(itemsMap).forEach(item => { if(item.name) items.push({ name: item.name, qty: item.qty || 1, price: item.price || 0 }); });
                        hasParsedSomething = true;
                    } 
                    
                    // 2. NEW METHOD (TEXT GODROID AUTOMATOR)
                    else if (orderData.orderNote || orderData.raw_text || orderData.phone_text) {
                        const textBody = String(orderData.raw_text || orderData.orderNote || "");
                        const phoneBody = String(orderData.phone_text || "");
                        const text = textBody + "\n" + phoneBody;
                        
                        // Attempt to extract JSON from GoDroid Automator UI Dump
                        let jsonStart = text.indexOf('{');
                        let arrayStart = text.indexOf('[{');
                        if (arrayStart !== -1 && (arrayStart < jsonStart || jsonStart === -1)) jsonStart = arrayStart;
                        
                        if (jsonStart !== -1) {
                            try {
                                let jsonStr = text.substring(jsonStart);
                                let rawJson = JSON.parse(jsonStr);
                                
                                let contentObj = {};
                                if (Array.isArray(rawJson)) {
                                    rawJson.forEach(obj => { if (obj.tout) Object.assign(contentObj, obj.tout); });
                                } else {
                                    contentObj = rawJson.tout || rawJson;
                                }

                                let itemsMap = {};
                                for (let key in contentObj) {
                                    let val = contentObj[key];
                                    if (typeof val !== 'string') continue;
                                    
                                    if (key.includes('customer_content')) name = val;
                                    if (key.includes('phone_number') && val.match(/\d/)) phone = val;
                                    
                                    let m = key.match(/receipt_item_description(?:\$(\d+))?/);
                                    if (m) {
                                        let idx = m[1] || '1';
                                        if (!itemsMap[idx]) itemsMap[idx] = {};
                                        itemsMap[idx].name = val;
                                    }
                                    m = key.match(/receipt_item_price(?:\$(\d+))?/);
                                    if (m) {
                                        let idx = m[1] || '1';
                                        if (!itemsMap[idx]) itemsMap[idx] = {};
                                        itemsMap[idx].price = parseFloat(val.replace(',', '.').replace(/MAD|DH/g, '').trim()) || 0;
                                    }
                                    m = key.match(/receipt_extra_item(?:\$(\d+))?/);
                                    if (m) {
                                        let idx = m[1] || '1';
                                        if (!itemsMap[idx]) itemsMap[idx] = {};
                                        let cleanExtra = val.replace(/"Extra"/g, '+').replace(/Sans/g, '-');
                                        itemsMap[idx].extras = itemsMap[idx].extras ? itemsMap[idx].extras + ', ' + cleanExtra : cleanExtra;
                                    }
                                    m = key.match(/items_count(?:\$(\d+))?/);
                                    if (m) {
                                        let idx = m[1] || '1';
                                        if (!itemsMap[idx]) itemsMap[idx] = {};
                                        itemsMap[idx].qty = parseInt(val) || 1;
                                    }
                                }
                                
                                Object.values(itemsMap).forEach(item => { 
                                    if(item.name) items.push({ 
                                        name: item.name + (item.extras ? ' (' + item.extras + ')' : ''), 
                                        qty: item.qty || 1, 
                                        price: item.price || 0 
                                    }); 
                                });
                            } catch (err) { console.error("Could not parse GoDroid Automator UI JSON", err); }
                        }

                        // Parse Phone Number and Name using lines from phoneBody
                        let phoneLines = phoneBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        let phoneIndex = phoneLines.findIndex(l => l.replace(/[\s\-]/g, '').match(/^(\+?\d{9,15})$/));
                        
                        if (phoneIndex !== -1) {
                            let extractedPhone = phoneLines[phoneIndex].replace(/[\s\-]/g, '').match(/(\+?\d{9,15})/)[1];
                            if (phone === "Inconnu") phone = extractedPhone;
                            if (phoneIndex > 0 && name === "Client Glovo") {
                                name = phoneLines[phoneIndex - 1];
                            }
                        } else {
                            // Backup regex for textBody
                            const cleanText = text.replace(/[\s\-]/g, '');
                            let phoneMatch = cleanText.match(/(\+?\d{9,15})/);
                            if (phoneMatch && phone === "Inconnu") {
                                phone = phoneMatch[1].trim();
                            }
                        }
                        
                        // Fallback if no items extracted
                        if (items.length === 0) {
                            items = [{ name: "📦 Commande Glovo (Voir Détails)", qty: 1, price: 0 }];
                        }
                        hasParsedSomething = true;
                    }

                    if (hasParsedSomething) {
                        let cleanPhone = phone;
                        if (cleanPhone && cleanPhone !== "Inconnu") {
                            cleanPhone = cleanPhone.replace(/\s/g, '').replace(/^\+212/, '0');
                        }
                        
                        const updateData = {
                            customerName: name,
                            phone: cleanPhone || "Inconnu",
                            items: items,
                            parsedGlovo: true,
                            status: "preparing", // 🔥 Important: Envoie directement au KDS !
                            nearestBranch: orderData.nearestBranch || { id: "laymoune", name: "Laymoune" }
                        };

                        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderData.id), updateData);

                        if (cleanPhone && cleanPhone !== "Inconnu") {
                            const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', cleanPhone);
                            await setDoc(clientRef, {
                                phone: cleanPhone,
                                name: name || "Client Glovo",
                                source: "glovo",
                                createdAt: serverTimestamp(),
                                blocked: false,
                                isDriver: false
                            }, { merge: true });
                        }
                    }
                } catch(e) { console.error("Erreur parsing Glovo:", e); }
            }
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

        const newOrds = ords.filter(o => o.status === 'pending' && (!o.notifiedAdmin) && (Date.now() - (o.createdAt?.seconds*1000 || 0) < 60000));
        if (newOrds.length > 0) {
          playNotification();
          newOrds.forEach(o => { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { notifiedAdmin: true }); });
        }
    });

    let unsubClients = () => {};
    let unsubDrivers = () => {};

    // 🔥 OPTIMISATION: L-Kuzina (KDS) ma-me7tajach les clients w les livreurs!
    // Hadchi ghay-wfer l-Lectures dyal GPS Livreur li kano kaytiy7o l-Quota f l-Cuisine.
    if (profile?.isAdmin || profile?.isManager) {
        unsubClients = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), limit(200)), (snap) => setClientsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        unsubDrivers = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'drivers'), limit(50)), (snap) => {
            const driversList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const uniqueMap = new Map();
            driversList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            driversList.forEach(d => {
                const key = d.phone || d.uid || d.id;
                if (!uniqueMap.has(key)) uniqueMap.set(key, d);
            });
            setOnlineDrivers(Array.from(uniqueMap.values()));
        });
    }

    return () => { unsubOrders(); unsubClients(); unsubDrivers(); };
  }, [user, profile]);

  // 🔥 NETTOYAGE AUTO: Supprimer les livreurs fantômes de la base de données (anciens livreurs retirés de l'Idara)
  useEffect(() => {
      if (!profile?.isAdmin && !profile?.isManager) return;
      if (clientsList.length === 0 || onlineDrivers.length === 0) return;
      
      const cleanupGhostDrivers = async () => {
          onlineDrivers.forEach(async (d) => {
              const exists = clientsList.some(c => c.isDriver === true && ((c.uid && c.uid === d.uid) || (d.phone && c.id === d.phone) || (c.id === d.id) || (c.id === d.uid)));
              if (!exists) {
                  try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', d.id)); } catch (e) {}
              }
          });
      };
      cleanupGhostDrivers();
  }, [clientsList, onlineDrivers, profile, db, appId]);

  const updateStatus = async (orderId, newStatus, updates = {}) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), { status: newStatus, updatedAt: serverTimestamp(), ...updates });
  };

  const handleReassignOrder = async (o, rejectingDriverId = null, forceBroadcast = false, isRobot = false, manualTargetDriverId = null) => {
      try {
         // 🔥 Si Idara demande un livreur manuellement, on vide la liste noire (rejectedBy) bach y3awd ytsifet lihom
         let newRejectedBy = forceBroadcast ? [] : [...(o.rejectedBy || [])]; 
         if (rejectingDriverId && !newRejectedBy.includes(rejectingDriverId)) newRejectedBy.push(rejectingDriverId);
         
         // 🔥 ASSIGNATION MANUELLE DIRECTE (DEPUIS LA CAISSE)
         if (manualTargetDriverId) {
             const dInfo = clientsListRef.current.find(c => c.uid === manualTargetDriverId || c.id === manualTargetDriverId);
             await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), {
                driverId: manualTargetDriverId,
                driverName: dInfo ? (dInfo.name || 'Inconnu') : 'Inconnu',
                isFreelanceDriver: dInfo ? (dInfo.isFreelance || false) : false,
                driverAccepted: false,
                rejectedBy: newRejectedBy.filter(id => id !== manualTargetDriverId), // N7iydouh mn liste noire ila kan fiha
                assignedAtLocal: Date.now(),
                updatedAt: serverTimestamp(),
                status: o.status === 'pending' ? 'preparing' : o.status,
                notifiedDriver: false, // 🔥 Nforcing sonnette 3nd livreur
                isManualAssignment: true // 🔥 INDICATEUR D'ASSIGNATION MANUELLE
             });
             if (!isRobot) showNotify("Livreur assigné manuellement ✅", "success");
             return;
         }

         const branch = o.nearestBranch; 
         if(!branch) return;

         let bD = null, mD = Infinity, bDObj = null;
         const isFirstAttempt = newRejectedBy.length === 0 && !forceBroadcast;

         onlineDriversRef.current.forEach(d => {
             const cInfo = clientsListRef.current.find(c => (c.uid && c.uid === d.uid) || (d.phone && c.id === d.phone));
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
             newRejectedBy = []; // Reset liste noire ila makayn 7ed
             onlineDriversRef.current.forEach(d => {
                 const cInfo = clientsListRef.current.find(c => (c.uid && c.uid === d.uid) || (d.phone && c.id === d.phone));
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
                status: o.status === 'pending' ? 'preparing' : o.status,
                notifiedDriver: false // 🔥 Nforcing sonnette 3nd livreur
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

  // 🔥 Chargement de l'écran KDS (Support Web w Electron via Hash)
  if (window.location.pathname.startsWith('/kds') || window.location.hash.includes('/kds')) {
    if (!profile?.isAdmin && !profile?.isManager && !profile?.isKds) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-950 font-sans selection:bg-orange-500/30">
          {notify && <div className={`fixed top-4 right-4 p-4 rounded-xl z-50 text-white ${notify.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>{notify.msg}</div>}
          <div className="bg-neutral-900 p-8 md:p-10 rounded-[3rem] w-full max-w-sm text-white shadow-2xl relative border border-neutral-800">
            <button onClick={() => window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#/idara' : '/idara'} className="absolute top-5 right-5 text-neutral-500 hover:text-white bg-neutral-800 rounded-full p-2 transition-all"><X size={20}/></button>
            <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-neutral-700 shadow-inner"><ChefHat size={32} className="text-orange-500" /></div>
            <h2 className="text-center font-black uppercase mb-2 text-2xl tracking-widest text-white">KDS Cuisine</h2>
            <p className="text-center text-xs font-bold text-neutral-500 mb-8">Connectez-vous avec le compte cuisine</p>
            <div className="space-y-4 mb-8">
                <input type="email" placeholder="Email Cuisine" className="w-full bg-neutral-950 border-2 border-neutral-800 p-4 rounded-2xl text-center text-sm font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all shadow-inner" value={kdsEmailInput} onChange={e => setKdsEmailInput(e.target.value)} />
                <input type="password" placeholder="Mot de passe" className="w-full bg-neutral-950 border-2 border-neutral-800 p-4 rounded-2xl text-center text-sm font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all shadow-inner" value={kdsPasswordInput} onChange={e => setKdsPasswordInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleKdsLogin()} />
            </div>
            <button onClick={handleKdsLogin} className="w-full bg-orange-600 text-white font-black uppercase py-5 rounded-2xl shadow-[0_0_20px_rgba(234,88,12,0.3)] active:scale-95 transition-all text-sm tracking-wider">Déverrouiller</button>
          </div>
        </div>
      );
    }
    return (
      <>
        {notify && <div className={`fixed top-4 right-4 p-4 rounded-xl z-50 text-white shadow-lg ${notify.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>{notify.msg}</div>}
        <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white"><div className="w-12 h-12 border-4 border-neutral-800 border-t-orange-500 rounded-full animate-spin"></div></div>}>
            <KitchenDashboard activeOrders={orders} updateStatus={updateStatus} printTicket={printTicket} brand={brand} settings={settings} profile={profile} />
        </Suspense>
      </>
    );
  }

  // 🔥 Chargement de l'écran Glovo Reports
  if (window.location.pathname.startsWith('/glovo-reports') || window.location.hash.includes('/glovo-reports')) {
    if (!profile?.isAdmin && !profile?.isManager) {
        return <div className="min-h-screen flex items-center justify-center p-4">Accès Refusé.</div>;
    }
    return (
      <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500"><div className="w-12 h-12 border-4 border-gray-200 border-t-[#FFC244] rounded-full animate-spin"></div></div>}>
          <GlovoReports brand={brand} />
      </Suspense>
    );
  }

  if (!profile?.isAdmin && !profile?.isManager) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: brand?.bgColor || '#f8f9fa'}}>
        {notify && <div className={`fixed top-4 right-4 p-4 rounded-xl z-50 text-white ${notify.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>{notify.msg}</div>}
        <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-black shadow-2xl relative">
          <button onClick={() => window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#/' : '/'} className="absolute top-5 right-5 text-gray-400 hover:text-red-500 bg-gray-100 rounded-full p-2"><X size={20}/></button>
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
          
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <button onClick={() => window.location.href = navigator.userAgent.toLowerCase().includes('electron') ? '#/kds' : '/kds'} className="text-xs font-black text-gray-400 hover:text-orange-500 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors">
                  <ChefHat size={16}/> Ouvrir l'Écran Cuisine (KDS)
              </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {notify && <div className={`fixed top-4 right-4 p-4 rounded-xl z-50 text-white shadow-lg ${notify.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>{notify.msg}</div>}
      
      {/* 🔥 Boutons flottants pour ouvrir KDS et TV depuis l'Idara */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
          <button onClick={() => {
              const route = profile?.managerBranchId && profile.managerBranchId !== 'ALL' ? `/tv?branch=${profile.managerBranchId}` : '/tv';
              window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank', 'width=1024,height=768');
          }} className="bg-neutral-900 text-white p-4 md:px-6 md:py-4 rounded-full md:rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.4)] flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 border-2 border-neutral-700 group hover:bg-black">
              <Monitor size={28} className="text-blue-400 group-hover:scale-110 transition-transform" /> 
              <span className="hidden md:inline-block font-black uppercase text-sm tracking-widest text-white">Écran TV</span>
          </button>

          <button onClick={() => {
              const route = profile?.managerBranchId && profile.managerBranchId !== 'ALL' ? `/kds?branch=${profile.managerBranchId}` : '/kds';
              window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank', 'width=1024,height=768');
          }} className="bg-neutral-900 text-white p-4 md:px-6 md:py-4 rounded-full md:rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.4)] flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 border-2 border-neutral-700 group hover:bg-black">
              <ChefHat size={28} className="text-orange-500 group-hover:rotate-12 transition-transform" /> 
              <span className="hidden md:inline-block font-black uppercase text-sm tracking-widest text-white">Cuisine (KDS)</span>
          </button>
      </div>

  <Suspense fallback={<div className="h-screen w-full bg-slate-900 flex items-center justify-center"><div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div></div>}>
    <AdminDashboard 
        role={profile.isAdmin ? 'admin' : 'manager'} 
        managerBranchId={profile.managerBranchId}
        orders={orders} 
        updateStatus={updateStatus} 
        clientsList={clientsList} 
        onlineDrivers={onlineDrivers} 
        settings={settings} 
        posStatuses={posStatuses}
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
  </Suspense>
    </>
  );
}

export default function AdminApp(props) {
    return (
        <ErrorBoundary>
            <AdminAppInner {...props} />
        </ErrorBoundary>
    );
}