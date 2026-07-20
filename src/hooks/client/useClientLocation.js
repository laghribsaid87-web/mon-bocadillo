import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getClosestBranch } from '../../utils/helpers';

export function useClientLocation(db, appId, user, activeBranches) {
    const [info, setInfo] = useState({ name: '', phone: user?.phone || user?.phoneNumber || '', address: '', lat: null, lng: null, nearestBranch: null, gpsFailed: false }); 
    const [isG, setIsG] = useState(false); 
    const [activeCat, setActiveCat] = useState('All'); 
    const [isAppLoading, setIsAppLoading] = useState(true); 
    const [promoCodeInput, setPromoCodeInput] = useState(''); 
    const [promoApplied, setPromoApplied] = useState(null); 
    const [usePoints, setUsePoints] = useState(false); 
    const [trackTab, setTrackTab] = useState('active'); 
    const [selectedItem, setSelectedItem] = useState(null); 
    const [itemOptions, setItemOptions] = useState([]); 
    const [selectedVariation, setSelectedVariation] = useState(null);
    const [selectedChoice, setSelectedChoice] = useState(null);
    const [selectedExtras, setSelectedExtras] = useState([]);
    const [comboSelections, setComboSelections] = useState({});
    const [customizationStep, setCustomizationStep] = useState(0);
    const [orderNote, setOrderNote] = useState('');
    const [detailOrder, setDetailOrder] = useState(null);
    const [showUpsellModal, setShowUpsellModal] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null); // Jdid: PWA Install Prompt
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [notifPerm, setNotifPerm] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied');
    const [editPhoneMode, setEditPhoneMode] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [trackDrivers, setTrackDrivers] = useState([]); // 🔥 Jdid: Suivi dyal livreur direct l-client
    const [deviceType, setDeviceType] = useState('desktop');
    const [showIosPrompt, setShowIosPrompt] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        let dt = 'desktop';
        if (/iphone|ipad|ipod/.test(ua)) dt = 'ios';
        else if (/android/.test(ua)) dt = 'android';
        setDeviceType(dt);

        const checkStandalone = () => window.matchMedia('(display-mode: standalone)').matches || 
                                      window.matchMedia('(display-mode: fullscreen)').matches ||
                                      window.matchMedia('(display-mode: minimal-ui)').matches ||
                                      window.navigator.standalone || 
                                      document.referrer.includes('android-app://');

        if (user?.uid && info?.phone) {
            setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', info.phone), {
                isAppInstalled: checkStandalone(),
                deviceType: dt
            }, { merge: true }).catch(() => {});
        }
    }, [user?.uid, info?.phone, db, appId]);

    useEffect(() => {
        // 🔥 UPDATE ACTIVE ORDERS WITH GPS
        if (info.lat && info.lng && info.phone) {
            const activeOrds = (orders || []).filter(o => 
                (o.phone === info.phone || o.userId === user?.uid) && 
                !['delivered', 'rejected'].includes(o.status) && 
                !o.lat
            );
            activeOrds.forEach(o => {
                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), {
                    lat: info.lat,
                    lng: info.lng
                }).catch(e => console.log("Erreur update order GPS", e));
            });
        }
    }, [info.lat, info.lng, info.phone, orders, user?.uid, db, appId]);

    useEffect(() => {
        if (brand?.logoUrl) {
            const addOrUpdateIcon = (relType) => {
                let link = document.querySelector(`link[rel='${relType}']`);
                if (!link) {
                    link = document.createElement('link');
                    link.rel = relType;
                    document.head.appendChild(link);
                }
                link.href = brand.logoUrl;
            };
            addOrUpdateIcon('apple-touch-icon');
            addOrUpdateIcon('apple-touch-icon-precomposed');
            addOrUpdateIcon('icon');
            addOrUpdateIcon('shortcut icon');
        }
    }, [brand?.logoUrl]);
    
    const activeBranches = settings.branches || DEFAULT_BRANCHES;
    const txtMenu = brand.texts?.navMenu || 'VOIR MENU'; 
    const txtTrack = brand.texts?.navTrack || 'SUIVI'; 
    const txtProfile = brand.texts?.navProfile || 'PROFIL'; 
    const txtAdd = brand.texts?.btnAdd || 'Ajouter'; 
    const txtCart = brand.texts?.btnCart || 'Panier'; 
    const txtOrder = brand.texts?.btnOrder || 'Commander';

    useEffect(() => {
        // Zoom global : Ajusté pour que l'interface ne paraisse pas trop grande sur tablette
        const updateFontSize = () => {
            if (window.innerWidth >= 1024) {
                document.documentElement.style.fontSize = '14px'; // Ordinateur
            } else if (window.innerWidth >= 768) {
                document.documentElement.style.fontSize = '12px'; // Tablette
            } else {
                document.documentElement.style.fontSize = '14px'; // Mobile
            }
        };
        updateFontSize();
        window.addEventListener('resize', updateFontSize);
        return () => window.removeEventListener('resize', updateFontSize);
    }, []);

    const toggleComboRemovable = (itemIndex, ing) => {
        setComboSelections(prev => {
            const current = prev[itemIndex]?.removables || [];
            const newRemovables = current.includes(ing) ? current.filter(x => x !== ing) : [...current, ing];
            return { ...prev, [itemIndex]: { ...prev[itemIndex], removables: newRemovables } };
        });
    };

    useEffect(() => { 
        if (!user || !user.uid) { setIsAppLoading(false); return; }
        getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'))
            .then(s => { 
                if (s.exists()) {
                    const data = s.data();
                    setInfo(p => ({ ...data, phone: data.phone || p.phone })); 
                    setIsAppLoading(false);
                    if (navigator.geolocation && !data.gpsFailed) {
                        navigator.geolocation.getCurrentPosition(pos => {
                            const closest = getClosestBranch(pos.coords.latitude, pos.coords.longitude, activeBranches); 
                            if(closest) {
                                setInfo(p => {
                                    if (p.lat === pos.coords.latitude && p.lng === pos.coords.longitude) return p;
                                    updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
                                        lat: pos.coords.latitude,
                                        lng: pos.coords.longitude,
                                        nearestBranch: closest
                                    }).catch(()=>{});
                                    return { ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, nearestBranch: closest };
                                });
                            }
                        }, () => {}, { enableHighAccuracy: true, maximumAge: 0 });
                    }
                } else {
                    setIsAppLoading(false);
                }
            })
            .catch(() => setIsAppLoading(false)); 
    }, [user, db, activeBranches]);

    useEffect(() => { 
        if (v === 'checkout' && navigator.geolocation && user?.uid) { 
            navigator.geolocation.getCurrentPosition(pos => { 
                const closest = getClosestBranch(pos.coords.latitude, pos.coords.longitude, activeBranches); 
                if(closest) {
                    setInfo(p => {
                        if (p.lat === pos.coords.latitude && p.lng === pos.coords.longitude) return p;
                        updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            nearestBranch: closest
                        }).catch(()=>{});
                        return { ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, nearestBranch: closest };
                    });
                }
            }, () => {}, { enableHighAccuracy: true, maximumAge: 0 }); 
        } 
    }, [v, activeBranches, user, db]);

    // 🔥 NOUVEAU: Listen FCM notifications silencieuses w Marketing bach nsjlo token
    useEffect(() => {
        let unsubscribe = null;
        const setupFCM = async () => {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            try {
                const messaging = getMessaging();
                
                const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                if (token && user?.uid) {
                    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { fcmToken: token, fcmUpdatedAt: serverTimestamp() }, { merge: true });
                    if (info?.phone) {
                        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', info.phone), { fcmToken: token, fcmUpdatedAt: serverTimestamp() }, { merge: true });
                    }
                }

                unsubscribe = onMessage(messaging, (payload) => {
                    if (payload.notification) {
                        showNotify(`🔔 ${payload.notification.title}: ${payload.notification.body}`, "success");
                        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    }
                });
            } catch(e) {
                console.log("FCM non supporté", e);
            }
        };
        if (user?.uid && info?.phone) { setupFCM(); }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user?.uid, info?.phone, db, appId, notifPerm]);

    // 🔥 NOUVEAU: Écouter l'événement pour installer la PWA
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

    useEffect(() => {
        const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
        const isStandalone = () => ('standalone' in window.navigator) && window.navigator.standalone;
        const hasDismissed = localStorage.getItem('iosInstallDismissedClient');

        if (isIos() && !isStandalone() && !hasDismissed) {
            setShowIosPrompt(true);
        }
    }, []);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        localStorage.setItem('pwa_mode', 'client');
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            window.deferredPWAInstall = null;
            setShowInstallBtn(false);
            try {
                // Increment a counter in Firestore when the PWA is installed
                const installStatsRef = doc(db, 'artifacts', appId, 'stats', 'pwa_installs');
                await updateDoc(installStatsRef, {
                    totalInstalls: increment(1),
                    lastInstallAt: new Date().toISOString()
                }, { merge: true }); // merge:true will create the document if it doesn't exist
            } catch (error) { console.error("Error incrementing PWA install counter:", error); }
        }
        setDeferredPrompt(null);
    };

    const handleEnableNotifications = async () => {
        if (!('Notification' in window)) {
            showNotify("Votre appareil ne supporte pas les notifications Web.", "error");
            return;
        }
        try {
            const perm = await Notification.requestPermission();
            setNotifPerm(perm);
            if (perm === 'granted') {
                showNotify("Notifications activées avec succès ! 🔔", "success");
            } else {
                showNotify("Vous avez refusé les notifications.", "error");
            }
        } catch (error) {
            console.error(error);
            showNotify("Erreur lors de l'activation des notifications.", "error");
        }
    };

    // 🔥 NOUVEAU : Fonction bach nbedlou n-nmra f profil w f les commandes li mazal en cours
    const handleUpdatePhoneTracking = async () => {
        const cleanPh = newPhone.replace(/[^\d]/g, '');
        if (!/^(06|07)\d{8}$/.test(cleanPh)) {
            showNotify("N-nmra khassha tbda b 06 wla 07 w fiha 10 d'ar9am!", "error");
            return;
        }
        
        try {
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), { phone: cleanPh }, { merge: true });
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', cleanPh), { name: info.name, phone: cleanPh, uid: user.uid }, { merge: true });
            
            const activeOrds = clientOrders.filter(o => !['delivered', 'rejected'].includes(o.status));
            for (const o of activeOrds) {
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { phone: cleanPh });
            }
            
            setInfo(prev => ({ ...prev, phone: cleanPh }));
            setEditPhoneMode(false);
            showNotify("Numéro mis à jour avec succès! ✅", "success");
        } catch (e) {
            showNotify("Erreur lors de la mise à jour.", "error");
        }
    };

    // 🔥 OPTIMISATION (Performance Fix): Cacher les calculs des commandes pour éviter le lag (T9ol)
    const { clientOrders, pastOrders, pointsEarned, pointsUsedTotal, availablePoints } = useMemo(() => {
        const cOrders = (orders || []).filter(o => (info.phone && o.phone === info.phone) || (user?.uid && o.userId === user.uid));
        const pOrders = cOrders.filter(o => o.status === 'delivered');
        const pEarned = pOrders.reduce((s, o) => s + Math.floor((o.subtotal || 0) / 10), 0) + (info.manualPoints || 0); 
        const pUsed = pOrders.reduce((s, o) => s + (o.pointsUsed || 0), 0);
        return {
            clientOrders: cOrders,
            pastOrders: pOrders,
            pointsEarned: pEarned,
            pointsUsedTotal: pUsed,
            availablePoints: Math.max(0, pEarned - pUsed)
        };
    }, [orders, info.phone, user, info.manualPoints]);
    
    // 🔥 NOUVEAU (FIX): N-trackiw l'GPS dyal l-livreur f l-app Client (Ghir mli katkon "out_for_delivery")
    useEffect(() => {
        const activeDriverIds = [...new Set(clientOrders.filter(o => o.status === 'out_for_delivery' && o.driverId).map(o => o.driverId))];
        
        if (activeDriverIds.length === 0) {
            setTrackDrivers([]);
            return;
        }
        
        const rtdb = getDatabase();

        const unsubsFirestore = activeDriverIds.map(dId => {
            return onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', dId), (docSnap) => {
                if (docSnap.exists()) {
                    setTrackDrivers(prev => {
                        const newDrivers = prev.filter(d => d.uid !== dId);
                        const existing = prev.find(d => d.uid === dId);
                        const lat = existing?.lat || docSnap.data().lat;
                        const lng = existing?.lng || docSnap.data().lng;
                        newDrivers.push({ uid: docSnap.id, ...docSnap.data(), lat, lng });
                        return newDrivers;
                    });
                }
            });
        });

        const unsubsRTDB = activeDriverIds.map(dId => {
            return onValue(rtdbRef(rtdb, `tracking/${appId}/drivers/${dId}`), (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setTrackDrivers(prev => {
                        const newDrivers = prev.filter(d => d.uid !== dId);
                        const existing = prev.find(d => d.uid === dId) || { uid: dId };
                        newDrivers.push({ ...existing, lat: data.lat, lng: data.lng });
                        return newDrivers;
                    });
                }
            });
        });

        return () => {
            unsubsFirestore.forEach(unsub => unsub());
            unsubsRTDB.forEach(unsub => unsub());
        };
    }, [clientOrders, db, appId]);

    // 🔥 OPTIMISATION: Cacher les calculs du panier
    const { subtotal, deliveryFee, discountAmt, pointsDiscount, totalDiscount, total } = useMemo(() => {
        const sub = cart.reduce((s,i)=>s+i.price*i.qty,0); 
        const fee = info.nearestBranch ? getDeliveryFee(info.nearestBranch.distance) : 15;
        let dAmt = 0; 
        if (promoApplied) { dAmt = promoApplied.type === 'fixed' ? promoApplied.discount : Math.floor(sub * promoApplied.discount); }
        let pDiscount = usePoints ? availablePoints : 0; 
        const tDiscount = Math.min(sub, dAmt + pDiscount); 
        const tot = Math.max(0, sub + fee - tDiscount);
        return { subtotal: sub, deliveryFee: fee, discountAmt: dAmt, pointsDiscount: pDiscount, totalDiscount: tDiscount, total: tot };
    }, [cart, info.nearestBranch, promoApplied, usePoints, availablePoints]);

    const handleApplyPromo = () => { 
        if (promoCodeInput.toUpperCase() === 'GLOVO1') { setPromoApplied({ code: 'GLOVO1', discount: 15, type: 'fixed' }); showNotify("Code Promo GLOVO1 appliqué! (-15 DH) 🎉", "success"); } 
        else if (promoCodeInput.toUpperCase() === 'BOCA10') { setPromoApplied({ code: 'BOCA10', discount: 0.10, type: 'percent' }); showNotify("Code Promo BOCA10 appliqué! (-10%) 🎉", "success"); } 
        else { showNotify("Code promo invalide wla salat s-sala7iya dyalo ❌", "error"); setPromoApplied(null); } 
    };


    const handleGps = (showNotify) => { 
        setIsG(true); 
        navigator.geolocation.getCurrentPosition(
            pos => { 
                const closest = getClosestBranch(pos.coords.latitude, pos.coords.longitude, activeBranches); 
                if (!closest) { setIsG(false); return showNotify("Ga3 l-ma7alat masdoudin daba! 🚫", "error"); } 
                setInfo(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, nearestBranch: closest, gpsFailed: false })); 
                setIsG(false); 
                if (parseFloat(closest.distance) > (closest.radius || 5)) showNotify(`B3id bzaf! (Max ${closest.radius || 5}km)`, "error"); else showNotify("GPS Validé ✅", "success"); 
            }, 
            () => { 
                setIsG(false); 
                showNotify("GPS makhdamch. Khtar l'agence b ydik lta7t 👇", "error"); 
                setInfo(p => ({ ...p, gpsFailed: true })); 
            }
        ); 
    };

    return {
        info, setInfo,
        isG, setIsG,
        isAppLoading, setIsAppLoading,
        handleGps
    };
}
