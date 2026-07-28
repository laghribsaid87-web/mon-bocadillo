import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Phone, Printer, Clock, CheckCircle, AlertTriangle, Truck, Map as MapIcon, X, ChefHat, BellRing, ClipboardList, Volume2, Zap } from 'lucide-react';
import OrderTimer from '../OrderTimer';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import LiveTimer from '../LiveTimer';
import { isDriverOnline } from '../../utils/helpers';

export default function AdminActiveOrders({
    pending,
    actives,
    brand,
    clientsList,
    updateStatus,
    printTicket,
    handleReassignOrder,
    onlineDrivers,
    db,
    appId,
    showNotify,
    hasAccess
}) {
    const [cancelModal, setCancelModal] = useState({ show: false, order: null });
    const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'pending', 'preparing', 'ready', 'route'
    const [showTotals, setShowTotals] = useState(false); // Jdid: State dyal résumé total
    const botAlertedOrdersRef = useRef(new Set());

    const displayedOrders = useMemo(() => {
        return actives.filter(o => {
            if (activeFilter === 'ALL') return true;
            if (activeFilter === 'pending') return o.status === 'pending';
            if (activeFilter === 'preparing') return o.status === 'preparing';
            if (activeFilter === 'ready') return o.status === 'ready';
            if (activeFilter === 'route') return o.status === 'out_for_delivery';
            return true;
        });
    }, [actives, activeFilter]);

    // Dictionnaire de thèmes (Couleurs Claires pour l'Admin) selon la source
    const getSourceTheme = (o, index, brandColor) => {
        const source = o.source;
        const isGlovoEspece = (source === 'glovo' || source === 'glovo_api') && (o.paymentMethod === 'espece' || o.paymentMethod === 'cash');
        
        if (isGlovoEspece) return {
            cardClass: `border-2 ${index === 0 ? 'border-green-400 ring-4 ring-green-100 ring-offset-4 scale-[1.02]' : 'border-green-100'}`,
            cardStyle: {},
            topClass: 'bg-green-500',
            topStyle: {},
            headerClass: 'bg-green-50/50',
            badgeClass: 'bg-green-100 text-green-800 border-green-300 font-black animate-pulse',
            label: 'GLOVO (ESPECE 💵 $)'
        };
        
        if ((source === 'glovo' || source === 'glovo_api')) return {
            cardClass: `border-2 ${index === 0 ? 'border-yellow-400 ring-4 ring-yellow-100 ring-offset-4 scale-[1.02]' : 'border-yellow-100'}`,
            cardStyle: {},
            topClass: 'bg-yellow-400',
            topStyle: {},
            headerClass: 'bg-yellow-50/50',
            badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            label: 'GLOVO'
        };

        if (source === 'pos') return {
            cardClass: `border-2 ${index === 0 ? 'border-blue-400 ring-4 ring-blue-100 ring-offset-4 scale-[1.02]' : 'border-blue-100'}`,
            cardStyle: {},
            topClass: 'bg-blue-500',
            topStyle: {},
            headerClass: 'bg-blue-50/50',
            badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
            label: 'POS'
        };
        if (source === 'telephone') return {
            cardClass: `border-2 ${index === 0 ? 'border-purple-400 ring-4 ring-purple-100 ring-offset-4 scale-[1.02]' : 'border-purple-100'}`,
            cardStyle: {},
            topClass: 'bg-purple-500',
            topStyle: {},
            headerClass: 'bg-purple-50/50',
            badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
            label: 'TÉL'
        };
        return {
            cardClass: `border-2 ${index === 0 ? 'scale-[1.02] ring-4 ring-offset-4' : ''}`,
            cardStyle: index === 0 ? {borderColor: brandColor, ringColor: brandColor} : {borderColor: '#f3f4f6'},
            topClass: '',
            topStyle: {backgroundColor: index === 0 ? brandColor : '#e5e7eb'},
            headerClass: 'bg-gray-50/30',
            badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
            label: 'APP'
        };
    };

    // 🔥 Jdid: Alerte Sonore & Vocale pour Bot Maestro (Routage Zoubire)
    useEffect(() => {
        const allOrders = [...pending, ...actives];
        const newRoutedOrders = allOrders.filter(o => o.isBotRouted && o.botRoutingReason === 'LAYMOUN_RUSH_OVERLOAD');
        
        let hasNewAlert = false;
        
        newRoutedOrders.forEach(o => {
            if (!botAlertedOrdersRef.current.has(o.id)) {
                botAlertedOrdersRef.current.add(o.id);
                hasNewAlert = true;
            }
        });

        if (hasNewAlert) {
            try {
                // 1. Inidar sawti (Alerte Sonore)
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2866/2866-preview.mp3');
                audio.play().catch(e => console.log("Audio bloqué", e));
                
                // 2. TTS Voice Message
                if ('speechSynthesis' in window) {
                    setTimeout(() => {
                        const utterance = new SpeechSynthesisUtterance("Alerte Bot Maestro. Une commande a été redirigée vers Zoubir.");
                        if (brand?.ttsVoiceURI) { const voices = window.speechSynthesis.getVoices(); const selectedVoice = voices.find(v => v.voiceURI === brand.ttsVoiceURI); if (selectedVoice) utterance.voice = selectedVoice; } else { utterance.lang = 'fr-FR'; }
                        window.speechSynthesis.speak(utterance);
                    }, 500);
                }
                
                // 3. Notification Visual
                if (showNotify) showNotify("🤖 Bot Maestro a redirigé une commande vers Zoubire !", "warning");
            } catch(e) {}
        }
    }, [pending, actives, brand, showNotify]);

    // Fonction pour lire la commande à haute voix (TTS) depuis l'Idara
    const readOrder = (order) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stoppe l'audio en cours s'il y en a un
            
            // Un petit délai (50ms) évite le bug de retard ou de blocage sur Chrome
            setTimeout(() => {
                const prefix = brand?.texts?.ttsNewOrder || 'Nouvelle commande';
                const text = `${prefix}. ` + (order.items || []).map(i => {
                    const itemName = (i.name || '').split(' (Sans')[0];
                    const sans = (i.name || '').includes(' (Sans') ? ' Sans ' + (i.name || '').split(' (Sans ')[1].replace(')', '') : '';
                    return `${i.qty} ${itemName} ${sans}`;
                }).join(', ');
                
                const utterance = new SpeechSynthesisUtterance(text);
                if (brand?.ttsVoiceURI) {
                    const voices = window.speechSynthesis.getVoices();
                    const selectedVoice = voices.find(v => v.voiceURI === brand.ttsVoiceURI);
                    if (selectedVoice) utterance.voice = selectedVoice;
                } else {
                    utterance.lang = 'fr-FR';
                }
                
                utterance.rate = 1.2; // Vitesse un peu plus rapide pour un retour instantané
                window.speechSynthesis.speak(utterance);
            }, 50);
        }
    };

    return (
        <>
            <div className="flex flex-wrap items-center justify-end gap-3 mb-6 px-2">
                <button onClick={() => setShowTotals(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-[1.5rem] font-black text-xs md:text-sm uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 border-2 border-blue-500">
                    <ClipboardList size={22} className="text-blue-200" /> Résumé (Total)
                </button>

                {(!hasAccess || hasAccess('kds')) && (
                    <button onClick={() => {
                        const route = '/kds';
                        window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank');
                    }} className="bg-neutral-900 hover:bg-black text-white px-6 py-4 rounded-[1.5rem] font-black text-xs md:text-sm uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all active:scale-95 border-2 border-neutral-800">                        <ChefHat size={22} className="text-orange-500" /> Ouvrir l'Écran Cuisine (KDS)
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-10">
                <div onClick={() => setActiveFilter(activeFilter === 'pending' ? 'ALL' : 'pending')} className={`cursor-pointer p-4 md:p-6 rounded-[2rem] border-4 shadow-xl flex flex-col justify-center items-center relative overflow-hidden transition-all ${activeFilter === 'pending' ? 'bg-red-100 border-red-400 scale-105' : 'bg-red-50 border-red-100 hover:bg-red-100/50'}`}><p className="text-[10px] md:text-sm font-black text-red-800 uppercase tracking-widest mb-1 md:mb-2 text-center">En Attente</p><p className="text-4xl md:text-6xl font-black text-red-600 tracking-tighter">{pending.length}</p></div>
                <div onClick={() => setActiveFilter(activeFilter === 'preparing' ? 'ALL' : 'preparing')} className={`cursor-pointer p-4 md:p-6 rounded-[2rem] border-4 shadow-xl flex flex-col justify-center items-center transition-all ${activeFilter === 'preparing' ? 'bg-orange-100 border-orange-400 scale-105' : 'bg-orange-50 border-orange-100 hover:bg-orange-100/50'}`}><p className="text-[10px] md:text-sm font-black text-orange-800 uppercase tracking-widest mb-1 md:mb-2 text-center">En Cuisine</p><p className="text-4xl md:text-6xl font-black text-orange-600 tracking-tighter">{actives.filter(o=>o.status==='preparing').length}</p></div>
                <div onClick={() => setActiveFilter(activeFilter === 'ready' ? 'ALL' : 'ready')} className={`cursor-pointer p-4 md:p-6 rounded-[2rem] border-4 shadow-xl flex flex-col justify-center items-center transition-all ${activeFilter === 'ready' ? 'bg-purple-100 border-purple-400 scale-105' : 'bg-purple-50 border-purple-100 hover:bg-purple-100/50'}`}><p className="text-[10px] md:text-sm font-black text-purple-800 uppercase tracking-widest mb-1 md:mb-2 text-center">Attente Livreur</p><p className="text-4xl md:text-6xl font-black text-purple-600 tracking-tighter">{actives.filter(o=>o.status==='ready').length}</p></div>
                <div onClick={() => setActiveFilter(activeFilter === 'route' ? 'ALL' : 'route')} className={`cursor-pointer p-4 md:p-6 rounded-[2rem] border-4 shadow-xl flex flex-col justify-center items-center transition-all ${activeFilter === 'route' ? 'bg-blue-100 border-blue-400 scale-105' : 'bg-blue-50 border-blue-100 hover:bg-blue-100/50'}`}><p className="text-[10px] md:text-sm font-black text-blue-800 uppercase tracking-widest mb-1 md:mb-2 text-center">En Route</p><p className="text-4xl md:text-6xl font-black text-blue-600 tracking-tighter">{actives.filter(o=>o.status==='out_for_delivery').length}</p></div>
            </div>

            {activeFilter !== 'ALL' && (
                <div className="flex justify-between items-center mb-6 px-2">
                    <h2 className="font-black text-xl md:text-2xl uppercase italic text-gray-800">Affichage : {activeFilter === 'pending' ? 'En Attente' : activeFilter === 'preparing' ? 'En Cuisine' : activeFilter === 'ready' ? 'Attente Livreur' : 'En Route'}</h2>
                    <button onClick={() => setActiveFilter('ALL')} className="text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100">Afficher Tout</button>
                </div>
            )}

            <div className="flex flex-col md:grid md:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-10">
                {displayedOrders.sort((a,b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).map((o, index) => {
                    const dName = o.driverName || (clientsList||[]).find(c => (c.uid && c.uid === o.driverId) || (o.driverId && c.phone === o.driverId))?.name || 'Inconnu';
                    const dPhone = (clientsList||[]).find(c => (c.uid && c.uid === o.driverId) || (o.driverId && c.phone === o.driverId))?.phone || '';
                    const theme = getSourceTheme(o, index, brand.color);

                    const clientData = (clientsList||[]).find(c => c.phone === o.phone);
                    const cMapLink = o.mapsLink || ((o.lat && o.lng) ? `https://maps.google.com/?q=${o.lat},${o.lng}` : null) || ((clientData?.location?.lat && clientData?.location?.lng) ? `https://maps.google.com/?q=${clientData.location.lat},${clientData.location.lng}` : null) || (o.address && o.address.length > 5 ? `https://maps.google.com/?q=${encodeURIComponent(o.address)}` : null);

                    return (
                        <div key={o.id} className={`bg-white rounded-2xl shadow-lg border relative overflow-hidden flex flex-col hover:shadow-xl transition-all ${theme.cardClass}`} style={theme.cardStyle}>
                            {/* Top Border Indicator */}
                            <div className={`h-1.5 w-full ${theme.topClass}`} style={theme.topStyle}></div>

                            {/* Header Section */}
                            <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-gray-500 uppercase">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${theme.badgeClass}`}>{theme.label}</span>
                                    {o.source === 'pos' && o.orderType && (
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${o.orderType === 'sur_place' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-pink-100 text-pink-700 border-pink-200'}`}>
                                            {o.orderType === 'sur_place' ? '🍽️ Sur place (Plateau)' : '🛍️ À emporter (Emballage)'}
                                        </span>
                                    )}
                                    {o.kitchenAlert && (Date.now() - o.kitchenAlert < 15 * 60 * 1000) && o.status === 'ready' && (
                                        <span className="text-[8px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200 animate-pulse flex items-center gap-1"><BellRing size={10}/> URGENCE</span>
                                    )}
                                    {o.isBotRouted && (
                                        <span className="text-[8px] font-black text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded border border-yellow-300 animate-pulse flex items-center gap-1 shadow-sm"><Zap size={10}/> ROUTÉ PAR BOT</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <LiveTimer startTime={o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now()} targetTime={o.estimatedPickupTime ? new Date(o.estimatedPickupTime.replace(' ', 'T')).getTime() : null} />
                                <button onClick={(e) => { e.stopPropagation(); readOrder(o); }} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200 shadow-sm transition-colors active:scale-95" title="Lire la commande (Haut-parleur)">
                                    <Volume2 size={16}/>
                                </button>
                                    <button onClick={(e) => { e.stopPropagation(); printTicket(o, brand); }} className="p-1.5 bg-white rounded text-gray-600 hover:text-blue-600 border border-gray-200 shadow-sm transition-colors active:scale-95" title="Imprimer"><Printer size={16}/></button>
                                </div>
                            </div>

                            {/* Driver Assignment Info (Very Top & Compact) */}
                            {o.driverId && (
                                <div className={`px-3 py-1.5 flex justify-between items-center border-b ${(!o.driverAccepted) ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                                    <div className="flex items-center gap-2">
                                        {(!o.driverAccepted) ? (
                                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                                        ) : (
                                            <CheckCircle size={12} className="text-blue-600"/>
                                        )}
                                        <span className="text-gray-900 font-bold text-[10px] uppercase tracking-tight flex items-center gap-1.5">
                                            {dName}
                                            {(!o.driverAccepted) ? (
                                                <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 animate-pulse flex items-center gap-1 shadow-sm">⏱ <OrderTimer assignedAtLocal={o.assignedAtLocal} updatedAt={o.updatedAt} /></span>
                                            ) : (
                                                <span className="text-[9px] text-gray-500 ml-1">(Livreur Confirmé)</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {dPhone && <a href={`tel:${dPhone}`} className="text-blue-600 hover:text-blue-800 text-[10px] font-bold p-1 bg-white rounded shadow-sm border border-blue-100"><Phone size={12} className="inline"/></a>}
                                        {(o.lat && o.lng) && <a href={`https://maps.google.com/?q=${o.lat},${o.lng}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 text-[10px] font-bold p-1 bg-white rounded shadow-sm border border-blue-100"><MapIcon size={12} className="inline"/></a>}
                                    </div>
                                </div>
                            )}

                            {/* Main Body */}
                            <div className="flex flex-col flex-1">
                                {/* Row 1: Client Info & Price */}
                                <div className="p-3 bg-blue-50/20 flex justify-between items-start gap-2 border-b border-gray-100">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-black text-gray-900 text-lg uppercase tracking-tight leading-none">{o.name || o.customerName || o.phone}</span>
                                        <p className="text-xs text-gray-600 flex items-center gap-1.5 font-medium leading-tight line-clamp-2"><MapPin size={12} className="text-gray-400 shrink-0"/> {o.address}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] text-green-700 font-bold flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded border border-green-200"><Phone size={10} className="text-green-500"/> {o.phone && o.phone.length > 15 ? 'Sans Numéro' : (o.phone || 'Sans Numéro')}</p>
                                            <p className="text-[9px] font-bold text-gray-500 flex items-center gap-1 uppercase"><MapIcon size={10} className="text-gray-400"/> {o.nearestBranch?.name}</p>
                                            {cMapLink && (
                                                <a href={cMapLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-700 font-bold flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm" onClick={(e) => e.stopPropagation()}>
                                                    <MapPin size={10} className="text-blue-500"/> Maps
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <span className="text-2xl font-black tracking-tighter" style={{color: brand.color || '#000'}}>{o.total} <span className="text-xs text-gray-500">DH</span></span>
                                    </div>
                                </div>

                                {/* Row 2: Kitchen Info (Items & Note) */}
                                <div className="p-3 bg-orange-50/20 flex-1 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[9px] font-black text-orange-800 uppercase tracking-widest mb-2 flex items-center gap-1.5"><ChefHat size={12} className="text-orange-500"/> Commande (Cuisine)</span>
                                        <div className="space-y-1.5">
                                            {(o.items||[]).map((i, idx) => (
                                                <div key={idx} className="leading-tight">
                                                    <span className="font-bold text-[13px] text-gray-900">{i.qty}x {(i.name || '').split(' (Sans ')[0]}</span>
                                                    {(i.name || '').includes(' (Sans ') && (i.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, oIdx) => <span key={oIdx} className="block text-[10px] font-bold text-red-500 ml-5 uppercase">- Sans {opt}</span>)}
                                                </div>
                                            ))}
                                        </div>
                                        {o.orderNote && (
                                            <div className="mt-2 pt-2 border-t border-orange-200/50 border-dashed">
                                                <p className="text-[9px] font-bold text-red-600 uppercase mb-1 tracking-widest">📝 Note :</p>
                                                <p className="text-xs font-medium text-gray-800 bg-yellow-300 p-2 rounded-lg border-2 border-yellow-400 shadow-sm text-black font-black">"{o.orderNote}"</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Preparing Timer */}
                                    {o.status === 'preparing' && (
                                        <div className="mt-3 flex items-center justify-between bg-white p-2 rounded-lg border border-orange-200 shadow-sm">
                                            <span className="text-[10px] font-bold text-orange-800 flex items-center gap-1 uppercase tracking-wide"><Clock size={12} className="text-orange-500"/> Temps de préparation</span>
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); updateStatus(o.id, o.status, {prepTime: Math.max(1, (o.prepTime||10)-1)}); }} className="bg-orange-50 text-orange-600 w-7 h-7 rounded flex items-center justify-center font-bold text-lg border border-orange-200 active:scale-95 transition-all">-</button>
                                                <span className="font-bold text-sm text-orange-700 w-6 text-center">{o.prepTime || 10}m</span>
                                                <button onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); updateStatus(o.id, o.status, {prepTime: (o.prepTime||10)+1}); }} className="bg-orange-50 text-orange-600 w-7 h-7 rounded flex items-center justify-center font-bold text-lg border border-orange-200 active:scale-95 transition-all">+</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Unreachable Alert */}
                                {o.clientUnreachable && (
                                    <div className="p-3 bg-red-50 border-t border-red-100">
                                        <p className="text-red-600 font-bold text-[10px] uppercase tracking-wide flex items-center gap-1 mb-2 animate-pulse"><AlertTriangle size={14}/> Client injoignable</p>
                                        <div className="flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); updateStatus(o.id, o.status, { clientUnreachable: false, unreachableAt: null, adminMessage: 'jawbak' }) }} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 rounded text-[9px] font-bold uppercase active:scale-95 transition-all">✅ J'ai eu client</button>
                                            <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Annuler w nkhllsso livreur?')) updateStatus(o.id, 'rejected', { reason: 'Client injoignable', driverPaid: true, deliveredAtLocal: Date.now(), clientUnreachable: false }) }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded text-[9px] font-bold uppercase active:scale-95 transition-all">❌ Annuler</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-2 bg-gray-50 border-t border-gray-200 flex gap-2 items-center rounded-b-2xl">
                                {o.status==='pending' && (
                                    <button onClick={(e)=>{ e.stopPropagation(); printTicket(o, brand); updateStatus(o.id, 'preparing'); }} className="flex-1 py-2.5 rounded-lg text-white font-bold text-[11px] uppercase tracking-wide active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm" style={{backgroundColor: brand.color || '#000'}}>
                                        <CheckCircle size={14}/> ACCEPTER
                                    </button>
                                )}
                                {o.status==='preparing' && (
                                    <button onClick={async (e)=>{ 
                                        e.stopPropagation(); 
                                        updateStatus(o.id,'ready'); 

                                    }} className="flex-1 py-2.5 rounded-lg text-white font-bold text-[11px] uppercase tracking-wide active:scale-95 transition-all bg-green-500 hover:bg-green-600 flex items-center justify-center gap-1.5 shadow-sm">
                                        <CheckCircle size={14}/> {brand.texts?.btnReady || 'Prêt (Wajad)'}
                                    </button>
                                )}
                                
                                {!o.driverId && o.status !== 'pending' && (
                                    <button onClick={(e)=>{ e.stopPropagation(); handleReassignOrder(o, null, true); }} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wide hover:bg-blue-700 flex items-center justify-center gap-1.5 active:scale-95 shadow-sm transition-all">
                                        <Truck size={14}/> Demander Livreur
                                    </button>
                                )}
                                
                                {!o.driverId && o.status !== 'pending' && (onlineDrivers||[]).filter(d => isDriverOnline(d)).length > 0 && (
                                    <select 
                                        className="w-24 bg-purple-50 text-purple-800 py-2.5 px-1 rounded-lg font-bold text-[9px] uppercase border border-purple-200 outline-none text-center cursor-pointer shadow-sm transition-all"
                                        onClick={(e)=>e.stopPropagation()}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            if(e.target.value) {
                                                const dInfo = (clientsList||[]).find(c => c.uid === e.target.value);
                                                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id), { 
                                                    driverId: e.target.value, 
                                                    driverName: dInfo ? dInfo.name : 'Inconnu', 
                                                    isFreelanceDriver: dInfo ? dInfo.isFreelance : false, 
                                                    driverAccepted: false, 
                                                    assignedAtLocal: Date.now(), 
                                                    updatedAt: serverTimestamp(), 
                                                    status: o.status === 'pending' ? 'preparing' : o.status 
                                                });
                                                showNotify("Commande assignée! 📦", "success");
                                                e.target.value = ""; 
                                            }
                                        }}
                                    >
                                        <option value="">Grouper</option>
                                        {(onlineDrivers||[]).filter(d => isDriverOnline(d)).map(d => (
                                            <option key={d.uid} value={d.uid}>{d.name} {d.isAvailable ? '' : '(Plein)'}</option>
                                        ))}
                                    </select>
                                )}

                                {o.status==='ready' && o.driverId && <div className="flex-1 py-2.5 text-center rounded-lg font-bold text-[10px] uppercase tracking-wide text-gray-600 bg-gray-200 border border-gray-300">Attente Livreur</div>}
                                {o.status==='out_for_delivery' && <div className="flex-1 py-2.5 text-center rounded-lg font-bold text-[10px] uppercase tracking-wide text-blue-700 bg-blue-100 border border-blue-200">{brand.texts?.btnOutDelivery || 'En route 🛵'}</div>}
                                
                                <button onClick={(e)=>{ e.stopPropagation(); setCancelModal({show: true, order: o}); }} className="w-10 h-10 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200 active:scale-95 flex items-center justify-center shrink-0 shadow-sm transition-all"><X size={18}/></button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {cancelModal.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border-2 border-red-100 flex flex-col gap-6 relative">
                        <div className="flex justify-between items-center border-b-2 border-gray-50 pb-4">
                            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Annuler Commande</h3>
                            <button onClick={() => setCancelModal({ show: false, order: null })} className="text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full p-2 transition-all"><X size={24}/></button>
                        </div>
                        <p className="text-sm font-bold text-gray-500">Choisissez la raison de l'annulation pour <br/><span className="font-black text-xl text-black mt-2 inline-block uppercase tracking-tight">{cancelModal.order?.name || cancelModal.order?.phone}</span></p>
                        <div className="flex flex-col gap-4">
                            <button onClick={() => { updateStatus(cancelModal.order.id, 'rejected', { reason: 'Problème de livraison', cancelledBy: 'admin', deliveredAtLocal: Date.now() }); setCancelModal({ show: false, order: null }); }} className="w-full bg-gray-50 p-5 rounded-2xl text-left border-2 border-gray-100 hover:bg-red-50 hover:border-red-300 shadow-sm font-black transition-all text-sm text-gray-800 flex items-center gap-3">🚚 Problème de livraison</button>
                            <button onClick={() => { updateStatus(cancelModal.order.id, 'rejected', { reason: 'Rupture de produit', cancelledBy: 'admin', deliveredAtLocal: Date.now() }); setCancelModal({ show: false, order: null }); }} className="w-full bg-gray-50 p-5 rounded-2xl text-left border-2 border-gray-100 hover:bg-red-50 hover:border-red-300 shadow-sm font-black transition-all text-sm text-gray-800 flex items-center gap-3">📦 Rupture de produit</button>
                            <button onClick={() => { updateStatus(cancelModal.order.id, 'rejected', { reason: 'Client injoignable', cancelledBy: 'admin', deliveredAtLocal: Date.now() }); setCancelModal({ show: false, order: null }); }} className="w-full bg-gray-50 p-5 rounded-2xl text-left border-2 border-gray-100 hover:bg-red-50 hover:border-red-300 shadow-sm font-black transition-all text-sm text-gray-800 flex items-center gap-3">📵 Client injoignable</button>
                            <button onClick={() => {
                                const custom = window.prompt("Autre raison:");
                                if (custom) {
                                    updateStatus(cancelModal.order.id, 'rejected', { reason: custom, cancelledBy: 'admin', deliveredAtLocal: Date.now() });
                                    setCancelModal({ show: false, order: null });
                                }
                            }} className="w-full bg-gray-50 p-5 rounded-2xl text-left border-2 border-gray-100 hover:bg-red-50 hover:border-red-300 shadow-sm font-black transition-all text-sm text-gray-800 flex items-center gap-3">✍️ Autre raison</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Résumé Total (Idara) */}
            {showTotals && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowTotals(false)}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest flex items-center gap-3">
                                <ClipboardList className="text-blue-500" /> Résumé (Total en préparation)
                            </h2>
                            <div className="flex items-center gap-3">
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    if ('speechSynthesis' in window) {
                                        window.speechSynthesis.cancel();
                                        setTimeout(() => {
                                            const summaryData = Object.entries(
                                                actives.filter(o => o.status === 'preparing' || o.status === 'pending').reduce((acc, o) => {
                                                    (o.items || []).forEach(i => {
                                                        const baseName = (i.name || '').split(' (Sans')[0];
                                                        const options = (i.name || '').includes(' (Sans') ? ' Sans ' + (i.name || '').split(' (Sans ')[1].replace(')', '') : '';
                                                        const key = baseName + options;
                                                        if (!acc[key]) acc[key] = { qty: 0 };
                                                        acc[key].qty += i.qty;
                                                    });
                                                    return acc;
                                                }, {})
                                            ).sort((a, b) => b[1].qty - a[1].qty);
                                            const text = summaryData.map(([name, data]) => `${data.qty} ${name}`).join(', ');
                                            const utterance = new SpeechSynthesisUtterance(`Total en préparation. ${text}`);
                                            if (brand?.ttsVoiceURI) { const voices = window.speechSynthesis.getVoices(); const selectedVoice = voices.find(v => v.voiceURI === brand.ttsVoiceURI); if (selectedVoice) utterance.voice = selectedVoice; } else { utterance.lang = 'fr-FR'; }
                                            utterance.rate = 1.2;
                                            window.speechSynthesis.speak(utterance);
                                        }, 50);
                                    }
                                }} className="p-2 md:px-4 bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 font-bold text-xs uppercase" title="Lire le résumé">
                                    <Volume2 size={18} /> <span className="hidden md:inline">Lire Total</span>
                                </button>
                                <button onClick={() => setShowTotals(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                            </div>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-4 no-scrollbar">
                            {actives.filter(o => o.status === 'preparing' || o.status === 'pending').length === 0 ? (
                                <div className="text-center text-gray-500 py-10 font-bold">Aucune commande en cours de préparation.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {Object.entries(
                                        actives.filter(o => o.status === 'preparing' || o.status === 'pending').reduce((acc, o) => {
                                            (o.items || []).forEach(i => {
                                                const baseName = (i.name || '').split(' (Sans')[0];
                                                const options = (i.name || '').includes(' (Sans') ? ' (Sans' + (i.name || '').split(' (Sans')[1] : '';
                                                const key = baseName + options;
                                                
                                                if (!acc[key]) acc[key] = { qty: 0, img: i.img };
                                                acc[key].qty += i.qty;
                                            });
                                            return acc;
                                        }, {})
                                    ).sort((a, b) => b[1].qty - a[1].qty).map(([name, data], idx) => {
                                        const baseName = name.split(' (Sans')[0];
                                        const options = name.includes(' (Sans') ? name.split(' (Sans ')[1].replace(')', '') : '';
                                        return (
                                            <div key={idx} className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex items-center gap-4 hover:bg-gray-100 transition-colors shadow-sm">
                                                <div className="w-14 h-14 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden text-2xl shadow-sm">
                                                        {typeof data.img === 'string' && (data.img.startsWith('http') || data.img.startsWith('data:image')) ? <img src={data.img} className="w-full h-full object-cover" alt="" /> : data.img}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-black text-lg text-gray-900 leading-tight">{baseName}</div>
                                                    {options && <div className="text-[10px] text-red-500 font-bold uppercase mt-1">- Sans {options}</div>}
                                                </div>
                                                <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl shadow-md shrink-0">
                                                    {data.qty}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}