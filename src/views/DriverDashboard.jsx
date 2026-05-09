import React, { useState, useEffect, useRef } from 'react';
import { Power, Truck, BellRing, MapPin, Navigation, Store, CheckCircle, Phone, MessageCircle, AlertTriangle, User, LogOut, Utensils, Map as MapIcon, Info, History, Check, X, Clock, Maximize, Minimize } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, onMessage, getToken } from 'firebase/messaging';
import { getWhatsAppFormat, getDistance, formatSansIngredient, openWhatsAppDirect } from '../utils/helpers';
import StatusBadge from '../components/StatusBadge';
import ClientTrackingMap from '../components/ClientTrackingMap';
import LiveTimer from '../components/LiveTimer';
import { VAPID_KEY } from '../config/firebase';

export default function DriverDashboard({ orders, user, profile, brand, updateStatus, db, showNotify, onLogout, clientsList, handleReassignOrder, settings, appId }) {
    const [isOnline, setIsOnline] = useState(true);
    const [location, setLocation] = useState(null);
    const [tab, setTab] = useState('attente'); // 'attente', 'acceptee', 'en_route', 'history'
    const [fullScreenMap, setFullScreenMap] = useState(null); // url for map
    
    // 🔥 Jdid: State dyal Sonnette w Vibreur
    const [isAppLoaded, setIsAppLoaded] = useState(false);
    const knownMissionsRef = useRef(new Set());

    // 🔥 Jdid: State l-GPS on-demand
    const [gpsActive, setGpsActive] = useState(false);
    const [gpsTimeoutId, setGpsTimeoutId] = useState(null);
    const lastGpsUpdateRef = useRef(0);
    const [deferredPrompt, setDeferredPrompt] = useState(null); // Jdid: PWA Install
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);

    useEffect(() => {
        // Zoom global de l'interface (Ajusté pour être un peu plus grand)
        document.documentElement.style.fontSize = '13px';
    }, []);

    // Les commandes dyal had l-livreur (DEFINI AVANT useEffect)
    const { myOrders, activeOrders, newMissions, toPickupMissions, deliveryMissions } = useMemo(() => {
        const myOrds = orders?.filter(o => {
            if (o.source === 'pos') return false;
            if (o.driverId === user?.uid) return true;
            if (!profile?.isFreelance && o.isFreelanceDriver && !o.driverAccepted && o.status !== 'delivered' && o.status !== 'rejected') return true;
            return false;
        }) || [];
        const actives = myOrds.filter(o => !['delivered', 'rejected'].includes(o.status));
        return {
            myOrders: myOrds,
            activeOrders: actives,
            newMissions: actives.filter(o => !o.driverAccepted),
            toPickupMissions: actives.filter(o => o.driverAccepted && ['pending', 'preparing', 'ready'].includes(o.status)),
            deliveryMissions: actives.filter(o => o.driverAccepted && o.status === 'out_for_delivery')
        };
    }, [orders, user?.uid, profile?.isFreelance]);

    // 🔥 Robot Sorting (Tartib b l-wa9t, w nchoufo chkon li f tri9)
    let sortedDeliveryMissions = [...deliveryMissions].sort((a, b) => {
        const timeA = a.acceptedAtLocal || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.acceptedAtLocal || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeA - timeB;
    });

    if (location && sortedDeliveryMissions.length > 1) {
        const primary = sortedDeliveryMissions[0];
        const distDriverToPrimary = getDistance(location.lat, location.lng, primary.lat, primary.lng);
        
        let bestEnRouteIndex = -1;
        let minEnRouteDist = Infinity;

        for (let i = 1; i < sortedDeliveryMissions.length; i++) {
            const other = sortedDeliveryMissions[i];
            if (!other.lat || !other.lng) continue;
            
            const distDriverToOther = getDistance(location.lat, location.lng, other.lat, other.lng);
            const distOtherToPrimary = getDistance(other.lat, other.lng, primary.lat, primary.lng);

            // Ila kant commande akhra a9rab l-livreur mn l-commande l-wla, w majayach b3ida 3la tri9 (+ 1.5x aw 2km max)
            if (distDriverToOther < distDriverToPrimary && (distDriverToOther + distOtherToPrimary <= distDriverToPrimary * 1.5 || distDriverToOther + distOtherToPrimary <= distDriverToPrimary + 2)) {
                if (distDriverToOther < minEnRouteDist) {
                    minEnRouteDist = distDriverToOther;
                    bestEnRouteIndex = i;
                }
            }
        }

        if (bestEnRouteIndex !== -1) {
            const recommended = sortedDeliveryMissions.splice(bestEnRouteIndex, 1)[0];
            recommended.isRobotRecommended = true;
            sortedDeliveryMissions.unshift(recommended);
        }
    }

    // 🔥 NOUVEAU: Écouter l'événement pour installer la PWA (Livreur)
    useEffect(() => {
        // Nchoufo wach l-event deja wsel f main.jsx
        if (window.deferredPWAInstall) {
            setDeferredPrompt(window.deferredPWAInstall);
            setShowInstallBtn(true);
        }

        const handler = (e) => {
            e.preventDefault();
            window.deferredPWAInstall = e;
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            window.deferredPWAInstall = null;
            setShowInstallBtn(false);
        }
        setDeferredPrompt(null);
    };

    // 🔥 Jdid: Sonnette w Vibreur mnin katjih commande jdida
    useEffect(() => {
        if (!isAppLoaded) {
            const initial = new Set();
            (newMissions || []).forEach(o => initial.add(o.id));
            knownMissionsRef.current = initial;
            setIsAppLoaded(true);
            return;
        }

        if (!newMissions || newMissions.length === 0) return;

        let hasNew = false;
        newMissions.forEach(o => {
            if (!knownMissionsRef.current.has(o.id)) {
                hasNew = true;
                knownMissionsRef.current.add(o.id);
            }
        });

        if (hasNew && isOnline) {
            try {
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(e => console.log("Audio bloqué", e));
                
                if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]); // Vibre 3 d-lmrat
            } catch (e) { console.log("Erreur son/vibreur", e); }
        }
    }, [newMissions, isAppLoaded, isOnline]);

    // 🔥 Jdid: Listen FCM notifications silencieuses bach ych3el GPS
    useEffect(() => {
        const setupFCM = async () => {
            try {
                const messaging = getMessaging();
                
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        const token = await getToken(messaging, { 
                            vapidKey: VAPID_KEY
                        });
                        if (token && user?.uid) {
                            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user.uid), {
                                fcmToken: token,
                                fcmUpdatedAt: serverTimestamp()
                            }, { merge: true });
                            console.log("🔔 FCM Token enregistré b-naja7 !");
                        }
                    }
                } catch(err) {
                    console.log("Erreur Notification permission / token:", err);
                }

                const unsubscribe = onMessage(messaging, (payload) => {
                    if (payload.data?.type === 'WAKE_UP_GPS') {
                        console.log("🔔 Réception FCM (Silent) : Wake Up GPS !");
                        setGpsActive(true);
                        
                        if (gpsTimeoutId) clearTimeout(gpsTimeoutId);
                        
                        // Auto-Stop ba3d 5 d9ay9
                        const id = setTimeout(() => {
                            console.log("🛑 Auto-stop GPS après 5 min (Économie Batterie)");
                            setGpsActive(false);
                        }, parseInt(payload.data.duration) || 300000);
                        
                        setGpsTimeoutId(id);
                    }
                });
                return () => unsubscribe();
            } catch(e) {
                console.log("FCM non supporté (Service Worker manquante ou pas setup)", e);
            }
        };
        setupFCM();
    }, [user?.uid, db, appId]);

    // Track GPS dyal Livreur (On-Demand & Auto-Stop)
    useEffect(() => {
        // 🔥 Dima n-trackiw l'GPS ila kan l-livreur "En ligne" bach yban f l'Idara (Live Map)
        const shouldTrack = isOnline || gpsActive;

        if (!shouldTrack || !user?.uid) {
            return;
        }

        console.log("🚀 Démarrage GPS tracking (On-Demand)...");
        
        let watchId;
        
        const pushLocation = async (pos) => {
            const lat = pos.coords.latitude; const lng = pos.coords.longitude;
            setLocation({ lat, lng });

            const now = Date.now();
            // 🔥 Optimisation Quota Firebase: Nzidou l'interval d'attente l 60 taniya (1 min) au lieu d 30s
            let updateInterval = 60000; 
            if (activeOrders.length > 0 && activeOrders[0].lat && activeOrders[0].lng) {
                const dist = getDistance(lat, lng, activeOrders[0].lat, activeOrders[0].lng);
                if (dist <= 1) updateInterval = 30000; // ila 9rib, 30s baraka bach mankhesrouch Writes dyal Firebase
            }
            
            // Si c'est la première fois qu'on récupère la position, on push direct
            if (lastGpsUpdateRef.current > 0 && now - lastGpsUpdateRef.current < updateInterval) return;
            lastGpsUpdateRef.current = now;

            const driverRef = doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user?.uid);
            await setDoc(driverRef, { uid: user?.uid, phone: profile?.phone || '', name: profile?.name || '', lat, lng, isOnline: true, isAvailable: activeOrders.length === 0, updatedAt: serverTimestamp() }, {merge: true});
        };

        const handleError = (err) => {
            console.error('GPS Error', err);
            if (err.code === 1) showNotify("Mochkil f GPS, 3afak ch3el localisation w 3ti permission!", "error");
        };

        // 1. Push immédiat sans attendre le watch
        navigator.geolocation.getCurrentPosition(pushLocation, handleError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

        // 2. Lancement du watch pour les déplacements
        watchId = navigator.geolocation.watchPosition(pushLocation, handleError, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
        
        return () => {
            if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
        };
    }, [isOnline, gpsActive, user?.uid, profile?.name, profile?.phone, db, appId, activeOrders.length, showNotify]);

    // Hssab dyal l-youm
    const todayStr = new Date().toISOString().split('T')[0];
    
    const { historyOrdersToday, cancelledPaidOrders, earningsToday, paidOrdersToday } = useMemo(() => {
        const history = myOrders.filter(o => {
            if (!['delivered', 'rejected'].includes(o.status)) return false;
            let d = new Date();
            if (o.deliveredAtLocal) d = new Date(o.deliveredAtLocal);
            else if (o.createdAt?.seconds) d = new Date(o.createdAt.seconds * 1000);
            return d.toISOString().split('T')[0] === todayStr;
        });
        const paid = history.filter(o => o.status === 'delivered' || (o.status === 'rejected' && o.driverPaid === true));
        return {
            historyOrdersToday: history,
            paidOrdersToday: paid,
            cancelledPaidOrders: paid.filter(o => o.status === 'rejected' && o.driverPaid === true && !o.driverAcknowledgedReturn),
            earningsToday: profile?.isFreelance ? (paid.length * 10) : 0
        };
    }, [myOrders, todayStr, profile?.isFreelance]);

    // Sauvegarder le statut isOnline quand il change
    useEffect(() => {
        const saveOnlineStatus = async () => {
            if (!user?.uid) return;
            try {
                const driverRef = doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user?.uid);
                await setDoc(driverRef, { 
                    uid: user?.uid, 
                    phone: profile?.phone || '', 
                    name: profile?.name || '', 
                    isOnline: isOnline, 
                    isAvailable: isOnline ? (activeOrders.length === 0) : false,
                    updatedAt: serverTimestamp() 
                }, {merge: true});
            } catch(e) { console.log('Error saving online status', e); }
        };
        saveOnlineStatus();
    }, [isOnline, user?.uid, profile?.phone, profile?.name, db, appId, activeOrders.length]);

    const toggleStatus = async () => {
        const newState = !isOnline;
        setIsOnline(newState);
        showNotify(newState ? "Rak en ligne daba 🟢" : "Hors ligne 🔴", newState ? "success" : "info");
    };

    const handleAccept = async (order) => {
        const updates = { driverAccepted: true, acceptedAtLocal: Date.now() };
        
        // Ila kan officiel w khdaha mn 3nd freelance, n-modifiw driverId
        if (order.driverId !== user?.uid) {
            updates.driverId = user?.uid;
            updates.driverName = profile?.name;
            updates.isFreelanceDriver = false;
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id), updates);
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user?.uid), { isAvailable: false, updatedAt: serverTimestamp() });
        showNotify("Commande acceptée ! ✅", "success");
    };

    const handleReject = async (order) => {
        setConfirmDialog({
            message: 'Wach met2ked bghiti trewez had l-commande?',
            onConfirm: async () => {
                await handleReassignOrder(order, user?.uid, false, false);
            }
        });
    };

    const dismissReturnAlert = async (orderId) => {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), { driverAcknowledgedReturn: true });
    };

    const sendImNearMessage = (phone) => {
        const waPhone = getWhatsAppFormat(phone);
        const appUrl = window.location.origin + window.location.pathname;
        const msg = encodeURIComponent(`Salam, m3ak l-livreur dyal ${brand.name || 'Restaurant'}. Rah 9erebt nwssel 3ndk 🛵, 3afak wjed rassek bach tstalm l-commande.\n\nT9der t-suivi l-commande dyalk en temps réel mn hna: ${appUrl}\n\nChokran!`);
        
        // Envoie direct sans fenetre de confirmation (sur mobile)
        openWhatsAppDirect(waPhone, decodeURIComponent(msg));
        
        showNotify("Message siftnah l-client! 📱", "success");
    };

    // 🔥 Fonction li kat-rssem l-carte dyal l-commande (bach man3awdouch l-koud 3 d-lmrat)
    const renderOrderCard = (o, index, isRecommended) => (
        <div key={o.id} className={`bg-white rounded-[2rem] border ${isRecommended ? 'border-green-500 ring-4 ring-green-200' : 'border-gray-100'} shadow-lg overflow-hidden animate-in slide-in-from-bottom-5 mb-6`}>
            {/* 🤖 Robot Recommendation Banner */}
            {isRecommended && (
                <div className="bg-green-500 text-white p-3 font-black text-xs uppercase flex items-center justify-center gap-2 shadow-inner text-center leading-tight">
                    🤖 L-Robot Kaygolik: Saba9 had l-commande, raha a9rab lik f tri9ak!
                </div>
            )}
            {/* 📋 Commande Index */}
            <div className="bg-gray-900 text-white text-center py-2.5 font-black text-sm uppercase tracking-widest shadow-sm">
                COMMANDE {index + 1}
            </div>

            {/* HEADER COMMANDE */}
            <div className={`p-5 border-b flex justify-between items-start relative ${o.source === 'telephone' ? 'bg-purple-50 border-purple-100' : 'bg-emerald-50 border-emerald-100'}`}>
                {o.driverId !== user?.uid && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md animate-pulse whitespace-nowrap">
                        En attente Freelance
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className={`text-white text-xl font-black px-4 py-1.5 rounded-xl shadow-md uppercase tracking-tighter border-2 ${o.source === 'telephone' ? 'bg-purple-500 border-purple-400' : 'bg-emerald-500 border-emerald-400'}`}>
                            #{o.orderNumber || o.id.slice(-4).toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${o.source === 'telephone' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                            {o.source === 'telephone' ? '📞 Téléphone' : '📱 App Client'}
                        </span>
                        {o.kitchenAlert && (Date.now() - o.kitchenAlert < 15 * 60 * 1000) && o.status === 'ready' && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-100 px-2 py-1 rounded-md border border-red-200 animate-pulse flex items-center gap-1"><BellRing size={12}/> VITE !</span>
                        )}
                    </div>
                    <h3 className="font-black text-gray-800 text-lg uppercase italic">{o.customerName || o.name || o.phone}</h3>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    <span className="text-2xl font-black tracking-tighter leading-none" style={{color: brand.driverColor || brand.color || '#3b82f6'}}>{o.total} DH</span>
                    <LiveTimer startTime={o.acceptedAtLocal || (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now())} />
                </div>
            </div>

            {/* DETAILS */}
            <div className="p-5 space-y-4">
                <div className="flex gap-3 items-center p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-blue-900 shadow-inner">
                    <Store size={24} className="shrink-0 text-blue-500"/>
                    <div><p className="text-[9px] font-black uppercase text-blue-500 tracking-widest mb-0.5">Récupérer de:</p><p className="font-black text-base">{o.nearestBranch?.name || 'Restaurant'}</p></div>
                </div>
                <div className="flex gap-3 items-center p-4 bg-green-50/50 rounded-2xl border border-green-100 text-green-900 shadow-inner">
                    <MapPin size={24} className="shrink-0 text-green-500"/>
                    <div><p className="text-[9px] font-black uppercase text-green-600 tracking-widest mb-0.5">Livrer à:</p><p className="font-bold text-sm leading-tight">{o.address}</p></div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl text-sm font-bold text-gray-700 border border-gray-100">
                    <div className="space-y-2">{(o.items||[]).map((i, idx) => <div key={idx} className="leading-tight"><span className="font-black">{i.qty}x {(i.name || '').split(' (Sans ')[0]}</span>{(i.name || '').includes(' (Sans ') && (i.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, oIdx) => <span key={oIdx} className="block text-[10px] text-red-500 font-black ml-4">- {formatSansIngredient(opt)}</span>)}</div>)}</div>
                </div>
            </div>

            {/* ACTIONS SELON STATUT */}
            <div className="p-5 bg-white border-t border-gray-100">
                
                {!o.driverAccepted ? (
                    <div className="flex gap-2">
                        {o.driverId === user?.uid && (
                            <button onClick={()=>handleReject(o)} className="flex-1 bg-red-50 text-red-600 py-4 rounded-xl font-black text-xs uppercase border border-red-200 active:scale-95 transition-all shadow-sm">{brand.texts?.driverBtnReject || 'Refuser'}</button>
                        )}
                        <button onClick={()=>handleAccept(o)} className="flex-[2] text-white py-4 rounded-xl font-black text-sm uppercase shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2" style={{backgroundColor: brand.driverColor || brand.color || '#3b82f6'}}><CheckCircle size={18}/> {brand.texts?.driverBtnAccept || 'Accepter'} {o.driverId !== user?.uid ? '(Prendre)' : ''}</button>
                    </div>
                ) : o.status === 'preparing' || o.status === 'pending' ? (
                    <div className="bg-orange-50 text-orange-600 p-5 rounded-2xl font-black text-center text-sm uppercase border border-orange-200 flex flex-col items-center justify-center gap-2 shadow-inner">
                        <Utensils size={24} className="animate-bounce"/> 
                        <span>Restaurant Kaywejed fiha...</span>
                        <span className="text-[10px] font-bold opacity-70 normal-case tracking-widest mt-1">Tsenna 7ta tban lik "Commande Wajda"</span>
                    </div>
                ) : o.status === 'ready' ? (
                    <div className="space-y-3">
                        <div className="bg-green-500 text-white p-4 rounded-2xl font-black text-center text-sm uppercase shadow-lg animate-pulse flex flex-col items-center gap-1">
                            <BellRing size={20}/> 🚨 L-COMMANDE WAJDA! SIR HEZHA!
                        </div>

                        {o.kitchenAlert && (Date.now() - o.kitchenAlert < 15 * 60 * 1000) && (
                            <button onClick={() => {
                                updateStatus(o.id, o.status, { kitchenAlert: 0 });
                                showNotify("Réponse envoyée à la cuisine 🏃‍♂️", "success");
                            }} className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-2xl font-black text-sm uppercase flex items-center justify-center gap-2 border border-red-200 active:scale-95 transition-all shadow-sm">
                                🏃‍♂️ Dire "J'arrive !"
                            </button>
                        )}

                    <button onClick={()=>updateStatus(o.id, 'out_for_delivery')} className="w-full text-white py-5 rounded-2xl font-black text-sm uppercase shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-black/20" style={{backgroundColor: brand.driverColor || brand.color || '#3b82f6'}}>
                            <CheckCircle size={20}/> J'ai récupéré la commande
                        </button>
                    </div>
                ) : o.status === 'out_for_delivery' ? (
                    <div className="space-y-3">
                        <StatusBadge status="out_for_delivery" brand={brand} className="w-full text-center py-2 mb-2"/>
                        
                        {/* KHARITA INTÉGRÉE (LIVE TRACKING LEAFLET) */}
                        {location && o.lat && o.lng ? (
                            <>
                                <div className="w-full h-64 rounded-2xl overflow-hidden shadow-inner border-2 border-blue-200 mb-2 bg-gray-100 relative">
                                    <ClientTrackingMap 
                                        dLat={location.lat} 
                                        dLng={location.lng} 
                                        cLat={o.lat} 
                                        cLng={o.lng} 
                                        color={brand.driverColor || brand.color || '#3b82f6'} 
                                        height="100%" 
                                    />
                                </div>
                                <button onClick={() => setFullScreenMap(`https://maps.google.com/maps?saddr=${location.lat},${location.lng}&daddr=${o.lat},${o.lng}&hl=fr&output=embed`)} className="w-full text-white py-4 rounded-2xl font-black text-sm uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all mb-4 hover:opacity-90" style={{backgroundColor: brand.driverColor || brand.color || '#2563eb'}}>
                                    <Navigation size={20}/> 📍 {brand.texts?.driverMapBtn || 'Démarrer Navigation GPS'}
                                </button>
                            </>
                        ) : (
                            <div className="w-full h-20 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200 mb-4 text-xs font-bold text-gray-400">
                                <MapIcon size={16} className="mr-2 opacity-50"/> En attente du GPS...
                            </div>
                        )}

                        <div className="flex gap-2">
                            <a href={`tel:${o.phone}`} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-gray-200 active:scale-95 transition-all hover:bg-gray-200"><Phone size={16}/> Appeler</a>
                            <button onClick={()=>sendImNearMessage(o.phone)} className="flex-[2] bg-green-500 text-white py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all hover:bg-green-600"><MessageCircle size={16}/> "Ana 9rib nwsel"</button>
                        </div>

                        <button onClick={()=>updateStatus(o.id, 'delivered', {deliveredAtLocal: Date.now()})} className="w-full text-white py-5 rounded-2xl font-black text-base uppercase shadow-xl active:scale-95 transition-all mt-4 border-b-4 border-black/20 flex items-center justify-center gap-2" style={{backgroundColor: brand.driverColor || brand.color || '#3b82f6'}}>
                            <CheckCircle size={24}/> Commande Livrée
                        </button>

                        {o.adminMessage === 'jawbak' && (
                            <div className="mt-4 bg-blue-100 border border-blue-300 p-4 rounded-xl animate-pulse">
                                <p className="text-blue-800 font-black text-xs uppercase flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-blue-600"/> L-Idara l9aw l-client, 3ayet lih daba!</p>
                                <button onClick={() => updateStatus(o.id, o.status, { adminMessage: null })} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-[10px] font-bold active:scale-95 flex justify-center items-center gap-2"><CheckCircle size={14}/> Fhmt, L9it l-message</button>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100 mt-4 text-center">
                            {o.clientUnreachable ? (
                                <p className="text-orange-500 font-bold text-[10px] uppercase py-2 px-4 bg-orange-50 rounded-lg flex items-center justify-center gap-1 mx-auto mb-2">
                                    <Info size={14}/> ⏳ L-Idara kat9leb 3la l-client...
                                </p>
                            ) : (
                                <button onClick={() => { 
                                    setConfirmDialog({ 
                                        message: 'Wach met2ked l-client majawbch? L-Idara ghadi t3lem biha.', 
                                        onConfirm: () => updateStatus(o.id, o.status, { clientUnreachable: true, unreachableAt: Date.now() }) 
                                    }) 
                                }} className="mb-2 text-red-500 font-bold text-[10px] uppercase py-2 px-4 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1 mx-auto">
                                    <Info size={14}/> ⚠️ Le client ne répond pas ?
                                </button>
                            )}

                            {/* BOUTON PANNE / URGENCE */}
                            <button onClick={() => { 
                                setConfirmDialog({
                                    message: '🚨 Wach mt2ked 3ndk mochkil w bghiti t7yed had l-commande?\nL-Idara ghatwselha l-khbar w l-commande ghatreje3 l-robot y9leb 3la livreur akhor.',
                                    onConfirm: () => {
                                        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), {
                                            driverId: null,
                                            driverName: null,
                                            driverAccepted: false,
                                            isFreelanceDriver: false,
                                            status: o.status === 'out_for_delivery' ? 'ready' : o.status,
                                            adminMessage: `🚨 LIVREUR EN PANNE: ${profile?.name || user?.phone}`,
                                            assignedAtLocal: Date.now(),
                                            updatedAt: serverTimestamp()
                                        });
                                    }
                                });
                            }} className="text-orange-600 font-bold text-[10px] uppercase py-2 px-4 hover:bg-orange-50 border border-orange-200 rounded-lg transition-colors flex items-center justify-center gap-1 mx-auto">
                                <AlertTriangle size={14}/> 🚨 Problème en route (Panne) ?
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );

    return (
        <div className="min-h-[100dvh] pb-24 w-full overflow-x-hidden" style={{ fontFamily: brand.fontFamily, backgroundColor: brand.driverBgColor || brand.bgColor || '#f9fafb', color: brand.driverTextColor || brand.textColor || '#111827' }}>
            {/* HEADER LIVREUR */}
            <header className="text-white p-5 rounded-b-[2.5rem] shadow-2xl sticky top-0 z-50 border-b border-white/10" style={{ backgroundColor: brand.driverHeaderColor || brand.headerColor || '#171717' }}>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-3 rounded-full border border-white/20"><Truck size={24} color={brand.driverColor || brand.color || '#3b82f6'}/></div>
                        <div>
                            <h2 className="font-black uppercase italic tracking-wider text-base flex items-center gap-2">{brand.texts?.driverAppTitle || 'LIVREUR'} • {profile?.name}</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                {profile?.isFreelance ? <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">Freelance</span> : <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">Officiel</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {showInstallBtn && (
                            <button onClick={handleInstallApp} className="px-3 py-1.5 bg-blue-500 text-white text-[10px] font-black uppercase rounded-xl shadow-md animate-bounce active:scale-95 transition-all">
                                📲 Installer
                            </button>
                        )}
                        <button onClick={toggleStatus} className={`w-14 h-8 rounded-full relative transition-all shadow-inner border-2 ${isOnline ? 'bg-green-500 border-green-400' : 'bg-gray-600 border-gray-500'}`}>
                            <div className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full transition-all shadow-md flex items-center justify-center ${isOnline ? 'left-7' : 'left-0.5'}`}>
                                <Power size={12} className={isOnline ? 'text-green-500' : 'text-gray-400'}/>
                            </div>
                        </button>
                    </div>
                </div>
            </header>

            <div className="px-4 space-y-4 max-w-lg mx-auto">
                
                {['attente', 'acceptee', 'en_route'].includes(tab) && (
                    <>
                        {/* MESSAGES DYAL RETOUR (Client majawbch) */}
                        {cancelledPaidOrders.map(o => (
                            <div key={o.id} className="bg-purple-100 border-2 border-purple-400 p-4 rounded-2xl shadow-lg animate-in slide-in-from-top-2 relative overflow-hidden mb-4">
                                {profile?.isFreelance && <div className="absolute top-0 right-0 bg-purple-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-lg tracking-widest">RETOUR PAYÉ (+10 DH)</div>}
                                <div className="flex gap-3 items-start mt-1">
                                    <div className="bg-purple-200 p-2 rounded-full shrink-0"><AlertTriangle className="text-purple-600" size={20}/></div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-purple-900 uppercase text-sm">Commande Annulée (#{o.orderNumber || o.id.slice(-4).toUpperCase()})</h4>
                                        <p className="text-xs font-bold text-purple-800 mt-1 leading-tight">
                                            L-Idara annulat l-commande dyal ({o.customerName || o.phone}) 7it majawbch. 
                                            <br/><span className="text-purple-900 font-black mt-1 block">👉 T9der trje3 l-commande l-Point de vente{profile?.isFreelance ? ', l-livraison dyalk ghatkheles fiha (tzadat f l-7ssab)!' : '.'}</span>
                                        </p>
                                        <button onClick={() => dismissReturnAlert(o.id)} className="mt-3 bg-purple-600 text-white w-full py-2.5 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                                            <Check size={14}/> Safi, fhamt (OK)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {!isOnline ? (
                            <div className="bg-white p-8 rounded-2xl text-center shadow-sm border border-gray-200 mt-4">
                                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100"><Power size={24} className="text-gray-400"/></div>
                                <h3 className="font-bold text-gray-900 text-lg mb-2">Vous êtes Hors Ligne</h3>
                                <p className="text-sm text-gray-500 mb-6">Activez votre statut pour commencer à recevoir des missions.</p>
                                <button onClick={toggleStatus} className="bg-black text-white w-full py-3 rounded-xl font-medium text-sm shadow-sm active:scale-95 transition-colors hover:bg-gray-800">Me Connecter</button>
                            </div>
                        ) : activeOrders.length === 0 ? (
                            <div className="bg-white p-8 rounded-2xl text-center shadow-sm border border-gray-200 mt-4">
                                <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100"><MapPin size={24} className="text-blue-500 animate-bounce"/></div>
                                <h3 className="font-bold text-gray-900 text-lg mb-2">En attente... ⏳</h3>
                                <p className="text-sm text-gray-500">Vous êtes en ligne. Restez à l'affût de nouvelles missions.</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {tab === 'attente' && (
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><BellRing size={16} className="text-red-500"/> Nouvelles Missions ({newMissions.length})</h3>
                                        {newMissions.length === 0 && <p className="text-gray-500 text-center py-8 bg-white rounded-2xl border border-gray-100">Aucune commande en attente.</p>}
                                        {newMissions.map((o, i) => renderOrderCard(o, i, false))}
                                    </div>
                                )}
                                {tab === 'acceptee' && (
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Store size={16} className="text-orange-500"/> À Récupérer ({toPickupMissions.length})</h3>
                                        {toPickupMissions.length === 0 && <p className="text-gray-500 text-center py-8 bg-white rounded-2xl border border-gray-100">Aucune commande à récupérer.</p>}
                                        {toPickupMissions.map((o, i) => renderOrderCard(o, i, false))}
                                    </div>
                                )}
                                {tab === 'en_route' && (
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Navigation size={16} className="text-blue-500"/> En Livraison ({sortedDeliveryMissions.length})</h3>
                                        {sortedDeliveryMissions.length === 0 && <p className="text-gray-500 text-center py-8 bg-white rounded-2xl border border-gray-100">Aucune commande en route.</p>}
                                        {sortedDeliveryMissions.map((o, i) => renderOrderCard(o, i, !!o.isRobotRecommended))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* TAB: HISTORIQUE */}
                {tab === 'history' && (
                    <div className="animate-in fade-in space-y-4">
                        
                        {profile?.isFreelance && (
                            <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm mb-6">
                                <h3 className="text-gray-500 font-semibold uppercase text-xs tracking-widest mb-1">Gains d'aujourd'hui</h3>
                                <p className="text-3xl font-black text-gray-900">+{earningsToday} <span className="text-lg text-gray-400 font-medium">DH</span></p>
                                <p className="text-xs font-medium text-gray-400 mt-1">{paidOrdersToday.length} livraisons payées</p>
                            </div>
                        )}

                        <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2"><History size={16} className="text-gray-400"/> Historique d'aujourd'hui</h3>
                        
                        {historyOrdersToday.length === 0 ? (
                            <div className="bg-white p-8 rounded-2xl text-center shadow-sm border border-gray-200 text-gray-500 font-medium text-sm">
                                Aucune livraison terminée aujourd'hui.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {historyOrdersToday.sort((a,b) => (b.deliveredAtLocal || 0) - (a.deliveredAtLocal || 0)).map(o => (
                                    <div key={o.id} className={`bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center ${o.status === 'rejected' ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900">{o.customerName || o.name || o.phone}</p>
                                            <p className="text-xs font-medium text-gray-500 mt-0.5">#{o.orderNumber || o.id.slice(-4).toUpperCase()} • {o.deliveredAtLocal ? new Date(o.deliveredAtLocal).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '--:--'}</p>
                                            
                                            {o.status === 'rejected' && o.driverPaid && profile?.isFreelance && (
                                                <span className="inline-block mt-1.5 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-purple-100">Retour Payé (+10 DH)</span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <StatusBadge status={o.status} brand={brand}/>
                                            <p className="text-sm font-bold mt-1 text-gray-900">{o.total} DH</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {/* FULL SCREEN MAP OVERLAY */}
                {fullScreenMap && (
                    <div className="fixed inset-0 z-[100] bg-black">
                        <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center z-10 pointer-events-none">
                            <h3 className="text-white font-black uppercase drop-shadow-md">Navigation GPS</h3>
                            <button onClick={() => setFullScreenMap(null)} className="bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-95 pointer-events-auto">
                                <X size={20}/>
                            </button>
                        </div>
                        <iframe 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            style={{ border: 0, marginTop: 'env(safe-area-inset-top)' }}
                            src={fullScreenMap} 
                            allowFullScreen
                        ></iframe>
                    </div>
                )}
            </div>

            {/* NAVBAR T7TANIYA SAAS */}
            <nav className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-gray-200 flex justify-around items-center z-40 px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] pb-safe">
               <button onClick={() => setTab('attente')} className={`flex flex-col items-center gap-1 transition-colors flex-1 h-full justify-center relative ${tab === 'attente' ? '' : 'text-gray-400 hover:text-gray-600'}`} style={tab === 'attente' ? {color: brand.driverColor || brand.color || '#3b82f6'} : {}}>
                   <BellRing size={20} strokeWidth={tab === 'attente' ? 2.5 : 2}/>
                   {newMissions.length > 0 && <span className="absolute top-2 right-1/4 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                   <span className="text-[8px] font-bold uppercase mt-0.5">Attente</span>
               </button>
               <button onClick={() => setTab('acceptee')} className={`flex flex-col items-center gap-1 transition-colors flex-1 h-full justify-center relative ${tab === 'acceptee' ? '' : 'text-gray-400 hover:text-gray-600'}`} style={tab === 'acceptee' ? {color: brand.driverColor || brand.color || '#3b82f6'} : {}}>
                   <Store size={20} strokeWidth={tab === 'acceptee' ? 2.5 : 2}/>
                   {toPickupMissions.length > 0 && <span className="absolute top-2 right-1/4 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white"></span>}
                   <span className="text-[8px] font-bold uppercase mt-0.5">Acceptée</span>
               </button>
               <button onClick={() => setTab('en_route')} className={`flex flex-col items-center gap-1 transition-colors flex-1 h-full justify-center relative ${tab === 'en_route' ? '' : 'text-gray-400 hover:text-gray-600'}`} style={tab === 'en_route' ? {color: brand.driverColor || brand.color || '#3b82f6'} : {}}>
                   <Navigation size={20} strokeWidth={tab === 'en_route' ? 2.5 : 2}/>
                   {deliveryMissions.length > 0 && <span className="absolute top-2 right-1/4 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white"></span>}
                   <span className="text-[8px] font-bold uppercase mt-0.5">En Route</span>
               </button>
               
               <button onClick={() => setTab('history')} className={`flex flex-col items-center gap-1 transition-colors flex-1 h-full justify-center ${tab === 'history' ? '' : 'text-gray-400 hover:text-gray-600'}`} style={tab === 'history' ? {color: brand.driverColor || brand.color || '#3b82f6'} : {}}>
                   <History size={20} strokeWidth={tab === 'history' ? 2.5 : 2}/>
                   <span className="text-[8px] font-bold uppercase mt-0.5">Historique</span>
               </button>

               <button onClick={onLogout} className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-500 transition-colors flex-1 h-full justify-center">
                   <LogOut size={20} strokeWidth={2}/>
                   <span className="text-[8px] font-bold uppercase mt-0.5">Quitter</span>
               </button>
            </nav>

            {/* MODAL DE CONFIRMATION */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDialog(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                            <h2 className="text-lg font-black text-orange-800 flex items-center gap-2"><AlertTriangle size={20}/> Confirmation</h2>
                            <button onClick={() => setConfirmDialog(null)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                        </div>
                        <div className="p-6 bg-gray-50 text-center space-y-5">
                            <p className="font-bold text-gray-800 text-base whitespace-pre-wrap">{confirmDialog.message}</p>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-200 rounded-xl hover:bg-gray-300 transition-colors shadow-sm">Non (Annuler)</button>
                                <button onClick={() => {
                                    confirmDialog.onConfirm();
                                    setConfirmDialog(null);
                                }} className="flex-[2] py-3 font-black text-white bg-green-500 rounded-xl shadow-md active:scale-95 transition-all hover:bg-green-600">Oui, Confirmer</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}