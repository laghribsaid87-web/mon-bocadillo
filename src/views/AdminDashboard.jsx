import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Store, Phone, History, Truck, Map as MapIcon, Users, Star, Palette, LogOut, 
    X, Menu, Check, CheckCircle, Minus, Clock, Printer, AlertTriangle, ChevronRight, Search, 
    Download, Ban, Trash2, User, Edit3, Settings, Zap, ImageIcon, Type, AlignLeft, 
    MessageCircle, Utensils, MousePointer2, Plus, ShoppingBag, Home, MapPin, Navigation,
    TrendingUp, DollarSign, Award, BarChart3
} from 'lucide-react';
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { formatPhoneNumber, getWhatsAppFormat, generateOrderNumber, buildMessage, isDriverOnline, getClosestBranch, calculateETA } from '../utils/helpers';
import AdminMap from '../components/AdminMap';
import StatusBadge from '../components/StatusBadge';
import OrderTimer from '../components/OrderTimer';
import AdminClients from '../components/admin/AdminClients';
import AdminConfig from '../components/admin/AdminConfig';
import AdminHistory from '../components/admin/AdminHistory';
import AdminActiveOrders from '../components/admin/AdminActiveOrders';
import { DEFAULT_BRANCHES, DEFAULT_MENU_ITEMS, DEFAULT_BRAND, FONTS_OPTIONS } from '../config/constants';
import PosDashboard from './PosDashboard';

