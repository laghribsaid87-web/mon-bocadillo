import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Coffee, Banknote, ArrowLeft, ShoppingBasket, Unlock, History, ClipboardList, X, Printer, Power, BellRing, CheckCircle, MapPin } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateOrderNumber, printTicket } from '../utils/helpers';

export default function PosDashboard({ settings, brand, db, appId, showNotify, managerBranchId, isAdmin, orders = [], updateStatus, handleReassignOrder, onQuit, setTab }) {
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');

    const [orderType, setOrderType] = useState('sur_place'); // 'sur_place' wla 'a_emporter'
    const [paymentMethod, setPaymentMethod] = useState('espece'); // 'espece' wla 'carte'
    
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showXZModal, setShowXZModal] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState(managerBranchId || '');
    const prevPendingCount = useRef(0);

    // Init Active Branch
    useEffect(() => {
        if (!activeBranchId && settings?.branches?.length > 0) setActiveBranchId(managerBranchId || settings.branches[0].id);
    }, [settings, managerBranchId, activeBranchId]);

    // Njibou l-menu w les catégories
    const menuItems = settings?.menuItems || [];
    const categories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];
    const displayCategory = selectedCategory || (categories.length > 0 ? categories[0] : '');

    // Filtrer l-menu
    const filteredMenu = useMemo(() => {
        if (!displayCategory) return menuItems;
        return menuItems.filter(item => item.category === displayCategory);
    }, [menuItems, displayCategory]);

    // 🔥 Les Commandes li Jayin mn l-App Client
    const onlineOrders = (orders || []).filter(o => 
        o.source !== 'pos' && 
        o.nearestBranch?.id === activeBranchId && 
        ['pending', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)
    );
    const pendingOnline = onlineOrders.filter(o => o.status === 'pending');

    // 🔥 Sonnette mli katzad commande web jdida f l-Caisse
    useEffect(() => {
        if (pendingOnline.length > prevPendingCount.current) {
            try {
                const audio = new Audio('/bell.mp3');
                audio.play().catch(e => console.log('Audio autoplay blocked', e));
            } catch (e) {}
        }
        prevPendingCount.current = pendingOnline.length;
    }, [pendingOnline.length]);

    // 🔥 Hssab dyal Z w Rapports
    const todayStr = new Date().toISOString().split('T')[0];
    const posOrdersToday = (orders || []).filter(o => {
        if (o.nearestBranch?.id !== activeBranchId) return false;
        if (o.status === 'rejected') return false; // Mankhdmoch b les commandes annulées
        let d = new Date();
        try {
            if (o.createdAt?.seconds) d = new Date(o.createdAt.seconds * 1000);
            else if (typeof o.createdAt === 'string' || typeof o.createdAt === 'number') d = new Date(o.createdAt);
            
            if (isNaN(d.getTime())) return false;
            return d.toISOString().split('T')[0] === todayStr;
        } catch (err) {
            return false;
        }
    });

    const dailyCA = posOrdersToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    
    let dailyItemsMap = {};
    posOrdersToday.forEach(o => {
        (o.items || []).forEach(i => { const baseName = (i.name || '').split(' (Sans ')[0]; dailyItemsMap[baseName] = (dailyItemsMap[baseName] || 0) + i.qty; });
    });
    const dailyItemsList = Object.entries(dailyItemsMap).sort((a,b) => b[1] - a[1]);

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const addToCart = (item) => {
        let note = "";
        // Option: Sans oignons, Sans frites...
        if (item.removableIngredients) {
             const sansList = window.prompt(`Had l-plat fih: ${item.removableIngredients}.\nWach bghiti t7yed chi 7aja l l-kliyane? (Ktbha hna, awla khelih khawi)`);
             if (sansList && sansList.trim() !== "") {
                 note = ` (Sans ${sansList.trim()})`;
             }
        }
        
        const finalName = item.name + note;
        
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id && i.name === finalName);
            if (existing) return prev.map(i => i.id === item.id && i.name === finalName ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { ...item, name: finalName, qty: 1 }];
        });
    };

    const removeFromCart = (itemId) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === itemId);
            if (existing && existing.qty > 1) return prev.map(i => i.id === itemId ? { ...i, qty: i.qty - 1 } : i);
            return prev.filter(i => i.id !== itemId);
        });
    };

    const clearCart = () => {
        if (window.confirm("Wach m2ked bghiti tsme7 f had l-commande?")) setCart([]);
    };

    const handleEncaissement = async () => {
        if (cart.length === 0) return showNotify("L-panier khawi!", "error");

        try {
            const orderNum = generateOrderNumber();
            const branch = (settings?.branches || []).find(b => b.id === activeBranchId) || null;

            const newOrder = {
                orderNumber: orderNum,
                items: cart,
                total: total,
                subtotal: total,
                deliveryFee: 0,
                status: 'delivered', // 🚀 POS orders kaymchiw nichan l-Delivered bach maybanoch f l-Idara/Livreur
                deliveredAtLocal: Date.now(),
                source: 'pos',
                orderType: orderType,
                paymentMethod: paymentMethod,
                nearestBranch: branch,
                createdAt: serverTimestamp(),
                customerName: orderType === 'a_emporter' ? 'Client Emporter' : 'Client Sur Place',
            };

            // Nssifto l-commande l-Firestore
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), newOrder);
            
            showNotify("Commande daret b-naja7! ✅", "success");
            
            // Impression automatique dyal t-ticket w feth l-caisse
            printTicket(newOrder, brand); 

            setCart([]); // Nkhwiw l-panier l-client jdid
        } catch (error) {
            showNotify("W9e3 mochkil f tsjal dyal l-commande", "error");
        }
    };

    // 🔥 Impression des Rapports X / Z
    const printReport = (type) => {
        const branch = (settings?.branches || []).find(b => b.id === activeBranchId);
        const printWindow = window.open('', '', 'width=400,height=600');
        const itemsHtml = dailyItemsList.map(([name, qty]) => `<div style="display:flex; justify-content:space-between;"><span>${qty}x ${name}</span><span></span></div>`).join('');
        
        const html = `<html><head><title>Rapport ${type}</title></head>
        <body style="font-family:monospace; padding:10px; font-size:14px; color:#000; text-align:center;">
            <h2 style="margin:0;">RAPPORT ${type}</h2>
            <p style="margin:5px 0;">${branch?.name?.toUpperCase() || brand?.name?.toUpperCase() || 'CAISSE'}<br>Date: ${new Date().toLocaleDateString('fr-FR')}</p>
            <hr style="border-top:1px dashed #000; margin:10px 0;"/><div style="display:flex; justify-content:space-between;"><span>Total Tickets:</span><span>${posOrdersToday.length}</span></div><hr style="border-top:1px dashed #000; margin:10px 0;"/>
            <p style="text-align:left; font-weight:bold; margin:5px 0;">Détails des ventes :</p>${itemsHtml || '<p style="text-align:left;">Aucun article</p>'}
            <hr style="border-top:1px dashed #000; margin:10px 0;"/><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:18px; margin-top:10px;"><span>C.A TOTAL:</span><span>${dailyCA} DH</span></div>
            <p style="margin-top:20px; font-size:12px;">${type === 'Z' ? '*** CLOTURE Z ***' : '*** BILAN PROVISOIRE X ***'}</p>
            <script>window.onload=function(){window.print();}; window.onafterprint=function(){window.close();};</script>
        </body></html>`;
        printWindow.document.write(html); printWindow.document.close();
        if (type === 'Z') { showNotify("Journée clôturée avec succès ✅", "success"); setShowXZModal(false); }
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 md:flex-row overflow-hidden relative font-sans" style={{ fontFamily: brand?.fontFamily || "'Plus Jakarta Sans', sans-serif" }}>
            
            {/* BOUTON QUITTER */}
            <button onClick={() => setTab ? setTab('active') : (onQuit ? onQuit() : window.location.href = '/idara')} className="absolute top-3 right-3 sm:top-4 sm:right-4 md:right-[416px] z-20 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl font-bold flex items-center gap-1 sm:gap-2 shadow-sm bg-white border border-gray-200 hover:bg-gray-50 text-xs sm:text-sm text-gray-700">
                <ArrowLeft size={18}/> <span className="hidden sm:inline">Quitter</span>
            </button>

            {/* MAIN CONTENT (LEFT) */}
            <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
                <header className="bg-white p-3 sm:p-4 shadow-sm font-black text-xl sm:text-2xl flex items-center gap-2 z-10" style={{ color: brand?.color || '#4f46e5' }}>
                    <ShoppingCart size={28}/> <span className="truncate pr-20 sm:pr-0">{brand?.name || 'CaissePro'}</span>
                    
                    {/* BOUTON CLIGNOTANT LI KAYDI L-IDARA */}
                <button onClick={() => setTab ? setTab('active') : (onQuit ? onQuit() : window.location.href = '/idara')} className={`ml-4 relative flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold shadow-sm transition-all text-sm sm:text-base ${pendingOnline.length > 0 ? 'bg-red-500 text-white animate-pulse border border-red-600' : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                    <BellRing size={18} className={pendingOnline.length > 0 ? 'animate-bounce' : ''}/>
                    <span className="hidden sm:inline">Commandes Web</span>
                    {pendingOnline.length > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{pendingOnline.length}</span>}
                </button>

                <button onClick={() => setTab ? setTab('standard') : window.location.href = '/idara'} className="ml-2 relative flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold shadow-sm transition-all text-sm sm:text-base bg-orange-500 hover:bg-orange-600 text-white border border-orange-600">
                    📞 <span className="hidden sm:inline">Standard Tél</span>
                </button>

                <div className="ml-auto mr-28 sm:mr-0"></div>
                </header>
                
                <div className="bg-white border-b border-gray-100 p-3 sm:p-4 overflow-x-auto no-scrollbar shrink-0">
                    <div className="flex gap-2">
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full sm:rounded-2xl font-bold sm:font-black transition-all whitespace-nowrap text-sm sm:text-base ${displayCategory === cat ? 'text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} style={displayCategory === cat ? { backgroundColor: brand?.color || '#4f46e5' } : {}}>
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <main className="flex-1 p-3 sm:p-6 overflow-y-auto w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pb-4">
                        {filteredMenu.map(item => (
                            <button key={item.id} onClick={() => addToCart(item)} className="bg-white border-2 border-gray-100 hover:border-blue-400 p-2 sm:p-3 rounded-2xl sm:rounded-[32px] flex flex-col items-center justify-center gap-2 sm:gap-3 shadow-sm hover:shadow-md active:scale-95 transition-all min-h-[180px] sm:min-h-[250px]">
                                <span className="text-6xl sm:text-7xl mb-1 flex items-center justify-center w-full flex-1">
                            {typeof item.img === 'string' && item.img.startsWith('http') ? <img src={item.img} className="w-full h-36 sm:h-48 object-contain drop-shadow-md rounded-xl" alt={item.name}/> : item.img}
                                </span>
                                <span className="font-bold text-xs sm:text-sm text-slate-700 leading-tight text-center line-clamp-2">{item.name}</span>
                                <span className="font-black text-lg sm:text-2xl" style={{ color: brand?.color || '#4f46e5' }}>{item.price} <small className="text-[10px] sm:text-sm">DH</small></span>
                            </button>
                        ))}
                    </div>
                </main>
            </div>

            {/* CART SIDEBAR (RIGHT) */}
            <aside className="hidden md:flex w-[400px] bg-white shadow-2xl flex-col h-full z-20 border-l border-gray-200 shrink-0">
                <div className="p-4 sm:p-6 border-b border-gray-100 font-black text-xl sm:text-2xl flex justify-between items-center bg-white sticky top-0 z-10" style={{ color: brand?.color || '#4f46e5' }}>
                    <div className="flex items-center gap-2 sm:gap-3"><ShoppingBasket size={28}/> Commande</div>
                    {cart.length > 0 && <button onClick={clearCart} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors"><Trash2 size={20}/></button>}
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-slate-50/50">
                    {cart.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-slate-500 my-10"><ShoppingBasket size={64}/><p className="font-bold uppercase tracking-widest mt-4 text-sm">VIDE</p></div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-2 sm:gap-3">
                                <div className="flex justify-between font-bold text-slate-800 text-sm sm:text-base">
                                    <span>{item.name}</span>
                                    <span className="font-black" style={{ color: brand?.color || '#4f46e5' }}>{item.price * item.qty} DH</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3 sm:gap-5 bg-slate-100 rounded-xl p-1 px-2">
                                        <button onClick={() => removeFromCart(item.id)} className="p-1 hover:bg-white rounded-lg text-slate-500 shadow-sm"><Minus size={16}/></button>
                                        <span className="font-black text-base sm:text-lg w-4 sm:w-6 text-center">{item.qty}</span>
                                        <button onClick={() => addToCart(item)} className="p-1 hover:bg-white rounded-lg text-slate-500 shadow-sm"><Plus size={16}/></button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 sm:p-5 bg-white border-t border-gray-100 shadow-[0_-5px_15px_rgba(0,0,0,0.03)]">
                    <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <span className="text-slate-500 font-medium text-sm sm:text-base">Total à Payer</span>
                        <span className="text-2xl sm:text-3xl font-black text-gray-900">{total} <span className="text-sm sm:text-lg">DH</span></span>
                    </div>
                    
                    <div className="flex gap-2 mb-3">
                        <button onClick={() => setOrderType('sur_place')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all border-2 ${orderType === 'sur_place' ? 'bg-blue-50' : 'border-gray-100 text-gray-500 bg-white'}`} style={orderType === 'sur_place' ? {borderColor: brand?.color || '#4f46e5', color: brand?.color || '#4f46e5'} : {}}>Sur Place</button>
                        <button onClick={() => setOrderType('a_emporter')} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all border-2 ${orderType === 'a_emporter' ? 'bg-blue-50' : 'border-gray-100 text-gray-500 bg-white'}`} style={orderType === 'a_emporter' ? {borderColor: brand?.color || '#4f46e5', color: brand?.color || '#4f46e5'} : {}}>À Emporter</button>
                    </div>
                    
                    <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                        <button onClick={() => setPaymentMethod('espece')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${paymentMethod === 'espece' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Espèce</button>
                        <button onClick={() => setPaymentMethod('carte')} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${paymentMethod === 'carte' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Carte Bancaire</button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <button onClick={() => showNotify("Tiroir ouvert 🔓", "success")} className="py-2 sm:py-3 bg-gray-800 text-white rounded-lg sm:rounded-xl hover:bg-gray-700 flex flex-col items-center justify-center gap-1 font-bold text-[10px] sm:text-xs shadow-sm"><Unlock size={16} className="text-green-400"/><span>Tiroir</span></button>
                        <button onClick={() => setShowHistoryModal(true)} className="py-2 sm:py-3 bg-blue-100 text-blue-700 rounded-lg sm:rounded-xl hover:bg-blue-200 flex flex-col items-center justify-center gap-1 font-bold text-[10px] sm:text-xs shadow-sm"><History size={16}/><span>Historique</span></button>
                        <button onClick={() => setShowXZModal(true)} className="py-2 sm:py-3 bg-purple-100 text-purple-700 rounded-lg sm:rounded-xl hover:bg-purple-200 flex flex-col items-center justify-center gap-1 font-bold text-[10px] sm:text-xs shadow-sm"><ClipboardList size={16}/><span>Rapports</span></button>
                    </div>

                    <button onClick={handleEncaissement} disabled={cart.length === 0} className="w-full py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-xl sm:text-2xl text-white disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-lg" style={{ backgroundColor: brand?.color || '#4f46e5' }}>
                        <Banknote size={24}/> ENCAISSER
                    </button>
                </div>
            </aside>

            {/* MODAL HISTORIQUE */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowHistoryModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="bg-blue-600 text-white p-4 flex justify-between items-center"><h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><History size={20}/> Historique (Aujourd'hui)</h2><button onClick={() => setShowHistoryModal(false)} className="hover:bg-blue-700 p-1 rounded-full"><X size={24}/></button></div>
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                            {posOrdersToday.length === 0 ? ( <p className="text-center text-gray-500 py-10 font-medium">Aucun ticket aujourd'hui.</p> ) : (
                                posOrdersToday.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).map(sale => (
                                    <div key={sale.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                        <div className="flex justify-between border-b border-gray-100 pb-2 mb-2"><span className="font-bold text-blue-600">#{sale.orderNumber || sale.id.slice(-4).toUpperCase()}</span><span className="text-xs text-gray-500">{sale.createdAt?.seconds ? new Date(sale.createdAt.seconds * 1000).toLocaleTimeString() : ''}</span></div>
                                        <div className="space-y-1 mb-3">{(sale.items || []).map((item, idx) => (<div key={idx} className="flex justify-between text-xs text-gray-700"><span>{item.qty}x {(item.name || '').split(' (Sans')[0]}</span><span className="font-medium">{item.price * item.qty} DH</span></div>))}</div>
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100"><span className="font-black text-gray-800">Total: <span className="text-blue-600">{sale.total} DH</span></span><button onClick={() => printTicket(sale, brand)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-blue-100"><Printer size={14}/> Imprimer</button></div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL RAPPORTS X/Z */}
            {showXZModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowXZModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="bg-purple-600 text-white p-4 flex justify-between items-center"><h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><ClipboardList size={20}/> Rapports Caisse</h2><button onClick={() => setShowXZModal(false)} className="hover:bg-purple-700 p-1 rounded-full"><X size={24}/></button></div>
                        <div className="p-5 sm:p-6 bg-gray-50 flex flex-col gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-gray-200 text-center shadow-sm">
                                <p className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Recette du jour</p>
                                <h3 className="text-3xl font-black text-purple-600">{dailyCA} MAD</h3>
                                <p className="text-xs text-gray-400 mt-1 font-medium">{posOrdersToday.length} tickets</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-200 max-h-48 overflow-y-auto shadow-sm">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Détails des ventes</h4>
                                {dailyItemsList.length === 0 ? ( <p className="text-xs text-gray-400 text-center">Aucun article vendu.</p> ) : (
                                    <div className="space-y-2">
                                        {dailyItemsList.map(([name, qty]) => (
                                            <div key={name} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0"><span className="text-xs text-gray-600 font-medium">{name}</span><span className="font-bold text-gray-800 text-xs bg-gray-100 px-2 py-0.5 rounded-md">{qty}</span></div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <button onClick={() => printReport('X')} className="w-full py-3 bg-blue-100 text-blue-700 font-bold rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-blue-200 text-sm shadow-sm"><Printer size={18}/> Bilan X</button>
                                <button onClick={() => printReport('Z')} className="w-full py-3 bg-red-100 text-red-600 font-bold rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-red-200 text-sm shadow-sm"><Power size={18}/> Clôture Z</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}