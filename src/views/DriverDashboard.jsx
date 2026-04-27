import React, { useState, useEffect, useRef } from 'react';
import { Power, Truck, BellRing, MapPin, Navigation, Store, CheckCircle, Phone, MessageCircle, AlertTriangle, User, LogOut, Utensils, Map as MapIcon, Info, History, Check, X, Clock } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getWhatsAppFormat, getDistance } from '../utils/helpers';
import StatusBadge from '../components/StatusBadge';
import ClientTrackingMap from '../components/ClientTrackingMap';

// 🔥 Jdid: Composant dyal l-wa9t l-Livreur
const LiveTimer = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!startTime) return;
        const calc = () => {
            const diff = Math.floor((Date.now() - startTime) / 60000);
            setElapsed(diff >= 0 ? diff : 0);
        };
        calc();
        const interval = setInterval(calc, 60000);
        return () => clearInterval(interval);
    }, [startTime]);
    
    const isLate = elapsed >= 20; // 20 d9i9a delay w tweli 7emra 3nd Livreur
    return (<span className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md border shadow-sm ${isLate ? 'bg-red-100 text-red-600 border-red-200 animate-pulse' : 'bg-white text-gray-600 border-gray-200'}`}><Clock size={12}/> {elapsed} min</span>);
};

export default function DriverDashboard({ orders, user, profile, brand, updateStatus, db, showNotify, onLogout, clientsList, handleReassignOrder, settings, appId }) {
    const [isOnline, setIsOnline] = useState(true);
    const [location, setLocation] = useState(null);
    const [tab, setTab] = useState('missions'); // 'missions' ou 'history'
    const [fullScreenMap, setFullScreenMap] = useState(null); // url for map
    
    // 🔥 Jdid: State dyal Sonnette w Vibreur
    const [isAppLoaded, setIsAppLoaded] = useState(false);
    const knownMissionsRef = useRef(new Set());

    // 🔥 Jdid: State l-GPS on-demand
    const [gpsActive, setGpsActive] = useState(false);
    const [gpsTimeoutId, setGpsTimeoutId] = useState(null);
    const lastGpsUpdateRef = useRef(0);

    // Les commandes dyal had l-livreur (DEFINI AVANT useEffect)
    const myOrders = orders?.filter(o => {
        if (o.driverId === user?.uid) return true;
        // L-livreur officiel y9der ychouf l-commandes li mchaw 3nd freelance w mazal ma-acceptawhoumch
        if (!profile?.isFreelance && o.isFreelanceDriver && !o.driverAccepted && o.status !== 'delivered' && o.status !== 'rejected') {
            return true;
        }
        return false;
    }) || [];
    const activeOrders = myOrders.filter(o => !['delivered', 'rejected'].includes(o.status));

    // 🔥 Grouping dyal les commandes bach l-interface tb9a mndma w mafrou9a
    const newMissions = activeOrders.filter(o => !o.driverAccepted);
    const toPickupMissions = activeOrders.filter(o => o.driverAccepted && ['pending', 'preparing', 'ready'].includes(o.status));
    const deliveryMissions = activeOrders.filter(o => o.driverAccepted && o.status === 'out_for_delivery');

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
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(e => console.log("Audio bloqué", e));
                
                if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]); // Vibre 3 d-lmrat
            } catch (e) { console.log("Erreur son/vibreur", e); }
        }
    }, [newMissions, isAppLoaded, isOnline]);

    // 🔥 Jdid: Listen FCM notifications silencieuses bach ych3el GPS
    useEffect(() => {
        const setupFCM = async () => {
            try {
                const { getMessaging, onMessage, getToken } = await import('firebase/messaging');
                const messaging = getMessaging();
                
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        const token = await getToken(messaging, { 
                            vapidKey: "BO5lAnealXpHrw_wOovDsCbCOT8nWrtGMkDAoUPDYyDr6ONv3asreY_XHq6KDMLHUYeaUY9CjbTkREJRdpZ5UYg"
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
            let updateInterval = 30000; 
            if (activeOrders.length > 0 && activeOrders[0].lat && activeOrders[0].lng) {
                const dist = getDistance(lat, lng, activeOrders[0].lat, activeOrders[0].lng);
                if (dist <= 1) updateInterval = 15000;
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
    
    const historyOrdersToday = myOrders.filter(o => {
        const isDelivered = o.status === 'delivered';
        const isPaidReturn = o.status === 'rejected' && o.driverPaid === true; 
        if (!['delivered', 'rejected'].includes(o.status)) return false;
        
        let d = new Date();
        if (o.deliveredAtLocal) d = new Date(o.deliveredAtLocal);
        else if (o.createdAt?.seconds) d = new Date(o.createdAt.seconds * 1000);
        return d.toISOString().split('T')[0] === todayStr;
    });

    const paidOrdersToday = historyOrdersToday.filter(o => o.status === 'delivered' || (o.status === 'rejected' && o.driverPaid === true));
    
    // Les commandes li rj3o l-youm w mazal l-livreur ma-klika 3la "OK"
    const cancelledPaidOrders = paidOrdersToday.filter(o => o.status === 'rejected' && o.driverPaid === true && !o.driverAcknowledgedReturn);
    
    const earningsToday = profile?.isFreelance ? (paidOrdersToday.length * 10) : 0;

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
        if(window.confirm('Wach met2ked bghiti trewez had l-commande?')) {
            await handleReassignOrder(order, user?.uid, false, false);
        }
    };

    const dismissReturnAlert = async (orderId) => {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId), { driverAcknowledgedReturn: true });
    };

    const sendImNearMessage = (phone) => {
        const waPhone = getWhatsAppFormat(phone);
        const appUrl = window.location.origin + window.location.pathname;
        const msg = encodeURIComponent(`Salam, m3ak l-livreur dyal ${brand.name || 'Restaurant'}. Rah 9erebt nwssel 3ndk 🛵, 3afak wjed rassek bach tstalm l-commande.\n\nT9der t-suivi l-commande dyalk en temps réel mn hna: ${appUrl}\n\nChokran!`);
        const waWindow = window.open(`https://wa.me/${waPhone}?text=${msg}`, '_blank');
        if (!waWindow) {
            showNotify("3afak autoriser les pop-ups bach ythl WhatsApp", "error");
        } else {
            showNotify("Message siftnah l-client! 📱", "success");
        }
    };

    // 🔥 Fonction li kat-rssem l-carte dyal l-commande (bach man3awdouch l-koud 3 d-lmrat)
    const renderOrderCard = (o) => (
        <div key={o.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-lg overflow-hidden animate-in slide-in-from-bottom-5 mb-6">
            {/* HEADER COMMANDE */}
            <div className="bg-gray-50 p-5 border-b border-gray-100 flex justify-between items-start relative">
                {o.driverId !== user?.uid && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-md animate-pulse whitespace-nowrap">
                        En attente Freelance
                    </div>
                )}
                <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cmd #{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                    <h3 className="font-black text-gray-800 text-lg uppercase italic mt-1">{o.customerName || o.name || o.phone}</h3>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                    <span className="text-2xl font-black tracking-tighter leading-none" style={{color: brand.color}}>{o.total} DH</span>
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
                    <div className="space-y-2">{(o.items||[]).map((i, idx) => <div key={idx} className="leading-tight"><span className="font-black">{i.qty}x {(i.name || '').split(' (Sans ')[0]}</span>{(i.name || '').includes(' (Sans ') && (i.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, oIdx) => <span key={oIdx} className="block text-[10px] text-red-500 font-black ml-4">- Sans {opt}</span>)}</div>)}</div>
                </div>
            </div>

            {/* ACTIONS SELON STATUT */}
            <div className="p-5 bg-white border-t border-gray-100">
                
                {!o.driverAccepted ? (
                    <div className="flex gap-2">
                        {o.driverId === user?.uid && (
                            <button onClick={()=>handleReject(o)} className="flex-1 bg-red-50 text-red-600 py-4 rounded-xl font-black text-xs uppercase border border-red-200 active:scale-95 transition-all shadow-sm">Refuser</button>
                        )}
                        <button onClick={()=>handleAccept(o)} className="flex-[2] text-black py-4 rounded-xl font-black text-sm uppercase shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2" style={{backgroundColor: brand.color}}><CheckCircle size={18}/> Accepter {o.driverId !== user?.uid ? '(Prendre)' : ''}</button>
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
                        <button onClick={()=>updateStatus(o.id, 'out_for_delivery')} className="w-full text-black py-5 rounded-2xl font-black text-sm uppercase shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 border-b-4 border-black/20" style={{backgroundColor: brand.color}}>
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
                                        color={brand.color || '#ffbc0d'} 
                                        height="100%" 
                                    />
                                </div>
                                <button onClick={() => setFullScreenMap(`https://maps.google.com/maps?saddr=${location.lat},${location.lng}&daddr=${o.lat},${o.lng}&hl=fr&output=embed`)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-sm uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all mb-4 hover:bg-blue-700">
                                    <Navigation size={20}/> 📍 Démarrer Navigation GPS
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

                        <button onClick={()=>updateStatus(o.id, 'delivered', {deliveredAtLocal: Date.now()})} className="w-full text-black py-5 rounded-2xl font-black text-base uppercase shadow-xl active:scale-95 transition-all mt-4 border-b-4 border-black/20 flex items-center justify-center gap-2" style={{backgroundColor: brand.color}}>
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
                                <p className="text-orange-500 font-bold text-[10px] uppercase py-2 px-4 bg-orange-50 rounded-lg flex items-center justify-center gap-1 mx-auto">
                                    <Info size={14}/> ⏳ L-Idara kat9leb 3la l-client...
                                </p>
                            ) : (
                                <button onClick={() => { if(window.confirm('Wach met2ked l-client majawbch? L-Idara ghadi t3lem biha.')) updateStatus(o.id, o.status, { clientUnreachable: true, unreachableAt: Date.now() }) }} className="text-red-500 font-bold text-[10px] uppercase py-2 px-4 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1 mx-auto">
                                    <Info size={14}/> ⚠️ Le client ne répond pas ?
                                </button>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-24" style={{ fontFamily: brand.fontFamily }}>
            {/* HEADER LIVREUR */}
            <header className="bg-neutral-900 text-white p-5 rounded-b-[2.5rem] shadow-2xl sticky top-0 z-50 border-b border-white/10">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-3 rounded-full border border-white/20"><Truck size={24} color={brand.color}/></div>
                        <div>
                            <h2 className="font-black uppercase italic tracking-wider text-base">{profile?.name}</h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                {profile?.isFreelance ? <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">Freelance</span> : <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">Officiel</span>}
                            </p>
                        </div>
                    </div>
                    <button onClick={toggleStatus} className={`w-14 h-8 rounded-full relative transition-all shadow-inner border-2 ${isOnline ? 'bg-green-500 border-green-400' : 'bg-gray-600 border-gray-500'}`}>
                        <div className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full transition-all shadow-md flex items-center justify-center ${isOnline ? 'left-7' : 'left-0.5'}`}>
                            <Power size={12} className={isOnline ? 'text-green-500' : 'text-gray-400'}/>
                        </div>
                    </button>
                </div>
            </header>

            <div className="px-4 space-y-4 max-w-lg mx-auto">
                
                {tab === 'missions' && (
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
                                {newMissions.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><BellRing size={16} className="text-red-500"/> Nouvelles Missions ({newMissions.length})</h3>
                                        {newMissions.map(o => renderOrderCard(o))}
                                    </div>
                                )}
                                {toPickupMissions.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Store size={16} className="text-orange-500"/> À Récupérer ({toPickupMissions.length})</h3>
                                        {toPickupMissions.map(o => renderOrderCard(o))}
                                    </div>
                                )}
                                {deliveryMissions.length > 0 && (
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Navigation size={16} className="text-blue-500"/> En Livraison ({deliveryMissions.length})</h3>
                                        {deliveryMissions.map(o => renderOrderCard(o))}
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
            <nav className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-gray-200 flex justify-around items-center z-40 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] pb-safe">
               <button onClick={() => setTab('missions')} className={`flex flex-col items-center gap-1 transition-colors flex-1 h-full justify-center ${tab === 'missions' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}>
                   <Truck size={20} strokeWidth={tab === 'missions' ? 2.5 : 2}/>
                   <span className="text-[10px] font-semibold">Missions</span>
               </button>
               
               <button onClick={() => setTab('history')} className={`flex flex-col items-center gap-1 transition-colors flex-1 h-full justify-center ${tab === 'history' ? 'text-black' : 'text-gray-400 hover:text-gray-600'}`}>
                   <History size={20} strokeWidth={tab === 'history' ? 2.5 : 2}/>
                   <span className="text-[10px] font-semibold">Historique</span>
               </button>

               <button onClick={onLogout} className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-500 transition-colors flex-1 h-full justify-center">
                   <LogOut size={20} strokeWidth={2}/>
                   <span className="text-[10px] font-semibold">Quitter</span>
               </button>
            </nav>
        </div>
    );
}