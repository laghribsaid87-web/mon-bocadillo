import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { VAPID_KEY } from '../config/firebase';
import qz from 'qz-tray';

export const setupNotifications = async (userId, db, messaging, appId) => {
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const fcmToken = await getToken(messaging, { 
        vapidKey: VAPID_KEY
      });
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

// 4.6. Fonction bach n-formatiw "Sans Ingrédient" b l'émoji f l-kher
export const formatSansIngredient = (ingredient) => {
    if (!ingredient) return '';
    let trimIng = ingredient.trim();
    
    const toTitleCase = (str) => {
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    if (trimIng.toUpperCase().includes('SANS')) {
        trimIng = trimIng.replace(/SANS/i, '').trim();
    }

    const firstSpace = trimIng.indexOf(' ');
    if (firstSpace !== -1) {
        const firstPart = trimIng.substring(0, firstSpace);
        if (!/^[a-zA-Z0-9À-ÿ]/.test(firstPart)) {
            const ingText = trimIng.substring(firstSpace + 1).trim();
            return `Sans ${toTitleCase(ingText)} ${firstPart}`;
        }
    }
    
    return `Sans ${toTitleCase(trimIng)}`;
};

// 5. 🔥 FIX N-NIHAYI: 7yedna l-weqt w l-magana 100%!
// ZEDNA L-WE9T: Bach n7iydou les livreurs fantômes li mchaw w b9aw laze9in (15 minutes d'inactivité = Hors ligne)
export const isDriverOnline = (drv) => { 
    if (!drv || drv.isOnline !== true) return false;
    const now = Date.now();
    const lastUpdate = drv.updatedAt?.seconds ? drv.updatedAt.seconds * 1000 : 0;
    // Ila dazet 15 d9i9a w l-GPS awla l-appli masiftat hta update, kan-3tbroh hors ligne (Fantôme)
    const minutesSinceLastUpdate = (now - lastUpdate) / (1000 * 60);
    return minutesSinceLastUpdate <= 15;
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
    if (p.length === 9 && (p.startsWith('6') || p.startsWith('7'))) p = '0' + p; 
    return p; 
};

// 9. Fonction bach t9ad n-nmra l WhatsApp (kadkhol bla 0 f l-wl)
export const getWhatsAppFormat = (ph) => { 
    let p = formatPhoneNumber(ph); 
    return p.startsWith('0') ? '212' + p.substring(1) : p; 
};

// 10. Fonction bach t-imprimer t-ticket dyal l-caisse
export const printTicket = async (o, brand) => {
    const itemsHtml = (o.items || []).map(i => {
        const parts = (i.name || '').split(' (Sans ');
        const baseName = parts[0];
        const optionsHtml = parts.length > 1 ? parts[1].replace(')','').split(', ').map(opt => `<br><span style="font-size: 10px; margin-left: 12px; color: #555;">- ${formatSansIngredient(opt)}</span>`).join('') : '';
    
    let finalOptionsHtml = optionsHtml;
    if (i.isCombo && i.comboChoices) {
        finalOptionsHtml = i.comboChoices.map(c => {
            let txt = `<br><span style="font-size: 10px; margin-left: 12px; color: #000;">🔹 ${c.name}</span>`;
            if (c.removables && c.removables.length > 0) txt += `<span style="font-size: 10px; color: #555;"> (SANS: ${c.removables.join(', ')})</span>`;
            if (c.selectedOption) txt += `<span style="font-size: 10px; color: #555;"> (${c.selectedOption})</span>`;
            return txt;
        }).join('');
    }

    return `<tr><td style="padding: 4px 0; vertical-align: top;"><b>${i.qty}x ${baseName}</b>${finalOptionsHtml}</td><td style="text-align: right; vertical-align: top; padding-top: 4px;">${(i.price * i.qty).toFixed(2)} DH</td></tr>`;
    }).join('');
    const orderTypeHtml = o.orderType ? `<h3 style="margin: 5px 0; border: 1px solid #000; padding: 4px; text-transform: uppercase;">${o.orderType.replace('_', ' ')}</h3>` : '';
    
    let glovoHtml = '';
    if (o.source === 'glovo') {
        const isCash = o.paymentMethod === 'espece' || o.paymentMethod === 'cash';
        const glovoTag = isCash ? '🛑 GLOVO : À ENCAISSER (ESPÈCE)' : '✅ GLOVO : PAYÉE EN LIGNE';
        glovoHtml = `<h2 style="margin: 5px 0; border: 2px dashed #000; padding: 6px; text-transform: uppercase; font-size: 16px; font-weight: 900;">${glovoTag}</h2>`;
    }

    const noteHtml = o.orderNote ? `<div class="divider"></div><p class="left bold" style="font-size: 11px; color: #000;">📝 NOTE CUISINE:</p><p class="left" style="font-size: 11px; font-style: italic;">${o.orderNote}</p>` : '';
    const paymentHtml = o.paymentMethod ? `<p class="left bold" style="font-size: 12px; margin-top: 5px;">Mode de paiement: ${o.paymentMethod.toUpperCase()}</p>` : '';
    
    const headerLogoHtml = brand?.ticketLogoUrl ? `<div style="text-align: center;"><img src="${brand.ticketLogoUrl}" style="max-width: 140px; max-height: 70px; object-fit: contain; margin-bottom: 5px;" /></div>` : '';
    const headerHtml = brand?.ticketHeader ? `<p style="font-size: 12px; margin: 2px 0;">${brand.ticketHeader}</p>` : '';
    const phoneHtml = brand?.ticketPhone ? `<p style="font-size: 12px; margin: 2px 0;">Tél: ${brand.ticketPhone}</p>` : '';
    const footerHtml = brand?.ticketFooter ? `<div class="divider"></div><p style="font-size: 12px; font-weight: bold; margin-top: 10px; text-align: center;">${brand.ticketFooter}</p>` : '<div class="divider"></div><p style="text-align: center;">Merci et bon appetit!</p>';

    // HTML bla script dyal window.print() 7it QZ Tray kay-imprimi direct mn l-khalafiya
    const html = `<html><head><style>body { font-family: monospace; width: ${brand?.ticketWidth || '100%'}; max-width: 80mm; box-sizing: border-box; margin: 0 auto; padding: 2px; color: #000; } h1, h2, h3, p { margin: 4px 0; text-align: center; } table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; } .divider { border-top: 1px dashed #000; margin: 8px 0; } .text-right { text-align: right; } .bold { font-weight: bold; } .left { text-align: left; }</style></head><body>${headerLogoHtml}<h2 style="margin: 0; font-size: 18px;">${brand?.name?.toUpperCase() || 'BOCADILLO'}</h2>${headerHtml}${phoneHtml}${orderTypeHtml}<h3>Ticket #${o.orderNumber || (o.id ? o.id.slice(-4).toUpperCase() : '')}</h3><p style="font-size: 10px;">${o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000).toLocaleString('fr-FR') : new Date().toLocaleString('fr-FR')}</p><div class="divider"></div><p class="left bold">Client: ${o.customerName || o.name || 'Client'}</p><p class="left">${o.source === 'glovo' ? '' : (o.phone || '')}</p><p class="left" style="font-size:10px;">${o.address || ''}</p><div class="divider"></div><table>${itemsHtml}</table>${noteHtml}<div class="divider"></div><table><tr><td>S-Total</td><td class="text-right">${o.subtotal || 0} DH</td></tr><tr><td>Livraison</td><td class="text-right">${o.deliveryFee || 0} DH</td></tr>${o.discount > 0 ? `<tr><td>Promo</td><td class="text-right">-${o.discount} DH</td></tr>` : ''}${o.pointsUsed > 0 ? `<tr><td>Fidélité</td><td class="text-right">-${o.pointsUsed} DH</td></tr>` : ''}</table><div class="divider"></div><h2 style="text-align: right; font-size: 16px;">TOTAL: ${o.total || 0} DH</h2>${paymentHtml}${footerHtml}</body></html>`;

    // 🔥 Fonction bach n-affichi notification non-bloquante l-caissier
    const notifyCaissier = (msg) => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification("Caisse - Impression", { body: msg, icon: '/favicon.svg' });
        }
    };

    // 🔥 1. N-choufo wach l-application khdama 3la chkel Logiciel (.exe) b Electron
    if (typeof window !== 'undefined' && window.require) {
        try {
            const ipcRenderer = window['require']('electron').ipcRenderer;
            if (ipcRenderer) {
                ipcRenderer.send('print-ticket', html, brand?.selectedPrinter);
                return; // N7bso hna, Electron tkelef bl-impression f s-skat!
            }
        } catch(e) { console.error("Erreur Electron IPC:", e); }
    }

    // 🔥 2. Ila khdamin f Navigateur (Chrome) nkhdmo b QZ Tray b7al dima
    // Impression 100% silencieuse m3a QZ Tray
    try {
        if (!qz.websocket.isActive()) {
            await qz.websocket.connect();
        }
        
        // 1. N9elbo 3la ga3 l-imprimantes w n3ezlo l-imprimante Thermique
        const printers = await qz.printers.find();
        let printer = (brand && brand.selectedPrinter) ? brand.selectedPrinter : printers.find(p => {
            const n = p.toLowerCase();
            return n.includes('pos') || n.includes('xp') || n.includes('80') || n.includes('58') || n.includes('ticket') || n.includes('receipt') || n.includes('thermal') || n.includes('epson') || n.includes('tm-');
        });
        
        // Ila mal9inach imprimante bhad s-smia, nkhdmo b par défaut
        if (!printer) {
            printer = await qz.printers.getDefault();
            const n = printer ? printer.toLowerCase() : '';
            // 🔥 N-blockiw les imprimantes virtuelles li kay7elo fenêtre
            if (!printer || n.includes('pdf') || n.includes('xps') || n.includes('fax') || n.includes('onenote') || n.includes('desktop') || n.includes('anydesk') || n.includes('microsoft')) {
                throw new Error("Imprimante thermique introuvable, passage au fallback Web");
            }
        }
        
        const config = qz.configs.create(printer, { 
            margins: 0,
            fallback: false // May7awelch y9leb 3la fallback y7el page
        });
        
        const data = [{
            type: 'pixel',
            format: 'html',
            flavor: 'plain',
            data: html
        }];
        
        await qz.print(config, data);
        
    } catch (e) {
        console.error("Erreur QZ Tray:", e);
        
        // 🔥 Fallback Web: Impression directe via Chrome si QZ Tray est éteint ou inaccessible
        const printWindow = window.open('', '', 'width=400,height=800');
        if (printWindow) {
            printWindow.document.open();
            const htmlWithScript = html.replace('</body>', `
            <script>
                window.onload = function() { setTimeout(function() { window.print(); }, 500); };
                window.onafterprint = function() { window.close(); };
            </script>
            </body>`);
            printWindow.document.write(htmlWithScript);
            printWindow.document.close();
        }
    }
};

