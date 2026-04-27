import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, User, Plus, ChevronRight, Lock, MapPin, Navigation, MessageCircle, Star, X, Home, Clock, Check, Phone, Utensils } from 'lucide-react';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getClosestBranch, getDeliveryFee, getWhatsAppFormat, generateOrderNumber, buildMessage } from '../utils/helpers';
import ClientTrackingMap from '../components/ClientTrackingMap';
import StatusBadge from '../components/StatusBadge';
import RatingCard from '../components/RatingCard';
import { DEFAULT_BRANCHES } from '../config/constants';
import { appId } from '../config/firebase';

export default function ClientView({ cart, setCart, orders, user, showNotify, settings, brand, db, onLogout, onlineDrivers, defaultMenu }) {
    const [v, setV] = useState('menu'); 
    const [info, setInfo] = useState({ name: '', phone: '', address: '', lat: null, lng: null, nearestBranch: null, gpsFailed: false }); 
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
    const [orderNote, setOrderNote] = useState('');
    
    const activeBranches = settings.branches || DEFAULT_BRANCHES;
    const txtMenu = brand.texts?.navMenu || 'VOIR MENU'; 
    const txtTrack = brand.texts?.navTrack || 'SUIVI'; 
    const txtProfile = brand.texts?.navProfile || 'PROFIL'; 
    const txtAdd = brand.texts?.btnAdd || 'Ajouter'; 
    const txtCart = brand.texts?.btnCart || 'Panier'; 
    const txtOrder = brand.texts?.btnOrder || 'Commander';

    useEffect(() => { 
        getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'))
            .then(s => { 
                if (s.exists()) {
                    const data = s.data();
                    setInfo(data); 
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
        if (v === 'checkout' && navigator.geolocation) { 
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

    // 🔥 OPTIMISATION (Performance Fix): Cacher les calculs des commandes pour éviter le lag (T9ol)
    const { clientOrders, pastOrders, pointsEarned, pointsUsedTotal, availablePoints } = useMemo(() => {
        const cOrders = orders.filter(o => (info.phone && o.phone === info.phone) || o.userId === user.uid);
        const pOrders = cOrders.filter(o => o.status === 'delivered');
        const pEarned = pOrders.reduce((s, o) => s + Math.floor((o.subtotal || 0) / 10), 0); 
        const pUsed = pOrders.reduce((s, o) => s + (o.pointsUsed || 0), 0);
        return {
            clientOrders: cOrders,
            pastOrders: pOrders,
            pointsEarned: pEarned,
            pointsUsedTotal: pUsed,
            availablePoints: Math.max(0, pEarned - pUsed)
        };
    }, [orders, info.phone, user.uid]);
    
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
        if (!info.lat && !info.nearestBranch) { showNotify("9ad l'GPS!", "error"); setV('profile'); return; }
        
        
        const orderNum = generateOrderNumber();
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), { userId: user.uid, orderNumber: orderNum, items: cart, total, deliveryFee, subtotal, discount: discountAmt, pointsUsed: usePoints ? availablePoints : 0, promoCode: promoApplied ? promoApplied.code : null, orderNote: orderNote.trim(), prepTime: 10, ...info, status: 'pending', createdAt: serverTimestamp() });
        
        const waPhone = getWhatsAppFormat(info.nearestBranch?.phone || brand.phone);
        const itemsTxt = cart.map(i => {
            const parts = (i.name || '').split(' (Sans ');
            const baseName = parts[0];
            const opts = parts.length > 1 ? parts[1].replace(')','').split(', ').map(opt => `\n   - Sans ${opt}`).join('') : '';
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
        
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msgBody)}`, '_blank');
        setCart([]); setV('tracking'); setPromoApplied(null); setUsePoints(false); setPromoCodeInput(''); setOrderNote('');
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
                    if (i.removableIngredients) { setSelectedItem(i); setItemOptions([]); } 
                    else { const lastItem = itemCart[itemCart.length - 1]; setCart(cart.map(x=>x.cartItemId===lastItem.cartItemId?{...x,qty:x.qty+1}:x)); }
                }} className={themeType === 'premium' ? `w-10 h-10 ${btnRadius} text-black font-black` : `bg-white w-7 h-7 ${btnRadius} text-black font-black shadow-sm`} style={{backgroundColor: brand.color}}>+</button></div>
            ) : (
            <button disabled={!settings.isOpen || i.outOfStock} onClick={()=>{
                    if (i.removableIngredients || i.hasVariations) { setSelectedItem(i); setItemOptions([]); setSelectedVariation(i.hasVariations && i.variations?.length > 0 ? i.variations[0] : null); } 
                    else { setCart([...cart,{...i,qty:1, cartItemId: i.id + '_default'}]); }
                }} className={`${themeType === 'premium' ? `text-black w-12 h-12 ${btnRadius} font-black text-xl shadow-xl flex items-center justify-center active:scale-90 transition-all` : `text-black w-full py-2.5 ${btnRadius} font-black text-[10px] uppercase shadow-sm`} ${anims.plusPulse ? 'animate-pulse text-red-500' : ''}`} style={{backgroundColor: brand.color}}>{themeType === 'premium' ? <Plus size={24} strokeWidth={3}/> : txtAdd}</button>
            )}
        </div>
    )};

    if (isAppLoading) return <div className="h-screen flex flex-col items-center justify-center space-y-4" style={{backgroundColor: brand.bgColor}}><div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-[#ffbc0d] animate-spin" style={{borderTopColor: brand.color}}></div><p className="text-xs font-black uppercase text-gray-400 tracking-widest">Chargement...</p></div>;

    const getStep = (s) => { switch(s) { case 'pending': return 1; case 'preparing': return 2; case 'ready': return 2; case 'out_for_delivery': return 3; case 'delivered': return 4; default: return 1; } };

    return (
      <div className="min-h-screen pb-32 text-left md:max-w-7xl md:mx-auto md:shadow-2xl md:rounded-b-[3rem] md:overflow-hidden relative" style={{color: brand.textColor, backgroundColor: brand.bgColor}}>
        {brand.promoMsg && <div className="text-[10px] font-black uppercase tracking-widest py-2 px-4 overflow-hidden relative flex items-center h-8" style={{backgroundColor: brand.color, color: '#000'}}><div className={`whitespace-nowrap absolute ${anims.promoMarquee ? 'animate-scroll-left' : 'animate-pulse text-center w-full'}`}>{brand.promoMsg}</div></div>}
        <header className="p-5 pt-6 flex justify-between items-center sticky top-0 z-[50] shadow-sm border-b-4 md:mt-0" style={{borderBottomColor: brand.color, backgroundColor: brand.headerColor}}>
          <div className="leading-none flex flex-col justify-center">
            {brand.logoUrl ? <img src={brand.logoUrl} alt="Logo" className={`h-8 object-contain mb-1 ${anims.boutiqueFloat ? 'animate-float-text inline-block' : ''}`} loading="lazy" /> : <h1 className={`text-2xl font-black italic ${anims.boutiqueFloat ? 'animate-float-text inline-block' : ''}`} dangerouslySetInnerHTML={{__html: brand.displayName || brand.name}}></h1>}
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-0.5">Salut, {info.name?.split(' ')[0]}</p>
          </div>
          <button onClick={()=>setV('profile')} className={`p-2.5 bg-black/5 ${btnRadius} shadow-inner active:scale-90 transition-all`} style={{color: brand.color}}><User size={20}/></button>
        </header>

        <main className="p-4 md:p-8 space-y-6">
          {v === 'menu' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <div className="rounded-3xl p-6 text-white overflow-hidden relative shadow-lg mt-2 min-h-[160px] md:min-h-[250px] flex flex-col justify-end" style={{ backgroundImage: `url(${brand.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}><div className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/20"></div><div className="relative z-10 w-full"><span className={`text-black text-[9px] font-black uppercase px-2 py-1 ${btnRadius} mb-2 inline-block shadow-md`} style={{backgroundColor: brand.color}}>Top Qualité</span><h2 className={`text-2xl md:text-4xl font-black mb-1 italic uppercase tracking-tighter leading-none text-white drop-shadow-md ${anims.titleFloat ? 'animate-float-text inline-block' : ''}`}>A7san Mada9</h2></div></div>
               <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">{categories.map(c => <button key={c} onClick={() => setActiveCat(c)} className={`whitespace-nowrap px-6 py-2.5 ${btnRadius} font-black text-xs uppercase border-2 transition-all ${anims.categoryFloat ? 'animate-float-text' : ''} ${activeCat === c ? 'text-black shadow-md' : 'bg-white border-transparent opacity-70 shadow-sm'}`} style={activeCat === c ? {backgroundColor: brand.color, borderColor: brand.color} : { color: brand.textColor }}>{c==='All'?'Tout':c}</button>)}</div>
               {!settings.isOpen && <div className={`bg-red-100 text-red-600 p-4 ${btnRadius} text-center font-black animate-pulse flex items-center justify-center gap-2 shadow-sm`}><Lock size={18}/> Boutique Masdouda</div>}
               
               {brand.theme === 'grid' && <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">{menu.map(i => <div key={i.id} className={`bg-white ${btnRadius} p-3 shadow-sm border border-black/5 flex flex-col group active:scale-95 transition-all relative overflow-hidden`}>{i.img?.startsWith('http') ? <div className={`h-24 md:h-32 mb-3 w-full ${btnRadius} overflow-hidden`}><img src={i.img} loading="lazy" className={`w-full h-full object-contain ${anims.photoZoom ? 'animate-zoom-slow' : ''}`} /></div> : <div className={`h-24 md:h-32 bg-black/5 ${btnRadius} mb-3 flex items-center justify-center text-4xl shadow-inner overflow-hidden ${anims.photoZoom ? 'animate-zoom-slow' : ''}`}>{i.img}</div>}<h3 className={`font-black text-[13px] md:text-sm uppercase leading-tight mb-1 ${anims.titleFloat ? 'animate-float-text inline-block' : ''}`} style={{color: brand.textColor}}>{i.name}</h3><p className="text-[9px] md:text-xs opacity-50 mb-2 leading-tight line-clamp-4 min-h-[32px]" style={{color: brand.textColor}}>{i.desc}</p><p className={`font-black text-lg md:text-xl italic mb-3 ${anims.priceBounce ? 'animate-bounce-price' : ''}`} style={{color: brand.color}}>{i.price} DH</p>{renderCartControls(i, cart.find(c => c.id === i.id), 'grid')}</div>)}</div>}
               {brand.theme === 'list' && <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">{menu.map(i => <div key={i.id} className={`bg-white ${btnRadius} p-3 shadow-sm border border-black/5 flex gap-4 items-center relative overflow-hidden active:scale-95 transition-all`}><div className={`w-24 h-24 md:w-32 md:h-32 ${btnRadius} overflow-hidden bg-black/5 flex-shrink-0 shadow-inner`}>{i.img?.startsWith('http') ? <img src={i.img} loading="lazy" className={`w-full h-full object-contain ${anims.photoZoom ? 'animate-zoom-slow' : ''}`}/> : <div className={`w-full h-full flex items-center justify-center text-4xl ${anims.photoZoom ? 'animate-zoom-slow' : ''}`}>{i.img}</div>}</div><div className="flex-1 flex flex-col justify-center h-full py-1"><h3 className={`font-black text-[13px] md:text-sm uppercase leading-tight mb-1 ${anims.titleFloat ? 'animate-float-text inline-block' : ''}`} style={{color: brand.textColor}}>{i.name}</h3><p className="text-[10px] md:text-xs opacity-50 line-clamp-4 mb-2 leading-tight" style={{color: brand.textColor}}>{i.desc}</p><p className={`font-black text-lg md:text-xl italic inline-block ${anims.priceBounce ? 'animate-bounce-price' : ''}`} style={{color: brand.color}}>{i.price} DH</p></div><div className="w-24 shrink-0 self-end">{renderCartControls(i, cart.find(c => c.id === i.id), 'list')}</div></div>)}</div>}
               {(brand.theme === 'premium' || brand.theme === 'dynamic_anim') && <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">{menu.map((i, idx) => <div key={i.id} className={`bg-white rounded-[2rem] shadow-lg border border-black/5 overflow-hidden active:scale-[0.98] transition-all relative ${brand.theme === 'dynamic_anim' ? 'animate-float-card' : ''}`} style={brand.theme === 'dynamic_anim' ? {animationDelay: `${idx * 0.15}s`} : {}}><div className="w-full h-48 md:h-56 bg-black/5 relative shadow-inner overflow-hidden">{i.img?.startsWith('http') ? <img src={i.img} loading="lazy" className={`w-full h-full object-contain ${brand.theme === 'dynamic_anim' || anims.photoZoom ? 'animate-zoom-slow' : ''}`}/> : <div className={`w-full h-full flex items-center justify-center text-6xl ${brand.theme === 'dynamic_anim' || anims.photoZoom ? 'animate-zoom-slow' : ''}`}>{i.img}</div>}<div className={`absolute top-4 left-4 px-4 py-2 ${btnRadius} font-black text-xl shadow-lg bg-white/90 backdrop-blur-sm z-10 inline-block ${brand.theme === 'dynamic_anim' || anims.priceBounce ? 'animate-bounce-price' : ''}`} style={{color: '#000'}}>{i.price} DH</div>{brand.theme === 'dynamic_anim' && idx < 2 && <div className={`absolute top-4 right-4 bg-[#da291c] text-white text-[10px] font-black uppercase px-3 py-1.5 ${btnRadius} shadow-lg animate-blink-fast z-20 border-2 border-white flex items-center gap-1`}>🔥 Best Seller</div>}</div><div className="p-5 pb-6 flex justify-between items-end gap-4 relative bg-white z-20 rounded-t-[2rem] -mt-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]"><div className="flex-1 pr-16"><h3 className={`font-black text-2xl uppercase leading-none mb-2 ${anims.titleFloat ? 'animate-float-text inline-block' : ''}`} style={{color: brand.textColor}}>{i.name}</h3><p className="text-sm font-bold opacity-60 line-clamp-4 leading-snug" style={{color: brand.textColor}}>{i.desc}</p></div><div className="absolute bottom-5 right-5 z-30">{renderCartControls(i, cart.find(c => c.id === i.id), 'premium')}</div></div></div>)}</div>}
            </div>
          )}

          {v === 'checkout' && (
            <div className="space-y-6 animate-in slide-in-from-right-5 md:max-w-2xl md:mx-auto">
               <div className="flex items-center gap-4 mb-2"><button onClick={() => setV('menu')} className={`bg-white shadow-sm p-2 ${btnRadius}`}><ChevronRight className="rotate-180" size={24}/></button><h2 className="text-3xl font-black italic uppercase">Confirmation</h2></div>
           <div className={`bg-white ${btnRadius} p-6 shadow-sm border border-black/5 space-y-4`}>{cart.map(i => <div key={i.cartItemId || i.id} className="flex justify-between items-center border-b border-gray-50 pb-3"><div className="flex items-center gap-3"><div className={`w-12 h-12 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center text-2xl overflow-hidden border border-gray-100`}>{i.img?.startsWith('http') ? <img src={i.img} className="w-full h-full object-cover" alt=""/> : i.img}</div><div className="flex flex-col"><div className="font-black text-sm uppercase leading-tight">{i.qty}x {(i.name || '').split(' (Sans ')[0]}</div>{(i.name || '').includes(' (Sans ') && (i.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, idx) => <div key={idx} className="text-[10px] text-red-500 font-bold mt-0.5 uppercase">- Sans {opt}</div>)}</div></div><p className="font-black whitespace-nowrap ml-2">{i.price*i.qty} DH</p></div>)}<div className="pt-2 border-t border-black/5 mt-2 space-y-1"><div className="flex justify-between font-bold text-sm opacity-60"><span>Sous-total</span><span>{subtotal} DH</span></div><div className="flex justify-between font-bold text-sm opacity-60"><span>Livraison</span><span>{deliveryFee} DH</span></div>{promoApplied && <div className="flex justify-between font-bold text-sm text-green-600"><span>Promo ({promoApplied.code})</span><span>-{discountAmt} DH</span></div>}{usePoints && <div className="flex justify-between font-bold text-sm text-yellow-600"><span>Fidélité</span><span>-{pointsDiscount} DH</span></div>}<div className="flex justify-between font-black text-2xl pt-2 mt-2 border-t border-dashed"><span>Total</span><span style={{color: brand.color}}>{total} DH</span></div></div></div>
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
            <div className="space-y-4 animate-in slide-in-from-top-5 md:max-w-2xl md:mx-auto">
               <h2 className="text-3xl font-black uppercase italic" style={{color: brand.color}}>Profil</h2>
               <div className={`bg-white p-6 ${btnRadius} space-y-5 shadow-sm border border-black/5`}>
                  <div className="bg-yellow-50 p-4 rounded-2xl flex justify-between items-center border border-yellow-200"><div className="flex items-center gap-3"><Star className="text-yellow-600"/><div><p className="font-black text-yellow-800 text-sm">Fidélité</p><p className="text-[10px] text-yellow-600 uppercase font-bold tracking-widest">{pointsEarned} points cumulés</p></div></div><p className="text-2xl font-black text-yellow-600 font-mono">{availablePoints}</p></div>
                  <label className="block text-left"><span className="text-[10px] font-black uppercase ml-2 opacity-50">Téléphone (Identifiant Unique)</span><input className={`w-full bg-gray-100 text-gray-500 border-2 p-4 ${btnRadius} font-mono mt-1 outline-none cursor-not-allowed tracking-widest`} value={info.phone || 'Non défini'} disabled /></label>
                  <label className="block text-left"><span className="text-[10px] font-black uppercase ml-2 opacity-50">Nom Complet</span><input className={`w-full bg-gray-50 border-2 p-4 ${btnRadius} font-bold mt-1 outline-none focus:border-black`} value={info.name} onChange={e=>setInfo({...info, name:e.target.value})} /></label>
                  <label className="block text-left"><span className="text-[10px] font-black uppercase ml-2 opacity-50">Adresse Livraison</span><textarea className={`w-full bg-gray-50 border-2 p-4 ${btnRadius} font-bold mt-1 min-h-[80px] outline-none focus:border-black`} value={info.address} onChange={e=>setInfo({...info, address:e.target.value})} placeholder="Zan9a, R9m dar..." /></label>
                  <div className={`w-full border-2 p-4 rounded-2xl flex flex-col gap-3 shadow-sm transition-all ${info.lat ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}><div className="flex items-center justify-between"><div className="text-left flex-1"><p className="font-black text-gray-800 text-sm flex items-center gap-1"><Navigation size={14}/> Localisation Exacte <span className="text-red-500">*</span></p><p className={`text-[10px] font-bold mt-1 ${info.lat ? 'text-green-700' : 'text-red-500'}`}>{info.lat ? `✅ GPS: ${Number(info.lat).toFixed(5)}, ${Number(info.lng).toFixed(5)}` : "❌ Darouri t7ded blastek"}</p></div><button onClick={handleGps} disabled={isG} className={`p-3 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${info.lat ? 'bg-green-200 text-green-800' : 'bg-black text-white active:scale-95 shadow-md'}`}>{isG ? 'Kantsnaw...' : info.lat ? 'Mbedel' : '📍 7ded GPS'}</button></div></div>
                  <button onClick={async()=> { await setDoc(doc(db,'artifacts',appId,'users',user.uid,'profile','data'), {...info, isRegistered: true}, {merge:true}); showNotify("Profil mreguel! ✅", "success"); setV('menu'); }} className={`w-full py-4 ${btnRadius} font-black text-black shadow-lg uppercase italic active:scale-95 transition-all`} style={{backgroundColor: brand.color}}>Sauvegarder</button>
               </div>
               <button onClick={onLogout} className="w-full py-3 text-red-500 font-bold uppercase text-xs bg-white rounded-xl border border-red-100 shadow-sm">Déconnexion</button>
            </div>
          )}

          {v === 'tracking' && (
            <div className="space-y-6 animate-in fade-in pb-8">
               <h2 className="text-3xl font-black uppercase italic text-left px-2">Suivi 🛵</h2>
               <div className={`flex bg-black/5 p-1.5 ${btnRadius} mb-6 md:max-w-md mx-auto`}><button onClick={() => setTrackTab('active')} className={`flex-1 py-3 ${btnRadius} font-black text-xs uppercase transition-all ${trackTab === 'active' ? 'bg-white text-black shadow-md' : 'text-gray-500'}`}>En Cours</button><button onClick={() => setTrackTab('history')} className={`flex-1 py-3 ${btnRadius} font-black text-xs uppercase transition-all ${trackTab === 'history' ? 'bg-white text-black shadow-md' : 'text-gray-500'}`}>Historique</button></div>
               <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
               {(trackTab === 'active' ? clientOrders.filter(o=>!['delivered', 'rejected'].includes(o.status)) : clientOrders.filter(o=>['delivered', 'rejected'].includes(o.status))).map(o => {
                 const dInfo = onlineDrivers?.find(d => d.uid === o.driverId); const dName = o.driverName || dInfo?.name || 'Livreur'; const step = getStep(o.status);
                 return (
                   <div key={o.id} className={`bg-white rounded-[2.5rem] shadow-xl border border-black/5 overflow-hidden active:scale-[0.99] transition-all relative flex flex-col`}>
                      {(o.status !== 'delivered' && o.status !== 'rejected') ? ( <div className="h-64 w-full relative bg-gray-200"><ClientTrackingMap dLat={dInfo?.lat} dLng={dInfo?.lng} cLat={o.lat} cLng={o.lng} bLat={o.nearestBranch?.lat} bLng={o.nearestBranch?.lng} color={brand.color} height="100%" /></div> ) : ( <div className="h-32 w-full relative bg-gray-100 flex items-center justify-center"><div className="text-5xl">{o.status === 'delivered' ? '✅' : '❌'}</div></div> )}
                      <div className="p-6 relative bg-white z-10 rounded-t-[2.5rem] -mt-8 shadow-[0_-10px_25px_rgba(0,0,0,0.05)] flex-1 flex flex-col">
                         {o.status !== 'rejected' && o.status !== 'delivered' && (
                             <div className="mb-8 mt-2 relative px-4"><div className="h-1.5 bg-gray-100 absolute w-[calc(100%-2rem)] top-1/2 -translate-y-1/2 z-0 rounded-full left-4"></div><div className="h-1.5 absolute top-1/2 -translate-y-1/2 z-0 rounded-full transition-all duration-700 ease-out left-4" style={{width: `calc(${(step-1)*33.33}% - ${step === 1 ? 0 : 2}rem)`, backgroundColor: brand.color}}></div><div className="flex justify-between relative z-10">{['Validée', 'Cuisine', 'Ramassé', 'Arrivée'].map((label, idx) => (<div key={label} className="flex flex-col items-center gap-1.5 relative"><div className={`w-6 h-6 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all duration-500 ${step > idx ? 'scale-110' : 'bg-gray-200'}`} style={{backgroundColor: step > idx ? brand.color : ''}}>{step > idx && <Check size={10} color={brand.textColor} strokeWidth={4}/>}</div><span className={`text-[8px] font-black uppercase absolute -bottom-5 w-16 text-center ${step > idx ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span></div>))}</div></div>
                         )}
                         
                         {/* 🚀 PROGRESS BAR SAAS DYAL PREPARATION */}
                         {o.status === 'preparing' && (
                             <div className="mb-4 bg-orange-50 border border-orange-100 rounded-xl p-4 shadow-sm animate-in fade-in">
                                 <div className="flex justify-between items-center mb-2.5">
                                     <span className="text-xs font-bold text-orange-800 flex items-center gap-2">
                                         <Utensils size={14} className="animate-bounce text-orange-600"/>
                                         En cours de préparation...
                                     </span>
                                     <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-1 rounded-md border border-orange-200">
                                         ~ {o.prepTime || 15} MIN
                                     </span>
                                 </div>
                                 <div className="w-full h-2 bg-orange-200/50 rounded-full overflow-hidden relative">
                                     <div className="absolute top-0 left-0 h-full bg-orange-500 rounded-full w-[60%] animate-pulse shadow-sm"></div>
                                 </div>
                             </div>
                         )}

                         <div className="flex justify-between items-start mb-4 mt-2"><div className="text-left"><p className="text-2xl font-black italic" style={{color: brand.color}}>{o.total} DH</p><p className="text-[10px] font-bold uppercase mt-1 flex items-center gap-1 opacity-50">#{o.orderNumber || o.id.slice(-4).toUpperCase()} • {new Date(o.createdAt?.seconds*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>{o.status !== 'delivered' && o.status !== 'rejected' && o.createdAt?.seconds && <p className="text-[11px] font-black uppercase mt-1 flex items-center gap-1" style={{color: brand.color}}><Clock size={12}/> Livraison ~ {new Date((o.createdAt.seconds + (o.prepTime || 15)*60 + 15*60)*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>}</div><StatusBadge status={o.status} /></div>
                         {o.status === 'rejected' && o.reason && ( <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-left mb-4 animate-in fade-in"><p className="text-[10px] font-black text-red-800 uppercase tracking-widest mb-1">⚠️ Raison de l'annulation</p><p className="text-sm font-bold text-red-600">{o.reason}</p></div> )}
                         <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left mb-4"><div className="text-xs font-bold opacity-80 mb-2 leading-relaxed border-b border-gray-200 pb-2"><span className="text-gray-500 uppercase tracking-widest text-[9px] block mb-1">Détails de la commande</span><div className="space-y-2 mt-2">{(o.items||[]).map((i, idx) => <div key={idx} className="leading-tight"><span className="font-bold">{i.qty}x {(i.name || '').split(' (Sans ')[0]}</span>{(i.name || '').includes(' (Sans ') && (i.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, oIdx) => <span key={oIdx} className="block text-[10px] text-red-500 ml-4 font-black">- Sans {opt}</span>)}</div>)}</div></div>{o.status === 'out_for_delivery' && ( <div className="flex justify-between items-center mt-3"><div><p className="text-xs font-bold text-blue-800">🛵 L-livreur <span className="font-black underline">{dName}</span> f tri9 jayi 3ndk!</p></div>{dInfo?.phone && <a href={`tel:${getWhatsAppFormat(dInfo.phone)}`} className={`bg-blue-100 text-blue-700 p-3 ${btnRadius} hover:bg-blue-200 transition-colors shadow-sm shrink-0`}><Phone size={16}/></a>}</div> )}</div>
                         {o.status === 'delivered' && !o.rating && ( <div className="mt-auto"><RatingCard onSubmit={(rating) => { updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { rating: rating }); showNotify("Chokran 3la l-vote dyalk! ⭐", "success"); }} brand={brand} /></div> )}
                         {o.rating && <div className={`bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-center text-yellow-700 font-bold text-[10px] uppercase tracking-widest mt-auto`}>Chokran 3la l-vote ⭐⭐⭐⭐⭐</div>}
                      </div>
                   </div>
                 );
               })}
               </div>
            </div>
          )}
        </main>

        {v === 'menu' && cart.length > 0 && (
          <div className="fixed bottom-24 left-4 right-4 z-[200] animate-in slide-in-from-bottom-10 md:max-w-md md:mx-auto md:left-0 md:right-0">
            <button onClick={()=>setV('checkout')} className={`w-full p-5 ${btnRadius} shadow-2xl flex justify-between items-center text-black font-black active:scale-95 transition-all`} style={{backgroundColor: brand.color}}>
               <div className="flex items-center gap-3"><div className={`bg-black text-white w-8 h-8 ${btnRadius} flex items-center justify-center font-black`}>{cart.reduce((s,i)=>s+i.qty,0)}</div><span className="text-lg uppercase italic tracking-wider">{txtCart}</span></div>
               <span className={`text-xl italic bg-white/20 px-3 py-1 ${btnRadius}`}>{total} DH</span>
            </button>
          </div>
        )}

        <nav className="fixed bottom-0 inset-x-0 h-20 bg-white border-t flex justify-around items-center z-[150] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl md:max-w-sm md:mx-auto md:bottom-6 md:rounded-[2rem] md:border-2 md:border-gray-100 md:shadow-2xl px-2" style={{backgroundColor: brand.headerColor}}>
           <button onClick={()=>setV('menu')} className={`flex flex-col items-center gap-1 transition-all w-1/3 ${v === 'menu' ? 'scale-105' : 'opacity-40 hover:opacity-100'}`} style={v==='menu'?{color: brand.color}:{color: brand.textColor}}><Home size={22} strokeWidth={v==='menu'?3:2}/><span className="text-[9px] font-black uppercase text-center leading-tight mt-1">{txtMenu}</span></button>
           <button onClick={()=>setV('tracking')} className={`flex flex-col items-center gap-1 transition-all w-1/3 ${v === 'tracking' ? 'scale-105' : 'opacity-40 hover:opacity-100'}`} style={v==='tracking'?{color: brand.color}:{color: brand.textColor}}>
             <div className="relative"><ShoppingBag size={22} strokeWidth={v==='tracking'?3:2}/>{clientOrders.filter(o => o.status !== 'delivered' && o.status !== 'rejected').length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}</div>
             <span className="text-[9px] font-black uppercase text-center leading-tight mt-1">{txtTrack}</span>
           </button>
           <button onClick={()=>setV('profile')} className={`flex flex-col items-center gap-1 transition-all w-1/3 ${v === 'profile' ? 'scale-105' : 'opacity-40 hover:opacity-100'}`} style={v==='profile'?{color: brand.color}:{color: brand.textColor}}><User size={22} strokeWidth={v==='profile'?3:2}/><span className="text-[9px] font-black uppercase text-center leading-tight mt-1">{txtProfile}</span></button>
        </nav>

        {selectedItem && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-end md:items-center justify-center animate-in fade-in" onClick={() => setSelectedItem(null)}>
            <div className="bg-white w-full md:w-[400px] rounded-t-3xl md:rounded-3xl p-6 flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-xl uppercase italic">Personnaliser</h3>
                <button onClick={() => setSelectedItem(null)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-6">
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

                {selectedItem.removableIngredients && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Qu'est-ce qu'on enlève ? (Sans...)</p>
                    <div className="space-y-2">
                      {(selectedItem.removableIngredients || '').split(',').map(ing => {
                  const ingredient = ing.trim();
                  if (!ingredient) return null;
                  const isRemoved = itemOptions.includes(ingredient);
                  return (
                    <button 
                      key={ingredient}
                      onClick={() => {
                        if (isRemoved) setItemOptions(itemOptions.filter(o => o !== ingredient));
                        else setItemOptions([...itemOptions, ingredient]);
                      }}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all font-black text-sm uppercase ${isRemoved ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-100 bg-white text-gray-800 hover:border-gray-200'}`}
                    >
                      <span>Sans {ingredient}</span>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isRemoved ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                        {isRemoved && <Check size={14} color="white" strokeWidth={4} />}
                      </div>
                    </button>
                  );
                })}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => {
                  if (selectedItem.hasVariations && !selectedVariation) return showNotify("Veuillez choisir une taille !", "error");
                  const optionsSuffix = itemOptions.length > 0 ? '_' + itemOptions.join('_') : '_default';
                  const varSuffix = selectedVariation ? '_' + selectedVariation.name.replace(/\s+/g, '') : '';
                  const cartItemId = selectedItem.id + varSuffix + optionsSuffix;
                  const existingItem = cart.find(c => c.cartItemId === cartItemId);
                  
                  const finalPrice = selectedVariation ? Number(selectedVariation.price || 0) : Number(selectedItem.price || 0);
                  const varNamePart = selectedVariation ? ` (${selectedVariation.name})` : '';
                  const sansNamePart = itemOptions.length > 0 ? ` (Sans ${itemOptions.join(', ')})` : '';
                  const finalName = selectedItem.name + varNamePart + sansNamePart;

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
                Valider • {selectedVariation ? selectedVariation.price : selectedItem.price} DH
              </button>
            </div>
          </div>
        )}
      </div>
    );
}