import React, { useEffect, useState, useRef } from 'react';
import { ChefHat, CheckCircle } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function ClientScreen({ brand, db, appId }) {
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        // Zoom global de l'interface (Ajusté pour être un peu plus grand)
        document.documentElement.style.fontSize = '13px';
    }, []);

    // 🔥 Njibou l-commandes directement mn Firestore bla man-tsenaw l-Auth dyal l-klyan
    useEffect(() => {
        if (!db || !appId) return;
        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
            where('status', 'in', ['pending', 'preparing', 'ready'])
        );
        const unsub = onSnapshot(q, (snap) => {
            const ords = snap.docs.map(d => ({id: d.id, ...d.data()}));
            setOrders(ords);
        });
        return () => unsub();
    }, [db, appId]);

    // On ne prend que les commandes Caisse (POS) ou À emporter/Sur place
    const posOrders = (orders || []).filter(o => o.source === 'pos' || o.orderType === 'sur_place' || o.orderType === 'a_emporter');
    
    const preparing = posOrders.filter(o => o.status === 'preparing' || o.status === 'pending');
    const ready = posOrders.filter(o => o.status === 'ready');

    const [lastReadyId, setLastReadyId] = useState(null);
    const prevReadyRef = useRef(new Set());

    useEffect(() => {
        const currentReady = new Set(ready.map(o => o.id));
        const prevReady = prevReadyRef.current;
        
        let hasNew = false;
        let newestId = null;
        
        currentReady.forEach(id => {
            if (!prevReady.has(id)) {
                hasNew = true;
                newestId = id;
            }
        });

        if (hasNew) {
            setLastReadyId(newestId);
            
            const newOrder = ready.find(o => o.id === newestId);
            const orderNum = newOrder ? (newOrder.orderNumber || newOrder.id.slice(-4).toUpperCase()) : '';

            try {
                // Sonnette quand la commande sort
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); 
                audio.play().catch(e => console.log('Audio bloqué par le navigateur', e));
                
                // 🔥 Lecture vocale "Numéro de commande X, wajda !"
                if ('speechSynthesis' in window && orderNum) {
                    setTimeout(() => {
                        const text = `Numéro de commande ${orderNum}, wajda !`;
                        const utterance = new SpeechSynthesisUtterance(text);
                        utterance.lang = 'fr-FR'; // On force la prononciation en Français
                        utterance.rate = 1.0; 
                        window.speechSynthesis.speak(utterance);
                    }, 1000); // Tsenna 1 seconde (bach tsali s-sonnette) 3ad hder
                }
            } catch(e) {}
            
            // L'animation "Clignotant" reste pendant 8 secondes
            setTimeout(() => setLastReadyId(null), 8000); 
        }

        prevReadyRef.current = currentReady;
    }, [ready]);

    return (
        <div className="h-[100dvh] w-full bg-[#111827] overflow-hidden relative">
            {/* الغلاف (Wrapper) لتصغير الواجهة بنسبة 70% بتموقع مضبوط (Top-Left) لتفادي الجوانب السوداء */}
            <div className="absolute top-0 left-0 w-[145%] h-[145%] flex flex-col origin-top-left text-white font-sans" style={{ transform: 'scale(0.7)' }}>
                    {/* En-tête du Restaurant */}
                    <header className="h-20 md:h-24 flex items-center justify-between px-6 md:px-10 border-b-4 border-gray-800 shadow-md shrink-0" style={{ backgroundColor: brand?.color || '#ffbc0d' }}>
                        <div className="flex items-center gap-4">
                            {brand?.logoUrl ? <img src={brand.logoUrl} className="h-12 md:h-16 object-contain" /> : <h1 className="text-2xl md:text-4xl font-black italic uppercase text-black">{brand?.name || 'Mon Bocadillo'}</h1>}
                        </div>
                        <h2 className="text-2xl md:text-4xl font-black uppercase text-black tracking-widest">Statut des Commandes</h2>
                    </header>

                    {/* Colonnes Principales */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* EN PRÉPARATION */}
                        <div className="flex-1 border-r-4 border-gray-800 flex flex-col bg-[#1f2937] overflow-hidden">
                            <div className="bg-[#374151] py-4 md:py-6 text-center shadow-lg border-b-4 border-gray-800 z-10 shrink-0">
                                <h3 className="text-3xl md:text-5xl font-black uppercase tracking-widest text-gray-300 flex items-center justify-center gap-3 md:gap-4"><ChefHat className="w-8 h-8 md:w-12 md:h-12" /> En Préparation</h3>
                            </div>
                            <div className="flex-1 p-6 md:p-8 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 content-start overflow-y-auto no-scrollbar">
                                {preparing.map(o => <div key={o.id} className="bg-[#4b5563] rounded-[2rem] py-6 md:py-8 text-center shadow-md border-b-4 border-gray-900"><span className="text-4xl md:text-6xl font-black text-gray-100 tracking-tighter">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span></div>)}
                                {preparing.length === 0 && <div className="col-span-full text-center py-16 md:py-20 text-gray-500 font-bold text-xl md:text-2xl">Aucune commande en préparation</div>}
                            </div>
                        </div>

                        {/* PRÊTES */}
                        <div className="flex-1 flex flex-col bg-[#064e3b] overflow-hidden">
                            <div className="bg-[#16a34a] py-4 md:py-6 text-center shadow-lg border-b-4 border-green-800 z-10 shrink-0">
                                <h3 className="text-3xl md:text-5xl font-black uppercase tracking-widest text-white flex items-center justify-center gap-3 md:gap-4"><CheckCircle className="w-8 h-8 md:w-12 md:h-12" /> Prêtes</h3>
                            </div>
                            <div className="flex-1 p-6 md:p-8 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 content-start overflow-y-auto no-scrollbar">
                                {ready.map(o => <div key={o.id} className={`rounded-[2rem] py-6 md:py-8 text-center shadow-2xl border-b-8 transition-all duration-300 ${lastReadyId === o.id ? 'bg-green-100 border-green-500 text-green-700 animate-pulse scale-105' : 'bg-green-500 border-green-700 text-white'}`}><span className="text-4xl md:text-6xl font-black tracking-tighter">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span></div>)}
                                {ready.length === 0 && <div className="col-span-full text-center py-16 md:py-20 text-green-800 font-bold text-xl md:text-2xl">Aucune commande prête</div>}
                            </div>
                        </div>
                    </div>
                </div>
        </div>
    );
}
