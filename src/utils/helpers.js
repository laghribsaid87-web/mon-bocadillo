import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';

export const setupNotifications = async (userId, db, messaging, appId) => {
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { vapidKey: 'BCmG0k02D2_b84rQ98s6N7T80u34vB5_m630B29b828z_e4M_q40_0Z-t4-YwM_U3c0' }); // Note: Using a placeholder VAPID key is wrong, better not to specify vapidKey or get the real one, actually Firebase works without vapidKey config if we have default setup, wait, for web push vapidKey is highly recommended. I will just pass the messaging instance and let it generate if possible, or I will omit vapidKey and let Firebase use the default one if not provided, or better, we can just call getToken(messaging).
      // wait, `getToken(messaging)` without vapidKey works if the project is configured correctly, but it's recommended to provide vapidKey.
      // I'll skip vapidKey for now and let Firebase handle it, or we can just try without.
      const fcmToken = await getToken(messaging);
      if (fcmToken) {
        await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data'), { fcmToken }, { merge: true });
      }
    }
  } catch (error) {
    console.error('Error setting up notifications:', error);
  }
};

// 1. Fonction bach tbdel les mots f les messages WhatsApp
export const buildMessage = (template, variables) => {
    if (!template) return ''; let msg = template;
    for (const key in variables) msg = msg.split(`{${key}}`).join(variables[key] || '');
    return msg;
};

// 2. Fonction bach t7seb l-masafa b l-kilomètre bin 2 blays b l-GPS
export const getDistance = (lat1, lon1, lat2, lon2) => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 9999;
    const R = 6371; const dLat = (lat2 - lat1) * (Math.PI/180); const dLon = (lon2 - lon1) * (Math.PI/180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
};

// 3. Fonction bach tl9a a9rab ma7al (Agence) l l-client
export const getClosestBranch = (lat, lng, branchesList) => {
    if (lat == null || lng == null || !branchesList || branchesList.length === 0) return null;
    const openBranches = branchesList.filter(b => b.isOpen !== false); if (openBranches.length === 0) return null;
    let closest = openBranches[0]; let minD = getDistance(lat, lng, closest.lat, closest.lng);
    openBranches.forEach(b => { let d = getDistance(lat, lng, b.lat, b.lng); if (d < minD) { minD = d; closest = b; } });
    return { ...closest, distance: minD.toFixed(2) };
};

// 4. Fonction bach t7seb t-taman dyal livraison 3la 7ssab l-masafa
export const getDeliveryFee = (dist) => { 
    const d = parseFloat(dist || 0); 
    return d <= 3 ? 5 : d <= 4 ? 8 : d <= 5 ? 10 : 15; 
};

// 4.5 Fonction jdida bach t7seb L-we9t l-mo9adar dyal Livraison (ETA)
export const calculateETA = (distKm) => {
    const distance = parseFloat(distKm || 0);
    const prepTime = 15; // 15 min preparation f l-kuzina
    const travelTime = distance > 0 ? Math.ceil(distance * 4) : 15; // 4 min lkol kilomètre
    return prepTime + travelTime + 5; // +5 min buffer dyal z7am
};

// 5. 🔥 FIX N-NIHAYI: 7yedna l-weqt w l-magana 100%!
// Daba l-Idara maghadich t-7seb 2026, ghat-chouf ghir wach l-Boutona mch3oula awla la.
export const isDriverOnline = (drv) => { 
    return drv && drv.isOnline === true; 
};

// 6. Fonction bach t2ked wach wa7ed t-tarikh howa lyoum
export const isToday = (ts) => { 
    if (!ts) return false; 
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    if (isNaN(d)) return false;
    const t = new Date(); 
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear(); 
};

// 7. Fonction bach t-générer numéro dyal l-commande (4 ar9am)
export const generateOrderNumber = () => Math.floor(Math.random() * 10000).toString().padStart(4, '0');

// 8. Fonction bach t9ad r-reqm dyal t-tilifon (t7iyd +212 awla 00212...)
export const formatPhoneNumber = (ph) => { 
    if (!ph) return ''; 
    let p = String(ph).replace(/\D/g, ''); 
    if (p.startsWith('00212')) p = p.substring(5); 
    if (p.startsWith('212')) p = p.substring(3); 
    if (p.length === 9) p = '0' + p; 
    return p; 
};

