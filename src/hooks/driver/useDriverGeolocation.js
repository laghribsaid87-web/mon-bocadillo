import { useState, useEffect, useRef, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDatabase, ref as rtdbRef, set as rtdbSet, onValue } from 'firebase/database';
import { registerPlugin, Capacitor } from '@capacitor/core';
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

export function useDriverGeolocation({ user, profile, isOnline: initialOnline, showSetupModal, gpsActive, activeOrders, lastGpsUpdateRef, db, appId, setGpsPermissionDenied, showNotify, myOrders, appVersion }) {
    const [isOnline, setIsOnline] = useState(initialOnline);
    const [location, setLocation] = useState(null);
    const [isRtdbConnected, setIsRtdbConnected] = useState(true);

    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // 🔥 NOUVEAU: Suivi de la connexion RTDB (Live Tracking)
    useEffect(() => {
        try {
            const rtdb = getDatabase();
            const connectedRef = rtdbRef(rtdb, '.info/connected');
            const unsub = onValue(connectedRef, (snap) => {
                setIsRtdbConnected(snap.val() === true);
            });
            return () => unsub();
        } catch (e) {}
    }, []);


    // Track GPS dyal Livreur (On-Demand & Auto-Stop)
    useEffect(() => {
        // 🔥 Dima n-trackiw l'GPS ila kan l-livreur "En ligne" bach yban f l'Idara (Live Map)
        const shouldTrack = (isOnline || gpsActive) && !showSetupModal;

        if (!shouldTrack || !user?.uid) {
            return;
        }

        console.log("🚀 Démarrage GPS tracking (On-Demand)...");
        
        let webWatchId = null;
        let bgWatcherId = null;
        
        const pushLocation = async (lat, lng) => {
            setGpsPermissionDenied(false);
            setLocation({ lat, lng });

            // 🔥 NOUVEAU: Envoi Live Tracking f Realtime Database (Rapide w Fabor)
            try {
                const rtdb = getDatabase();
                rtdbSet(rtdbRef(rtdb, `tracking/${appId}/drivers/${user?.uid}`), {
                    lat, lng, updatedAt: now
                });
            } catch (e) { console.log("RTDB Error", e); }

            // 🔥 OPTIMISATION GLOVO PRO (FREELANCE QUOTA SAVER)
            const isFreelanceIdle = profile?.isFreelance && activeOrders.length === 0;
            const now = Date.now();
            let updateInterval = 60000; 
            
            if (isFreelanceIdle) {
                updateInterval = 3 * 60000; // 🔥 3 Minutes: L-Plugin Natif (distanceFilter 100m) howa li kay-protéger l-Quota daba.
            } else if (activeOrders.length > 0 && activeOrders[0].lat && activeOrders[0].lng) {
                const dist = getDistance(lat, lng, activeOrders[0].lat, activeOrders[0].lng);
                if (dist <= 1) updateInterval = 30000; // ila 9rib, 30s baraka bach mankhesrouch Writes dyal Firebase
            }
            
            if (lastGpsUpdateRef.current > 0 && now - lastGpsUpdateRef.current < updateInterval) return;
            lastGpsUpdateRef.current = now;

            const driverRef = doc(db, 'artifacts', appId, 'public', 'data', 'drivers', user?.uid);
            await setDoc(driverRef, { uid: user?.uid, phone: profile?.phone || '', name: profile?.name || '', lat, lng, isOnline: true, isAvailable: activeOrders.length === 0, updatedAt: serverTimestamp(), appVersion }, {merge: true}).catch(() => {});
        };

        const handleError = (err) => {
            console.error('GPS Error', err);
            if (err.code === 1) {
                setGpsPermissionDenied(true);
            } else if (err.code === 3) {
                console.log("GPS Timeout, le signal est faible...");
            }
        };

        const startWebTracking = () => {
            // FALLBACK L-WEB (PWA / Navigateur)
            const isHighAccuracy = activeOrders.length > 0;
            navigator.geolocation.getCurrentPosition((pos) => pushLocation(pos.coords.latitude, pos.coords.longitude), handleError, { enableHighAccuracy: isHighAccuracy, timeout: 15000, maximumAge: 10000 });
            webWatchId = navigator.geolocation.watchPosition((pos) => pushLocation(pos.coords.latitude, pos.coords.longitude), handleError, { enableHighAccuracy: isHighAccuracy, maximumAge: 15000 });
        };

        const startNativeTracking = async () => {
            try {
                // 🔥 NATIVE BACKGROUND GEOLOCATION (Méthode Glovo)
                bgWatcherId = await BackgroundGeolocation.addWatcher(
                    {
                        backgroundMessage: "L'application utilise le GPS pour vous envoyer des commandes en direct.",
                        backgroundTitle: "Service Livreur Actif 🛵",
                        requestPermissions: true,
                        stale: false,
                        distanceFilter: 100 // 🔥 GLOVO TRICK: N'envoie Firebase QUE s'il bouge de 100 mètres (Zéro Quota ila wa9ef)
                    },
                    function callback(location, error) {
                        if (error) {
                            if (error.code === 'NOT_AUTHORIZED') setGpsPermissionDenied(true);
                            return console.error(error);
                        }
                        pushLocation(location.latitude, location.longitude);
                    }
                );
            } catch (e) {
                console.log("Erreur BackgroundGeolocation Plugin, fallback au mode Web", e);
                startWebTracking();
            }
        };

        if (Capacitor.isNativePlatform()) {
            startNativeTracking();
        } else {
            startWebTracking();
        }

        // 3. Relance automatique quand l'application revient au premier plan
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !Capacitor.isNativePlatform()) {
                navigator.geolocation.getCurrentPosition((pos) => pushLocation(pos.coords.latitude, pos.coords.longitude), () => {}, { enableHighAccuracy: activeOrders.length > 0 });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (bgWatcherId) BackgroundGeolocation.removeWatcher({ id: bgWatcherId });
            if (webWatchId !== null) navigator.geolocation.clearWatch(webWatchId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isOnline, gpsActive, user?.uid, profile?.name, profile?.phone, profile?.isFreelance, db, appId, activeOrders.length, showSetupModal, appVersion]);

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
                    isAvailable: isOnline ? (activeOrders.length < 3) : false,
                    updatedAt: serverTimestamp(),
                    appVersion: appVersion
                }, {merge: true});
            } catch(e) { console.log('Error saving online status', e); }
        };
        saveOnlineStatus();
    }, [isOnline, user?.uid, profile?.phone, profile?.name, db, appId, activeOrders.length, appVersion]);

    const toggleStatus = async () => {
        const newState = !isOnline;
        setIsOnline(newState);
        showNotify(newState ? "Rak en ligne daba 🟢" : "Hors ligne 🔴", newState ? "success" : "info");
    };


    return { isOnline, setIsOnline, location, setLocation, isRtdbConnected, setIsRtdbConnected };
}
