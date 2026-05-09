import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, User, Plus, ChevronRight, Lock, MapPin, Navigation, MessageCircle, Star, X, Home, Clock, Check, Phone, Utensils, Trash2, FileText, ClipboardList, BellRing } from 'lucide-react';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { getMessaging, onMessage, getToken } from 'firebase/messaging';
import { getClosestBranch, getDeliveryFee, getWhatsAppFormat, generateOrderNumber, buildMessage, formatSansIngredient, openWhatsAppDirect } from '../utils/helpers';
import ClientTrackingMap from '../components/ClientTrackingMap';
import StatusBadge from '../components/StatusBadge';
import RatingCard from '../components/RatingCard';
import { DEFAULT_BRANCHES, PREDEFINED_DRINKS } from '../config/constants';
import { appId, VAPID_KEY } from '../config/firebase';
import ErrorBoundary from '../components/ErrorBoundary';

const PromoSlider = ({ brand, btnRadius, anims }) => {
    const [current, setCurrent] = useState(0);
    
    const validSliders = (brand.sliders || []).filter(s => {
        if (typeof s === 'string') return s.trim() !== '';
        return s && s.img && s.img.trim() !== '';
    });
    
    const slides = validSliders.length > 0 
        ? validSliders.map(s => typeof s === 'string' ? { img: s, title: brand.texts?.coverTitle || 'A7san Mada9', badge: brand.texts?.topQuality || 'Top Qualité' } : { img: s.img, title: s.title || brand.texts?.coverTitle || 'A7san Mada9', badge: s.badge || brand.texts?.topQuality || 'Top Qualité' })
        : [{ img: brand.coverUrl, title: brand.texts?.coverTitle || 'A7san Mada9', badge: brand.texts?.topQuality || 'Top Qualité' }];

    useEffect(() => {
        if (slides.length <= 1) return;
        const interval = setInterval(() => {
            setCurrent(prev => (prev + 1) % slides.length);
        }, 4000);
        return () => clearInterval(interval);
    }, [slides.length]);

    return (
        <div className="rounded-3xl text-white overflow-hidden relative shadow-lg mt-2 min-h-[160px] md:min-h-[250px] flex flex-col justify-end">
            {slides.map((slide, idx) => (
                <div key={idx} className={`absolute inset-0 transition-opacity duration-1000 ${idx === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
                    <img src={slide.img} alt={`Promo ${idx}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/20 z-0"></div>
                    <div className="absolute inset-0 z-10 w-full p-6 flex flex-col justify-end">
                        <span className={`text-black text-[9px] font-black uppercase px-2 py-1 ${btnRadius} mb-2 inline-block w-fit shadow-md`} style={{backgroundColor: brand.color}}>{slide.badge}</span>
                        <h2 className={`text-2xl md:text-4xl font-black mb-1 italic uppercase tracking-tighter leading-none text-white drop-shadow-md ${anims.titleFloat ? 'animate-float-text inline-block' : ''}`}>{slide.title}</h2>
                    </div>
                </div>
            ))}
            {slides.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                    {slides.map((_, idx) => (
                        <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === current ? 'bg-white w-6' : 'bg-white/50 w-1.5'}`} />
                    ))}
                </div>
            )}
        </div>
    );
};

function ClientViewInner({ cart, setCart, orders, user, showNotify, settings, brand, db, onLogout, onlineDrivers, defaultMenu }) {
    const [v, setV] = useState('menu'); 
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
    const [customizationStep, setCustomizationStep] = useState(0);
    const [orderNote, setOrderNote] = useState('');
    const [detailOrder, setDetailOrder] = useState(null);
    const [deferredPrompt, setDeferredPrompt] = useState(null); // Jdid: PWA Install Prompt
    const [showInstallBtn, setShowInstallBtn] = useState(false);
    const [notifPerm, setNotifPerm] = useState(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied');
    
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
                                setInfo(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, nearestBranch: closest }));
                                updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
                                    lat: pos.coords.latitude,
                                    lng: pos.coords.longitude,
                                    nearestBranch: closest
                                }).catch(()=>{});
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
                    setInfo(p => ({ ...p, lat: pos.coords.latitude, lng: pos.coords.longitude, nearestBranch: closest }));
                    updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        nearestBranch: closest
                    }).catch(()=>{});
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

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
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

    const handleGps = () => { 
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
    
    const handleFinalOrder = async () => {
        if (cart.length === 0) return; 
        if (!info.phone || !/^(06|07)\d{8}$/.test(info.phone)) {
            showNotify("3afak 9ad N-nmra dyal Télifoun f Profil 9bel mat-commander! 📱", "error");
            setV('profile');
            return;
        }
        if (!info.lat && !info.nearestBranch) { showNotify("9ad l'GPS!", "error"); setV('profile'); return; }
        
        const orderNum = generateOrderNumber();
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), { userId: user?.uid || 'guest', orderNumber: orderNum, items: cart, total, deliveryFee, subtotal, discount: discountAmt, pointsUsed: usePoints ? availablePoints : 0, promoCode: promoApplied ? promoApplied.code : null, orderNote: orderNote.trim(), prepTime: 10, ...info, status: 'pending', createdAt: serverTimestamp() });
        
        const waPhone = getWhatsAppFormat(info.nearestBranch?.phone || brand.phone);
        const itemsTxt = cart.map(i => {
            const parts = (i.name || '').split(' (Sans ');
            const baseName = parts[0];
            const opts = parts.length > 1 ? parts[1].replace(')','').split(', ').map(opt => `\n   - ${formatSansIngredient(opt)}`).join('') : '';
            return `• ${i.qty}x ${baseName}${opts}`;
        }).join('\n');
        const gpsLink = info.lat ? `\n🌍 *GPS Exact:* https://maps.google.com/?q=${info.lat},${info.lng}` : '';
        let discountLines = ''; 
        if (promoApplied) discountLines += `\n🏷️ *Promo:* -${discountAmt} DH`; 
        if (usePoints) discountLines += `\n⭐ *Fidélité:* -${pointsDiscount} DH`;
        const appUrl = window.location.origin + window.location.pathname;

        const msgTemplate = brand.messages?.newOrder || brand.messages?.standardOrder;
        let msgBody = buildMessage(msgTemplate, { brandName: (brand.name || '').toUpperCase(), orderNum: orderNum, clientName: info.name, clientPhone: info.phone, clientAddress: info.address || 'Non spécifiée', branchName: info.nearestBranch?.name || 'Inconnu', gpsLink: gpsLink, items: itemsTxt, subtotal: subtotal, deliveryFee: deliveryFee, discount: discountLines, total: total, adminLink: `${appUrl}?admin=true` });
        
        if (orderNote.trim()) { msgBody += `\n\n📝 *Note Cuisine:* ${orderNote.trim()}`; }
        msgBody += "\n\nRevenez sur l'application pour suivre votre livreur en direct.";
        
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const waUrl = isMobile ? `whatsapp://send?phone=${waPhone}&text=${encodeURIComponent(msgBody)}` : `https://web.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(msgBody)}`;
        
        if (isMobile) {
            window.location.href = waUrl;
        } else {
            if (clientWaWindow && !clientWaWindow.closed) {
                clientWaWindow.location.href = waUrl;
                clientWaWindow.focus();
            } else {
                clientWaWindow = window.open(waUrl, 'whatsapp_client');
            }
        }
        setCart([]); setV('tracking'); setTrackTab('active'); setPromoApplied(null); setUsePoints(false); setPromoCodeInput(''); setOrderNote('');
    };

    const activeMenu = useMemo(() => settings.menuItems || defaultMenu, [settings.menuItems, defaultMenu]); 
    const categories = useMemo(() => ['All', ...new Set(activeMenu.map(i => i.category))], [activeMenu]); 
    const menu = activeMenu.filter(i => (activeCat === 'All' || i.category === activeCat) && !settings.disabledItems?.includes(i.id));
    const btnRadius = brand.buttonStyle === 'square' ? 'rounded-md' : (brand.buttonStyle === 'rounded' ? 'rounded-xl' : 'rounded-full');
    const anims = brand.animations || { photoZoom: true, priceBounce: true, titleFloat: true, categoryFloat: true, boutiqueFloat: true, plusPulse: true, promoMarquee: false };

    const renderCartControls = (i, inC, themeType = 'normal') => {
        const itemCart = cart.filter(c => c.id === i.id);
        const totalQty = itemCart.reduce((sum, c) => sum + c.qty, 0);
        return (
        <div className={`${themeType === 'premium' ? 'mt-auto z-20' : 'mt-auto w-full z-20'}`}>
            {totalQty > 0 ? (
                <div className={`flex items-center justify-between ${btnRadius} p-1 border ${themeType === 'premium' ? 'bg-black text-white w-28 h-12 shadow-xl' : 'bg-gray-100'}`}><button onClick={() => {
                    const lastItem = itemCart[itemCart.length - 1];
                    setCart(cart.map(x=>x.cartItemId===lastItem.cartItemId?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0));
                }} className={themeType === 'premium' ? `bg-white/20 w-10 h-10 ${btnRadius} font-black text-white` : `bg-white w-7 h-7 ${btnRadius} text-red-500 font-black shadow-sm`}>-</button><span className="font-black text-sm">{totalQty}</span><button onClick={() => {
                    if (i.removableIngredients || i.choices || (i.extras && i.extras.length > 0) || i.hasVariations) { setSelectedItem(i); setItemOptions([]); setSelectedVariation(i.hasVariations && i.variations?.length > 0 ? i.variations[0] : null); setSelectedChoice(null); setSelectedExtras([]); setCustomizationStep(0); } 
                    else { const lastItem = itemCart[itemCart.length - 1]; setCart(cart.map(x=>x.cartItemId===lastItem.cartItemId?{...x,qty:x.qty+1}:x)); }
                }} className={themeType === 'premium' ? `w-10 h-10 ${btnRadius} text-black font-black` : `bg-white w-7 h-7 ${btnRadius} text-black font-black shadow-sm`} style={{backgroundColor: brand.color}}>+</button></div>
            ) : (
            <button disabled={!settings.isOpen || i.outOfStock} onClick={()=>{
                    if (i.removableIngredients || i.hasVariations || i.choices || (i.extras && i.extras.length > 0)) { setSelectedItem(i); setItemOptions([]); setSelectedVariation(i.hasVariations && i.variations?.length > 0 ? i.variations[0] : null); setSelectedChoice(null); setSelectedExtras([]); } 
                    else { setCart([...cart,{...i,qty:1, cartItemId: i.id + '_default'}]); }
                }} className={`${themeType === 'premium' ? `text-black w-12 h-12 ${btnRadius} font-black text-xl shadow-xl flex items-center justify-center active:scale-90 transition-all` : `text-black w-full py-2.5 ${btnRadius} font-black text-[10px] uppercase shadow-sm`} ${anims.plusPulse ? 'animate-pulse text-red-500' : ''}`} style={{backgroundColor: brand.color}}>{themeType === 'premium' ? <Plus size={24} strokeWidth={3}/> : txtAdd}</button>
            )}
        </div>
    )};

    if (isAppLoading) return <div className="h-[100dvh] flex flex-col items-center justify-center space-y-4" style={{backgroundColor: brand.bgColor}}><div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-[#ffbc0d] animate-spin" style={{borderTopColor: brand.color}}></div><p className="text-xs font-black uppercase text-gray-400 tracking-widest">Chargement...</p></div>;

    const getStep = (s) => { switch(s) { case 'pending': return 1; case 'preparing': return 2; case 'ready': return 2; case 'out_for_delivery': return 3; case 'delivered': return 4; default: return 1; } };

    return (
      <div className="min-h-[100dvh] pb-32 text-left relative w-full overflow-x-hidden" style={{color: brand.textColor, backgroundColor: brand.bgColor}}>
        {brand.promoMsg && <div className="text-[10px] font-black uppercase tracking-widest py-2 px-4 overflow-hidden relative flex items-center h-8" style={{backgroundColor: brand.color, color: '#000'}}><div className={`whitespace-nowrap absolute ${anims.promoMarquee ? 'animate-scroll-left' : 'animate-pulse text-center w-full'}`}>{brand.promoMsg}</div></div>}
        <header className="px-4 py-2 flex justify-between items-center sticky top-0 z-[50] shadow-sm border-b-2 md:mt-0" style={{borderBottomColor: brand.color, backgroundColor: brand.headerColor}}>
          <div className="leading-none flex flex-col justify-center">
            {brand.logoUrl ? <img src={brand.logoUrl} alt="Logo" className={`h-8 object-contain mb-1 ${anims.boutiqueFloat ? 'animate-float-text inline-block' : ''}`} loading="lazy" /> : <h1 className={`text-2xl font-black italic ${anims.boutiqueFloat ? 'animate-float-text inline-block' : ''}`} dangerouslySetInnerHTML={{__html: brand.displayName || brand.name}}></h1>}
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-0.5">Salut, {info.name?.split(' ')[0]}</p>
          </div>
          <div className="flex items-center gap-2">
            {showInstallBtn && (
              <button onClick={handleInstallApp} className={`px-3 py-2 text-[10px] font-black uppercase shadow-md active:scale-95 transition-all animate-bounce ${btnRadius}`} style={{backgroundColor: brand.color, color: '#000'}}>
                📲 Installer
              </button>
            )}
            <button onClick={()=>setV('profile')} className={`p-2.5 bg-black/5 ${btnRadius} shadow-inner active:scale-90 transition-all`} style={{color: brand.color}}><User size={20}/></button>
          </div>
        </header>

        <main className="p-4 md:p-8 space-y-6">
          {v === 'menu' && (
            <div className="space-y-6 animate-in fade-in duration-500">
           <PromoSlider brand={brand} btnRadius={btnRadius} anims={anims} />
               <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">{categories.map(c => <button key={c} onClick={() => setActiveCat(c)} className={`whitespace-nowrap px-6 py-2.5 ${btnRadius} font-black text-xs uppercase border-2 transition-all ${anims.categoryFloat ? 'animate-float-text' : ''} ${activeCat === c ? 'text-black shadow-md' : 'bg-white border-transparent opacity-70 shadow-sm'}`} style={activeCat === c ? {backgroundColor: brand.color, borderColor: brand.color} : { color: brand.textColor }}>{c==='All'?'Tout':c}</button>)}</div>
               {!settings.isOpen && <div className={`bg-red-100 text-red-600 p-4 ${btnRadius} text-center font-black animate-pulse flex items-center justify-center gap-2 shadow-sm`}><Lock size={18}/> Boutique Masdouda</div>}
               
               {brand.theme === 'grid' && <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">{menu.map(i => <div key={i.id} className={`bg-white ${btnRadius} p-3 shadow-sm border border-black/5 flex flex-col group active:scale-95 transition-all relative overflow-hidden`}>{i.img?.startsWith('http') || i.img?.startsWith('data:image') ? <div className={`h-24 md:h-32 mb-3 w-full ${btnRadius} overflow-hidden`}><img src={i.img} loading="lazy" className={`w-full h-full object-contain ${anims.photoZoom ? 'animate-zoom-slow' : ''}`} /></div> : <div className={`h-24 md:h-32 bg-black/5 ${btnRadius} mb-3 flex items-center justify-center text-4xl shadow-inner overflow-hidden ${anims.photoZoom ? 'animate-zoom-slow' : ''}`}>{i.img}</div>}<h3 className={`font-black text-base md:text-lg uppercase leading-tight mb-1 ${anims.titleFloat ? 'animate-float-text inline-block' : ''}`} style={{color: brand.textColor}}>{i.name}</h3><p className="text-[9px] md:text-xs opacity-50 mb-2 leading-tight line-clamp-4 min-h-[32px]" style={{color: brand.textColor}}>{i.desc}</p><p className={`font-black text-lg md:text-xl italic mb-3 ${anims.priceBounce ? 'animate-bounce-price' : ''}`} style={{color: brand.color}}>{i.price} DH</p>{renderCartControls(i, cart.find(c => c.id === i.id), 'grid')}</div>)}</div>}
               {brand.theme === 'list' && <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">{menu.map(i => <div key={i.id} className={`bg-white ${btnRadius} p-3 shadow-sm border border-black/5 flex gap-4 items-center relative overflow-hidden active:scale-95 transition-all`}><div className={`w-24 h-24 md:w-32 md:h-32 ${btnRadius} overflow-hidden bg-black/5 flex-shrink-0 shadow-inner`}>{i.img?.startsWith('http') || i.img?.startsWith('data:image') ? <img src={i.img} loading="lazy" className={`w-full h-full object-contain ${anims.photoZoom ? 'animate-zoom-slow' : ''}`}/> : <div className={`w-full h-full flex items-center justify-center text-4xl ${anims.photoZoom ? 'animate-zoom-slow' : ''}`}>{i.img}</div>}</div><div className="flex-1 flex flex-col justify-center h-full py-1"><h3 className={`font-black text-base md:text-lg uppercase leading-tight mb-1 ${anims.titleFloat ? 'animate-float-text inline-block' : ''}`} style={{color: brand.textColor}}>{i.name}</h3><p className="text-[10px] md:text-xs opacity-50 line-clamp-4 mb-2 leading-tight" style={{color: brand.textColor}}>{i.desc}</p><p className={`font-black text-lg md:text-xl italic inline-block ${anims.priceBounce ? 'animate-bounce-price' : ''}`} style={{color: brand.color}}>{i.price} DH</p></div><div className="w-24 shrink-0 self-end">{renderCartControls(i, cart.find(c => c.id === i.id), 'list')}</div></div>)}</div>}
               {(brand.theme === 'premium' || brand.theme === 'dynamic_anim') && <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">{menu.map((i, idx) => <div key={i.id} className={`bg-white rounded-[2rem] shadow-lg border border-black/5 overflow-hidden active:scale-[0.98] transition-all relative ${brand.theme === 'dynamic_anim' ? 'animate-float-card' : ''}`} style={brand.theme === 'dynamic_anim' ? {animationDelay: `${idx * 0.15}s`} : {}}><div className="w-full h-48 md:h-56 bg-black/5 relative shadow-inner overflow-hidden">{i.img?.startsWith('http') || i.img?.startsWith('data:image') ? <img src={i.img} loading="lazy" className={`w-full h-full object-contain ${brand.theme === 'dynamic_anim' || anims.photoZoom ? 'animate-zoom-slow' : ''}`}/> : <div className={`w-full h-full flex items-center justify-center text-6xl ${brand.theme === 'dynamic_anim' || anims.photoZoom ? 'animate-zoom-slow' : ''}`}>{i.img}</div>}<div className={`absolute top-4 left-4 px-4 py-2 ${btnRadius} font-black text-xl shadow-lg bg-white/90 backdrop-blur-sm z-10 inline-block ${brand.theme === 'dynamic_anim' || anims.priceBounce ? 'animate-bounce-price' : ''}`} style={{color: '#000'}}>{i.price} DH</div>{brand.theme === 'dynamic_anim' && idx < 2 && <div className={`absolute top-4 right-4 bg-[#da291c] text-white text-[10px] font-black uppercase px-3 py-1.5 ${btnRadius} shadow-lg animate-blink-fast z-20 border-2 border-white flex items-center gap-1`}>🔥 Best Seller</div>}</div><div className="p-5 pb-6 flex justify-between items-end gap-4 relative bg-white z-20 rounded-t-[2rem] -mt-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]"><div className="flex-1 pr-16"><h3 className={`font-black text-3xl md:text-4xl uppercase leading-none mb-2 ${anims.titleFloat ? 'animate-float-text inline-block' : ''}`} style={{color: brand.textColor}}>{i.name}</h3><p className="text-sm font-bold opacity-60 line-clamp-4 leading-snug" style={{color: brand.textColor}}>{i.desc}</p></div><div className="absolute bottom-5 right-5 z-30">{renderCartControls(i, cart.find(c => c.id === i.id), 'premium')}</div></div></div>)}</div>}
            </div>
          )}

          {v === 'checkout' && (
            <div className="space-y-6 animate-in slide-in-from-right-5 md:max-w-lg lg:max-w-2xl md:mx-auto">
               <div className="flex items-center gap-4 mb-2"><button onClick={() => setV('menu')} className={`bg-white shadow-sm p-2 ${btnRadius}`}><ChevronRight className="rotate-180" size={24}/></button><h2 className="text-3xl font-black italic uppercase">Confirmation</h2></div>
           <div className={`bg-white ${btnRadius} p-6 shadow-sm border border-black/5 space-y-4`}>
               {cart.map(i => (
                 <div key={i.cartItemId || i.id} className="flex justify-between items-center border-b border-gray-50 pb-4">
                    <div className="flex items-center gap-3">
                       <div className={`w-12 h-12 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-gray-100`}>
                          {i.img?.startsWith('http') || i.img?.startsWith('data:image') ? <img src={i.img} className="w-full h-full object-cover" alt=""/> : i.img}
                       </div>
                       <div className="flex flex-col">
                          <div className="font-black text-sm uppercase leading-tight">{(i.name || '').split(' (Sans ')[0]}</div>
                          {(i.name || '').includes(' (Sans ') && (i.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, idx) => <div key={idx} className="text-[10px] text-red-500 font-bold mt-0.5 uppercase">- {formatSansIngredient(opt)}</div>)}
                          
                          <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                  <button onClick={() => { const cId = i.cartItemId || i.id; setCart(cart.map(c => (c.cartItemId || c.id) === cId ? {...c, qty: c.qty - 1} : c).filter(c => c.qty > 0)); }} className="w-6 h-6 bg-white hover:bg-gray-100 rounded-md text-gray-600 shadow-sm flex items-center justify-center font-bold text-lg leading-none active:scale-95">-</button>
                                  <span className="text-xs font-black w-4 text-center">{i.qty}</span>
                                  <button onClick={() => { const cId = i.cartItemId || i.id; setCart(cart.map(c => (c.cartItemId || c.id) === cId ? {...c, qty: c.qty + 1} : c)); }} className="w-6 h-6 bg-white hover:bg-gray-100 rounded-md text-gray-600 shadow-sm flex items-center justify-center font-bold text-lg leading-none active:scale-95">+</button>
                              </div>
                              <button onClick={() => { const cId = i.cartItemId || i.id; setCart(cart.filter(c => (c.cartItemId || c.id) !== cId)); }} className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg flex items-center justify-center shadow-sm active:scale-95 border border-red-100 transition-colors">
                                  <Trash2 size={14}/>
                              </button>
                          </div>
                       </div>
                    </div>
                    <p className="font-black whitespace-nowrap ml-2">{i.price*i.qty} DH</p>
                 </div>
               ))}
               <div className="pt-2 border-t border-black/5 mt-2 space-y-1"><div className="flex justify-between font-bold text-sm opacity-60"><span>Sous-total</span><span>{subtotal} DH</span></div><div className="flex justify-between font-bold text-sm opacity-60"><span>Livraison</span><span>{deliveryFee} DH</span></div>{promoApplied && <div className="flex justify-between font-bold text-sm text-green-600"><span>Promo ({promoApplied.code})</span><span>-{discountAmt} DH</span></div>}{usePoints && <div className="flex justify-between font-bold text-sm text-yellow-600"><span>Fidélité</span><span>-{pointsDiscount} DH</span></div>}<div className="flex justify-between font-black text-2xl pt-2 mt-2 border-t border-dashed"><span>Total</span><span style={{color: brand.color}}>{total} DH</span></div></div></div>
               {(settings?.promoEnabled !== false || (settings?.loyaltyEnabled !== false && availablePoints > 0)) && (
                 <div className={`bg-white p-5 ${btnRadius} shadow-sm border border-black/5 text-left space-y-4`}>
                   <h3 className="font-black text-[11px] uppercase tracking-widest border-b border-gray-50 pb-2 opacity-50">Avantages & Réductions</h3>
                   {settings?.promoEnabled !== false && (
                     <div className="flex gap-2"><input className={`flex-1 bg-gray-50 border border-gray-200 p-3 ${btnRadius} font-bold text-sm outline-none focus:border-black uppercase`} placeholder="Code Promo" value={promoCodeInput} onChange={e => setPromoCodeInput(e.target.value.toUpperCase())} disabled={promoApplied !== null} />{!promoApplied ? (<button onClick={handleApplyPromo} className={`bg-black text-white px-4 ${btnRadius} font-black text-xs uppercase active:scale-95 transition-all shadow-md`}>Appliquer</button>) : (<button onClick={() => { setPromoApplied(null); setPromoCodeInput(''); }} className={`bg-red-100 text-red-600 px-4 ${btnRadius} font-black text-xs uppercase active:scale-95 transition-all`}><X size={16}/></button>)}</div>
                   )}
                   {settings?.loyaltyEnabled !== false && availablePoints > 0 && (
                     <label className={`flex items-center justify-between bg-yellow-50 border border-yellow-200 p-4 ${btnRadius} cursor-pointer hover:bg-yellow-100 transition-colors`}><div className="flex items-center gap-3"><div className="bg-yellow-200 p-2 rounded-full"><Star size={16} className="text-yellow-700" /></div><div><p className="text-xs font-black text-yellow-800">Points de Fidélité</p><p className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest">{availablePoints} points dispo (-{availablePoints} DH)</p></div></div><input type="checkbox" className="w-5 h-5 accent-yellow-600 cursor-pointer" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} /></label>
                   )}
                 </div>
               )}
               {settings?.kitchenNoteEnabled !== false && (
                   <div className={`bg-white p-5 ${btnRadius} shadow-sm border border-black/5 text-left space-y-4`}>
                       <h3 className="font-black text-[11px] uppercase tracking-widest border-b border-gray-50 pb-2 opacity-50">Note pour la cuisine (Optionnel)</h3>
                       <textarea className={`w-full bg-gray-50 border border-gray-200 p-3 ${btnRadius} font-medium text-sm outline-none focus:border-black resize-none min-h-[80px]`} placeholder="Ex: Sans oignon, sauce à part, bien cuit..." value={orderNote} onChange={e => setOrderNote(e.target.value)} />
                   </div>
               )}
               <div className={`bg-white p-5 ${btnRadius} shadow-sm border border-black/5 text-left relative overflow-hidden`}><div className={`absolute top-0 right-0 bg-blue-100 text-blue-800 text-[9px] font-black px-3 py-1 rounded-bl-xl border-l border-b border-blue-200`}>POINT: {info.nearestBranch?.name}</div><h3 className="font-black text-[11px] uppercase tracking-widest mb-3 border-b border-gray-50 pb-2 opacity-50">Infos Livraison</h3><div className="space-y-3"><div className={`w-full border-2 p-4 rounded-2xl flex flex-col gap-3 shadow-sm transition-all ${info.lat || info.nearestBranch ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}><div className="flex items-center justify-between"><div className="text-left flex-1"><p className="font-black text-gray-800 text-sm flex items-center gap-1"><Navigation size={14}/> Localisation Exacte <span className="text-red-500">*</span></p><p className={`text-[10px] font-bold mt-1 ${info.lat ? 'text-green-700' : info.nearestBranch ? 'text-blue-600' : 'text-red-500'}`}>{info.lat ? `✅ GPS: ${Number(info.lat).toFixed(5)}, ${Number(info.lng).toFixed(5)}` : info.nearestBranch ? `✅ Manuel: ${info.nearestBranch?.name}` : "❌ Darouri t7ded blastek"}</p></div><button onClick={handleGps} disabled={isG} className={`p-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${info.lat ? 'bg-green-200 text-green-800' : 'bg-black text-white active:scale-95 shadow-md'}`}>{isG ? 'Kantsnaw...' : info.lat ? 'Mbedel' : '📍 7ded GPS'}</button></div>{info.gpsFailed && (<div className="mt-2 p-3 bg-red-100/50 rounded-xl border border-red-200 animate-in slide-in-from-top-2"><select className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-bold text-sm text-gray-700 mb-2" value={info.nearestBranch?.id || ''} onChange={(e) => { const branch = activeBranches.find(b => b.id === e.target.value); setInfo(prev => ({ ...prev, nearestBranch: branch, lat: null, lng: null })); }}><option value="" disabled>1. Khtar a9rab ma7al...</option>{activeBranches.map(b => <option key={b.id} value={b.id} disabled={b.isOpen === false}>{b.name} {b.isOpen === false ? '🚫' : ''}</option>)}</select><input type="url" placeholder="2. Coller Lien Google Maps" className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none focus:border-[#ffbc0d] text-xs font-bold text-gray-700" value={info.mapsLink || ''} onChange={(e) => setInfo(prev => ({ ...prev, mapsLink: e.target.value }))} /></div>)}</div></div>{(!info.lat && !info.nearestBranch) && (<button onClick={() => setV('profile')} className={`mt-4 w-full bg-white text-gray-800 py-3 ${btnRadius} font-black text-xs uppercase active:scale-95 transition-all shadow-sm border border-gray-200`}>👉 9ad l'GPS hna</button>)}</div>
               <button onClick={handleFinalOrder} className={`w-full text-black py-5 ${btnRadius} font-black text-xl uppercase shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all border-b-4`} style={{backgroundColor: brand.color, borderBottomColor: 'rgba(0,0,0,0.2)'}}><MessageCircle size={24}/> {txtOrder} WhatsApp</button>
            </div>
          )}

          {v === 'profile' && (
            <div className="space-y-4 animate-in slide-in-from-top-5 md:max-w-lg lg:max-w-2xl md:mx-auto">
               <h2 className="text-3xl font-black uppercase italic" style={{color: brand.color}}>Profil</h2>
               <div className={`bg-white p-6 ${btnRadius} space-y-5 shadow-sm border border-black/5`}>
                  <div className="bg-yellow-50 p-4 rounded-2xl flex justify-between items-center border border-yellow-200"><div className="flex items-center gap-3"><Star className="text-yellow-600"/><div><p className="font-black text-yellow-800 text-sm">Fidélité</p><p className="text-[10px] text-yellow-600 uppercase font-bold tracking-widest">{pointsEarned} points cumulés</p></div></div><p className="text-2xl font-black text-yellow-600 font-mono">{availablePoints}</p></div>
                  <label className="block text-left"><span className="text-[10px] font-black uppercase ml-2 opacity-50">Téléphone (Identifiant Unique)</span><input className={`w-full bg-gray-50 border-2 p-4 ${btnRadius} font-mono mt-1 outline-none focus:border-black tracking-widest`} value={info.phone} onChange={e=>setInfo({...info, phone:e.target.value.replace(/[^\d]/g, '').slice(0, 10)})} placeholder="06XXXXXXXX ou 07XXXXXXXX" /></label>
                  <label className="block text-left"><span className="text-[10px] font-black uppercase ml-2 opacity-50">Nom Complet</span><input className={`w-full bg-gray-50 border-2 p-4 ${btnRadius} font-bold mt-1 outline-none focus:border-black`} value={info.name} onChange={e=>setInfo({...info, name:e.target.value})} /></label>
                  <label className="block text-left"><span className="text-[10px] font-black uppercase ml-2 opacity-50">Adresse Livraison</span><textarea className={`w-full bg-gray-50 border-2 p-4 ${btnRadius} font-bold mt-1 min-h-[80px] outline-none focus:border-black`} value={info.address} onChange={e=>setInfo({...info, address:e.target.value})} placeholder="Zan9a, R9m dar..." /></label>
                  <div className={`w-full border-2 p-4 rounded-2xl flex flex-col gap-3 shadow-sm transition-all ${info.lat ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}><div className="flex items-center justify-between"><div className="text-left flex-1"><p className="font-black text-gray-800 text-sm flex items-center gap-1"><Navigation size={14}/> Localisation Exacte <span className="text-red-500">*</span></p><p className={`text-[10px] font-bold mt-1 ${info.lat ? 'text-green-700' : 'text-red-500'}`}>{info.lat ? `✅ GPS: ${Number(info.lat).toFixed(5)}, ${Number(info.lng).toFixed(5)}` : "❌ Darouri t7ded blastek"}</p></div><button onClick={handleGps} disabled={isG} className={`p-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${info.lat ? 'bg-green-200 text-green-800' : 'bg-black text-white active:scale-95 shadow-md'}`}>{isG ? 'Kantsnaw...' : info.lat ? 'Mbedel' : '📍 7ded GPS'}</button></div></div>
                  <button onClick={async()=> { const cleanPhone = (info.phone || user?.phone || user?.phoneNumber || '').replace(/[^\d]/g, ''); if(!/^(06|07)\d{8}$/.test(cleanPhone)) return showNotify("N-nmra khassha tbda b 06 wla 07 w fiha 10 d'ar9am!", "error"); await setDoc(doc(db,'artifacts',appId,'users',user.uid,'profile','data'), {...info, phone: cleanPhone, isRegistered: true}, {merge:true}); setInfo(p => ({...p, phone: cleanPhone})); showNotify("Profil mreguel! ✅", "success"); setV('menu'); }} className={`w-full py-4 ${btnRadius} font-black text-black shadow-lg uppercase italic active:scale-95 transition-all`} style={{backgroundColor: brand.color}}>Sauvegarder</button>
                  {notifPerm === 'default' && (
                      <button onClick={handleEnableNotifications} className={`w-full mt-3 py-4 ${btnRadius} font-black text-white shadow-lg uppercase italic active:scale-95 transition-all bg-blue-500 flex items-center justify-center gap-2`}>
                          <BellRing size={20} /> Activer les Notifications
                      </button>
                  )}
               </div>
               
               {/* 🚀 HISTORIQUE F L'PROFILE */}
               <div className="mt-8 mb-4 px-2">
                  <h3 className="font-black text-xs uppercase opacity-50 mb-3 text-left">Historique des Commandes</h3>
                  <div className="space-y-3">
                     {clientOrders.filter(o=>['delivered', 'rejected'].includes(o.status)).length === 0 ? (
                         <p className="text-[10px] text-gray-400 font-bold text-left">Aucune commande passée.</p>
                     ) : (
                         clientOrders.filter(o=>['delivered', 'rejected'].includes(o.status)).map(o => (
                             <div key={o.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center text-left">
                                 <div>
                                     <p className="font-black text-sm uppercase">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                     <p className="text-[10px] text-gray-500 font-bold mt-0.5">{new Date(o.createdAt?.seconds*1000).toLocaleDateString()} • {o.total} DH</p>
                                 </div>
                                 <div className="flex flex-col items-end gap-2">
                                    <StatusBadge status={o.status} />
                                    <button onClick={() => setDetailOrder(o)} className="text-[9px] font-black uppercase text-blue-600 underline">Voir détails</button>
                                 </div>
                             </div>
                         ))
                     )}
                  </div>
               </div>

               <button onClick={onLogout} className="w-full py-3 text-red-500 font-bold uppercase text-xs bg-white rounded-xl border border-red-100 shadow-sm">Déconnexion</button>
            </div>
          )}

          {v === 'tracking' && (
            <div className="space-y-3 animate-in fade-in pb-8 -mt-4">
               <div className="px-4 text-left">
                   <h2 className="text-3xl font-black uppercase italic leading-none text-gray-900">{info.name ? `Suivi dyalk a ${info.name.split(' ')[0]}` : 'Suivi'} 🛵</h2>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Ma commande en ligne</p>
               </div>
               <div className="flex flex-col gap-5 md:max-w-md lg:max-w-xl mx-auto px-2 md:px-0">
               {clientOrders.filter(o=>!['delivered', 'rejected'].includes(o.status)).length === 0 ? (
                   <div className="text-center py-12 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                       <span className="text-5xl mb-3">📭</span>
                       <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Aucune commande en cours</p>
                   </div>
               ) : (
                   clientOrders.filter(o=>!['delivered', 'rejected'].includes(o.status)).map(o => {
                     const dInfo = onlineDrivers?.find(d => d.uid === o.driverId); 
                     const dName = o.driverName || dInfo?.name || 'Livreur'; 
                     const step = getStep(o.status);
                     return (
                       <div key={o.id} className={`bg-white rounded-[2.5rem] shadow-xl border border-black/5 overflow-hidden active:scale-[0.99] transition-all relative flex flex-col h-[calc(100dvh-140px)] min-h-[500px] max-h-[850px]`}>
                          <div className="p-4 md:p-5 relative bg-white z-10 shrink-0 flex flex-col rounded-t-[2.5rem]">
                             
                             <div className="flex justify-between items-center mb-4 mt-1">
                                <div className="text-left flex flex-col justify-center">
                                   <p className="text-xl font-black italic leading-none" style={{color: brand.color}}>{o.total} DH</p>
                                   <p className="text-[9px] font-bold uppercase mt-1.5 flex items-center gap-1 opacity-50">#{o.orderNumber || o.id.slice(-4).toUpperCase()} • {new Date(o.createdAt?.seconds*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
                                </div>
                                <StatusBadge status={o.status} />
                             </div>

                             <div className="mb-5 mt-1 relative px-2"><div className="h-1.5 bg-gray-100 absolute w-[calc(100%-2rem)] top-1/2 -translate-y-1/2 z-0 rounded-full left-4"></div><div className="h-1.5 absolute top-1/2 -translate-y-1/2 z-0 rounded-full transition-all duration-700 ease-out left-4" style={{width: `calc(${(step-1)*33.33}% - ${step === 1 ? 0 : 2}rem)`, backgroundColor: brand.color}}></div><div className="flex justify-between relative z-10">{['Validée', 'Cuisine', 'Ramassé', 'Arrivée'].map((label, idx) => (<div key={label} className="flex flex-col items-center gap-1.5 relative"><div className={`w-5 h-5 rounded-full flex items-center justify-center border-[3px] border-white shadow-sm transition-all duration-500 ${step > idx ? 'scale-110' : 'bg-gray-200'}`} style={{backgroundColor: step > idx ? brand.color : ''}}>{step > idx && <Check size={10} color={brand.textColor} strokeWidth={4}/>}</div><span className={`text-[8px] font-black uppercase absolute -bottom-4 w-16 text-center ${step > idx ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span></div>))}</div></div>

                             {o.status === 'out_for_delivery' && (
                                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-left mb-3 animate-in fade-in flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0 text-lg">🛵</div>
                                    <p className="text-[10px] font-black text-blue-800 leading-tight">M3ak <span className="underline uppercase">{dName}</span>, je suis en route, préparez-vous !</p>
                                </div>
                             )}

                             <div className="flex gap-2 w-full mt-2">
                                <button onClick={() => setDetailOrder(o)} className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-md hover:bg-gray-800 active:scale-95 transition-all">
                                    <FileText size={14} className="group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" /> Détails
                                </button>
                                
                                <div className="flex-1 py-3 bg-gray-50 text-gray-800 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-1.5 shadow-sm border border-gray-200">
                                    <Clock size={14} className="text-orange-500" /> ~ {o.createdAt?.seconds ? new Date((o.createdAt.seconds + (o.prepTime || 15)*60 + 15*60)*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '...'}
                                </div>

                                {o.status === 'out_for_delivery' && dInfo?.phone && (
                                    <a href={`tel:${getWhatsAppFormat(dInfo.phone)}`} className="flex-[0.8] py-3 bg-green-500 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-1.5 shadow-md hover:bg-green-600 active:scale-95 transition-all">
                                        <Phone size={14} /> Appeler
                                    </a>
                                )}
                             </div>
                          </div>

                          <div className="flex-1 w-full relative bg-gray-200 mt-auto min-h-[250px] rounded-b-[2.5rem] overflow-hidden border-t border-gray-100">
                              <ClientTrackingMap dLat={dInfo?.lat} dLng={dInfo?.lng} cLat={o.lat} cLng={o.lng} bLat={o.nearestBranch?.lat} bLng={o.nearestBranch?.lng} color={brand.color} height="100%" />
                          </div>
                       </div>
                     );
                   })
               )}
               </div>
            </div>
          )}
        </main>

        {v === 'menu' && cart.length > 0 && (
          <div className="fixed bottom-24 left-4 right-4 z-[200] animate-in slide-in-from-bottom-10 md:w-full md:max-w-sm md:left-auto md:right-8">
            <button onClick={()=>setV('checkout')} className={`w-full p-5 ${btnRadius} shadow-2xl flex justify-between items-center text-black font-black active:scale-95 transition-all`} style={{backgroundColor: brand.color}}>
               <div className="flex items-center gap-3"><div className={`bg-black text-white w-8 h-8 ${btnRadius} flex items-center justify-center font-black`}>{cart.reduce((s,i)=>s+i.qty,0)}</div><span className="text-lg uppercase italic tracking-wider">{txtCart}</span></div>
               <span className={`text-xl italic bg-white/20 px-3 py-1 ${btnRadius}`}>{total} DH</span>
            </button>
          </div>
        )}

        <nav className="fixed bottom-0 inset-x-0 h-20 bg-white border-t flex justify-around items-center z-[150] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl px-2" style={{backgroundColor: brand.headerColor}}>
           <button onClick={()=>setV('menu')} className={`flex flex-col items-center gap-1 transition-all w-1/3 ${v === 'menu' ? 'scale-105' : 'opacity-40 hover:opacity-100'}`} style={v==='menu'?{color: brand.color}:{color: brand.textColor}}><Home size={22} strokeWidth={v==='menu'?3:2}/><span className="text-[9px] font-black uppercase text-center leading-tight mt-1">{txtMenu}</span></button>
           <button onClick={()=>setV('tracking')} className={`flex flex-col items-center gap-1 transition-all w-1/3 ${v === 'tracking' ? 'scale-105' : 'opacity-40 hover:opacity-100'}`} style={v==='tracking'?{color: brand.color}:{color: brand.textColor}}>
             <div className="relative"><ShoppingBag size={22} strokeWidth={v==='tracking'?3:2}/>{clientOrders.filter(o => o.status !== 'delivered' && o.status !== 'rejected').length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}</div>
             <span className="text-[9px] font-black uppercase text-center leading-tight mt-1">{txtTrack}</span>
           </button>
           <button onClick={()=>setV('profile')} className={`flex flex-col items-center gap-1 transition-all w-1/3 ${v === 'profile' ? 'scale-105' : 'opacity-40 hover:opacity-100'}`} style={v==='profile'?{color: brand.color}:{color: brand.textColor}}><User size={22} strokeWidth={v==='profile'?3:2}/><span className="text-[9px] font-black uppercase text-center leading-tight mt-1">{txtProfile}</span></button>
        </nav>

        {detailOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in" onClick={() => setDetailOrder(null)}>
            <div className="bg-white w-full md:max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] flex flex-col h-[80dvh] md:h-auto md:max-h-[85dvh] overflow-hidden animate-in slide-in-from-bottom-10 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b-2 border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                   <h3 className="font-black text-xl uppercase tracking-tighter text-gray-900">Détails Commande</h3>
                   <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Cmd #{detailOrder.orderNumber || detailOrder.id?.slice(-4).toUpperCase()}</p>
                </div>
                <button onClick={() => setDetailOrder(null)} className="p-3 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors active:scale-95"><X size={20}/></button>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto space-y-4 bg-gray-50/50">
                {(detailOrder.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start font-bold text-gray-800 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex gap-4 items-start">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-sm font-black border border-gray-200">{item.qty}x</span>
                      <div className="flex flex-col">
                          <span className="font-black text-sm uppercase leading-tight">{(item.name || '').split(' (Sans ')[0]}</span>
                          {(item.name || '').includes(' (Sans ') && (
                              <span className="text-[10px] text-red-500 font-black uppercase mt-1 flex flex-col gap-0.5">
                                  {(item.name || '').split(' (Sans ')[1].replace(')', '').split(', ').map((opt, oIdx) => <span key={oIdx}>- {formatSansIngredient(opt)}</span>)}
                              </span>
                          )}
                      </div>
                    </div>
                    <span className="font-black text-gray-900 whitespace-nowrap ml-2">{item.price * item.qty} DH</span>
                  </div>
                ))}
                {detailOrder.orderNote && (
                    <div className="mt-2 p-4 bg-red-50 text-red-800 text-xs rounded-2xl border border-red-100 font-bold shadow-sm">
                        <span className="uppercase tracking-widest text-[9px] block mb-1 text-red-500">📝 Note au restaurant :</span>
                        "{detailOrder.orderNote}"
                    </div>
                )}
              </div>
              
              <div className="p-6 bg-white border-t-2 border-gray-100 shrink-0">
                 <div className="flex justify-between items-center mb-2 text-xs font-bold text-gray-500">
                    <span>Sous-total</span>
                    <span>{detailOrder.subtotal} DH</span>
                 </div>
                 <div className="flex justify-between items-center mb-3 text-xs font-bold text-gray-500">
                    <span>Livraison</span>
                    <span>{detailOrder.deliveryFee} DH</span>
                 </div>
                 {detailOrder.discount > 0 && (
                     <div className="flex justify-between items-center mb-3 text-xs font-bold text-green-600">
                        <span>Remise Promo</span>
                        <span>-{detailOrder.discount} DH</span>
                     </div>
                 )}
                 {detailOrder.pointsUsed > 0 && (
                     <div className="flex justify-between items-center mb-3 text-xs font-bold text-yellow-600">
                        <span>Fidélité (Points)</span>
                        <span>-{detailOrder.pointsUsed} DH</span>
                     </div>
                 )}
                 <div className="flex justify-between items-center text-2xl font-black text-gray-900 border-t-2 border-dashed border-gray-200 pt-4 mt-1">
                    <span className="uppercase tracking-tighter">Total Payé</span>
                    <span style={{color: brand?.color || '#da291c'}}>{detailOrder.total} DH</span>
                 </div>
              </div>
            </div>
          </div>
        )}

        {selectedItem && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-end md:items-center justify-center animate-in fade-in" onClick={() => setSelectedItem(null)}>
            <div className="bg-white w-full md:w-[400px] rounded-t-3xl md:rounded-3xl p-6 flex flex-col max-h-[80dvh] animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-xl uppercase italic">Personnaliser</h3>
                <button onClick={() => setSelectedItem(null)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-6">
                {(() => {
                    const activeGlobalDrinks = settings?.globalDrinks !== undefined ? settings.globalDrinks : PREDEFINED_DRINKS;
                    const drinkNames = new Set(activeGlobalDrinks.map(d => d.name));

                    const pureExtras = (selectedItem.extras || []).filter(e => !drinkNames.has(e.name));
                    const pureDrinks = (selectedItem.extras || []).filter(e => drinkNames.has(e.name));
                    
                    const steps = [];
                    if ((selectedItem.hasVariations && selectedItem.variations?.length > 0) || selectedItem.choices) {
                        steps.push('base');
                    }
                    if (selectedItem.removableIngredients) {
                        steps.push('ingredients');
                    }
                    if (pureExtras.length > 0) steps.push('extras');
                    if (pureDrinks.length > 0) steps.push('drinks');
                    if (steps.length === 0) steps.push('base');

                    const currentStepId = steps[customizationStep] || 'base';

                    return (
                        <>
                            {currentStepId === 'base' && (
                                <div className="animate-in slide-in-from-right-5">
                                    {selectedItem.hasVariations && selectedItem.variations?.length > 0 && (
                                      <div className="mb-6">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Taille / Variante <span className="text-red-500">*</span></p>
                                        <div className="space-y-2">
                                          {selectedItem.variations.map((v, idx) => (
                                            <label key={idx} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedVariation?.name === v.name ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedVariation?.name === v.name ? 'border-blue-500' : 'border-gray-300'}`}>
                                                        {selectedVariation?.name === v.name && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}
                                                    </div>
                                                    <span className="font-bold text-sm text-gray-900">{v.name}</span>
                                                </div>
                                                <span className="font-black text-blue-600">{v.price} DH</span>
                                                <input type="radio" className="hidden" name="variation" checked={selectedVariation?.name === v.name} onChange={() => setSelectedVariation(v)} />
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {selectedItem.choices && (
                                      <div className="mb-6">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Choix / Parfum <span className="text-red-500">*</span></p>
                                        <div className="space-y-2">
                                          {(selectedItem.choices || '').split(',').map(choice => {
                                            const c = choice.trim();
                                            if (!c) return null;
                                            return (
                                              <label key={c} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedChoice === c ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                                  <div className="flex items-center gap-3">
                                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedChoice === c ? 'border-blue-500' : 'border-gray-300'}`}>
                                                          {selectedChoice === c && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}
                                                      </div>
                                                      <span className="font-bold text-sm text-gray-900">{c}</span>
                                                  </div>
                                                  <input type="radio" className="hidden" name="choice" checked={selectedChoice === c} onChange={() => setSelectedChoice(c)} />
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                </div>
                            )}

                            {currentStepId === 'ingredients' && selectedItem.removableIngredients && (
                                <div className="animate-in slide-in-from-right-5">
                                      <div>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">🥗 Choix de garniture</p>
                                        <p className="text-[10px] text-gray-400 mb-3 font-semibold">Choisissez un maximum de 8 produits</p>
                                        <div className="space-y-2">
                                          {(selectedItem.removableIngredients || '').split(',').map(ing => {
                                      const ingredient = ing.trim();
                                      if (!ingredient) return null;
                                      const isRemoved = itemOptions.includes(ingredient);
                                      return (
                                        <button 
                                          key={ingredient}
                                          onClick={() => {
                                            if (isRemoved) {
                                                setItemOptions(itemOptions.filter(o => o !== ingredient));
                                            } else {
                                                if (itemOptions.length >= 8) {
                                                    showNotify("Maximum 8 ingrédients à retirer.", "error");
                                                    return;
                                                }
                                                setItemOptions([...itemOptions, ingredient]);
                                            }
                                          }}
                                          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all font-black text-sm uppercase ${isRemoved ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 bg-white text-gray-800 hover:border-gray-200'}`}>
                                          <span>{formatSansIngredient(ingredient)}</span>
                                          <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isRemoved ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                                            {isRemoved && <Check size={14} color="white" strokeWidth={4} />}
                                          </div>
                                        </button>
                                      );
                                    })}
                                        </div>
                                      </div>
                                </div>
                            )}

                            {currentStepId === 'extras' && pureExtras.length > 0 && (
                              <div className="mb-6 animate-in slide-in-from-right-5">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">➕ Souhaitez-vous un Extra ?</p>
                                <p className="text-[10px] text-gray-400 mb-3 font-semibold">Choisissez un maximum de 8 produits</p>
                                <div className="space-y-2">
                                  {pureExtras.map((ext, idx) => {
                                      const isAdded = selectedExtras.some(e => e.name === ext.name);
                                      return (
                                          <button key={idx} onClick={() => {
                                              if (isAdded) {
                                                  setSelectedExtras(selectedExtras.filter(e => e.name !== ext.name));
                                              } else {
                                                  const currentExtrasCount = selectedExtras.filter(e => !drinkNames.has(e.name)).length;
                                                  if (currentExtrasCount >= 8) {
                                                      showNotify("Maximum 8 extras autorisés.", "error");
                                                      return;
                                                  }
                                                  setSelectedExtras([...selectedExtras, ext]);
                                              }
                                          }} className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all font-black text-sm uppercase ${isAdded ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 bg-white text-gray-800 hover:border-gray-200'}`}>
                                              <span>Avec {ext.name}</span>
                                              <div className="flex items-center gap-3">
                                                  <span className="text-green-600 font-black">+{ext.price} DH</span>
                                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isAdded ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                                                      {isAdded && <Check size={14} color="white" strokeWidth={4} />}
                                                  </div>
                                              </div>
                                          </button>
                                      )
                                  })}
                                </div>
                              </div>
                            )}

                            {currentStepId === 'drinks' && pureDrinks.length > 0 && (
                              <div className="mb-6 animate-in slide-in-from-right-5">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">🥤 Souhaitez-vous une boisson ?</p>
                                <p className="text-[10px] text-gray-400 mb-3 font-semibold">Choisissez un maximum de 6 produits</p>
                                <div className="space-y-2">
                                  {pureDrinks.map((ext, idx) => {
                                      const isAdded = selectedExtras.some(e => e.name === ext.name);
                                      return (
                                          <button key={idx} onClick={() => {
                                              if (isAdded) {
                                                  setSelectedExtras(selectedExtras.filter(e => e.name !== ext.name));
                                              } else {
                                                  const currentDrinksCount = selectedExtras.filter(e => drinkNames.has(e.name)).length;
                                                  if (currentDrinksCount >= 6) {
                                                      showNotify("Maximum 6 boissons autorisées.", "error");
                                                      return;
                                                  }
                                                  setSelectedExtras([...selectedExtras, ext]);
                                              }
                                          }} className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all font-black text-sm uppercase ${isAdded ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 bg-white text-gray-800 hover:border-gray-200'}`}>
                                              <span>{ext.name}</span>
                                              <div className="flex items-center gap-3">
                                                  <span className="text-blue-600 font-black">+{ext.price} DH</span>
                                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isAdded ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                                                      {isAdded && <Check size={14} color="white" strokeWidth={4} />}
                                                  </div>
                                              </div>
                                          </button>
                                      )
                                  })}
                                </div>
                              </div>
                            )}
                        </>
                    );
                })()}
              </div>

              {(() => {
                  const drinkNames = new Set(PREDEFINED_DRINKS.map(d => d.name));
                  const pureExtras = (selectedItem.extras || []).filter(e => !drinkNames.has(e.name));
                  const pureDrinks = (selectedItem.extras || []).filter(e => drinkNames.has(e.name));
                  
                  const steps = [];
                  if ((selectedItem.hasVariations && selectedItem.variations?.length > 0) || selectedItem.choices) {
                      steps.push('base');
                  }
                  if (selectedItem.removableIngredients) {
                      steps.push('ingredients');
                  }
                  if (pureExtras.length > 0) steps.push('extras');
                  if (pureDrinks.length > 0) steps.push('drinks');
                  if (steps.length === 0) steps.push('base');

                  const currentStepId = steps[customizationStep] || 'base';
                  const isLastStep = customizationStep >= steps.length - 1;

                  if (isLastStep) {
                      return (
                          <button 
                            onClick={() => {
                              if (selectedItem.hasVariations && !selectedVariation) return showNotify("Veuillez choisir une taille !", "error");
                              if (selectedItem.choices && !selectedChoice) return showNotify("Veuillez choisir une option !", "error");
                              
                              const optionsSuffix = itemOptions.length > 0 ? '_' + itemOptions.join('_') : '_default';
                              const varSuffix = selectedVariation ? '_' + selectedVariation.name.replace(/\s+/g, '') : '';
                              const choiceSuffix = selectedChoice ? '_' + selectedChoice.replace(/\s+/g, '') : '';
                              const extrasSuffix = selectedExtras.length > 0 ? '_' + selectedExtras.map(e => e.name.replace(/\s+/g, '')).join('_') : '';
                              const cartItemId = selectedItem.id + varSuffix + choiceSuffix + optionsSuffix + extrasSuffix;
                              
                              let finalPrice = selectedVariation ? Number(selectedVariation.price || 0) : Number(selectedItem.price || 0);
                              finalPrice += selectedExtras.reduce((s, e) => s + Number(e.price), 0);
                              
                              const varNamePart = selectedVariation ? ` (${selectedVariation.name})` : '';
                              const choiceNamePart = selectedChoice ? ` (${selectedChoice})` : '';
                              const avecNamePart = selectedExtras.length > 0 ? ` (Avec ${selectedExtras.map(e => e.name).join(', ')})` : '';
                              const sansNamePart = itemOptions.length > 0 ? ` (Sans ${itemOptions.join(', ')})` : '';
                              const finalName = selectedItem.name + varNamePart + choiceNamePart + avecNamePart + sansNamePart;

                              const existingItem = cart.find(c => c.cartItemId === cartItemId);
                              if (existingItem) {
                                setCart(cart.map(c => c.cartItemId === cartItemId ? { ...c, qty: c.qty + 1 } : c));
                              } else {
                                setCart([...cart, { ...selectedItem, qty: 1, cartItemId, name: finalName, price: finalPrice }]);
                              }
                              setSelectedItem(null);
                              showNotify("Ajouté au panier ! 🍔", "success");
                            }} 
                            className="w-full py-4 rounded-xl font-black text-lg uppercase text-black shadow-lg"
                            style={{backgroundColor: brand.color}}
                          >
                            Valider • {(selectedVariation ? Number(selectedVariation.price || 0) : Number(selectedItem.price || 0)) + selectedExtras.reduce((s,e)=>s+Number(e.price),0)} DH
                          </button>
                      );
                  }

                  return (
                      <div className="flex gap-2 w-full mt-auto">
                          <button 
                              onClick={() => setCustomizationStep(prev => prev + 1)}
                              className="flex-1 py-4 rounded-xl font-black text-sm uppercase bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors shadow-sm"
                          >
                              Non merci
                          </button>
                          <button 
                              onClick={() => {
                                  if (currentStepId === 'base') {
                                      if (selectedItem.hasVariations && !selectedVariation) return showNotify("Veuillez choisir une taille !", "error");
                                      if (selectedItem.choices && !selectedChoice) return showNotify("Veuillez choisir une option !", "error");
                                  }
                                  setCustomizationStep(prev => prev + 1);
                              }}
                              className="flex-[2] py-4 rounded-xl font-black text-lg uppercase text-black shadow-lg"
                              style={{backgroundColor: brand.color}}
                          >
                              Suivant ➔
                          </button>
                      </div>
                  );
              })()}
            </div>
          </div>
        )}
      </div>
    );
}

export default function ClientView(props) {
    return (
        <ErrorBoundary>
            <ClientViewInner {...props} />
        </ErrorBoundary>
    );
}