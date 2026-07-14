import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, CheckCircle, ChefHat, AlertTriangle, CheckSquare, BellRing, Printer, ArrowLeft, History, X, RotateCcw, Timer, ClipboardList, Thermometer, Flame, PackageX, Layers, AlignJustify, Volume2, Minus, Monitor, Type, ChevronUp, ChevronDown } from 'lucide-react';
import { doc, updateDoc, setDoc, collection, query, where, orderBy, limit, getDocs, startAfter, onSnapshot, arrayUnion } from 'firebase/firestore';
import { db, appId } from '../../config/firebase';
import { formatSansIngredient } from '../../utils/helpers';
import LiveTimer from '../LiveTimer';
import { io } from 'socket.io-client';

const getGlovoName = (caisseName) => {
    const name = caisseName?.trim();
    const mapping = {
        "Bocadillo Thon": "Bocadillo Thon",
        "Bocadillo Tangérois": "Bocadillo Tangérois",
        "Bocadillo Cheese": "Bocadillio Cheese",
        "Bocadillo Complet (\u0634\u0645\u0627\u0644\u064A)": "Bocadillo Complet",
        "Tortillia Cheese": "Bocadillo Tortilla Cheese",
        "Sandwiche Poulet": "Sandwich Brochettes de Poulet",
        "Sandwiche Viande Hachée": "Sandwich Viande Hachée",
        "Sandwiche Saucisse": "Sandwich Saucisse de Bœuf",
        "Sandwiche Mixte": "Sandwich Mixte",
        "Sandwiche Américain": "Sandwiche Américain",
        "Toi et Moi": "Formule Toi et Moi",
        "Formule Gourmand": "Formule Gourmande",
        "Coca-Cola": "Coca-Cola",
        "Pepsi": "PEPSI",
        "Mirinda Pomme": "Mirinda Pomme",
        "7up": "7up",
        "Mirinda Orange": "Mirinda Orange",
        "Jus d'orange": "Jus d'Orange",
        "Eau 50 Cl": "Eau minérale",
        "Cornet de Frite": "\"Extra\" Frites",
        "Thon": "\"Extra\" Thon",
        "Charcuterie": "\"Extra\" Charcuterie",
        "Fromage": "\"Extra\" Fromage",
        "Oeuf": "\"Extra\" \u0152uf"
    };
    return mapping[name] || name;
};