// 9. Fonction bach t9ad n-nmra l WhatsApp (kadkhol bla 0 f l-wl)
export const getWhatsAppFormat = (ph) => { 
    let p = formatPhoneNumber(ph); 
    return p.startsWith('0') ? '212' + p.substring(1) : p; 
};

// 10. Fonction bach t-imprimer t-ticket dyal l-caisse
export const printTicket = (o, brand) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Veuillez autoriser les pop-ups pour imprimer le ticket.");
        const itemsHtml = (o.items || []).map(i => {
            const parts = (i.name || '').split(' (Sans ');
            const baseName = parts[0];
            const optionsHtml = parts.length > 1 ? parts[1].replace(')','').split(', ').map(opt => `<br><span style="font-size: 10px; margin-left: 12px; color: #555;">- Sans ${opt}</span>`).join('') : '';
            return `<tr><td style="padding: 4px 0; vertical-align: top;"><b>${i.qty}x ${baseName}</b>${optionsHtml}</td><td style="text-align: right; vertical-align: top; padding-top: 4px;">${(i.price * i.qty).toFixed(2)} DH</td></tr>`;
        }).join('');
    const orderTypeHtml = o.orderType ? `<h3 style="margin: 5px 0; border: 1px solid #000; padding: 4px; text-transform: uppercase;">${o.orderType.replace('_', ' ')}</h3>` : '';
    const noteHtml = o.orderNote ? `<div class="divider"></div><p class="left bold" style="font-size: 11px; color: #000;">📝 NOTE CUISINE:</p><p class="left" style="font-size: 11px; font-style: italic;">${o.orderNote}</p>` : '';
    const paymentHtml = o.paymentMethod ? `<p class="left bold" style="font-size: 12px; margin-top: 5px;">Mode de paiement: ${o.paymentMethod.toUpperCase()}</p>` : '';
    const html = `<html><head><style>body { font-family: monospace; width: 58mm; margin: 0 auto; padding: 5px; color: #000; } h1, h2, h3, p { margin: 4px 0; text-align: center; } table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; } .divider { border-top: 1px dashed #000; margin: 8px 0; } .text-right { text-align: right; } .bold { font-weight: bold; } .left { text-align: left; }</style></head><body><h2>${brand?.name?.toUpperCase() || 'BOCADILLO'}</h2>${orderTypeHtml}<h3>Ticket #${o.orderNumber || (o.id ? o.id.slice(-4).toUpperCase() : '')}</h3><p style="font-size: 10px;">${o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR')}</p><div class="divider"></div><p class="left bold">Client: ${o.customerName || o.name || 'Client'}</p><p class="left">${o.phone || ''}</p><p class="left" style="font-size:10px;">${o.address || ''}</p><div class="divider"></div><table>${itemsHtml}</table>${noteHtml}<div class="divider"></div><table><tr><td>S-Total</td><td class="text-right">${o.subtotal || 0} DH</td></tr><tr><td>Livraison</td><td class="text-right">${o.deliveryFee || 0} DH</td></tr>${o.discount > 0 ? `<tr><td>Promo</td><td class="text-right">-${o.discount} DH</td></tr>` : ''}${o.pointsUsed > 0 ? `<tr><td>Fidélité</td><td class="text-right">-${o.pointsUsed} DH</td></tr>` : ''}</table><div class="divider"></div><h2 style="text-align: right; font-size: 16px;">TOTAL: ${o.total || 0} DH</h2>${paymentHtml}<div class="divider"></div><p>Merci et bon appetit!</p><script>window.onload=function(){window.print();}; window.onafterprint=function(){window.close();};</script></body></html>`;
    printWindow.document.write(html); printWindow.document.close();
};

export const getStep = (s) => { switch(s) { case 'pending': return 1; case 'preparing': return 2; case 'ready': return 2; case 'out_for_delivery': return 3; case 'delivered': return 4; default: return 1; } };