export default function AdminDashboard({ role, managerBranchId, orders, updateStatus, clientsList, onlineDrivers, settings, brand, setBrand, saveSettings, db, showNotify, handleReassignOrder, printTicket, defaultMenu, onLogout, appId }) {
    const [tab, setTab] = useState('active'); 
    const [f, setF] = useState({ type: 'today', date: new Date().toISOString().split('T')[0], search: '' }); 
    const [clientSubTab, setClientSubTab] = useState('nouveaux'); 
    const [historyDriverFilter, setHistoryDriverFilter] = useState('ALL');
    const [avisFilter, setAvisFilter] = useState('all'); 
    const [editableMenu, setEditableMenu] = useState(settings?.menuItems || defaultMenu || DEFAULT_MENU_ITEMS); 
    const [editableBranches, setEditableBranches] = useState(settings?.branches || DEFAULT_BRANCHES);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
    const [extOrder, setExtOrder] = useState({ type: 'telephone', phone: '', address: '', details: '', total: '', branchId: role === 'manager' ? managerBranchId : '', deliveryFee: 0 }); 
    const [extCart, setExtCart] = useState([]); 
    const [showExtMenu, setShowExtMenu] = useState(false); 
    const [expandedOrder, setExpandedOrder] = useState(null); 
    const [activeEditZone, setActiveEditZone] = useState(null); 
    const [configTab, setConfigTab] = useState('apparence');
    const [now, setNow] = useState(Date.now());
    
    const [selectedExtItem, setSelectedExtItem] = useState(null); 
    const [extItemOptions, setExtItemOptions] = useState([]);
    const [extSelectedVariation, setExtSelectedVariation] = useState(null);
    const [isDriversLoaded, setIsDriversLoaded] = useState(false);
    const prevOnlineDriversRef = useRef(new Set());
    const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
    const [analyticsBranch, setAnalyticsBranch] = useState('all');

    // 🔥 Zidna had les states bach n-trackiw les commandes jdad
    const [isAppLoaded, setIsAppLoaded] = useState(false);
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const knownOrdersRef = useRef(new Set());

    const enableSound = () => {
        setIsSoundEnabled(true);
        try {
            const audio = new Audio('/bell.mp3');
            audio.volume = 0.01;
            audio.play().catch(() => {});
        } catch (e) {}
    };


    useEffect(() => {
        const int = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(int);
    }, []);

    // 🔥 Zidna had l-useEffect bach t-sonner mnin t-ti7 commande jdida (Pending)
    useEffect(() => {
        if (!orders || orders.length === 0) return;

        // Mnin kat-charger l'Idara l-merra l-wla, kankhbiw ga3 les commandes bach may-sonniwch
        if (!isAppLoaded) {
            const initialOrders = new Set();
            orders.forEach(o => initialOrders.add(o.id));
            knownOrdersRef.current = initialOrders;
            setIsAppLoaded(true);
            return;
        }

        let hasNewOrder = false;
        orders.forEach(order => {
            // Ila kant jdida w f status pending w mazal ma-3rfnahach
            if (order.status === 'pending' && !knownOrdersRef.current.has(order.id)) {
                hasNewOrder = true;
                knownOrdersRef.current.add(order.id);
            }
        });

        // Ila l9ina commande jdida (awla ktr mn whda f nfs l-we9t), n-l3bo sonnette
        if (hasNewOrder) {
            try {
                const audio = new Audio('/bell.mp3');
                audio.play().catch(e => console.log("Audio bloqué par le navigateur (Autoplay Policy). L'utilisateur doit interagir avec la page.", e));
            } catch (e) { console.log("Erreur audio", e); }
        }
    }, [orders, isAppLoaded]);

    // 🔥 Notification mnin kayt-connecta chi livreur jdid
    useEffect(() => {
        if (!onlineDrivers) return;
        if (!isDriversLoaded) {
            const initial = new Set();
            onlineDrivers.forEach(d => { if (isDriverOnline(d)) initial.add(d.uid || d.phone); });
            prevOnlineDriversRef.current = initial;
            setIsDriversLoaded(true);
            return;
        }
        const current = new Set();
        onlineDrivers.forEach(d => {
            if (isDriverOnline(d)) {
                const id = d.uid || d.phone;
                current.add(id);
                if (!prevOnlineDriversRef.current.has(id)) {
                    showNotify(`🛵 Livreur ${d.name || 'Inconnu'} est connecté !`, "info");
                }
            }
        });
        prevOnlineDriversRef.current = current;
    }, [onlineDrivers, isDriversLoaded]);

    // 🔥 Zid had 2 stoura hna:
    const [showAddDriver, setShowAddDriver] = useState(false);
    const [newDriver, setNewDriver] = useState({ name: '', phone: '', isFreelance: false });
    // HADI HIYA S-SECURITE LI ZEDNA BACH MAYW9E3CH CRASH (PAGE BAYDA)
    const getL = (d) => {
        try {
            if (!d || !(d instanceof Date) || isNaN(d)) return '';
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        } catch (e) { return ''; }
    };

    const today = getL(new Date()); 
    const yesterday = getL(new Date(now - 86400000));

    useEffect(() => {
        const interval = setInterval(() => {
            (orders || []).forEach(o => {
                if (o.status === 'rejected' || o.status === 'delivered') return;
                
                if (o.driverId && !o.driverAccepted) {
                    const elapsed = Date.now() - (o.assignedAtLocal || 0);
                    if (elapsed > 30000) { handleReassignOrder(o, o.driverId, false, true); }
                } else if (!o.driverId && (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')) {
                    const elapsedSinceLastSearch = Date.now() - (o.assignedAtLocal || o.createdAt?.seconds*1000 || 0);
                    if (elapsedSinceLastSearch > 15000) { handleReassignOrder(o, null, true, true); }
                }
            });
        }, 3000);
        return () => clearInterval(interval);
    }, [orders, handleReassignOrder]);

    useEffect(() => { 
        setEditableMenu(settings?.menuItems || defaultMenu || DEFAULT_MENU_ITEMS); 
        setEditableBranches(settings?.branches || DEFAULT_BRANCHES); 
    }, [settings, defaultMenu]);

    // 🔥 OPTIMISATION (Performance Fix): Cacher les calculs lourds avec useMemo
    const { safeOrders, branchOrders, history, pending, actives } = useMemo(() => {
        const sOrders = orders || [];
        const bOrders = role === 'manager' ? sOrders.filter(o => o.nearestBranch?.id === managerBranchId) : sOrders;
        
        const hist = bOrders.filter(o => ['delivered', 'rejected'].includes(o.status)).filter(o => { 
            let d = '';
            if (o.createdAt && o.createdAt.seconds) { d = getL(new Date(o.createdAt.seconds * 1000)); }
            if (f.type === 'today') return d === today; 
            if (f.type === 'yesterday') return d === yesterday; 
            return f.date ? d === f.date : true; 
        });
        
        return {
            safeOrders: sOrders,
            branchOrders: bOrders,
            history: hist,
            pending: bOrders.filter(o => o.status === 'pending'),
            actives: bOrders.filter(o => !['delivered', 'rejected'].includes(o.status))
        };
    }, [orders, role, managerBranchId, f, today, yesterday]);

    // 🔥 OPTIMISATION: Hssab dyal l-flouss mayt3awdch ila matbedlatch l-historique
    const { filteredHistory, totalCollecte, totalGainsLivreur, aRendre } = useMemo(() => {
        const filtered = history.filter(o => { 
            if (historyDriverFilter === 'ALL') return true; 
            if (o.driverId === historyDriverFilter) return true;
            const selectedDriver = (clientsList || []).find(c => c.uid === historyDriverFilter || c.id === historyDriverFilter || c.phone === historyDriverFilter); 
            if (!selectedDriver) return false; 
            return o.driverId === selectedDriver.uid; 
        });

        let collect = 0; let gains = 0; 
        filtered.forEach(o => { 
            if (o.status === 'delivered') { collect += Number(o.total) || 0; }
            if (o.status === 'delivered' || (o.status === 'rejected' && o.driverPaid)) {
                const driverData = (clientsList || []).find(c => c.uid === o.driverId); 
                const isFreelance = o.isFreelanceDriver !== undefined ? o.isFreelanceDriver : (driverData?.isFreelance || false); 
                if (isFreelance) gains += 10; 
            }
        }); 
        return { filteredHistory: filtered, totalCollecte: collect, totalGainsLivreur: gains, aRendre: collect - gains };
    }, [history, historyDriverFilter, clientsList]);

    // 🔥 Fonction jdida bach t-imprimi automatiquement mnin t-accepter l-commande
    const handleUpdateStatus = async (orderId, newStatus, extraData) => {
        await updateStatus(orderId, newStatus, extraData);
        
        if (newStatus === 'preparing') {
            const orderToPrint = orders.find(o => o.id === orderId);
            if (orderToPrint) {
                // 🔔 L3ab sonnette (Audio)
                try {
                    const audio = new Audio('/bell.mp3');
                    audio.play().catch(e => console.log("Audio bloqué par le navigateur (Autoplay Policy)", e));
                } catch (e) { console.log("Erreur audio", e); }
                
                printTicket(orderToPrint, brand);
            }
        }
    };

    const addExtCart = (item) => { setExtCart(prev => { const cid = item.cartItemId || item.id; const ex = prev.find(i => (i.cartItemId || i.id) === cid); if (ex) return prev.map(i => (i.cartItemId || i.id) === cid ? {...i, qty: i.qty+1} : i); return [...prev, {...item, qty: 1, cartItemId: cid}]; }); };
    const removeExtCart = (item) => { setExtCart(prev => { const cid = item.cartItemId || item.id; const ex = prev.find(i => (i.cartItemId || i.id) === cid); if (ex && ex.qty > 1) return prev.map(i => (i.cartItemId || i.id) === cid ? {...i, qty: i.qty-1} : i); return prev.filter(i => (i.cartItemId || i.id) !== cid); }); };
    const extTotal = extCart.reduce((sum, i) => sum + ((i.price||0) * (i.qty||0)), 0);

    const handleStandardOrder = async () => {
        if(!extOrder.phone || extCart.length === 0 || !extOrder.branchId) return showNotify("Numéro de Téléphone, Agence et Commande sont obligatoires!", "error");
        const cleanPh = formatPhoneNumber(extOrder.phone); 
        const waPhone = getWhatsAppFormat(cleanPh); 
        const appUrl = window.location.origin + window.location.pathname; 
        const branch = (settings?.branches || DEFAULT_BRANCHES).find(b => b.id === extOrder.branchId);
        
        const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', cleanPh); 
        const snap = await getDoc(clientRef); 
        if(!snap.exists()) await setDoc(clientRef, { name: '', phone: cleanPh, pin: '0000', blocked: false, isDriver: false, createdAt: serverTimestamp() });
        
        const finalDeliveryFee = Number(extOrder.deliveryFee) || 0;
        const finalTotal = extTotal + finalDeliveryFee;

        const orderNum = generateOrderNumber(); 
        const detailsTxt = extCart.map(i => {
            const parts = (i.name || '').split(' (Sans ');
            const baseName = parts[0];
            const opts = parts.length > 1 ? parts[1].replace(')','').split(', ').map(opt => `\n   - Sans ${opt}`).join('') : '';
            return `${i.qty}x ${baseName}${opts}`;
        }).join('\n'); 
        const etaMins = calculateETA(0); // 0 Hit Commande Par Tél mafihach distance direct (Ghaliban ghat3ti ~30-40 mins)
        
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), { userId: cleanPh, orderNumber: orderNum, customerName: '', phone: cleanPh, address: extOrder.address || 'Commande par Téléphone', nearestBranch: branch, items: extCart, total: finalTotal, deliveryFee: finalDeliveryFee, subtotal: extTotal, status: 'pending', source: 'telephone', etaMinutes: etaMins, createdAt: serverTimestamp() });
        
        const msgTemplate = brand.messages?.standardOrder || DEFAULT_BRAND.messages.standardOrder; 
        const msgBody = buildMessage(msgTemplate, { brandName: (brand.name || '').toUpperCase(), items: detailsTxt, subtotal: extTotal, deliveryFee: finalDeliveryFee, total: finalTotal, appUrl: appUrl, eta: etaMins });
        
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msgBody)}`, '_blank');
        showNotify("Commande ajoutée w WhatsApp t7el! ✅", "success"); 
        setExtOrder({ type: 'telephone', phone: '', address: '', details: '', total: '', branchId: role === 'manager' ? managerBranchId : '', deliveryFee: 0 }); 
        setExtCart([]); 
        setShowExtMenu(false); 
        setTab('active');
    };

    const handleGlovoInvite = async () => {
        if(!extOrder.phone) return showNotify("Numéro darouri!", "error");
        const cleanPh = formatPhoneNumber(extOrder.phone);
        const waPhone = getWhatsAppFormat(cleanPh); const appUrl = window.location.origin + window.location.pathname;
        const msgTemplate = brand.messages?.glovoInvite || DEFAULT_BRAND.messages.glovoInvite; 
        const msgBody = buildMessage(msgTemplate, { brandName: (brand.name || '').toUpperCase(), appUrl: appUrl });
        
        window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msgBody)}`, '_blank'); 
        showNotify("Invitation WhatsApp t7ellat! ✅", "success"); 
        setExtOrder({ type: 'glovo', phone: '', address: '', details: '', total: '', branchId: '' });
    };

    const handleExportCSV = () => {
        const headers = ['Nom', 'Téléphone', 'Role', 'Statut', 'Total Commandes', 'Total Livraisons'];
        const rows = (clientsList||[]).map(c => {
            const clientOrders = safeOrders.filter(o => o.userId === c.uid || o.phone === c.phone).length;
            const driverOrders = safeOrders.filter(o => o.driverId === c.uid && o.status === 'delivered').length;
            const role = c.isDriver ? (c.isFreelance ? 'Livreur (Freelance)' : 'Livreur (Officiel)') : 'Client';
            const status = c.blocked ? 'Bloqué' : 'Actif';
            return `"${c.name || 'Inconnu'}","${c.phone || ''}","${role}","${status}","${clientOrders}","${driverOrders}"`;
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Clients_MonBocadillo_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotify("Exportation Excel/CSV réussie ✅", "success");
    };

    const handleWakeUpDrivers = async () => {
        try {
            showNotify("Kansifto l-notifications l-livreurs...", "info");
            const functions = getFunctions();
            const wakeUpFn = httpsCallable(functions, 'wakeUpDriversGPS');
            await wakeUpFn({ appId });
            showNotify("Notifications t-siftat bnaja7! 📡", "success");
        } catch(e) {
            console.error(e);
            showNotify("Erreur f l-envoi dyal notifications", "error");
        }
    };
// 🔥 Zid had l-Fonction jdida:
    const handleAddDriverSubmit = async () => {
        if (!newDriver.name || !newDriver.phone) return showNotify("Saisir nom et téléphone", "error");
        let p = newDriver.phone.replace(/\D/g, ''); 
        if (p.startsWith('00212')) p = p.substring(5); 
        if (p.startsWith('212')) p = p.substring(3); 
        if (p.length === 9) p = '0' + p;
        if (p.length < 9) return showNotify("Numéro invalide", "error");

        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', p), {
                name: newDriver.name, phone: p, isDriver: true, isFreelance: newDriver.isFreelance, blocked: false, createdAt: serverTimestamp()
            }, { merge: true });
            
            showNotify("Livreur ajouté b-naja7! ✅", "success");
            setShowAddDriver(false);
            setNewDriver({ name: '', phone: '', isFreelance: false });
        } catch (e) {
            showNotify("Erreur d'ajout", "error");
        }
    };
    const renderNavItem = ({ id, icon, label, badge, hidden }) => {
        if (hidden) return null; const active = tab === id;
        return ( <button key={id} onClick={() => { setTab(id); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-4 mb-3 rounded-2xl transition-all font-black text-xs md:text-sm uppercase tracking-wider ${active ? 'bg-white text-black shadow-xl scale-[1.02]' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}> <div className="flex items-center gap-3">{icon}<span>{label}</span></div> {badge > 0 && <span className={`px-3 py-1 rounded-lg text-xs font-black shadow-sm ${active ? 'bg-red-600 text-white' : 'bg-blue-500 text-white'}`}>{badge}</span>} </button> )
    };

    const btnRadiusMock = brand.buttonStyle === 'square' ? 'rounded-md' : (brand.buttonStyle === 'rounded' ? 'rounded-xl' : 'rounded-full');

    return (
      <div className="flex h-screen bg-gray-50 text-gray-800 font-sans w-full absolute inset-0 z-[100] overflow-hidden" style={{ fontFamily: brand.fontFamily || "'Poppins', sans-serif" }}>
        <div className={`fixed inset-y-0 left-0 w-64 bg-neutral-900 text-white shadow-2xl z-[200] transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative flex flex-col`}>
            <div className="p-6 flex justify-between items-center border-b border-white/10 shrink-0"><div><h2 className="font-black text-2xl italic uppercase tracking-tighter" style={{color: brand.color}}>{brand.texts?.adminTitle || 'Idara'}</h2>{role === 'manager' && <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase">Gérant Agence</p>}</div><button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={24}/></button></div>
            <div className="flex-1 overflow-y-auto py-6 px-4 no-scrollbar">
                {renderNavItem({ id: "pos", icon: <ShoppingBag size={20}/>, label: "Caisse (POS)" })}
                {renderNavItem({ id: "active", icon: <Store size={20}/>, label: "Commandes", badge: pending.length })}
                {renderNavItem({ id: "standard", icon: <Phone size={20}/>, label: "Standard Tél" })}
                
                {renderNavItem({ id: "history", icon: <History size={20}/>, label: "Historique" })}
                {renderNavItem({ id: "analytics", icon: <TrendingUp size={20}/>, label: "Analyses & Stats", hidden: role === 'manager' })}
                {renderNavItem({ id: "drivers", icon: <Truck size={20}/>, label: "Livreurs", badge: (onlineDrivers || []).filter(d => isDriverOnline(d)).length })}
                {renderNavItem({ id: "maps", icon: <MapIcon size={20}/>, label: "Live Maps" })}
                {renderNavItem({ id: "clients", icon: <Users size={20}/>, label: "Livreurs & Comptes" })}
                {renderNavItem({ id: "avis", icon: <Star size={20}/>, label: "Avis clients", hidden: role === 'manager' })}
                {renderNavItem({ id: "config", icon: <Palette size={20}/>, label: "Éditeur Visuel", hidden: role === 'manager' })}
            </div>
            <div className="p-4 border-t border-white/10 shrink-0"><button onClick={onLogout} className="flex items-center gap-3 text-gray-400 font-bold hover:text-red-500 w-full p-2 transition-colors"><LogOut size={20}/> Se déconnecter</button></div>
        </div>

        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-[150] md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

        <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
            <header className="bg-white h-20 border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shadow-sm shrink-0">
                <div className="flex items-center gap-4"><button className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors" onClick={() => setIsSidebarOpen(true)}><Menu size={20}/></button><h2 className="font-semibold text-lg hidden md:block text-gray-800 capitalize">{tab === 'active' ? 'Commandes' : tab === 'config' ? 'Éditeur Visuel Live' : tab === 'analytics' ? 'Analyses & Stats' : tab}</h2></div>
                <div className="flex items-center gap-3">
                    {!isSoundEnabled && (
                        <button onClick={enableSound} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-all bg-amber-100 border border-amber-200 text-amber-700 hover:bg-amber-200 hover:scale-105">
                            🔔 Activer Son
                        </button>
                    )}
                    {role === 'admin' && ( 
                        <>
                            <span className="text-xs font-bold text-gray-500 hidden md:inline-block">Freelance:</span>
                            <button onClick={async()=> {await saveSettings({...settings, freelanceEnabled: !settings?.freelanceEnabled}); showNotify("Freelance Maj ✅", "success");}} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all border ${settings?.freelanceEnabled ? 'bg-blue-100 text-blue-700 border-blue-300 shadow-blue-100' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>{settings?.freelanceEnabled ? <Check size={14}/> : <Minus size={14}/>} {settings?.freelanceEnabled ? 'Activé' : 'Désactivé'}</button>
                            
                            <span className="text-xs font-bold text-gray-500 hidden md:inline-block ml-4">Boutique:</span>
                            <button onClick={async()=> {await saveSettings({...settings, isOpen: !settings?.isOpen}); showNotify("Maj Boutique ✅", "success");}} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all border ${settings?.isOpen ? 'bg-green-100 text-green-700 border-green-300 shadow-green-100' : 'bg-red-100 text-red-700 border-red-300 shadow-red-100'}`}>{settings?.isOpen ? <Check size={14}/> : <Minus size={14}/>} {settings?.isOpen ? 'Ouvert' : 'Fermé'}</button>
                        </> 
                    )}
                </div>
            </header>

            <main className={`flex-1 ${tab === 'pos' ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8 pb-20'} bg-gray-50 relative`}>
                
                {tab === 'pos' && (
                    <PosDashboard 
                        settings={settings} 
                        brand={brand} 
                        db={db} 
                        appId={appId} 
                        showNotify={showNotify} 
                        managerBranchId={managerBranchId} 
                        isAdmin={role === 'admin'}
                        orders={orders}
                        updateStatus={updateStatus}
                        handleReassignOrder={handleReassignOrder}
                        onQuit={() => setTab('active')}
                        setTab={setTab}
                    />
                )}

                {tab==='active' && (
                    <div className="space-y-6 animate-in fade-in pb-4">
                        <AdminActiveOrders
                            pending={pending}
                            actives={actives}
                            brand={brand}
                            clientsList={clientsList}
                            updateStatus={handleUpdateStatus}
                            printTicket={printTicket}
                            handleReassignOrder={handleReassignOrder}
                            onlineDrivers={onlineDrivers}
                            db={db}
                            appId={appId}
                            showNotify={showNotify}
                        />
                    </div>
                )}

                {tab === 'standard' && (
                    <div className="space-y-6 animate-in fade-in pb-4 max-w-4xl">
                      <div className="flex bg-gray-200/60 p-1.5 rounded-xl border border-gray-200 shadow-inner mb-6 w-fit">
                          <button onClick={()=>setExtOrder({...extOrder, type: 'telephone'})} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${extOrder.type==='telephone'?'bg-blue-600 text-white shadow-md':'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}><Phone size={16}/> Standard Tél</button>
                          <button onClick={()=>setExtOrder({...extOrder, type: 'glovo'})} className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${extOrder.type==='glovo'?'bg-orange-500 text-white shadow-md':'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}><Truck size={16}/> Glovo Grahak</button>
                      </div>

                      {extOrder.type === 'telephone' && (
                        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 border-t-4 border-t-blue-500 flex flex-col gap-5">
                           <h3 className="font-bold text-gray-900 text-lg mb-2 flex items-center gap-3 border-b border-gray-100 pb-4"><div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Phone size={20}/></div> Saisir une nouvelle commande</h3>
                           <div className="grid grid-cols-1 gap-4">
                               <label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Numéro de Téléphone <span className="text-red-500">*</span></span><input className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" placeholder="06..." type="tel" value={extOrder.phone} onChange={e=>setExtOrder({...extOrder, phone: e.target.value.replace(/[^\d\s\+\-]/g, '')})} /></label>
                           </div>
                           <label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Adresse de Livraison</span><input className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" placeholder="Quartier, Rue, N° de maison..." value={extOrder.address} onChange={e=>setExtOrder({...extOrder, address: e.target.value})} /></label>
                           <label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Frais de Livraison (DH)</span><input className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" placeholder="Ex: 10" type="number" min="0" value={extOrder.deliveryFee || ''} onChange={e=>setExtOrder({...extOrder, deliveryFee: e.target.value})} /></label>
                           <label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Agence / Point de Vente <span className="text-red-500">*</span></span><select disabled={role === 'manager'} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer disabled:opacity-50 shadow-sm" value={extOrder.branchId} onChange={e=>setExtOrder({...extOrder, branchId: e.target.value})}><option value="">Sélectionner une agence...</option>{(settings?.branches || DEFAULT_BRANCHES).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                           
                           <div className="block mt-2">
                              <div className="flex justify-between items-center mb-3"><span className="text-xs font-medium text-gray-700 block">Détails de la Commande <span className="text-red-500">*</span></span><button onClick={()=>setShowExtMenu(!showExtMenu)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-gray-200">{showExtMenu ? 'Cacher le Menu' : 'Ajouter un produit'}</button></div>
                              <div className={`transition-all overflow-hidden ${showExtMenu ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}><div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-wrap gap-2 overflow-y-auto max-h-60 no-scrollbar shadow-sm">{(settings?.menuItems || DEFAULT_MENU_ITEMS).map(item => (<button key={item.id} disabled={item.outOfStock} onClick={() => { if (item.removableIngredients || item.hasVariations) { setSelectedExtItem(item); setExtItemOptions([]); setExtSelectedVariation(item.hasVariations && item.variations?.length > 0 ? item.variations[0] : null); } else { addExtCart({...item, cartItemId: item.id + '_default'}); } }} className={`bg-gray-50 px-3 py-2 rounded-md border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-all flex items-center gap-2 ${item.outOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}><span>{item.img?.startsWith('http') ? '🍔' : item.img}</span> {item.name || ''} {item.hasVariations && <span className="text-[9px] text-blue-500 font-bold ml-1">(Tailles)</span>} <span className="text-gray-900 font-semibold ml-auto">{item.price} DH</span></button>))}</div></div>
                              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 min-h-[100px] shadow-inner">{extCart.length === 0 ? (<p className="text-sm font-medium text-blue-400 flex items-center justify-center h-full min-h-[80px]">Le panier est vide pour le moment.</p>) : (<div className="space-y-3">{extCart.map(item => (<div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow"><div className="flex flex-col"><span className="text-sm font-bold text-gray-900">{(item.name || '').split(' (Sans ')[0] || ''}</span>{(item.name || '').includes(' (Sans ') && (item.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, idx) => <span key={idx} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-bold mt-1 w-fit uppercase">- Sans {opt}</span>)}</div><div className="flex items-center gap-4"><span className="text-base font-black text-blue-600">{item.price * item.qty} DH</span><div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200"><button onClick={() => removeExtCart(item)} className="w-7 h-7 bg-white hover:bg-gray-100 rounded-md text-gray-600 shadow-sm flex items-center justify-center font-bold">-</button><span className="text-sm font-black w-5 text-center">{item.qty}</span><button onClick={() => addExtCart(item)} className="w-7 h-7 bg-white hover:bg-gray-100 rounded-md text-gray-600 shadow-sm flex items-center justify-center font-bold">+</button></div></div></div>))}</div>)}</div>
                           </div>
                           <div className="flex items-center justify-between mt-6 p-5 bg-gradient-to-r from-gray-50 to-blue-50/30 rounded-xl border border-gray-200 shadow-sm">
                              <span className="text-sm font-bold text-gray-600 uppercase tracking-widest">Total à Payer</span>
                              <span className="text-3xl font-black text-gray-900">{extTotal + (Number(extOrder.deliveryFee) || 0)} <span className="text-lg text-gray-500">DH</span></span>
                           </div>
                           <button onClick={handleStandardOrder} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-blue-500/30 mt-4 flex items-center justify-center gap-3 transition-all hover:-translate-y-0.5 active:translate-y-0"><MessageCircle size={20}/> Créer & Envoyer WhatsApp</button>
                           
                           {/* Modal Options "Sans" pour Standard Tél */}
                           {selectedExtItem && (
                             <div className="fixed inset-0 bg-black/60 z-[300] flex items-end md:items-center justify-center animate-in fade-in" onClick={() => setSelectedExtItem(null)}>
                               <div className="bg-white w-full md:w-[400px] rounded-t-2xl md:rounded-xl p-6 flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-10 shadow-2xl" onClick={e => e.stopPropagation()}>
                                 <div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-lg text-gray-900">Personnaliser</h3><button onClick={() => setSelectedExtItem(null)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"><X size={18}/></button></div>
                                 
                                 <div className="flex-1 overflow-y-auto mb-6">
                                   {selectedExtItem.hasVariations && selectedExtItem.variations?.length > 0 && (
                                     <div className="mb-6">
                                       <p className="text-sm font-medium text-gray-600 mb-3">Taille / Variante <span className="text-red-500">*</span></p>
                                       <div className="space-y-2">
                                         {selectedExtItem.variations.map((v, idx) => (
                                           <label key={idx} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${extSelectedVariation?.name === v.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                               <div className="flex items-center gap-3">
                                                   <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${extSelectedVariation?.name === v.name ? 'border-blue-500' : 'border-gray-300'}`}>{extSelectedVariation?.name === v.name && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}</div>
                                                   <span className="font-medium text-sm text-gray-900">{v.name}</span>
                                               </div>
                                               <span className="font-semibold text-blue-600">{v.price} DH</span>
                                               <input type="radio" className="hidden" name="extvariation" checked={extSelectedVariation?.name === v.name} onChange={() => setExtSelectedVariation(v)} />
                                           </label>
                                         ))}
                                       </div>
                                     </div>
                                   )}

                                   {selectedExtItem.removableIngredients && (
                                     <div>
                                       <p className="text-sm font-medium text-gray-600 mb-3">Ingrédients à retirer :</p>
                                       <div className="space-y-2">
                                         {(selectedExtItem.removableIngredients || '').split(',').map(ing => {
                                     const ingredient = ing.trim(); if (!ingredient) return null;
                                     const isRemoved = extItemOptions.includes(ingredient);
                                     return ( <button key={ingredient} onClick={() => { if (isRemoved) setExtItemOptions(extItemOptions.filter(o => o !== ingredient)); else setExtItemOptions([...extItemOptions, ingredient]); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm font-medium ${isRemoved ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}><span>Sans {ingredient}</span><div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isRemoved ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>{isRemoved && <Check size={14} color="white" strokeWidth={4} />}</div></button> );
                                   })}
                                       </div>
                                     </div>
                                   )}
                                 </div>
                                 <button onClick={() => { if (selectedExtItem.hasVariations && !extSelectedVariation) return showNotify("Veuillez choisir une taille !", "error"); const optionsSuffix = extItemOptions.length > 0 ? '_' + extItemOptions.join('_') : '_default'; const varSuffix = extSelectedVariation ? '_' + extSelectedVariation.name.replace(/\s+/g, '') : ''; const cartItemId = selectedExtItem.id + varSuffix + optionsSuffix; const finalPrice = extSelectedVariation ? Number(extSelectedVariation.price || 0) : Number(selectedExtItem.price || 0); const varNamePart = extSelectedVariation ? ` (${extSelectedVariation.name})` : ''; const sansNamePart = extItemOptions.length > 0 ? ` (Sans ${extItemOptions.join(', ')})` : ''; const finalName = selectedExtItem.name + varNamePart + sansNamePart; const existingItem = extCart.find(c => (c.cartItemId || c.id) === cartItemId); if (existingItem) { setExtCart(extCart.map(c => (c.cartItemId || c.id) === cartItemId ? { ...c, qty: c.qty + 1 } : c)); } else { setExtCart([...extCart, { ...selectedExtItem, qty: 1, cartItemId, name: finalName, price: finalPrice }]); } setSelectedExtItem(null); showNotify("Produit ajouté ! 🍔", "success"); }} className="w-full py-3 rounded-lg font-medium text-sm text-white shadow-sm bg-blue-600 hover:bg-blue-700 mt-4">Valider • {extSelectedVariation ? extSelectedVariation.price : selectedExtItem.price} DH</button>
                               </div>
                             </div>
                           )}
                        </div>
                      )}

                      {extOrder.type === 'glovo' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
                           <h3 className="font-semibold text-gray-900 text-base mb-2 flex items-center gap-2 border-b border-gray-100 pb-3"><Truck size={16} className="text-gray-500"/> Convertir Client Glovo</h3>
                           <div className="grid grid-cols-1 gap-4"><label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Numéro de Téléphone <span className="text-red-500">*</span></span><input className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" placeholder="06..." type="tel" value={extOrder.phone} onChange={e=>setExtOrder({...extOrder, phone: e.target.value.replace(/[^\d\s\+\-]/g, '')})} /></label></div>
                           <button onClick={handleGlovoInvite} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium text-sm shadow-sm mt-2 flex items-center justify-center gap-2 transition-all"><MessageCircle size={18}/> Envoyer WhatsApp Invitation</button>
                        </div>
                      )}
                    </div>
                )}

                {tab === 'maps' && (
                   <div className="space-y-6 animate-in fade-in pb-4">
                       <div className="flex justify-between items-center bg-gradient-to-r from-white to-blue-50/50 p-6 rounded-3xl border border-blue-100 shadow-sm">
                           <div className="flex items-center gap-4">
                               <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl"><Users size={32}/></div>
                               <div>
                                   <p className="text-blue-600 text-xs font-black uppercase tracking-widest mb-1">En Ligne Actuellement</p>
                                   <p className="text-4xl font-black text-gray-900">{(onlineDrivers||[]).filter(d => isDriverOnline(d)).length} <span className="text-lg font-bold text-gray-500">Livreurs actifs</span></p>
                               </div>
                           </div>
                           <button onClick={handleWakeUpDrivers} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
                               <Navigation size={18}/> Wake Up GPS
                           </button>
                       </div>
                       
                       {/* Carte Live Map SaaS */}
                       <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white p-2">
                           <AdminMap 
                               onlineDrivers={(onlineDrivers||[]).filter(d => isDriverOnline(d) && d.lat && d.lng).map(d => ({
                                   ...d,
                                   isFreelance: (clientsList||[]).find(c => c.uid === d.uid || c.phone === d.phone)?.isFreelance
                               }))} 
                               branches={settings?.branches || DEFAULT_BRANCHES} 
                           />
                       </div>
                       
                       {/* Alert info GPS */}
                       {(onlineDrivers||[]).filter(d => isDriverOnline(d) && (!d.lat || !d.lng)).length > 0 && (
                           <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3">
                               <AlertTriangle className="text-orange-500 shrink-0" size={20} />
                               <div>
                                   <h4 className="text-orange-800 font-bold text-sm">Livreurs sans GPS</h4>
                                   <p className="text-orange-700 text-xs mt-1">Certains livreurs sont en ligne mais n'apparaissent pas sur la carte car ils n'ont pas encore autorisé la position GPS ou le navigateur bloque l'accès.</p>
                               </div>
                           </div>
                       )}
                   </div>
                )}

                {tab === 'drivers' && (
                   <div className="space-y-6 animate-in fade-in pb-4">
                       <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4"><Truck size={16} className="text-blue-500"/> Suivi Détaillé des Livreurs en Ligne</h3>
                       
                       <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                           <div className="overflow-x-auto">
                               <table className="w-full text-left border-collapse min-w-[800px]">
                                   <thead>
                                       <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-500">
                                           <th className="px-6 py-4 font-bold">Livreur</th>
                                           <th className="px-6 py-4 font-bold">Statut & Activité</th>
                                           <th className="px-6 py-4 font-bold">Dernière Position (GPS)</th>
                                           <th className="px-6 py-4 font-bold">Total Livraisons</th>
                                           <th className="px-6 py-4 font-bold text-right">Actions</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-100 text-sm">
                                       {(clientsList||[]).filter(c => c.isDriver === true && (onlineDrivers||[]).some(od => (od.uid === c.uid || (od.phone && od.phone === c.id)) && isDriverOnline(od))).length === 0 ? (
                                           <tr>
                                               <td colSpan="5" className="py-16 text-center text-gray-400">
                                                   <Truck size={40} className="mx-auto mb-3 opacity-20"/>
                                                   <p className="font-semibold text-sm">Aucun livreur n'est en ligne pour le moment 😴</p>
                                               </td>
                                           </tr>
                                       ) : (clientsList||[]).filter(c => c.isDriver === true).map(c => {
                                           const onlineData = (onlineDrivers||[]).find(od => (od.uid === c.uid || (od.phone && od.phone === c.id)) && isDriverOnline(od)); 
                                           if (!onlineData) return null;
                                           const isOnline = true; 
                                           const isAvailable = onlineData.isAvailable; 
                                           const driverTotalOrders = safeOrders.filter(o => o.driverId === c.uid && o.status === 'delivered').length;
                                           
                                           let isGpsOutdated = false;
                                           if (isOnline) {
                                               const lastUpdate = onlineData.updatedAt?.seconds ? onlineData.updatedAt.seconds * 1000 : now;
                                               isGpsOutdated = (!onlineData.lat || !onlineData.lng) || (now - lastUpdate > 5 * 60 * 1000);
                                           }
                                           
                                           let locationText = "Mamsajlach f l'GPS"; 
                                           let mapLink = null; 
                                           if (isOnline && onlineData.lat && onlineData.lng) { 
                                               const nearest = getClosestBranch(onlineData.lat, onlineData.lng, settings?.branches || DEFAULT_BRANCHES); 
                                               locationText = `${nearest.distance} km mn ${nearest.name || ''}`; 
                                               mapLink = `https://maps.google.com/?q=${onlineData.lat},${onlineData.lng}`; 
                                           }
                                           
                                           const joinDate = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
                                           const isNewDriver = joinDate ? (Date.now() - joinDate.getTime()) < 48 * 60 * 60 * 1000 : false;
                                           
                                           return (
                                               <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${isNewDriver ? 'bg-purple-50/30' : ''}`}>
                                                   <td className="px-6 py-4">
                                                       <div className="flex items-center gap-3">
                                                           <div className="relative">
                                                               <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white bg-gray-800 shrink-0 shadow-sm">
                                                                   {c.name ? c.name[0].toUpperCase() : <User size={16}/>}
                                                               </div>
                                                               <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${isOnline ? (isAvailable ? 'bg-green-500' : 'bg-orange-500') : 'bg-red-500'}`}></div>
                                                           </div>
                                                           <div className="flex flex-col">
                                                               <span className="font-bold text-gray-900 flex items-center gap-1.5">{c.name || 'Inconnu'} {isGpsOutdated && <span title="Mochkil f l'GPS" className="cursor-help text-xs">⚠️</span>}</span>
                                                               <span className="text-[10px] text-gray-500 font-mono">{c.phone || ''}</span>
                                                           </div>
                                                       </div>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       <div className="flex flex-col gap-1.5 items-start">
                                                           <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${c.isFreelance ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                               {c.isFreelance ? 'Freelance' : 'Officiel'}
                                                           </span>
                                                           {isOnline ? (
                                                               isAvailable ? <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">✅ Dispo (Kitsenna)</span> : <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">🛵 Occupé (F Tri9)</span>
                                                           ) : <span className="text-[10px] font-semibold text-red-500">❌ Hors Ligne</span>}
                                                       </div>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5"><MapIcon size={14} className="text-gray-400"/> {locationText}</span>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md border border-green-100">{driverTotalOrders} Livraisons</span>
                                                   </td>
                                                   <td className="px-6 py-4 text-right">
                                                       {mapLink ? (
                                                           <a href={mapLink} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200" title="Voir sur Maps">
                                                               <MapIcon size={16}/>
                                                           </a>
                                                       ) : (
                                                           <span className="text-xs text-gray-400 italic">Pas de GPS</span>
                                                       )}
                                                   </td>
                                               </tr>
                                           );
                                       })}
                                   </tbody>
                               </table>
                           </div>
                       </div>
                   </div>
                )}

                {tab === 'avis' && role === 'admin' && (() => {
                   const ratedOrders = safeOrders.filter(o => o.rating);
                   const totalAvis = ratedOrders.length;
                   const avgResto = totalAvis ? (ratedOrders.reduce((sum, o) => sum + o.rating.restaurant, 0) / totalAvis).toFixed(1) : 0;
                   const avgDriver = totalAvis ? (ratedOrders.reduce((sum, o) => sum + o.rating.driver, 0) / totalAvis).toFixed(1) : 0;

                   let filteredAvis = [...ratedOrders].sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
                   if (avisFilter === 'good') filteredAvis = filteredAvis.filter(o => o.rating.restaurant >= 4 && o.rating.driver >= 4);
                   if (avisFilter === 'bad') filteredAvis = filteredAvis.filter(o => o.rating.restaurant <= 3 || o.rating.driver <= 3);
                   if (avisFilter === 'comments') filteredAvis = filteredAvis.filter(o => o.rating.comment && o.rating.comment.trim() !== '');

                   return (
                   <div className="space-y-6 animate-in fade-in pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
                          <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100 shadow-md"><p className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-2">Total Avis</p><p className="text-4xl font-black text-indigo-900">{totalAvis}</p></div>
                          <div className="bg-gradient-to-br from-yellow-50 to-white p-6 rounded-2xl border border-yellow-100 shadow-md"><p className="text-xs font-bold text-yellow-800 uppercase tracking-widest mb-2">Moyenne Resto</p><p className="text-4xl font-black text-gray-900 flex items-baseline gap-2">{avgResto} <span className="text-2xl text-yellow-500 mb-1 drop-shadow-sm">★</span></p></div>
                          <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100 shadow-md"><p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2">Moyenne Livreur</p><p className="text-4xl font-black text-gray-900 flex items-baseline gap-2">{avgDriver} <span className="text-2xl text-blue-500 mb-1 drop-shadow-sm">★</span></p></div>
                      </div>

                      <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-sm mb-6 w-fit">
                          <button onClick={()=>setAvisFilter('all')} className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${avisFilter==='all'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Tous</button>
                          <button onClick={()=>setAvisFilter('good')} className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${avisFilter==='good'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Positifs (4-5★)</button>
                          <button onClick={()=>setAvisFilter('bad')} className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${avisFilter==='bad'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Négatifs (1-3★)</button>
                          <button onClick={()=>setAvisFilter('comments')} className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${avisFilter==='comments'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Commentaires</button>
                      </div>

                      <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {filteredAvis.map(o => {
                          const dName = o.driverName || (clientsList||[]).find(c => c.uid === o.driverId || c.phone === o.driverId)?.name || 'Inconnu';
                          const isBad = o.rating.restaurant <= 3 || o.rating.driver <= 3;
                          return (
                          <div key={o.id} className={`bg-white p-4 rounded-lg border ${isBad ? 'border-red-300' : 'border-gray-200'} shadow-sm flex flex-col gap-3 relative transition-all hover:shadow-md`}>
                             {isBad && <div className="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-lg"></div>}
                             <div className="flex justify-between items-start border-b border-gray-100 pb-2"><div><p className="font-semibold text-sm text-gray-900">{o.name || o.customerName || o.phone}</p><p className="text-xs text-gray-500 mt-0.5">#{o.orderNumber || o.id.slice(-4).toUpperCase()} • {o.createdAt?.seconds ? new Date(o.createdAt.seconds*1000).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '--'}</p></div></div>
                             <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-md border border-gray-100"><div><p className="text-xs font-medium text-gray-500 mb-0.5">Restaurant</p><p className={`text-base ${o.rating.restaurant <= 3 ? 'text-red-500' : 'text-yellow-500'}`}>{'★'.repeat(o.rating.restaurant)}<span className="text-gray-300">{'★'.repeat(5-o.rating.restaurant)}</span></p><p className="text-[10px] text-gray-500 mt-0.5 truncate" title={o.nearestBranch?.name}>📍 {o.nearestBranch?.name || ''}</p></div><div className="border-l border-gray-200 pl-3"><p className="text-xs font-medium text-gray-500 mb-0.5">Livreur</p><p className={`text-base ${o.rating.driver <= 3 ? 'text-red-500' : 'text-blue-500'}`}>{'★'.repeat(o.rating.driver)}<span className="text-gray-300">{'★'.repeat(5-o.rating.driver)}</span></p><p className="text-[10px] text-gray-500 mt-0.5 truncate" title={dName}>🛵 {dName}</p></div></div>
                             {o.rating.comment && <p className={`text-sm p-2.5 rounded-md italic mt-1 border-l-2 ${isBad ? 'bg-red-50 text-red-800 border-red-400' : 'bg-gray-50 text-gray-700 border-gray-300'}`}>"{o.rating.comment}"</p>}
                          </div>
                      )})}
                      </div>
                      {filteredAvis.length === 0 && <div className="py-20 text-center text-gray-400 flex flex-col items-center"><Star size={40} className="mb-2 opacity-50"/><p className="font-medium text-sm">Aucun avis trouvé.</p></div>}
                   </div>
                )})()}

                {tab==='history' && (
                    <AdminHistory
                        f={f} setF={setF}
                        historyDriverFilter={historyDriverFilter} setHistoryDriverFilter={setHistoryDriverFilter}
                        totalCollecte={totalCollecte} totalGainsLivreur={totalGainsLivreur} aRendre={aRendre}
                        filteredHistory={filteredHistory}
                        clientsList={clientsList}
                        expandedOrder={expandedOrder} setExpandedOrder={setExpandedOrder}
                        brand={brand}
                        role={role}
                    />
                )}

                {tab === 'analytics' && role === 'admin' && (() => {
                   let deliveredOrders = safeOrders.filter(o => o.status === 'delivered');
                   
                   if (analyticsBranch !== 'all') {
                       deliveredOrders = deliveredOrders.filter(o => o.nearestBranch?.id === analyticsBranch);
                   }

                   if (analyticsPeriod !== 'all') {
                       deliveredOrders = deliveredOrders.filter(o => {
                           let d = '';
                           if (o.deliveredAtLocal) { d = getL(new Date(o.deliveredAtLocal)); }
                           else if (o.createdAt && o.createdAt.seconds) { d = getL(new Date(o.createdAt.seconds * 1000)); }
                           if (analyticsPeriod === 'today') return d === today;
                           if (analyticsPeriod === 'yesterday') return d === yesterday;
                           return d === analyticsPeriod;
                       });
                   }

                   const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                   
                   const productCount = {};
                   deliveredOrders.forEach(o => {
                       (o.items || []).forEach(item => {
                           const baseName = (item.name || '').split(' (Sans ')[0];
                           productCount[baseName] = (productCount[baseName] || 0) + item.qty;
                       });
                   });
                   const topProducts = Object.entries(productCount).sort((a,b) => b[1] - a[1]).slice(0, 5);

                   const driverCount = {};
                   deliveredOrders.forEach(o => {
                       if (o.driverId) {
                           driverCount[o.driverId] = (driverCount[o.driverId] || 0) + 1;
                       }
                   });
                   const topDrivers = Object.entries(driverCount)
                       .map(([id, count]) => {
                           const d = (clientsList||[]).find(c => c.uid === id || c.id === id || c.phone === id);
                           return { name: d?.name || 'Inconnu', count, isFreelance: d?.isFreelance };
                       })
                       .sort((a,b) => b.count - a.count).slice(0, 5);

                   const clientCount = {};
                   deliveredOrders.forEach(o => {
                       const id = o.phone || o.userId || 'Inconnu';
                       clientCount[id] = clientCount[id] || { count: 0, name: o.customerName || o.name || o.phone || id, phone: o.phone || '', totalSpent: 0 };
                       clientCount[id].count += 1;
                       clientCount[id].totalSpent += (Number(o.total) || 0);
                   });
                   const topClients = Object.values(clientCount).sort((a,b) => b.count - a.count).slice(0, 5);

                   return (
                       <div className="space-y-6 animate-in fade-in pb-4">
                           <div className="flex items-center gap-3 mb-4 border-b border-gray-200 pb-4">
                               <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={24} strokeWidth={2}/></div>
                               <div><h2 className="text-xl font-semibold text-gray-900">Analyses & Statistiques</h2><p className="text-xs text-gray-500">Performances globales du restaurant</p></div>
                           </div>

                           <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                               <select value={analyticsBranch} onChange={e=>setAnalyticsBranch(e.target.value)} className="flex-1 bg-white p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm cursor-pointer appearance-none text-center">
                                   <option value="all">Toutes Agences</option>
                                   {(settings?.branches || DEFAULT_BRANCHES).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                               </select>
                               <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 flex-[1.5]">
                                   <button onClick={()=>setAnalyticsPeriod('today')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsPeriod==='today'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Aujourd'hui</button>
                                   <button onClick={()=>setAnalyticsPeriod('yesterday')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsPeriod==='yesterday'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Hier</button>
                                   <button onClick={()=>setAnalyticsPeriod('all')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsPeriod==='all'?'bg-white text-gray-900 shadow-sm border border-gray-200':'text-gray-500 hover:text-gray-700'}`}>Toujours</button>
                               </div>
                               <input type="date" value={!['today','yesterday','all'].includes(analyticsPeriod) ? analyticsPeriod : ''} onChange={e=>setAnalyticsPeriod(e.target.value || 'all')} className="flex-1 bg-white p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm" />
                           </div>

                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                               <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-2xl border border-green-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                                   <div className="absolute -right-4 -top-4 opacity-5 text-green-500 group-hover:scale-110 transition-transform duration-500"><DollarSign size={100}/></div>
                                   <div className="flex justify-between items-start mb-4"><p className="text-xs font-bold text-green-800 uppercase tracking-widest">Chiffre d'Affaires</p><div className="p-2 bg-green-100 rounded-lg text-green-600"><DollarSign size={20}/></div></div>
                                   <p className="text-3xl font-black text-gray-900">{totalRevenue} <span className="text-sm font-bold text-gray-500">DH</span></p>
                               </div>
                               <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                                   <div className="absolute -right-4 -top-4 opacity-5 text-blue-500 group-hover:scale-110 transition-transform duration-500"><ShoppingBag size={100}/></div>
                                   <div className="flex justify-between items-start mb-4"><p className="text-xs font-bold text-blue-800 uppercase tracking-widest">Cmds Livrées</p><div className="p-2 bg-blue-100 rounded-lg text-blue-600"><ShoppingBag size={20}/></div></div>
                                   <p className="text-2xl font-bold text-gray-900">{deliveredOrders.length}</p>
                               </div>
                               <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border border-purple-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                                   <div className="absolute -right-4 -top-4 opacity-5 text-purple-500 group-hover:scale-110 transition-transform duration-500"><BarChart3 size={100}/></div>
                                   <div className="flex justify-between items-start mb-4"><p className="text-xs font-bold text-purple-800 uppercase tracking-widest">Panier Moyen</p><div className="p-2 bg-purple-100 rounded-lg text-purple-600"><BarChart3 size={20}/></div></div>
                                   <p className="text-3xl font-black text-gray-900">{deliveredOrders.length ? Math.round(totalRevenue / deliveredOrders.length) : 0} <span className="text-sm font-bold text-gray-500">DH</span></p>
                               </div>
                               <div className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-2xl border border-orange-100 shadow-md relative overflow-hidden group hover:shadow-lg transition-all">
                                   <div className="absolute -right-4 -top-4 opacity-5 text-orange-500 group-hover:scale-110 transition-transform duration-500"><Users size={100}/></div>
                                   <div className="flex justify-between items-start mb-4"><p className="text-xs font-bold text-orange-800 uppercase tracking-widest">Total Clients</p><div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Users size={20}/></div></div>
                                   <p className="text-2xl font-bold text-gray-900">{Object.keys(clientCount).length}</p>
                               </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                   <h3 className="font-semibold text-sm text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><Utensils size={16} className="text-gray-400"/> Top Produits</h3>
                                   <div className="space-y-1">
                                       {topProducts.map(([name, count], i) => (
                                           <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                               <div className="flex items-center gap-3">
                                                   <span className="font-medium text-gray-400 text-sm w-4">{i+1}.</span>
                                                   <span className="text-sm font-medium text-gray-800">{name}</span>
                                               </div>
                                               <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{count}x</span>
                                           </div>
                                       ))}
                                       {topProducts.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune donnée</p>}
                                   </div>
                               </div>

                               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                   <h3 className="font-semibold text-sm text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><Truck size={16} className="text-gray-400"/> Top Livreurs</h3>
                                   <div className="space-y-1">
                                       {topDrivers.map((d, i) => (
                                           <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                               <div className="flex items-center gap-3">
                                                   <span className="font-medium text-gray-400 text-sm w-4">
                                                       {i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}
                                                   </span>
                                                   <div className="flex flex-col">
                                                       <span className="text-sm font-medium text-gray-800">{d.name}</span>
                                                       <span className="text-[10px] font-medium text-gray-400">{d.isFreelance ? 'Freelance' : 'Officiel'}</span>
                                                   </div>
                                               </div>
                                               <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">{d.count} cmds</span>
                                           </div>
                                       ))}
                                       {topDrivers.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune donnée</p>}
                                   </div>
                               </div>

                               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                   <h3 className="font-semibold text-sm text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><Award size={16} className="text-gray-400"/> Clients Fidèles</h3>
                                   <div className="space-y-1">
                                       {topClients.map((c, i) => (
                                           <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                               <div className="flex items-center gap-3">
                                                   <span className="font-medium text-gray-400 text-sm w-4">{i+1}.</span>
                                                   <div className="flex flex-col w-[110px]">
                                                       <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                                                       <span className="text-[10px] font-medium text-gray-400 truncate">{c.phone}</span>
                                                   </div>
                                               </div>
                                               <div className="flex flex-col items-end">
                                                   <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md mb-1">{c.count} cmds</span>
                                                   <span className="text-[10px] font-medium text-gray-400">{c.totalSpent} DH</span>
                                               </div>
                                           </div>
                                       ))}
                                       {topClients.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune donnée</p>}
                                   </div>
                               </div>
                           </div>
                       </div>
                   );
                })()}

                {tab==='clients' && (
                    <AdminClients
                        f={f} setF={setF}
                        role={role}
                        clientSubTab={clientSubTab} setClientSubTab={setClientSubTab}
                        clientsList={clientsList} safeOrders={safeOrders}
                        db={db} appId={appId} showNotify={showNotify}
                        handleExportCSV={handleExportCSV}
                        showAddDriver={showAddDriver} setShowAddDriver={setShowAddDriver}
                        newDriver={newDriver} setNewDriver={setNewDriver}
                        handleAddDriverSubmit={handleAddDriverSubmit}
                    />
                )}

                {tab === 'config' && role === 'admin' && (
                    <AdminConfig
                        brand={brand} setBrand={setBrand}
                        settings={settings} saveSettings={saveSettings}
                        editableMenu={editableMenu} setEditableMenu={setEditableMenu}
                        editableBranches={editableBranches} setEditableBranches={setEditableBranches}
                        configTab={configTab} setConfigTab={setConfigTab}
                        activeEditZone={activeEditZone} setActiveEditZone={setActiveEditZone}
                        db={db} appId={appId} showNotify={showNotify}
                    />
                )}

            </main>
        </div>
      </div>
    );
}