export default function KitchenDashboard({ activeOrders, updateStatus, printTicket, brand, settings, profile }) {
    // État pour cocher/rayer les articles préparés individuellement
    const [checkedItems, setCheckedItems] = useState({});
    const [showHistory, setShowHistory] = useState(false);
    const [alertedOrders, setAlertedOrders] = useState(new Set());
    const [confirmReturn, setConfirmReturn] = useState(null); // Jdid: State dyal cadre confirmation
    const [newOrderNotify, setNewOrderNotify] = useState(false);
    const [showTotals, setShowTotals] = useState(false); // Jdid: State dyal résumé total
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const prevOrdersRef = useRef(new Set());

    // 🔥 Jdid: States dyal l-historique (Pagination 10 b 10)
    const [historyOrders, setHistoryOrders] = useState([]);
    const [lastHistoryDoc, setLastHistoryDoc] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    const [stationFilter, setStationFilter] = useState('ALL'); // ALL, CHAUD, FROID
    const [compactMode, setCompactMode] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState('');

    // 🔥 Jdid: Local WebSocket Server
    const [posLocalIp, setPosLocalIp] = useState(() => localStorage.getItem('posLocalIp') || 'localhost');
    const [showIpConfig, setShowIpConfig] = useState(false);
    const [localOrders, setLocalOrders] = useState([]);
    const [wsConnected, setWsConnected] = useState(false);
    const localSocketRef = useRef(null);

    // 🔥 Jdid: Font Settings pour KDS
    const [showFontConfig, setShowFontConfig] = useState(false);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [kdsFontSizes, setKdsFontSizes] = useState(() => {
        const saved = localStorage.getItem('kdsFontSizes');
        const parsed = saved ? JSON.parse(saved) : {};
        return { 
            principal: parsed.principal || 16, 
            sans: parsed.sans || 11, 
            extra: parsed.extra || 11,
            headerNum: parsed.headerNum || 30,
            headerTags: parsed.headerTags || 11,
            btnReady: parsed.btnReady || 12
        };
    });

    const updateKdsFontSize = (type, delta) => {
        setKdsFontSizes(prev => {
            const newVal = Math.max(8, Math.min(48, prev[type] + delta));
            const updated = { ...prev, [type]: newVal };
            localStorage.setItem('kdsFontSizes', JSON.stringify(updated));
            return updated;
        });
    };

    useEffect(() => {
        if (!posLocalIp) return;
        
        const socket = io(`http://${posLocalIp}:3001`, { transports: ['websocket', 'polling'] });
        localSocketRef.current = socket;

        socket.on('connect', () => setWsConnected(true));
        socket.on('disconnect', () => setWsConnected(false));
        
        socket.on('kds_new_order', (order) => {
            setLocalOrders(prev => {
                if (prev.some(o => o.id === order.id || o.orderNumber === order.orderNumber)) return prev;
                return [...prev, order];
            });
        });

        socket.on('kds_status_updated', (data) => {
            if (data.status === 'ready' || data.status === 'delivered') {
                setLocalOrders(prev => prev.filter(o => o.id !== data.id && o.orderNumber !== data.orderNumber));
            } else {
                setLocalOrders(prev => prev.map(o => (o.id === data.id || o.orderNumber === data.orderNumber) ? { ...o, status: data.status } : o));
            }
        });

        return () => {
            socket.disconnect();
            localSocketRef.current = null;
        };
    }, [posLocalIp]);

    useEffect(() => {
        if (!selectedBranchId) {
            if (profile?.isAdmin) {
                setSelectedBranchId('ALL');
            } else if (profile?.managerBranchId) {
                setSelectedBranchId(profile.managerBranchId);
            } else {
                setSelectedBranchId('ALL');
            }
        }
    }, [profile, selectedBranchId]);

    // 🔥 Webrtc Spy Listener (Microphone Silencieux pour KDS Cuisine)
    useEffect(() => {
        if (!selectedBranchId || selectedBranchId === 'ALL') return;
        const targetId = `kds_${selectedBranchId}`;
        let pc = null;
        let localStream = null;
        let addedTargetCandidates = new Set();

        const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();

            if (data.status === 'calling' && data.offer && !pc) {
                try {
                    addedTargetCandidates.clear();
                    localStream = await navigator.mediaDevices.getUserMedia({ 
                        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                    });
                    
                    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), {
                                targetCandidates: arrayUnion(event.candidate.toJSON())
                            }).catch(() => {});
                        }
                    };

                    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), {
                        answer: { type: answer.type, sdp: answer.sdp },
                        status: 'answered'
                    });
                } catch (err) { /* Secret tamma: Makayn ta console.error bach ta 7ed may3i9 */ }
            }

            if (pc && data.status === 'answered' && data.adminCandidates) {
                data.adminCandidates.forEach(async candidate => {
                    const candStr = JSON.stringify(candidate);
                    if (!addedTargetCandidates.has(candStr)) {
                        addedTargetCandidates.add(candStr);
                        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){}
                    }
                });
            }
            if (data.status === 'ended') {
                if (pc) { pc.close(); pc = null; }
                if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
            }
        });

        return () => {
            unsub();
            if (pc) { pc.close(); pc = null; }
            if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
        };
    }, [selectedBranchId, db, appId]);
    
    // Utilisation de useMemo pour éviter de recalculer les listes à chaque tick du timer ou autre state
    const { preparingOrders } = useMemo(() => {
        const preparingFirebase = (activeOrders || [])
            .filter(o => o.status === 'preparing' || o.status === 'pending')
            .filter(o => selectedBranchId === 'ALL' || o.nearestBranch?.id === selectedBranchId)
            .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            
        // Filtrer les doublons au cas où la commande est à la fois en local et sur firebase
        const fbIds = new Set(preparingFirebase.map(o => o.orderNumber));
        const preparingLocal = localOrders.filter(o => !fbIds.has(o.orderNumber));

        const allPreparing = [...preparingLocal, ...preparingFirebase].sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.offlineCreatedAt || Date.now());
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.offlineCreatedAt || Date.now());
            return timeA - timeB;
        });

        return { preparingOrders: allPreparing };
    }, [activeOrders, selectedBranchId, localOrders]);

    // Effet pour jouer un son de sonnette lors d'une nouvelle commande
    useEffect(() => {
        const currentIds = new Set(preparingOrders.map(o => o.id));
        const prevIds = prevOrdersRef.current;
        
        let hasNewOrder = false;
        currentIds.forEach(id => {
            if (!prevIds.has(id)) hasNewOrder = true;
        });
        
        if (hasNewOrder) {
            try {
                // Sonnette nouvelle commande (Bip court)
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(e => console.log("L'audio a été bloqué par le navigateur", e));
            } catch(e) {}
            setNewOrderNotify(true);
            setTimeout(() => setNewOrderNotify(false), 5000);
        }
        
        prevOrdersRef.current = currentIds;
    }, [preparingOrders]);

    // Extraction automatique du nmro de tlphone pour les commandes GoDroid Automator (Glovo)
    useEffect(() => {
        preparingOrders.forEach(async (order) => {
            if (order.source === 'glovo' && order.orderNote && !order.phone) {
                const phoneMatch = order.orderNote.match(/(?:0|\+212)\s?[567](?:\s?\d){8}/);
                if (phoneMatch) {
                    const extractedPhone = phoneMatch[0].replace(/\s+/g, '');
                    if (extractedPhone.length >= 10) {
                        try {
                            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id), {
                                phone: extractedPhone
                            });
                        } catch (e) {
                            console.error("Erreur auto-extraction tel", e);
                        }
                    }
                }
            }
        });
    }, [preparingOrders]);

    // Filtrage des items selon Froid / Chaud
    const isItemFroid = (item) => {
        if (item.station === 'FROID') return true;
        if (item.station === 'CHAUD') return false;
        const cat = (item.category || '').toLowerCase();
        return cat.includes('boisson') || cat.includes('dessert') || cat.includes('glace') || cat.includes('froid') || cat.includes('jus') || cat.includes('smoothie');
    };

    const enableSound = () => {
        setIsSoundEnabled(true);
        try {
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.volume = 0.01;
            audio.play().catch(() => {});
        } catch (e) {}
    };

    // 🔥 Jdid: Fonction bach nchargiw l-historique 10 b 10 à la demande
    const loadHistory = async (isLoadMore = false) => {
        setLoadingHistory(true);
        try {
            let constraints = [
                where('status', 'in', ['ready', 'out_for_delivery', 'delivered']),
                orderBy('createdAt', 'desc')
            ];
            if (selectedBranchId !== 'ALL') {
                constraints.push(where('nearestBranch.id', '==', selectedBranchId));
            }
            
            let q = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), ...constraints, limit(10));

            if (isLoadMore && lastHistoryDoc) {
                q = query(q, startAfter(lastHistoryDoc));
            }

            const snap = await getDocs(q);
            if (!snap.empty) {
                setLastHistoryDoc(snap.docs[snap.docs.length - 1]);
                const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                if (isLoadMore) setHistoryOrders(prev => [...prev, ...fetched]);
                else setHistoryOrders(fetched);
            }
        } catch (error) {
            console.error("Erreur lors du chargement de l'historique :", error);
        }
        setLoadingHistory(false);
    };

    const filteredPreparingOrders = useMemo(() => {
        return preparingOrders.map(o => ({
            ...o,
            filteredItems: (o.items || []).filter(i => stationFilter === 'ALL' ? true : (stationFilter === 'FROID' ? isItemFroid(i) : !isItemFroid(i)))
        })).filter(o => o.filteredItems.length > 0);
    }, [preparingOrders, stationFilter]);

    // Fonction pour rayer un plat spécifique
    const toggleItemCheck = (orderId, itemIndex) => {
        const key = `${orderId}_${itemIndex}`;
        setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Marquer toute la commande comme prête
    const markOrderAsReady = (orderId) => {
        const order = preparingOrders.find(o => o.id === orderId || o.orderNumber === orderId);
        if (order) {
            const createdMs = order.createdAt?.seconds ? order.createdAt.seconds * 1000 : (order.offlineCreatedAt || Date.now());
            const readyMs = Date.now();
            const prepTimeMinutes = Math.max(1, Math.round((readyMs - createdMs) / 60000)); // Minimum 1 min

            // Si c'est une commande locale (WiFi), on émet l'event au WebSocket
            if (localSocketRef.current && wsConnected && (order.source === 'pos' || order.orderType === 'sur_place' || order.orderType === 'a_emporter')) {
                localSocketRef.current.emit('update_local_status', { id: order.id, orderNumber: order.orderNumber, status: 'ready', prepTime: prepTimeMinutes });
                // On met à jour l'état local immédiatement
                setLocalOrders(prev => prev.filter(o => o.id !== orderId && o.orderNumber !== orderId));
            }
            
            // Toujours mettre à jour sur Firebase (pour l'écran TV et la caisse)
            updateStatus(order.id, 'ready', { prepTime: prepTimeMinutes }); 
        }
    };

    // Fonction pour lire la commande à haute voix (TTS)
    const readOrder = (order) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stoppe l'audio en cours s'il y en a un
            
            // Un petit délai (50ms) évite le bug de retard ou de blocage sur Chrome
            setTimeout(() => {
                const prefix = brand?.texts?.ttsNewOrder || 'Nouvelle commande';
                const text = `${prefix}. ` + (order.filteredItems || order.items || []).map(i => {
                    const itemName = (i.name || '').split(' (Sans')[0];
                    const sansParts = (i.name || '').split(' (Sans ');
                    const sans = sansParts.length > 1 ? ' ' + sansParts[1].replace(')', '').split(', ').map(opt => formatSansIngredient(opt)).join(', ') : '';
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
                
                utterance.rate = 1.2; // Vitesse accélérée pour éviter la sensation de lenteur
                window.speechSynthesis.speak(utterance);
            }, 50);
        } else {
            alert("La lecture audio n'est pas supportée sur ce navigateur.");
        }
    };

    const getSourceStyles = (source) => {
        if (source === 'pos') return {
            border: 'border-blue-500 hover:border-blue-400',
            bg: 'bg-blue-900/20',
            headerBg: 'bg-blue-600/30',
            headerBorder: 'border-blue-500/50',
            text: 'text-blue-300',
            label: 'CAISSE (POS)'
        };
        if (source === 'telephone') return {
            border: 'border-purple-500 hover:border-purple-400',
            bg: 'bg-purple-900/20',
            headerBg: 'bg-purple-600/30',
            headerBorder: 'border-purple-500/50',
            text: 'text-purple-300',
            label: 'TÉLÉPHONE'
        };
        if (source === 'glovo') return {
            border: 'border-[#FFC244]',
            bg: 'bg-yellow-900/20',
            headerBg: 'bg-[#FFC244]',
            headerBorder: 'border-black/20',
            text: '!text-[15px] text-black',
            label: (
                <svg className="h-[20px] inline-block -mt-1 drop-shadow-sm" viewBox=".06 .127 147.592 47.611" xmlns="http://www.w3.org/2000/svg">
                    <path d="m.06 31.102v-.092c0-9.057 7.04-16.727 16.946-16.727 4.929 0 8.214 1.154 11.219 3.28a2.866 2.866 0 0 1 1.174 2.31c0 1.526-1.267 2.82-2.864 2.82-.751 0-1.314-.324-1.784-.648-2.112-1.524-4.412-2.542-7.98-2.542-6.055 0-10.655 5.223-10.655 11.414v.093c0 6.654 4.459 11.552 11.172 11.552 3.098 0 5.914-.97 7.933-2.449v-6.053h-6.478c-1.409 0-2.581-1.062-2.581-2.448 0-1.387 1.172-2.496 2.581-2.496h9.154c1.642 0 2.91 1.248 2.91 2.866v8.64c0 1.617-.657 2.773-2.018 3.604-2.817 1.849-6.76 3.512-11.688 3.512-10.282-.001-17.041-7.208-17.041-16.636zm35.924-15.11c0-1.525 1.22-2.773 2.815-2.773 1.597 0 2.864 1.248 2.864 2.773v28.65c0 1.571-1.268 2.772-2.864 2.772-1.548 0-2.815-1.2-2.815-2.773v-28.65zm10.079 19.131v-.094c0-6.977 5.632-12.753 13.237-12.753 7.604 0 13.191 5.684 13.191 12.662v.091c0 6.933-5.633 12.709-13.285 12.709-7.558 0-13.143-5.684-13.143-12.615zm20.748 0v-.094c0-4.296-3.146-7.854-7.605-7.854-4.554 0-7.464 3.512-7.464 7.763v.091c0 4.252 3.145 7.81 7.558 7.81 4.6 0 7.51-3.512 7.51-7.716zm19.861 12.522h-.282c-1.548 0-2.582-.97-3.238-2.45l-8.26-18.622c-.142-.416-.33-.876-.33-1.386 0-1.386 1.267-2.68 2.816-2.68 1.548 0 2.346.878 2.816 2.034l6.384 16.172 6.478-16.264c.423-.971 1.173-1.942 2.676-1.942 1.549 0 2.769 1.156 2.769 2.68 0 .51-.187 1.064-.327 1.34l-8.262 18.669c-.66 1.432-1.69 2.45-3.24 2.45zm13.9-12.522v-.094c0-6.977 5.633-12.753 13.24-12.753 7.602 0 13.189 5.684 13.189 12.662v.091c0 6.933-5.633 12.709-13.285 12.709-7.557 0-13.144-5.684-13.144-12.615zm20.75 0v-.094c0-4.296-3.146-7.854-7.606-7.854-4.553 0-7.463 3.512-7.463 7.763v.091c0 4.252 3.144 7.81 7.558 7.81 4.599 0 7.51-3.512 7.51-7.716zm15.177-34.996c-6.15 0-11.153 4.927-11.153 10.98 0 2.306.728 4.52 2.103 6.402l.297.405 5.806 8.067s.709 1.14 2.254 1.14h1.387c1.546 0 2.252-1.14 2.252-1.14l5.808-8.067.294-.405a10.787 10.787 0 0 0 2.105-6.402c0-6.053-5.003-10.98-11.153-10.98zm4.59 14.222-.309.426-4.28 5.947-4.274-5.935-.314-.431a5.475 5.475 0 0 1 -1.074-3.249c0-3.073 2.54-5.573 5.66-5.573 3.122 0 5.661 2.5 5.661 5.573 0 1.165-.37 2.286-1.07 3.242zm-7.727 17.725v-.022c0-1.64 1.323-2.999 3.11-2.999 1.789 0 3.101 1.336 3.101 2.977v.022c0 1.628-1.324 2.986-3.122 2.986-1.775 0-3.09-1.335-3.09-2.964z" fill="#00a082" fillRule="evenodd"/>
                </svg>
            ),
            orderNumberText: 'text-black'
        };
        return {
            border: 'border-emerald-500 hover:border-emerald-400',
            bg: 'bg-emerald-900/20',
            headerBg: 'bg-emerald-600/30',
            headerBorder: 'border-emerald-500/50',
            text: 'text-emerald-300',
            label: 'APP CLIENT'
        };
    };

    return (
        <div className="min-h-[100dvh] text-neutral-100 p-4 md:p-6 lg:p-8 font-sans selection:bg-orange-500/30 w-full overflow-x-hidden" style={{ backgroundColor: brand.kdsBgColor || '#0a0a0a' }}>
            {/* Notification Nouvelle Commande */}
            {newOrderNotify && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] bg-green-500 text-white px-8 py-4 rounded-full shadow-[0_10px_40px_rgba(34,197,94,0.4)] font-black text-lg uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-top-5 fade-in duration-300">
                    <BellRing className="animate-bounce" size={24} />
                    Nouvelle Commande !
                </div>
            )}

            {/* Bouton pour afficher/masquer l'en-tête */}
            <div className="flex justify-center mb-2">
                <button 
                    onClick={() => setIsHeaderVisible(!isHeaderVisible)} 
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-400 p-1.5 rounded-full border border-neutral-700 shadow-sm transition-all"
                    title={isHeaderVisible ? "Masquer l'en-tête pour plus d'espace" : "Afficher l'en-tête"}
                >
                    {isHeaderVisible ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </button>
            </div>

            {/* En-tête du Dashboard KDS */}
            {isHeaderVisible && (
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b-2 border-neutral-900 animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="flex items-center gap-4">
                    <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg">
                        <ChefHat size={32} className="text-orange-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-white flex items-center gap-3">
                            {brand.texts?.kdsTitle || brand.name || 'Écran Cuisine (KDS)'}
                            {selectedBranchId && selectedBranchId !== 'ALL' && (
                                <span className="ml-2 text-sm text-neutral-400 uppercase tracking-widest hidden sm:inline-block">- KDS {(settings?.branches || []).find(b => b.id === selectedBranchId)?.name || ''}</span>
                            )}
                            </h1>
                            {profile?.isAdmin && (
                                <select 
                                    value={selectedBranchId} 
                                    onChange={e => setSelectedBranchId(e.target.value)}
                                    className="bg-neutral-800 text-white border border-neutral-700 px-3 py-1.5 rounded-lg text-sm font-bold outline-none"
                                >
                                    {(settings?.branches || []).map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            )}
                            
                            {/* 🔥 Jdid: Sélecteur du Chef (Staff Cuisine) supprimé selon la demande */}


                            {!isSoundEnabled && (
                                <button onClick={enableSound} className="animate-pulse bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-colors whitespace-nowrap ml-2">
                                    🔔 Activer Son
                                </button>
                            )}
                        </div>
                        <p className="text-sm font-bold text-neutral-500 mt-1 flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                            </span>
                            {filteredPreparingOrders.length} Commande(s) en cours de préparation
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center gap-2 w-full md:w-auto pb-2 md:pb-0">
                    <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-1 shrink-0 shadow-sm hidden md:flex">
                        <button onClick={() => setStationFilter('ALL')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-colors ${stationFilter === 'ALL' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 hover:text-white'}`}>Tout</button>
                        <button onClick={() => setStationFilter('CHAUD')} className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-colors flex items-center gap-1.5 ${stationFilter === 'CHAUD' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-neutral-500 hover:text-orange-400'}`}><Flame size={14}/> Chaud</button>
                        <button onClick={() => setStationFilter('FROID')} className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-colors flex items-center gap-1.5 ${stationFilter === 'FROID' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-neutral-500 hover:text-blue-400'}`}><Thermometer size={14}/> Froid</button>
                    </div>
                    <button onClick={() => setCompactMode(!compactMode)} className={`shrink-0 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-2 border border-neutral-800 transition-all shadow-sm ${compactMode ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-neutral-300 hover:text-white'}`} title="Mode Rush (Liste Compacte)">
                        {compactMode ? <AlignJustify size={18}/> : <Layers size={18}/>}
                    </button>
                    <button onClick={() => setShowStockModal(true)} className="shrink-0 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-red-400 px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-2 border border-neutral-800 transition-all shadow-sm" title="Rupture de Stock">
                        <PackageX size={18}/>
                    </button>
                    
                    {/* Bouton Config IP KDS */}
                    <button onClick={() => setShowIpConfig(!showIpConfig)} className={`shrink-0 px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-2 border transition-all shadow-sm whitespace-nowrap ${wsConnected ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`} title="Configurer IP Caisse">
                        <Monitor size={18}/> {wsConnected ? 'Lié (WiFi)' : 'Déconnecté'}
                    </button>
                    
                    {showIpConfig && (
                        <div className="absolute top-20 right-8 bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-xl z-50 animate-in fade-in slide-in-from-top-4">
                            <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest">Adresse IP de la Caisse</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={posLocalIp} 
                                    onChange={e => setPosLocalIp(e.target.value)} 
                                    className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white outline-none w-40 text-sm font-bold text-center placeholder-neutral-500" 
                                    placeholder="192.168..." 
                                />
                                <button onClick={() => { localStorage.setItem('posLocalIp', posLocalIp); setShowIpConfig(false); }} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors">OK</button>
                            </div>
                            <p className="text-[10px] text-neutral-500 mt-2 italic max-w-[200px]">Tapez 'localhost' si KDS est sur le même ordinateur, ou l'IP WiFi de la caisse.</p>
                        </div>
                    )}

                    {/* Bouton Taille de Police */}
                    <button onClick={() => setShowFontConfig(!showFontConfig)} className={`shrink-0 px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-2 border transition-all shadow-sm ${showFontConfig ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-neutral-900 text-neutral-300 hover:text-white border-neutral-800 hover:border-neutral-700'}`} title="Taille de Police">
                        <Type size={18}/>
                    </button>
                    {showFontConfig && (
                        <div className="absolute top-20 right-8 bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-xl z-50 animate-in fade-in slide-in-from-top-4 min-w-[250px]">
                            <label className="block text-xs font-bold text-neutral-400 mb-3 uppercase tracking-widest flex justify-between items-center">
                                Tailles de police
                                <button onClick={() => setShowFontConfig(false)} className="text-neutral-500 hover:text-white"><X size={14}/></button>
                            </label>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between bg-neutral-800 p-2 rounded-xl">
                                    <span className="text-xs font-bold text-white uppercase">Produits</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateKdsFontSize('principal', -1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">-</button>
                                        <span className="text-sm font-black text-orange-400 w-6 text-center">{kdsFontSizes.principal}</span>
                                        <button onClick={() => updateKdsFontSize('principal', 1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">+</button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-neutral-800 p-2 rounded-xl">
                                    <span className="text-xs font-bold text-red-400 uppercase">Sans</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateKdsFontSize('sans', -1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">-</button>
                                        <span className="text-sm font-black text-red-400 w-6 text-center">{kdsFontSizes.sans}</span>
                                        <button onClick={() => updateKdsFontSize('sans', 1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">+</button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-neutral-800 p-2 rounded-xl">
                                    <span className="text-xs font-bold text-green-400 uppercase">Extra</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateKdsFontSize('extra', -1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">-</button>
                                        <span className="text-sm font-black text-green-400 w-6 text-center">{kdsFontSizes.extra}</span>
                                        <button onClick={() => updateKdsFontSize('extra', 1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">+</button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-neutral-800 p-2 rounded-xl">
                                    <span className="text-xs font-bold text-white uppercase">N° Cmd</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateKdsFontSize('headerNum', -1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">-</button>
                                        <span className="text-sm font-black text-white w-6 text-center">{kdsFontSizes.headerNum}</span>
                                        <button onClick={() => updateKdsFontSize('headerNum', 1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">+</button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-neutral-800 p-2 rounded-xl">
                                    <span className="text-xs font-bold text-blue-400 uppercase">Tags</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateKdsFontSize('headerTags', -1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">-</button>
                                        <span className="text-sm font-black text-blue-400 w-6 text-center">{kdsFontSizes.headerTags}</span>
                                        <button onClick={() => updateKdsFontSize('headerTags', 1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">+</button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-neutral-800 p-2 rounded-xl">
                                    <span className="text-xs font-bold text-green-500 uppercase">Btn Prêt</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateKdsFontSize('btnReady', -1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">-</button>
                                        <span className="text-sm font-black text-green-500 w-6 text-center">{kdsFontSizes.btnReady}</span>
                                        <button onClick={() => updateKdsFontSize('btnReady', 1)} className="p-1 bg-neutral-700 hover:bg-neutral-600 rounded text-white">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <button 
                        onClick={() => {
                            if ('speechSynthesis' in window) {
                                window.speechSynthesis.cancel();
                            setTimeout(() => {
                                const prefix = brand?.texts?.ttsNewOrder || 'Nouvelle commande';
                                const text = filteredPreparingOrders.map(order => {
                                    return `${prefix}. ` + (order.filteredItems || order.items || []).map(i => {
                                        const itemName = (i.name || '').split(' (Sans')[0];
                                        const sansParts = (i.name || '').split(' (Sans ');
                                        const sans = sansParts.length > 1 ? ' ' + sansParts[1].replace(')', '').split(', ').map(opt => formatSansIngredient(opt)).join(', ') : '';
                                        return `${i.qty} ${itemName} ${sans}`;
                                    }).join(', ');
                                }).join('. Ensuite, ');
                                
                                const utterance = new SpeechSynthesisUtterance(`Il y a ${filteredPreparingOrders.length} commandes en cours. ` + text);
                                if (brand?.ttsVoiceURI) {
                                    const voices = window.speechSynthesis.getVoices();
                                    const selectedVoice = voices.find(v => v.voiceURI === brand.ttsVoiceURI);
                                    if (selectedVoice) utterance.voice = selectedVoice;
                                } else {
                                    utterance.lang = 'fr-FR';
                                }
                                
                                utterance.rate = 1.2;
                                window.speechSynthesis.speak(utterance);
                            }, 50);
                            }
                        }} 
                        className="shrink-0 flex-1 md:flex-none bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] active:scale-95 whitespace-nowrap" title="Lire toutes les commandes"
                    >
                        <Volume2 size={18} /> Lire Tout
                    </button>
                    <button 
                        onClick={() => setShowTotals(true)} 
                        className="shrink-0 flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] active:scale-95 whitespace-nowrap"
                    >
                        <ClipboardList size={18} /> Résumé (Total)
                    </button>
                    <button 
                        onClick={() => {
                            setShowHistory(true);
                            if (historyOrders.length === 0) loadHistory(false);
                        }} 
                        className="shrink-0 flex-1 md:flex-none bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-neutral-800 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    >
                        <History size={18} /> Historique
                    </button>
                    <button 
                        onClick={() => {
                            if (window.opener) { window.close(); } 
                            else { window.location.href = '/idara'; }
                        }} 
                        className="shrink-0 flex-1 md:flex-none bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(234,88,12,0.3)] active:scale-95 whitespace-nowrap"
                    >
                        <ArrowLeft size={18} /> Retour Caisse
                    </button>
                </div>
            </header>
            )}

            {/* Grille Kanban des Commandes */}
            {filteredPreparingOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50dvh] text-neutral-600 space-y-4">
                    <CheckSquare size={80} className="opacity-20" />
                    <p className="text-xl font-black uppercase tracking-widest">Aucune commande en cuisine</p>
                </div>
            ) : compactMode ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredPreparingOrders.map(o => {
                        const styles = getSourceStyles(o.source);
                        return (
                            <div key={o.id} className={`${styles.bg} border-2 ${styles.border} rounded-2xl flex flex-col overflow-hidden shadow-lg`}>
                                <div className={`${styles.headerBg} px-3 py-2 border-b ${styles.headerBorder} flex flex-col relative`}>
                                    <div className="flex justify-between items-center">
                                        <span className={`font-black ${styles.text}`} style={{ fontSize: Math.round(kdsFontSizes.headerNum * 0.6) + 'px' }}>#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); readOrder(o); }} className="p-1.5 bg-blue-500 text-white rounded-md active:scale-95 transition-all" title="Lire la commande">
                                                <Volume2 size={14} />
                                            </button>
                                            <LiveTimer variant="kitchen" startTime={o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now()} maxTime={settings?.kitchenLateTime || 15} compact={true} />
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase mt-1 tracking-widest flex items-center gap-1`}>
                                        <span className={`${styles.text}`} style={{ fontSize: kdsFontSizes.headerTags + 'px' }}>{styles.label}</span>
                                        {(o.paymentMethod === 'espece' || o.paymentMethod === 'cash') && o.source === 'glovo' && (
                                            <span className="text-white bg-red-500 px-1.5 py-0.5 rounded-sm border border-red-600 font-black animate-pulse ml-1 shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ fontSize: kdsFontSizes.headerTags + 'px' }}>ESPECE</span>
                                        )}
                                    </span>
                                    {o.source === 'pos' && (
                                        <span className={`font-black uppercase mt-1 px-1.5 py-0.5 rounded-md w-fit text-white ${o.orderType === 'sur_place' ? 'bg-blue-600' : 'bg-pink-600'}`} style={{ fontSize: Math.max(8, kdsFontSizes.headerTags - 1) + 'px' }}>
                                            {o.orderType === 'sur_place' ? '🍽️ SUR PLACE (PLATEAUX)' : '🛍️ À EMPORTER (EMBALLAGE)'}
                                        </span>
                                    )}
                                    {o.driverETA && (
                                        <span className="text-[9px] font-black uppercase mt-1 tracking-widest text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20 w-fit">🛵 {o.driverETA} min</span>
                                    )}
                                </div>
                                <div className="p-3 flex-1 no-scrollbar space-y-1.5">
                                    {(o.filteredItems || []).map((item, idx) => (
                                        <div key={idx} dir="auto" className="text-xs font-bold text-neutral-200 leading-tight border-b-2 border-dashed border-neutral-600 pb-3 mb-2 last:border-0 last:pb-0 last:mb-0">
                                            <span className="text-yellow-400 font-black me-3 inline-block" style={{ fontSize: kdsFontSizes.principal + 'px' }}>{item.qty}<span className="text-[0.75em] ml-0.5 opacity-90">x</span></span><span className="text-white font-black" style={{ fontSize: kdsFontSizes.principal + 'px' }}>{(getGlovoName(item.name) || '').split(' (Sans ')[0].replace(/"/g, '')}</span>
                                            {(item.name || '').includes(' (Sans ') && (item.name || '').split(' (Sans ').length > 1 && (
                                                <div className="flex flex-col gap-1 mt-1 items-end w-full" dir="auto">
                                                    {(item.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, oIdx) => {
                                                        const mappedOpt = getGlovoName(opt).replace(/"/g, '');
                                                        const isExtra = mappedOpt.toLowerCase().includes('extra') || mappedOpt.toLowerCase().includes('ajout') || mappedOpt.includes('إكسترا');
                                                        let displayOpt = mappedOpt;
                                                        if (isExtra && !displayOpt.trim().startsWith('+')) {
                                                            displayOpt = `+ ${displayOpt}`;
                                                        }
                                                        displayOpt = displayOpt.replace(/^\+\s*\+\s*/, '+ ');
                                                        
                                                        let qtyStr = '';
                                                        let textStr = displayOpt;
                                                        const qtyMatch = displayOpt.match(/(?:^|\s)(\d+x)(?:\s|$)/i);
                                                        if (qtyMatch) {
                                                            qtyStr = qtyMatch[1];
                                                            textStr = displayOpt.replace(qtyMatch[1], '').trim();
                                                        }
                                                        
                                                        return (
                                                            <div key={oIdx} className={`font-black uppercase tracking-wider flex items-center gap-2 ${isExtra ? 'text-green-500' : 'text-red-400'}`} style={{ fontSize: (isExtra ? kdsFontSizes.extra : kdsFontSizes.sans) + 'px' }} dir="ltr">
                                                                <span dir="auto" className="text-right">{textStr}</span>
                                                                {qtyStr && <span className="text-yellow-400 shrink-0">{qtyStr.replace(/x/i, '')}<span className="text-[0.75em] ml-0.5 opacity-90">x</span></span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {item.isCombo && item.comboChoices && item.comboChoices.map((c, cIdx) => (
                                                <div key={cIdx} className="text-[9px] text-gray-300 block mt-0.5 pl-2 border-l border-orange-500/50">
                                                    <span className="text-orange-400">🔹 {c.name}</span>
                                                    {c.removables?.length > 0 && <span className="text-red-400 ml-1">(- SANS: {c.removables.join(', ')})</span>}
                                                    {c.selectedOption && <span className="text-blue-400 ml-1">({c.selectedOption})</span>}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    {o.orderNote && (() => {
                                        const validLines = o.orderNote.split(/\|\|\||\n/).filter(line => {
                                            const l = line.toLowerCase();
                                            return l.trim() !== '' && !l.includes('paiement: espece') && !l.includes('paiement: espèce') && !l.includes('encaisser du livreur');
                                        });
                                        if (validLines.length === 0) return null;
                                        return (
                                            <div dir="auto" className="mt-2 text-[11px] text-black font-black bg-yellow-400 p-2 rounded-lg border-2 border-yellow-500 flex flex-col gap-1 shadow-md items-start">
                                                {validLines.map((line, idx) => {
                                                    const lowerLine = line.toLowerCase();
                                                    if (lowerLine.includes('sans ')) {
                                                        return <span key={idx} className="text-black font-black bg-yellow-500 px-1 rounded inline-block">🚫 {line.trim()}</span>;
                                                    } else if (line.match(/^\d+/) || lowerLine.includes('bocadillo') || lowerLine.includes('tacos')) {
                                                        return <span key={idx} className="text-black font-black mt-1 inline-block">🍔 {line.trim()}</span>;
                                                    } else {
                                                        return <span key={idx} className="text-black font-bold pl-4 inline-block">{line.trim()}</span>;
                                                    }
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            <button onClick={() => markOrderAsReady(o.id)} className="w-full py-3 text-white font-black uppercase tracking-wider transition-colors hover:opacity-90" style={{ backgroundColor: brand.kdsBtnReadyColor || '#16a34a', fontSize: kdsFontSizes.btnReady + 'px' }}>
                                {brand.texts?.btnKdsReady || 'Prêt'}
                            </button>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                    {filteredPreparingOrders.map(o => {
                        const styles = getSourceStyles(o.source);
                        return (
                        <div key={o.id} className={`${styles.bg} border-2 ${styles.border} transition-colors rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl`}>
                            
                            {/* Header de la carte commande */}
                            <div className={`${styles.headerBg} p-6 border-b ${styles.headerBorder} flex justify-between items-start relative`}>
                                <div className="flex flex-col gap-1">
                                    <span className={`font-black uppercase tracking-widest ${styles.text}`} style={{ fontSize: kdsFontSizes.headerTags + 'px' }}>
                                        {styles.label}{(o.paymentMethod === 'espece' || o.paymentMethod === 'cash') && o.source === 'glovo' && (
                                            <span className="text-white bg-red-500 px-2 py-0.5 rounded border-2 border-red-700 ml-2 font-black shadow-[0_0_10px_rgba(239,68,68,0.5)] uppercase animate-pulse" style={{ fontSize: kdsFontSizes.headerTags + 'px' }}>ESPECE</span>
                                        )}
                                    </span>
                                    <span className={`font-black uppercase tracking-tighter ${styles.orderNumberText || 'text-white'}`} style={{ fontSize: kdsFontSizes.headerNum + 'px' }}>#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                    {o.source === 'pos' && (
                                        <span className={`font-black uppercase mt-1 px-2 py-1 rounded-md w-fit text-white ${o.orderType === 'sur_place' ? 'bg-blue-600' : 'bg-pink-600'}`} style={{ fontSize: Math.max(8, kdsFontSizes.headerTags - 1) + 'px' }}>
                                            {o.orderType === 'sur_place' ? '🍽️ SUR PLACE (PLATEAUX)' : '🛍️ À EMPORTER (EMBALLAGE)'}
                                        </span>
                                    )}
                                    {o.status === 'pending' && <span className="text-[9px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 w-fit mt-1 animate-pulse">Nouvelle (En Attente)</span>}
                                    {o.driverETA && <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20 w-fit mt-1">🛵 Livreur à {o.driverETA} min</span>}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <LiveTimer variant="kitchen" startTime={o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now()} maxTime={settings?.kitchenLateTime || 15} />
                                    <div className="flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); readOrder(o); }} className="p-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center" title="Lire la commande">
                                            <Volume2 size={18} />
                                        </button>
                                        {printTicket && (
                                            <button onClick={() => printTicket(o, brand)} className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-all border border-neutral-700 shadow-sm active:scale-95 flex items-center justify-center" title="Imprimer Ticket">
                                                <Printer size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Liste des Plats à préparer */}
                            <div className="p-6 flex-1 space-y-3 no-scrollbar">
                                {(o.filteredItems || []).map((item, idx) => {
                                    const isChecked = checkedItems[`${o.id}_${idx}`];
                                    return (
                                        <div key={idx} onClick={() => toggleItemCheck(o.id, idx)} className={`p-5 rounded-2xl border-2 cursor-pointer transition-all active:scale-95 select-none ${isChecked ? 'bg-neutral-800/40 border-neutral-800 opacity-40 grayscale' : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 shadow-sm'}`}>
                                            <div className="flex gap-4 items-start">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-colors ${isChecked ? 'bg-green-500/20 border-green-500/50 text-green-500' : 'bg-neutral-900 border-neutral-600 text-neutral-600'}`}>{isChecked && <CheckCircle size={20} strokeWidth={3} />}</div>
                                                {item.img && (
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-neutral-900 border border-neutral-700 overflow-hidden transition-all ${isChecked ? 'grayscale opacity-40' : ''}`}>
                                                        {typeof item.img === 'string' && (item.img.startsWith('http') || item.img.startsWith('data:image')) ? <img src={item.img} className={`w-full h-full object-cover transition-all ${isChecked ? 'grayscale' : ''}`} alt="" /> : <span className="text-2xl">{item.img}</span>}
                                                    </div>
                                                )}
                                                <div className="flex-1 pt-1 flex flex-col items-start" dir="auto">
                                                    <span className={`font-black block leading-tight ${isChecked ? 'line-through decoration-2' : ''}`} style={{ fontSize: kdsFontSizes.principal + 'px' }}><span className="text-yellow-400 me-3 inline-block">{item.qty}<span className="text-[0.75em] ml-0.5 opacity-90">x</span></span><span className="text-white">{(getGlovoName(item.name) || '').split(' (Sans ')[0].replace(/"/g, '')}</span></span>
                                                    {(item.name || '').includes(' (Sans ') && (item.name || '').split(' (Sans ').length > 1 && (
                                                <div className="flex flex-col items-end w-full gap-1.5 mt-2" dir="auto">
                                                    {(item.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, oIdx) => {
                                                        const mappedOpt = getGlovoName(opt).replace(/"/g, '');
                                                        const isExtra = mappedOpt.toLowerCase().includes('extra') || mappedOpt.toLowerCase().includes('ajout') || mappedOpt.includes('إكسترا');
                                                        let displayOpt = mappedOpt;
                                                        if (isExtra && !displayOpt.trim().startsWith('+')) {
                                                            displayOpt = `+ ${displayOpt}`;
                                                        }
                                                        displayOpt = displayOpt.replace(/^\+\s*\+\s*/, '+ ');
                                                        
                                                        let qtyStr = '';
                                                        let textStr = displayOpt;
                                                        const qtyMatch = displayOpt.match(/(?:^|\s)(\d+x)(?:\s|$)/i);
                                                        if (qtyMatch) {
                                                            qtyStr = qtyMatch[1];
                                                            textStr = displayOpt.replace(qtyMatch[1], '').trim();
                                                        }

                                                        return (
                                                            <div key={oIdx} className={`inline-flex px-3 py-1 rounded-lg font-black uppercase tracking-wider border items-center gap-2 ${isExtra ? 'bg-green-500/20 text-green-400 border-green-500/20' : 'bg-red-500/20 text-red-400 border-red-500/20'}`} style={{ fontSize: (isExtra ? kdsFontSizes.extra : kdsFontSizes.sans) + 'px' }} dir="ltr">
                                                                <span dir="auto" className="text-right">{textStr}</span>
                                                                {qtyStr && <span className="text-yellow-400 shrink-0">{qtyStr.replace(/x/i, '')}<span className="text-[0.75em] ml-0.5 opacity-90">x</span></span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                                    {item.isCombo && item.comboChoices && (
                                                        <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-orange-500 bg-orange-500/10 p-2 rounded-r-xl">
                                                            {item.comboChoices.map((c, cIdx) => (
                                                                <div key={cIdx} className="text-sm font-bold text-gray-200 flex flex-wrap items-center gap-1">
                                                                    <span className="text-orange-400 mr-1">🔹 {c.name}</span>
                                                                    {c.removables?.length > 0 && <span className="text-red-400 text-[11px] bg-red-500/20 px-2 py-0.5 rounded-md border border-red-500/20">- {c.removables.map(r => formatSansIngredient(r)).join(', ')}</span>}
                                                                    {c.selectedOption && <span className="text-blue-300 text-[11px] bg-blue-500/20 px-2 py-0.5 rounded-md border border-blue-500/20">({c.selectedOption})</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {o.orderNote && (() => {
                                    const validLines = o.orderNote.split(/\|\|\||\n/).filter(line => {
                                        const l = line.toLowerCase();
                                        return l.trim() !== '' && !l.includes('paiement: espece') && !l.includes('paiement: espèce') && !l.includes('encaisser du livreur');
                                    });
                                    if (validLines.length === 0) return null;
                                    return (
                                        <div className="mt-6 p-5 bg-yellow-400 border-4 border-yellow-500 rounded-2xl shadow-xl">
                                            <span className="text-sm font-black uppercase tracking-widest text-black flex items-center gap-2 mb-2"><AlertTriangle size={18}/> Note Client Spéciale :</span>
                                            <div className="text-base font-black text-black space-y-2">
                                                {validLines.map((line, idx) => {
                                                    const lowerLine = line.toLowerCase();
                                                    if (lowerLine.includes('sans ')) {
                                                        return <div key={idx} className="text-black font-black text-lg flex items-center gap-2">🚫 <span className="bg-yellow-500 px-2 py-0.5 rounded border border-yellow-600 shadow-sm">{line.trim()}</span></div>;
                                                    } else if (line.match(/^\d+/) || lowerLine.includes('bocadillo') || lowerLine.includes('tacos') || lowerLine.includes('burger')) {
                                                        return <div key={idx} className="text-black font-black text-xl mt-3 flex items-center gap-2">🍔 {line.trim()}</div>;
                                                    } else {
                                                        return <div key={idx} className="text-black font-bold ml-6">{line.trim()}</div>;
                                                    }
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                            
                            
                            {/* Warning pour Glovo Cash */}
                            {o.source === 'glovo' && (o.paymentMethod === 'espece' || o.paymentMethod === 'cash') && (
                                <div className="p-3 bg-red-900/50 border-t border-b border-red-500/50 flex flex-col items-center justify-center text-center animate-pulse">
                                    <span className="text-white font-black text-xl uppercase tracking-widest">⚠️ GLOVO ESPÈCE ⚠️</span>
                                    <span className="text-red-200 font-bold text-sm">LE LIVREUR DOIT PAYER EN CASH</span>
                                </div>
                            )}

                            {/* Bouton de validation final */}
                            <div className="p-6 bg-neutral-900 border-t border-neutral-800 shrink-0">
                                <button onClick={() => markOrderAsReady(o.id)} className="w-full py-6 text-white rounded-[1.5rem] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3 hover:opacity-90" style={{ backgroundColor: brand.kdsBtnReadyColor || '#16a34a', boxShadow: `0 0 30px ${brand.kdsBtnReadyColor || '#16a34a'}40`, fontSize: Math.round(kdsFontSizes.btnReady * 1.5) + 'px' }}>
                                    <CheckCircle size={28} /> 
                                    {brand.texts?.btnKdsReady || 'Prêt'}
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
            
            {/* Modal Historique Cuisine */}
            {showHistory && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
                    <div className="bg-neutral-900 rounded-[2.5rem] w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl border border-neutral-800 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <History className="text-orange-500" /> Historique d'aujourd'hui
                            </h2>
                            <button onClick={() => setShowHistory(false)} className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-4 no-scrollbar">
                            {historyOrders.length === 0 && !loadingHistory ? (
                                <div className="text-center text-neutral-500 py-10 font-bold">Aucune commande dans l'historique.</div>
                            ) : (
                                historyOrders.map(o => (
                                    <div key={o.id} className="bg-neutral-800/50 border border-neutral-800 p-5 rounded-2xl flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-xl font-black text-white uppercase tracking-tighter">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${o.source === 'pos' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : o.source === 'telephone' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-neutral-700 text-neutral-300 border border-neutral-600'}`}>
                                                    {o.source === 'pos' ? 'POS' : o.source === 'telephone' ? 'TÉL' : 'APP'}
                                                </span>
                                                {o.source === 'pos' && o.orderType && (
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg ${o.orderType === 'sur_place' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'}`}>
                                                        {o.orderType === 'sur_place' ? '🍽️ Sur Place' : '🛍️ À Emporter'}
                                                    </span>
                                                )}
                                                <span className="text-xs font-bold text-neutral-500 bg-neutral-950 px-2 py-1 rounded-lg">
                                                    {o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                                </span>
                                                {o.status === 'ready' && <span className="text-[10px] font-black uppercase text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">Prêt (Attente Livreur)</span>}
                                                {o.status === 'out_for_delivery' && <span className="text-[10px] font-black uppercase text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">En Route</span>}
                                                {o.status === 'delivered' && <span className="text-[10px] font-black uppercase text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg">Livré</span>}
                                            </div>
                                            <div className="text-sm font-bold text-neutral-400">
                                                {(o.items || []).map(i => {
                                                    let text = `${i.qty}x ${(i.name || '').split(' (Sans')[0]}`;
                                                    if (i.isCombo && i.comboChoices) {
                                                        text += ' [' + i.comboChoices.map(c => c.name + (c.removables?.length ? ' (SANS: '+c.removables.join(', ')+')' : '') + (c.selectedOption ? ' '+c.selectedOption : '')).join(' + ') + ']';
                                                    }
                                                    return text;
                                                }).join(', ')}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {printTicket && <button onClick={() => printTicket(o, brand)} className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl transition-all shadow-sm active:scale-95" title="Imprimer"><Printer size={18} /></button>}
                                            
                                            {o.status === 'ready' && (
                                                <button 
                                                    onClick={() => { 
                                                        updateStatus(o.id, o.status, { kitchenAlert: Date.now() }); 
                                                        setAlertedOrders(prev => new Set(prev).add(o.id));
                                                    }} 
                                                    disabled={alertedOrders.has(o.id)}
                                                    className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 ${alertedOrders.has(o.id) ? 'bg-neutral-800 text-neutral-500 border border-neutral-700' : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20'}`}
                                                >
                                                    <BellRing size={16} /> {alertedOrders.has(o.id) ? 'Alerte Envoyée' : 'Bip Livreur'}
                                                </button>
                                            )}

                                            <button onClick={() => setConfirmReturn(o.id)} className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95">
                                                <RotateCcw size={16} /> Rje3 L-KDS
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                            
                            {/* 🔥 Bouton "Charger Plus" */}
                            {historyOrders.length > 0 && (
                                <div className="flex justify-center pt-4 border-t border-neutral-800 mt-4">
                                    <button 
                                        onClick={() => loadHistory(true)} 
                                        disabled={loadingHistory}
                                        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loadingHistory ? <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin"></div> : <AlignJustify size={16} />}
                                        {loadingHistory ? "Chargement..." : "Charger 10 de plus"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Cadre de Confirmation Zwin (Rje3 L-KDS) */}
            {confirmReturn && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setConfirmReturn(null)}>
                    <div className="bg-neutral-900 rounded-[2.5rem] w-full max-w-sm flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-2 border-neutral-800 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-8 flex flex-col items-center text-center gap-4">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border-4 border-red-500/20 text-red-500 mb-2 shadow-inner">
                                <RotateCcw size={36} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Met2ked (T'es sûr) ?</h3>
                                <p className="text-sm font-bold text-neutral-400">Voulez-vous vraiment renvoyer cette commande en cuisine ? Elle réapparaîtra sur le KDS.</p>
                            </div>
                        </div>
                        <div className="p-6 bg-neutral-950 border-t border-neutral-800 flex gap-3">
                            <button onClick={() => setConfirmReturn(null)} className="flex-1 py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl font-black uppercase text-xs transition-colors active:scale-95 border border-neutral-700 shadow-sm">
                                Annuler
                            </button>
                            <button onClick={() => { updateStatus(confirmReturn, 'preparing'); setShowHistory(false); setConfirmReturn(null); }} className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black uppercase text-xs shadow-[0_0_20px_rgba(220,38,38,0.25)] transition-colors active:scale-95">
                                Oui, Renvoyer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Résumé Total (Batch Cooking) */}
            {showTotals && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowTotals(false)}>
                    <div className="bg-neutral-900 rounded-[2.5rem] w-full max-w-3xl max-h-[85dvh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-2 border-neutral-800 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <ClipboardList className="text-blue-500" /> Résumé (Total à préparer)
                            </h2>
                            <div className="flex items-center gap-3">
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    if ('speechSynthesis' in window) {
                                        window.speechSynthesis.cancel();
                                        setTimeout(() => {
                                            const summaryData = Object.entries(
                                                preparingOrders.reduce((acc, o) => {
                                                    (o.items || []).forEach(i => {
                                                        const baseName = (i.name || '').split(' (Sans')[0];
                                                        const sansParts = (i.name || '').split(' (Sans ');
                                                const options = sansParts.length > 1 ? ' (Sans ' + sansParts[1] : '';
                                                        let comboOpts = '';
                                                        if (i.isCombo && i.comboChoices) {
                                                            comboOpts = ' [' + i.comboChoices.map(c => c.name + (c.removables?.length ? ' ' + c.removables.map(r => formatSansIngredient(r)).join(', ') : '') + (c.selectedOption ? ' '+c.selectedOption : '')).join(' + ') + ']';
                                                        }
                                                        const key = baseName + options + comboOpts;
                                                        if (!acc[key]) acc[key] = { qty: 0 };
                                                        acc[key].qty += i.qty;
                                                    });
                                                    return acc;
                                                }, {})
                                            ).sort((a, b) => b[1].qty - a[1].qty);
                                            const text = summaryData.map(([name, data]) => `${data.qty} ${name}`).join(', ');
                                            const utterance = new SpeechSynthesisUtterance(`Total à préparer. ${text}`);
                                            if (brand?.ttsVoiceURI) { const voices = window.speechSynthesis.getVoices(); const selectedVoice = voices.find(v => v.voiceURI === brand.ttsVoiceURI); if (selectedVoice) utterance.voice = selectedVoice; } else { utterance.lang = 'fr-FR'; }
                                            utterance.rate = 1.2;
                                            window.speechSynthesis.speak(utterance);
                                        }, 50);
                                    }
                                }} className="p-2 md:px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 font-bold text-xs uppercase" title="Lire le résumé">
                                    <Volume2 size={18} /> <span className="hidden md:inline">Lire Total</span>
                                </button>
                                <button onClick={() => setShowTotals(false)} className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-full transition-colors"><X size={24} /></button>
                            </div>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-4 no-scrollbar">
                            {preparingOrders.length === 0 ? (
                                <div className="text-center text-neutral-500 py-10 font-bold">Aucune commande en cours.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {Object.entries(
                                        preparingOrders.reduce((acc, o) => {
                                            (o.items || []).forEach(i => {
                                                // On regroupe par nom exact (avec les options "Sans" pour ne pas mélanger)
                                                const baseName = (i.name || '').split(' (Sans')[0];
                                                const sansParts = (i.name || '').split(' (Sans ');
                                        const options = sansParts.length > 1 ? ' (Sans ' + sansParts[1] : '';
                                                let comboOpts = '';
                                                if (i.isCombo && i.comboChoices) {
                                                    comboOpts = ' [' + i.comboChoices.map(c => c.name + (c.removables?.length ? ' ' + c.removables.map(r => formatSansIngredient(r)).join(', ') : '') + (c.selectedOption ? ' '+c.selectedOption : '')).join(' + ') + ']';
                                                }
                                                const key = baseName + options + comboOpts;
                                                
                                                if (!acc[key]) acc[key] = { qty: 0, img: i.img };
                                                acc[key].qty += i.qty;
                                            });
                                            return acc;
                                        }, {})
                                    ).sort((a, b) => b[1].qty - a[1].qty).map(([name, data], idx) => {
                                        const baseName = name.split(' (Sans')[0];
                                        const options = name.replace(baseName, '').trim();
                                        return (
                                            <div key={idx} className="bg-neutral-800/50 border border-neutral-700 p-4 rounded-2xl flex items-center gap-4 hover:bg-neutral-800 transition-colors">
                                                <div className="w-14 h-14 rounded-xl bg-neutral-900 border border-neutral-600 flex items-center justify-center shrink-0 overflow-hidden text-2xl">
                                                    {typeof data.img === 'string' && data.img.startsWith('http') ? <img src={data.img} className="w-full h-full object-cover" alt="" /> : data.img}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-black text-lg text-white leading-tight">{baseName}</div>
                                                    {options && <div className="text-[10px] text-red-400 font-bold uppercase mt-1">- {options.replace(' (Sans ', '').replace(')', '')}</div>}
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
            
            {/* Modal Rupture de Stock */}
            {showStockModal && (
                <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowStockModal(false)}>
                    <div className="bg-neutral-900 rounded-[2.5rem] w-full max-w-3xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl border border-neutral-800 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <PackageX className="text-red-500" /> Gestion des Ruptures
                            </h2>
                            <button onClick={() => setShowStockModal(false)} className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 no-scrollbar">
                            {(settings?.menuItems || []).map(item => (
                                <button key={item.id} onClick={() => {
                                    const isRupture = !item.outOfStock;
                                    const updatedMenu = settings.menuItems.map(i => i.id === item.id ? { ...i, outOfStock: isRupture } : i);
                                    updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'config'), { menuItems: updatedMenu }).catch(e=>console.log(e));
                                    
                                    // Delay to overwrite the Cloud Function's default config_sync trigger
                                    setTimeout(() => {
                                        let ruptureDoc = 'glovo_rupture';
                                        if (profile?.branchId === 'oum_rabii') ruptureDoc = 'glovo_rupture_OumRabii';
                                        if (profile?.branchId === 'zoubire') ruptureDoc = 'glovo_rupture_Zoubire';

                                        setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', ruptureDoc), {
                                            glovoName: getGlovoName(item.name),
                                            status: 'pending_robot',
                                            action: isRupture ? 'rupture' : 'disponible',
                                            isHandled: false,
                                            timestamp: Date.now()
                                        }).catch(e=>console.log(e));
                                    }, 1500);
                                }} className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${item.outOfStock ? 'bg-red-500/10 border-red-500/30' : 'bg-neutral-800 border-neutral-700 hover:border-neutral-500 shadow-sm'}`}>
                                    <span className="text-3xl mb-1">{item.img?.startsWith('http') || item.img?.startsWith('data:image') ? <img src={item.img} className="w-10 h-10 rounded-md object-cover"/> : item.img}</span>
                                    <span className={`font-black text-sm leading-tight line-clamp-2 ${item.outOfStock ? 'text-red-400' : 'text-white'}`}>{item.name}</span>
                                    {item.outOfStock ? <span className="text-[10px] font-black text-red-500 uppercase px-2 py-1 bg-red-500/20 rounded-md w-fit mt-auto border border-red-500/20">En rupture</span> : <span className="text-[10px] font-black text-green-500 uppercase px-2 py-1 bg-green-500/20 rounded-md w-fit mt-auto border border-green-500/20">Disponible</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