// 11. Fonction centralisée bach nsifto l-WhatsApp direct bla machakil dyal l-navigateur
export const openWhatsAppDirect = (phone, message) => {
    const waPhone = getWhatsAppFormat(phone);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isElectron = typeof window !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
    
    if (isMobile) {
        // En mobile: Ouvre l'application WhatsApp directement (0 onglet web, 0 page de confirmation)
        window.location.href = `whatsapp://send?phone=${waPhone}&text=${encodeURIComponent(message)}`;
    } else if (isElectron) {
        // En Logiciel Windows (.exe) :
        try {
            const { shell } = window.require('electron');
            // 🔥 Ouvre UNIQUEMENT le logiciel WhatsApp Desktop de Windows (0 navigateur !)
            shell.openExternal(`whatsapp://send?phone=${waPhone}&text=${encodeURIComponent(message)}`);
        } catch (e) {
            window.location.href = `whatsapp://send?phone=${waPhone}&text=${encodeURIComponent(message)}`;
        }
    } else {
        // En PC (Navigateur Web normal)
        window.open(`https://web.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(message)}`, '_blank');
        // 🔥 N-Forciw l-Navigateur y7el l-Application WhatsApp Desktop (Logiciel PC)
        // Zero onglet web, katsifet amr direct l'application d-Windows
        window.location.href = `whatsapp://send?phone=${waPhone}&text=${encodeURIComponent(message)}`;
    }
};

export const getStep = (s) => { switch(s) { case 'pending': return 1; case 'preparing': return 2; case 'ready': return 2; case 'out_for_delivery': return 3; case 'delivered': return 4; default: return 1; } };