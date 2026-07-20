import { useMemo } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDeliveryFee, getWhatsAppFormat, generateOrderNumber, buildMessage, formatSansIngredient } from '../../utils/helpers';

export function useClientCartAndCheckout({ 
    cart, setCart, info, promoApplied, setPromoApplied, usePoints, setUsePoints, availablePoints,
    promoCodeInput, setPromoCodeInput, orderNote, setOrderNote, setV, setTrackTab,
    db, appId, user, brand, settings, showNotify, activeBranches 
}) {
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
        
        if (settings?.whatsappRedirectEnabled !== false) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            const waUrl = isMobile ? `whatsapp://send?phone=${waPhone}&text=${encodeURIComponent(msgBody)}` : `https://web.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(msgBody)}`;
            
            if (isMobile) {
                window.location.href = waUrl;
            } else {
                if (window.clientWaWindow && !window.clientWaWindow.closed) {
                    window.clientWaWindow.location.href = waUrl;
                    window.clientWaWindow.focus();
                } else {
                    window.clientWaWindow = window.open(waUrl, 'whatsapp_client');
                }
            }
        } else {
            showNotify(brand.texts?.orderSuccess || "Commande passée avec succès !", "success");
        }
        setCart([]); setV('tracking'); setTrackTab('active'); setPromoApplied(null); setUsePoints(false); setPromoCodeInput(''); setOrderNote('');
    };


    return {
        subtotal, deliveryFee, discountAmt, pointsDiscount, totalDiscount, total,
        handleApplyPromo, handleFinalOrder
    };
}
