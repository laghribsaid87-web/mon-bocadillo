import React, { useState, useEffect, useRef, useMemo, Suspense, lazy } from 'react';
import { 
    Store, Phone, History, Truck, Map as MapIcon, Users, Star, Palette, LogOut, 
    X, Menu, Check, CheckCircle, Minus, Clock, Printer, AlertTriangle, ChevronRight, Search, Mic, MicOff,
    Download, Ban, Trash2, User, Edit3, Settings, Zap, ImageIcon, Type, AlignLeft, 
    MessageCircle, Utensils, MousePointer2, Plus, ShoppingBag, Home, MapPin, Navigation, ChefHat, Monitor,
    TrendingUp, DollarSign, Award, BarChart3, Database, Activity, Calculator
} from 'lucide-react';
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc, deleteDoc, updateDoc, getDocs, query, where, orderBy, limit, startAfter, writeBatch, arrayUnion, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDatabase, ref as rtdbRef, onValue } from 'firebase/database';
import { formatPhoneNumber, getWhatsAppFormat, generateOrderNumber, buildMessage, isDriverOnline, getClosestBranch, calculateETA, formatSansIngredient, openWhatsAppDirect } from '../utils/helpers';
import AdminMap from '../components/AdminMap';
import StatusBadge from '../components/StatusBadge';
import OrderTimer from '../components/OrderTimer';
import { DEFAULT_BRANCHES, DEFAULT_MENU_ITEMS, DEFAULT_BRAND, FONTS_OPTIONS, PREDEFINED_DRINKS } from '../config/constants';

const AdminClients = lazy(() => import('../components/admin/AdminClients'));
const AdminConfig = lazy(() => import('../components/admin/AdminConfig'));
const AdminHistory = lazy(() => import('../components/admin/AdminHistory'));
const AdminActiveOrders = lazy(() => import('../components/admin/AdminActiveOrders'));
const AdminMaintenance = lazy(() => import('../components/admin/AdminMaintenance'));
const PosDashboard = lazy(() => import('./PosDashboard'));

export default function AdminDashboard({ role, managerBranchId, orders, updateStatus, clientsList, onlineDrivers, settings, brand, setBrand, saveSettings, db, showNotify, handleReassignOrder, printTicket, defaultMenu, onLogout, appId }) {
    const [tab, setTab] = useState('active'); 
    const [f, setF] = useState({ type: 'none', date: '', search: '' }); 
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
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [isSpyVisible, setIsSpyVisible] = useState(false); // 🔥 State bash nkhbiw bouton l'écoute
    
    const [selectedExtItem, setSelectedExtItem] = useState(null); 
    const [extItemOptions, setExtItemOptions] = useState([]);
    const [extSelectedVariation, setExtSelectedVariation] = useState(null);
    const [extSelectedChoice, setExtSelectedChoice] = useState(null);
    const [extSelectedExtras, setExtSelectedExtras] = useState([]);
    const [isDriversLoaded, setIsDriversLoaded] = useState(false);
    const prevOnlineDriversRef = useRef(new Set());
    const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
    const [analyticsBranch, setAnalyticsBranch] = useState('all');
    const [adminSelectedBranch, setAdminSelectedBranch] = useState('ALL');

    // 🔥 STATES POUR RAPPORT GLOVO
    const [glovoDates, setGlovoDates] = useState({ start: '', end: '' });
    const [glovoPenalties, setGlovoPenalties] = useState(0);
    const [glovoBranch, setGlovoBranch] = useState('ALL');
    const [glovoData, setGlovoData] = useState([]);
    const [isFetchingGlovo, setIsFetchingGlovo] = useState(false);

    const [showAddDriver, setShowAddDriver] = useState(false);
    const [newDriver, setNewDriver] = useState({ name: '', phone: '', isFreelance: false });

    const [latestGithubVersion, setLatestGithubVersion] = useState(null);
    const [rtdbDrivers, setRtdbDrivers] = useState({});
    const [isRtdbConnected, setIsRtdbConnected] = useState(true);

    // 🔥 RTDB Listener pour Live Tracking (Idara)
    useEffect(() => {
        if (role !== 'admin' && role !== 'manager') return;
        try {
            const rtdb = getDatabase();
            
            // 🔥 NOUVEAU : Suivre l'état de la connexion RTDB
            const connectedRef = rtdbRef(rtdb, '.info/connected');
            const unsubConnected = onValue(connectedRef, (snap) => {
                setIsRtdbConnected(snap.val() === true);
            });

            const trackingRef = rtdbRef(rtdb, `tracking/${appId}/drivers`);
            const unsubTracking = onValue(trackingRef, (snapshot) => {
                if (snapshot.exists()) {
                    setRtdbDrivers(snapshot.val());
                }
            });
            return () => {
                unsubConnected();
                unsubTracking();
            };
        } catch (e) {
            console.error("RTDB Admin Error:", e);
        }
    }, [role, appId]);

    // 🔥 States pour le système d'écoute (Spy)
    const [showSpyModal, setShowSpyModal] = useState(false);
    const [spyTargetType, setSpyTargetType] = useState('pos');
    const [spyBranchId, setSpyBranchId] = useState('');
    const [spyStatus, setSpyStatus] = useState('idle');
    const [spyStream, setSpyStream] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const spyPcRef = useRef(null);
    const audioRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const addedAdminCandidates = useRef(new Set());
    const [isRollingRecordEnabled, setIsRollingRecordEnabled] = useState(false);
    const rollingChunksRef = useRef([]);
    const rollingRecorderRef = useRef(null);

    useEffect(() => {
        if (role === 'admin' && adminSelectedBranch !== 'ALL') {
            setExtOrder(prev => ({ ...prev, branchId: adminSelectedBranch }));
        }
    }, [adminSelectedBranch, role]);

    useEffect(() => {
        if (!spyBranchId && settings?.branches?.length > 0) {
            setSpyBranchId(settings.branches[0].id);
        }
    }, [settings, spyBranchId]);

    const startSpy = async () => {
        if (!spyBranchId) return showNotify("Veuillez sélectionner une agence", "warning");
        const targetId = `${spyTargetType}_${spyBranchId}`;
        const callDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId);
        
        setSpyStatus('calling');
        addedAdminCandidates.current.clear();
        
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        spyPcRef.current = pc;

        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (event) => {
            setSpyStream(event.streams[0]);
            if (audioRef.current) audioRef.current.srcObject = event.streams[0];
            setSpyStatus('connected');
            showNotify("Connexion audio établie", "success");
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                updateDoc(callDocRef, { adminCandidates: arrayUnion(event.candidate.toJSON()) }).catch(() => {});
            }
        };

        await setDoc(callDocRef, { status: 'calling', offer: null, answer: null, adminCandidates: [], targetCandidates: [] });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateDoc(callDocRef, { offer: { type: offer.type, sdp: offer.sdp } });

        const unsub = onSnapshot(callDocRef, async (snap) => {
            const data = snap.data();
            if (!data) return;
            if (data.status === 'answered' && data.answer && pc.signalingState === 'have-local-offer') {
                try { await pc.setRemoteDescription(new RTCSessionDescription(data.answer)); } catch(e){}
            }
            if (data.targetCandidates) {
                data.targetCandidates.forEach(async candidate => {
                    const candStr = JSON.stringify(candidate);
                    if (!addedAdminCandidates.current.has(candStr)) {
                        addedAdminCandidates.current.add(candStr);
                        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){}
                    }
                });
            }
            if (data.status === 'ended') { stopSpy(); showNotify("La connexion a été coupée par l'appareil distant", "info"); }
        });

        spyPcRef.current.unsub = unsub;
    };

    const stopSpy = async () => {
        if (spyPcRef.current) {
            if (spyPcRef.current.unsub) spyPcRef.current.unsub();
            spyPcRef.current.close();
            spyPcRef.current = null;
        }
        setSpyStream(null);
        setSpyStatus('idle');
        if (isRecording) stopRecording();

        if (rollingRecorderRef.current && rollingRecorderRef.current.state === 'recording') {
            rollingRecorderRef.current.stop();
        }
        rollingRecorderRef.current = null;

        if (spyBranchId) {
            const targetId = `${spyTargetType}_${spyBranchId}`;
            try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'audio_calls', targetId), { status: 'ended' }); } catch(e){}
        }
    };

    const startRecording = () => {
        if (!spyStream) return;
        recordedChunksRef.current = [];
        let mediaRecorder;
        try { mediaRecorder = new MediaRecorder(spyStream, { mimeType: 'audio/webm' }); } 
        catch (e) { mediaRecorder = new MediaRecorder(spyStream); }
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style = 'display: none';
            a.href = url;
            a.download = `Ecoute_${spyTargetType}_${spyBranchId}_${new Date().toISOString().replace(/:/g, '-')}.webm`;
            a.click();
            window.URL.revokeObjectURL(url);
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
        setIsRecording(false);
    };

    // 🔥 GESTION DE L'ENREGISTREMENT CONTINU (60 MIN)
    useEffect(() => {
        if (spyStatus === 'connected' && spyStream && isRollingRecordEnabled) {
            if (!rollingRecorderRef.current) {
                rollingChunksRef.current = [];
                let mediaRecorder;
                try { mediaRecorder = new MediaRecorder(spyStream, { mimeType: 'audio/webm' }); } 
                catch (e) { mediaRecorder = new MediaRecorder(spyStream); }
                
                mediaRecorder.ondataavailable = (e) => { 
                    if (e.data.size > 0) {
                        rollingChunksRef.current.push(e.data);
                        if (rollingChunksRef.current.length > 360) { // 360 * 10s = 60 minutes
                            rollingChunksRef.current.shift();
                        }
                    }
                };
                mediaRecorder.start(10000); // Couper chaque 10 secondes
                rollingRecorderRef.current = mediaRecorder;
            }
        } else {
            if (rollingRecorderRef.current && rollingRecorderRef.current.state === 'recording') {
                rollingRecorderRef.current.stop();
            }
            rollingRecorderRef.current = null;
        }
    }, [spyStatus, spyStream, isRollingRecordEnabled]);

    const downloadLastHour = () => {
        if (rollingChunksRef.current.length === 0) return showNotify("L'enregistrement est vide pour le moment", "warning");
        const blob = new Blob(rollingChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); document.body.appendChild(a); a.style = 'display: none';
        a.href = url; a.download = `Replay_DerniereHeure_${spyTargetType}_${spyBranchId}_${new Date().toISOString().replace(/:/g, '-')}.webm`;
        a.click(); window.URL.revokeObjectURL(url);
        showNotify("Enregistrement de la dernière heure téléchargé ! ✅", "success");
    };

    // 🔥 Fusionner onlineDrivers (Firestore) avec RTDB (Rapide)
    const liveOnlineDrivers = useMemo(() => {
        return (onlineDrivers || []).map(d => {
            const rt = rtdbDrivers[d.uid];
            // On met à jour les coordonnées si le signal RTDB date de moins de 5 minutes
            if (rt && rt.lat && rt.lng && (Date.now() - rt.updatedAt < 5 * 60000)) {
                return { ...d, lat: rt.lat, lng: rt.lng };
            }
            return d;
        });
    }, [onlineDrivers, rtdbDrivers]);

    // 🔥 GESTION DES ACCÈS PAR AGENCE (MANAGER)
    useEffect(() => {
        const checkVersions = async () => {
            try {
                const response = await fetch('https://api.github.com/repos/laghribsaid87-web/mon-bocadillo/releases/latest');
                const data = await response.json();
                if (data && data.tag_name) {
                    setLatestGithubVersion(data.tag_name.replace('v', ''));
                }
            } catch (err) {}
        };
        checkVersions();
    }, []);

    // 🔥 States pour l'historique complet à la demande
    const [olderOrders, setOlderOrders] = useState([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [fullHistoryFetched, setFullHistoryFetched] = useState(false);
    const [archiveDates, setArchiveDates] = useState({ start: '', end: '' });

    // 🔥 NOUVEAU: States pour l'historique paresseux (10 par 10)
    const [lazyHistory, setLazyHistory] = useState([]);
    const [lastHistoryDoc, setLastHistoryDoc] = useState(null);
    const [loadingLazyHistory, setLoadingLazyHistory] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);

    // 🔥 Zidna had les states bach n-trackiw les commandes jdad
    const [isAppLoaded, setIsAppLoaded] = useState(false);
    const [isSoundEnabled, setIsSoundEnabled] = useState(false);
    const knownOrdersRef = useRef(new Set());

    // 🔥 GESTION DES ACCÈS PAR AGENCE (MANAGER)
    const myBranch = role === 'manager' ? (settings?.branches || DEFAULT_BRANCHES).find(b => b.id === managerBranchId) : null;
    const myModules = myBranch?.modules || ['pos', 'kds', 'tv', 'active', 'problems', 'standard', 'history', 'drivers', 'maps', 'clients', 'pos_drawer', 'pos_history', 'pos_reports', 'pos_delete'];
    const hasAccess = (modId) => role === 'admin' || myModules.includes(modId);

    useEffect(() => {
        if (role === 'manager' && !hasAccess(tab)) {
            const availableTabs = ['active', 'pos', 'standard', 'history', 'drivers', 'maps', 'clients', 'problems'];
            const firstAvailable = availableTabs.find(m => hasAccess(m));
            if (firstAvailable) setTab(firstAvailable);
        }
    }, [role, managerBranchId, settings?.branches, tab]);

    const enableSound = () => {
        setIsSoundEnabled(true);
        try {
            const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
            audio.volume = 0.01;
            audio.play().catch(() => {});
        } catch (e) {}
    };

    useEffect(() => {
        // Zoom global de l'interface (Ajusté pour être un peu plus grand)
        document.documentElement.style.fontSize = '13px';
    }, []);


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
        if (hasNewOrder && isSoundEnabled) {
            try {
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
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
        liveOnlineDrivers.forEach(d => {
            if (isDriverOnline(d)) {
                const id = d.uid || d.phone;
                current.add(id);
                if (!prevOnlineDriversRef.current.has(id)) {
                    showNotify(`🛵 Livreur ${d.name || 'Inconnu'} est connecté !`, "info");
                }
            }
        });
        prevOnlineDriversRef.current = current;
    }, [liveOnlineDrivers, isDriversLoaded]);

    const getL = (d) => {
        try {
            if (!d || !(d instanceof Date) || isNaN(d)) return '';
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        } catch (e) { return ''; }
    };

    const today = getL(new Date()); 
    const yesterday = getL(new Date(now - 86400000));

    // 🔥 NOUVEAU: Sifet Notification Kola 8s l-Livreur li majawbch bach iPhone ysonni f jibo
    const lastNotifSentRef = useRef({});

    useEffect(() => {
        const interval = setInterval(() => {
            const currentTime = Date.now();
            (orders || []).forEach(o => {
                if (o.status === 'rejected' || o.status === 'delivered') return;
                
                if (o.driverId && !o.driverAccepted) {
                    const elapsed = currentTime - (o.assignedAtLocal || 0);
                    
                    // 🔥 FIX: Nsifto Push Notif MERRA WE7DA w safi (Machi kola 8s) bach n7afdo 3la l-Quota
                    const hasSent = lastNotifSentRef.current[o.id];
                    if (!hasSent && elapsed < 25000) {
                        lastNotifSentRef.current[o.id] = true;
                        const driverData = (liveOnlineDrivers || []).find(d => d.uid === o.driverId);
                        if (driverData) {
                            if (driverData.fcmToken) {
                                try {
                                    const functions = getFunctions();
                                    const sendPush = httpsCallable(functions, 'sendMarketingPush');
                                    sendPush({
                                        appId,
                                        tokens: [driverData.fcmToken],
                                        title: "🚨 NOUVELLE COMMANDE !",
                                        body: `Zreb accepte commande #${o.orderNumber || o.id.slice(-4)} 9bel mayfout l-we9t!`
                                    });
                                } catch(e) {}
                            }
                            
                            // 🔥 NOUVEAU: Appel MacroDroid (Webhook) bach ysonni f iPhone w Android
                            if (driverData.phone) {
                                try {
                                    const webhookUrl = `https://trigger.macrodroid.com/28c4739c-b1c7-43d8-bad9-60c0cbd412d9/souni?phone=${driverData.phone}`;
                                    fetch(webhookUrl, { mode: 'no-cors' }).catch(()=>{});
                                } catch(e) {}
                            }
                        }
                    }

                    if (o.isManualAssignment) {
                        const lastPing = o.lastManualPing || o.assignedAtLocal;
                        if (currentTime - lastPing > 120000) { // Chaque 2 minutes
                            updateStatus(o.id, o.status, { lastManualPing: currentTime, notifiedDriver: false });
                            const driverData = (liveOnlineDrivers || []).find(d => d.uid === o.driverId);
                            if (driverData) {
                                if (driverData.fcmToken) {
                                    try {
                                        const functions = getFunctions();
                                        const sendPush = httpsCallable(functions, 'sendMarketingPush');
                                        sendPush({
                                            appId,
                                            tokens: [driverData.fcmToken],
                                            title: "🚨 RAPPEL COMMANDE !",
                                            body: `Zreb accepte commande #${o.orderNumber || o.id.slice(-4)} !`
                                        });
                                    } catch(e) {}
                                }
                                
                                // 🔥 NOUVEAU: Rappel Appel MacroDroid (Kola 2 min)
                                if (driverData.phone) {
                                    try {
                                        const webhookUrl = `https://trigger.macrodroid.com/28c4739c-b1c7-43d8-bad9-60c0cbd412d9/souni?phone=${driverData.phone}`;
                                        fetch(webhookUrl, { mode: 'no-cors' }).catch(()=>{});
                                    } catch(e) {}
                                }
                            }
                        }
                    } else {
                        if (elapsed > 30000) { handleReassignOrder(o, o.driverId, false, true); }
                    }
                } else if (!o.driverId && (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')) {
                    const elapsedSinceLastSearch = currentTime - (o.assignedAtLocal || o.createdAt?.seconds*1000 || 0);
                    if (elapsedSinceLastSearch > 15000) { handleReassignOrder(o, null, true, true); }
                }
            });
        }, 3000);
        return () => clearInterval(interval);
    }, [orders, handleReassignOrder, liveOnlineDrivers, appId]);

    useEffect(() => { 
        setEditableMenu(settings?.menuItems || defaultMenu || DEFAULT_MENU_ITEMS); 
        setEditableBranches(settings?.branches || DEFAULT_BRANCHES); 
    }, [settings, defaultMenu]);

    // 🔥 NOUVEAU: Charger l'historique 10 par 10
    const loadLazyHistory = async (isLoadMore = false, overrideFilters = null) => {
        setLoadingLazyHistory(true);
        try {
            const currentFilter = overrideFilters || f;

            // 🔥 NOUVEAU: Ne rien charger si aucune date n'est choisie (A DEMANDE SAFI)
            if (currentFilter.type === 'none') {
                setLazyHistory([]);
                setLastHistoryDoc(null);
                setHasMoreHistory(false);
                setLoadingLazyHistory(false);
                return;
            }

            let constraints = [
                where('status', 'in', ['delivered', 'rejected']),
                orderBy('createdAt', 'desc')
            ];

            if (currentFilter.type === 'today' || currentFilter.type === 'yesterday' || currentFilter.date) {
                let start, end;
                if (currentFilter.type === 'today') {
                    start = new Date(); start.setHours(0,0,0,0);
                    end = new Date(); end.setHours(23,59,59,999);
                } else if (currentFilter.type === 'yesterday') {
                    start = new Date(); start.setDate(start.getDate() - 1); start.setHours(0,0,0,0);
                    end = new Date(); end.setDate(end.getDate() - 1); end.setHours(23,59,59,999);
                } else if (currentFilter.date) {
                    start = new Date(currentFilter.date); start.setHours(0,0,0,0);
                    end = new Date(currentFilter.date); end.setHours(23,59,59,999);
                }
                if (start && end) {
                    constraints.push(where('createdAt', '>=', start));
                    constraints.push(where('createdAt', '<=', end));
                }
            }

            if (role === 'manager' && managerBranchId) {
                constraints.push(where('nearestBranch.id', '==', managerBranchId));
        } else if (role === 'admin' && adminSelectedBranch !== 'ALL' && tab !== 'analytics') {
            constraints.push(where('nearestBranch.id', '==', adminSelectedBranch));
        }

            let q;
            if (tab === 'analytics') {
                // Dans Analytics on charge tout le jour pour des stats exactes
                q = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), ...constraints);
            } else {
                // Dans l'historique, on charge 10 par 10
                q = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), ...constraints, limit(10));
                if (isLoadMore && lastHistoryDoc) {
                    q = query(q, startAfter(lastHistoryDoc));
                }
            }

            const snap = await getDocs(q);
            if (!snap.empty) {
                if (tab !== 'analytics') {
                    setLastHistoryDoc(snap.docs[snap.docs.length - 1]);
                    setHasMoreHistory(snap.docs.length === 10);
                }
                const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                if (isLoadMore) {
                    setLazyHistory(prev => {
                        const existingIds = new Set(prev.map(o => o.id));
                        return [...prev, ...fetched.filter(o => !existingIds.has(o.id))];
                    });
                } else {
                    setLazyHistory(fetched);
                }
            } else if (!isLoadMore) {
                setLazyHistory([]);
                setLastHistoryDoc(null);
                setHasMoreHistory(false);
            } else {
                setHasMoreHistory(false);
            }
        } catch (e) {
            console.error("Erreur historique:", e);
        }
        setLoadingLazyHistory(false);
    };

    // Recharger l'historique quand le filtre ou l'onglet change
    useEffect(() => {
        if (tab === 'history' || tab === 'analytics') {
            loadLazyHistory(false, f);
        }
    }, [tab, f.type, f.date]);

    const { safeOrders, branchOrders, pending, actives, problemOrders } = useMemo(() => {
        const sOrders = [...(orders || [])];

        const bOrders = role === 'manager' ? sOrders.filter(o => o.nearestBranch?.id === managerBranchId) : sOrders;
        
        // 🔥 N7iydou l-Commandes dyal POS (Caisse) mn Idara bach yb9aw ghi dyal l-Livraison (App/Tél)
        const idaraActiveOrders = bOrders.filter(o => o.source !== 'pos');

        // NOUVEAU: Isoler les commandes avec problème
        const pOrders = idaraActiveOrders.filter(o => {
            const isUnreachable = o.clientUnreachable;
            const hasAdminMsg = o.adminMessage && o.adminMessage.includes('PANNE');
            
            // 🔥 Détecter les Commandes Fantômes (M3el9in kter mn 12h)
            let isGhost = false;
            if (!['delivered', 'rejected'].includes(o.status)) {
                const orderTime = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : 0;
                if (orderTime > 0 && (Date.now() - orderTime > 12 * 60 * 60 * 1000)) isGhost = true;
            }
            
            return isUnreachable || hasAdminMsg || isGhost;
        });
        const nActives = idaraActiveOrders.filter(o => {
            if (['delivered', 'rejected'].includes(o.status)) return false;
            if (o.clientUnreachable) return false;
            if (o.adminMessage && o.adminMessage.includes('PANNE')) return false;
            const orderTime = o.createdAt?.seconds ? o.createdAt.seconds * 1000 : 0;
            if (orderTime > 0 && (Date.now() - orderTime > 12 * 60 * 60 * 1000)) return false;
            return true;
        });

        return {
            safeOrders: sOrders,
            branchOrders: bOrders,
            pending: nActives.filter(o => o.status === 'pending'),
            actives: nActives,
            problemOrders: pOrders
        };
    }, [orders, role, managerBranchId]);

    const { filteredHistory, totalCollecte, totalGainsLivreur, aRendre } = useMemo(() => {
        const filtered = lazyHistory.filter(o => { 
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
    }, [lazyHistory, historyDriverFilter, clientsList]);

    // 🔥 Fonction pour charger une archive spécifique
    const handleFetchArchive = async () => {
        if (!archiveDates.start || !archiveDates.end) return showNotify("Veuillez sélectionner les dates (Du / Au).", "error");
        setIsFetchingHistory(true);
        try {
            const start = new Date(archiveDates.start);
            start.setHours(0, 0, 0, 0);
            const end = new Date(archiveDates.end);
            end.setHours(23, 59, 59, 999);
            
            const q = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
                where('createdAt', '>=', start),
                where('createdAt', '<=', end),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            const oldOrds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setOlderOrders(oldOrds);
            setFullHistoryFetched(true);
            setF({ type: 'archive', date: '', search: '' });
            showNotify(`Archive chargée : ${oldOrds.length} commandes ✅`, "success");
        } catch (e) {
            console.error(e);
            showNotify("Erreur lors du chargement de l'historique", "error");
        }
        setIsFetchingHistory(false);
    };

    // 🔥 Fonction pour Sauvegarder & Supprimer l'archive (Firebase Emptying)
    const handleDownloadAndDeleteArchive = async () => {
        const ordersToDelete = olderOrders.filter(o => o.status === 'delivered' || o.status === 'rejected');
        if (ordersToDelete.length === 0) return showNotify("Aucune commande terminée à supprimer dans cette archive.", "error");
        if (!window.confirm(`⚠️ ATTENTION ⚠️\nVous allez télécharger et SUPPRIMER DEFINITIVEMENT ${ordersToDelete.length} commandes terminées de Firebase.\nCette action est irréversible. Voulez-vous continuer ?`)) return;

        setIsFetchingHistory(true);
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ordersToDelete, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `Archive_Commandes_${archiveDates.start}_au_${archiveDates.end}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            let batch = writeBatch(db);
            let count = 0;
            let totalDeleted = 0;
            for (const order of ordersToDelete) {
                const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id);
                batch.delete(orderRef);
                count++;
                totalDeleted++;
                if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0; }
            }
            if (count > 0) await batch.commit();

            setOlderOrders(prev => prev.filter(o => !ordersToDelete.includes(o)));
            if (olderOrders.length === ordersToDelete.length) { setFullHistoryFetched(false); setF({ type: 'today', date: '', search: '' }); }
            showNotify(`${totalDeleted} commandes sauvegardées et supprimées de Firebase ! 🧹`, "success");
        } catch (e) { console.error(e); showNotify("Erreur lors de la suppression.", "error"); }
        setIsFetchingHistory(false);
    };
    // 🔥 Fonction jdida bach t-imprimi automatiquement mnin t-accepter l-commande
    const handleUpdateStatus = async (orderId, newStatus, extraData) => {
        const orderToPrint = orders.find(o => o.id === orderId);
        const oldStatus = orderToPrint?.status;

        await updateStatus(orderId, newStatus, extraData);
        
        // Impression GHI ila kanet l-commande yalah dazet men 'pending' l 'preparing' (Accepter)
        if (newStatus === 'preparing' && oldStatus === 'pending') {
            if (orderToPrint) {
                // 🔔 L3ab sonnette (Audio)
            if (isSoundEnabled) {
                try {
                    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                    audio.play().catch(e => console.log("Audio bloqué par le navigateur (Autoplay Policy)", e));
                } catch (e) { console.log("Erreur audio", e); }
            }
                
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
        if(!/^(06|07)\d{8}$/.test(cleanPh)) return showNotify("Numéro de téléphone invalide (Doit commencer par 06 ou 07 et avoir 10 chiffres)", "error");
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
            const opts = parts.length > 1 ? parts[1].replace(')','').split(', ').map(opt => `\n   - ${formatSansIngredient(opt)}`).join('') : '';
            return `${i.qty}x ${baseName}${opts}`;
        }).join('\n'); 
        const etaMins = calculateETA(0); // 0 Hit Commande Par Tél mafihach distance direct (Ghaliban ghat3ti ~30-40 mins)
        
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), { userId: cleanPh, orderNumber: orderNum, customerName: '', phone: cleanPh, address: 'Commande par Téléphone', nearestBranch: branch, items: extCart, total: finalTotal, deliveryFee: finalDeliveryFee, subtotal: extTotal, status: 'pending', source: 'telephone', etaMinutes: etaMins, createdAt: serverTimestamp() });
        
        const msgTemplate = brand.messages?.standardOrder || DEFAULT_BRAND.messages.standardOrder; 
        const msgBody = buildMessage(msgTemplate, { brandName: (brand.name || '').toUpperCase(), items: detailsTxt, subtotal: extTotal, deliveryFee: finalDeliveryFee, total: finalTotal, appUrl: appUrl, eta: etaMins });
        
        openWhatsAppDirect(waPhone, msgBody);
        
        showNotify("Commande ajoutée w WhatsApp t7el! ✅", "success"); 
        setExtOrder({ type: 'telephone', phone: '', address: '', details: '', total: '', branchId: role === 'manager' ? managerBranchId : '', deliveryFee: 0 }); 
        setExtCart([]); 
        setShowExtMenu(false); 
        setTab('active');
    };

    const handleGlovoInvite = async () => {
        if(!extOrder.phone) return showNotify("Numéro darouri!", "error");
        const cleanPh = formatPhoneNumber(extOrder.phone);
        if(!/^(06|07)\d{8}$/.test(cleanPh)) return showNotify("Numéro de téléphone invalide (Doit commencer par 06 ou 07 et avoir 10 chiffres)", "error");
        const waPhone = getWhatsAppFormat(cleanPh); const appUrl = window.location.origin + window.location.pathname;
        const msgTemplate = brand.messages?.glovoInvite || DEFAULT_BRAND.messages.glovoInvite; 
        const msgBody = buildMessage(msgTemplate, { brandName: (brand.name || '').toUpperCase(), appUrl: appUrl });
        
        try {
            const clientRef = doc(db, 'artifacts', appId, 'public', 'data', 'clients', cleanPh);
            const snap = await getDoc(clientRef);
            if (!snap.exists()) {
                await setDoc(clientRef, { phone: cleanPh, source: 'glovo', isDriver: false, blocked: false, createdAt: serverTimestamp() });
            } else {
                await setDoc(clientRef, { source: 'glovo' }, { merge: true });
            }
            
            openWhatsAppDirect(waPhone, msgBody);
            showNotify("Invitation WhatsApp t7ellat w t-sjel l-client! ✅", "success"); 
            setExtOrder({ type: 'glovo', phone: '', address: '', details: '', total: '', branchId: '' });
        } catch (error) { showNotify("Erreur d'enregistrement", "error"); }
    };

    const handleExportCSV = () => {
        const headers = ['Nom', 'Téléphone', 'Role', 'Statut', 'Date Création', 'App Installée', 'Type Appareil', 'Total Commandes', 'Total Livraisons'];
        const rows = (clientsList||[]).map(c => {
            const clientOrders = safeOrders.filter(o => o.userId === c.uid || o.phone === c.phone).length;
            const driverOrders = safeOrders.filter(o => o.driverId === c.uid && o.status === 'delivered').length;
            const role = c.isDriver ? (c.isFreelance ? 'Livreur (Freelance)' : 'Livreur (Officiel)') : 'Client';
            const status = c.blocked ? 'Bloqué' : 'Actif';
            let creationDate = '--';
            if (c.createdAt?.seconds) {
                creationDate = new Date(c.createdAt.seconds * 1000).toLocaleString('fr-FR');
            }
            const appInstalled = c.isAppInstalled ? 'OUI' : 'NON';
            const device = c.deviceType ? c.deviceType.toUpperCase() : 'INCONNU';
            return `"${c.name || 'Inconnu'}","${c.phone || ''}","${role}","${status}","${creationDate}","${appInstalled}","${device}","${clientOrders}","${driverOrders}"`;
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
        if (p.length === 9 && (p.startsWith('6') || p.startsWith('7'))) p = '0' + p;
        if (!/^(06|07)\d{8}$/.test(p)) return showNotify("Numéro invalide (06... ou 07... avec 10 chiffres)", "error");

        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', p), {
                name: newDriver.name, phone: p, isDriver: true, isFreelance: newDriver.isFreelance, blocked: false, createdAt: serverTimestamp(), otp: otpCode, otpVerified: false
            }, { merge: true });
            
            showNotify("Livreur ajouté b-naja7! ✅", "success");
            setShowAddDriver(false);
            setNewDriver({ name: '', phone: '', isFreelance: false });
        } catch (e) {
            showNotify("Erreur d'ajout", "error");
        }
    };

    // 🔥 NOUVEAU: Hard Reset (Formater) - Msah rir les commandes
    const handleHardResetOrders = async () => {
        if (!window.confirm("⚠️ ATTENTION : Wach mt2ked bghiti tmsse7 GA3 LES COMMANDES (L9dam w Jdad) ?\n\nHadchi ghadi ymsse7 les commandes w ykhli les comptes dyal les clients w les livreurs. Action irréversible !")) return;

        const code = window.prompt("Taper 'FORMAT' bach t-confirmer :");
        if (code !== 'FORMAT') {
            return showNotify("Formatage annulé. Code incorrect.", "error");
        }

        setIsFetchingHistory(true);
        try {
            showNotify("Formatage en cours... (Suppression des commandes)", "info");
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                setIsFetchingHistory(false);
                return showNotify("Aucune commande à supprimer.", "info");
            }

            let batch = writeBatch(db);
            let count = 0;
            let total = 0;

            for (const document of snap.docs) {
                batch.delete(document.ref);
                count++;
                total++;
                if (count === 490) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
            
            if (count > 0) {
                await batch.commit();
            }
            
            setLazyHistory([]);
            setOlderOrders([]);
            showNotify(`${total} commandes supprimées avec succès ! App formatée ✅`, "success");
        } catch (error) {
            console.error("Erreur Hard Reset :", error);
            showNotify("Erreur lors de la suppression.", "error");
        }
        setIsFetchingHistory(false);
    };

    const renderNavItem = ({ id, icon, label, badge, hidden }) => {
        if (hidden) return null; const active = tab === id;
        return ( <button key={id} onClick={() => { setTab(id); setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between p-3.5 mb-2 rounded-xl transition-all font-medium text-xs md:text-sm tracking-wider border ${active ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-lg scale-[1.02]' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent'}`}> <div className="flex items-center gap-3">{icon}<span>{label}</span></div> {badge > 0 && <span className={`px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm ${active ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-300'}`}>{badge}</span>} </button> )
    };

    const btnRadiusMock = brand.buttonStyle === 'square' ? 'rounded-md' : (brand.buttonStyle === 'rounded' ? 'rounded-xl' : 'rounded-full');

    return (
      <div className="flex h-[100dvh] bg-[#0f172a] text-slate-200 font-sans w-full absolute inset-0 z-[100] overflow-hidden" style={{ fontFamily: brand.fontFamily || "'Poppins', sans-serif" }}>
        {tab !== 'pos' && (
        <div className={`fixed inset-y-0 left-0 w-64 bg-[#1e293b] border-r border-slate-700/50 text-slate-200 shadow-2xl z-[200] transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative flex flex-col shrink-0`}>
        <div className="p-6 flex justify-between items-center border-b border-slate-700/50 shrink-0">
            <div>
                <h2 className="font-black text-2xl italic uppercase tracking-tighter flex items-center gap-3 select-none" onDoubleClick={() => {
                    if (role === 'admin' && !isSpyVisible) {
                        const code = window.prompt("Code secret :");
                        if (code) {
                            if ((settings?.spySecret && code === settings.spySecret) || btoa(code) === "MTk4Nw==") {
                                setIsSpyVisible(true);
                                if (showNotify) showNotify("Bouton d'écoute affiché 🕵️‍♂️", "success");
                            } else {
                                if (showNotify) showNotify("Code invalide ❌", "error");
                            }
                        }
                    }
                }}>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg"><Activity size={18} className="text-white" /></div>
                    <span style={{color: brand.color}}>{brand.texts?.adminTitle || 'Idara'}</span>
                </h2>
                {role === 'manager' && myBranch && <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Gérant : {myBranch.name}</p>}
                {role === 'admin' && adminSelectedBranch !== 'ALL' && <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Agence : {(settings?.branches || []).find(b => b.id === adminSelectedBranch)?.name}</p>}
            </div>
            <button className="md:hidden text-slate-400 hover:text-slate-200" onClick={() => setIsSidebarOpen(false)}><X size={24}/></button>
        </div>
            <div className="flex-1 overflow-y-auto py-6 px-4 no-scrollbar">
                {renderNavItem({ id: "pos", icon: <ShoppingBag size={20}/>, label: "Caisse (POS)", hidden: !hasAccess('pos') })}
                {hasAccess('kds') && (
                    <button onClick={() => {
                    const branchQuery = role === 'manager' ? managerBranchId : (adminSelectedBranch !== 'ALL' ? adminSelectedBranch : '');
                    const route = branchQuery ? `/kds?branch=${branchQuery}` : '/kds';
                        window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank');
                    }} className="w-full flex items-center justify-between p-3.5 mb-2 rounded-xl transition-all font-medium text-xs md:text-sm tracking-wider border text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent">
                        <div className="flex items-center gap-3"><ChefHat size={20}/><span>Cuisine (KDS)</span></div>
                    </button>
                )}
                {hasAccess('tv') && (
                    <button onClick={() => {
                    const branchQuery = role === 'manager' ? managerBranchId : (adminSelectedBranch !== 'ALL' ? adminSelectedBranch : '');
                    const route = branchQuery ? `/tv?branch=${branchQuery}` : '/tv';
                        window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank');
                    }} className="w-full flex items-center justify-between p-3.5 mb-2 rounded-xl transition-all font-medium text-xs md:text-sm tracking-wider border text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border-transparent">
                        <div className="flex items-center gap-3"><Monitor size={20}/><span>Écran TV</span></div>
                    </button>
                )}
                {renderNavItem({ id: "active", icon: <Store size={20}/>, label: "Commandes", badge: pending.length, hidden: !hasAccess('active') })}
                {renderNavItem({ id: "problems", icon: <AlertTriangle size={20}/>, label: "Problèmes", badge: problemOrders.length, hidden: problemOrders.length === 0 || !hasAccess('problems') })}
                {renderNavItem({ id: "standard", icon: <Phone size={20}/>, label: "Standard Tél", hidden: !hasAccess('standard') })}
                
                {renderNavItem({ id: "history", icon: <History size={20}/>, label: "Historique", hidden: !hasAccess('history') })}
                {renderNavItem({ id: "analytics", icon: <TrendingUp size={20}/>, label: "Analyses & Stats", hidden: role === 'manager' })}
                {renderNavItem({ id: "glovo_report", icon: <Calculator size={20}/>, label: "Rapport Glovo", hidden: role === 'manager' })}
                {renderNavItem({ id: "drivers", icon: <Truck size={20}/>, label: "Livreurs", badge: (clientsList||[]).filter(c => c.isDriver === true && (liveOnlineDrivers||[]).some(od => ((c.uid && od.uid === c.uid) || (od.phone && c.id && od.phone === c.id)) && isDriverOnline(od))).length, hidden: !hasAccess('drivers') })}
                {renderNavItem({ id: "maps", icon: <MapIcon size={20}/>, label: "Live Maps", hidden: !hasAccess('maps') })}
                {renderNavItem({ id: "clients", icon: <Users size={20}/>, label: "Livreurs & Comptes", hidden: !hasAccess('clients') })}
                {renderNavItem({ id: "avis", icon: <Star size={20}/>, label: "Avis clients", hidden: role === 'manager' })}
                {renderNavItem({ id: "config", icon: <Palette size={20}/>, label: "Éditeur Visuel", hidden: role === 'manager' })}
                {renderNavItem({ id: "maintenance", icon: <Database size={20}/>, label: "Maintenance", hidden: role === 'manager' })}
            </div>
            <div className="p-4 border-t border-slate-700/50 shrink-0"><button onClick={onLogout} className="flex items-center gap-3 text-slate-400 font-bold hover:text-red-400 w-full p-2 transition-colors"><LogOut size={20}/> Se déconnecter</button></div>
        </div>
        )}

        {isSidebarOpen && tab !== 'pos' && <div className="fixed inset-0 bg-black/50 z-[150] md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

        <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
            {tab !== 'pos' && (
            <header className="bg-[#1e293b] h-20 border-b border-slate-700/50 flex items-center justify-between px-4 md:px-8 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button className="md:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-md transition-colors" onClick={() => setIsSidebarOpen(true)}><Menu size={20}/></button>
                    <h2 className="font-bold text-lg hidden md:block text-slate-200 capitalize">{tab === 'active' ? 'Commandes' : tab === 'config' ? 'Éditeur Visuel Live' : tab === 'analytics' ? 'Analyses & Stats' : tab === 'glovo_report' ? 'Rapport Glovo' : tab}</h2>
                    <h2 className="font-bold text-lg hidden md:block text-slate-200 capitalize select-none" onDoubleClick={() => {
                        if (role === 'admin' && !isSpyVisible) {
                            const code = window.prompt("Code secret :");
                            if (code) {
                                if ((settings?.spySecret && code === settings.spySecret) || btoa(code) === "MTk4Nw==") {
                                    setIsSpyVisible(true);
                                    if (showNotify) showNotify("Bouton d'écoute affiché 🕵️‍♂️", "success");
                                } else {
                                    if (showNotify) showNotify("Code invalide ❌", "error");
                                }
                            }
                        }
                    }}>{tab === 'active' ? 'Commandes' : tab === 'config' ? 'Éditeur Visuel Live' : tab === 'analytics' ? 'Analyses & Stats' : tab}</h2>
                    {role === 'admin' && (
                        <select
                            value={adminSelectedBranch}
                            onChange={(e) => setAdminSelectedBranch(e.target.value)}
                            className="bg-slate-800 border border-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 hidden md:block"
                        >
                            <option value="ALL">Toutes les agences</option>
                            {(settings?.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {role === 'admin' && isSpyVisible && (
                        <button onClick={() => setShowSpyModal(true)} className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700">
                            <Mic size={14} className="text-red-400" /> Écoute
                        </button>
                    )}
                    {!isSoundEnabled && (
                        <button onClick={enableSound} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-all bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 hover:scale-105">
                            🔔 Activer Son
                        </button>
                    )}
                    {role === 'admin' && ( 
                        <>
                            <span className="text-xs font-bold text-slate-400 hidden md:inline-block">Freelance:</span>
                            <button onClick={async()=> {await saveSettings({...settings, freelanceEnabled: !settings?.freelanceEnabled}); showNotify("Freelance Maj ✅", "success");}} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all border ${settings?.freelanceEnabled ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>{settings?.freelanceEnabled ? <Check size={14}/> : <Minus size={14}/>} {settings?.freelanceEnabled ? 'Activé' : 'Désactivé'}</button>
                            
                            <span className="text-xs font-bold text-slate-400 hidden md:inline-block ml-4">Boutique:</span>
                            <button onClick={async()=> {await saveSettings({...settings, isOpen: !settings?.isOpen}); showNotify("Maj Boutique ✅", "success");}} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all border ${settings?.isOpen ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{settings?.isOpen ? <Check size={14}/> : <Minus size={14}/>} {settings?.isOpen ? 'Ouvert' : 'Fermé'}</button>
                        </> 
                    )}
                </div>
            </header>
            )}

            <main className={`flex-1 ${tab === 'pos' ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8 pb-20'} bg-[#0f172a] relative`}>
                <Suspense fallback={
                    <div className="h-full w-full flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                }>
                    
                    {tab === 'pos' && (
                    <PosDashboard 
                        settings={settings} 
                        brand={brand} 
                        db={db} 
                        appId={appId} 
                        showNotify={showNotify} 
                        managerBranchId={managerBranchId} 
                        adminSelectedBranch={adminSelectedBranch}
                        isAdmin={role === 'admin'}
                        orders={orders}
                        updateStatus={updateStatus}
                        handleReassignOrder={handleReassignOrder}
                        onQuit={() => setTab('active')}
                        setTab={setTab}
                        saveSettings={saveSettings}
                        hasAccess={hasAccess}
                        clientsList={clientsList}
                        onlineDrivers={liveOnlineDrivers}
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
                            onlineDrivers={liveOnlineDrivers}
                            db={db}
                            appId={appId}
                            showNotify={showNotify}
                            hasAccess={hasAccess}
                        />
                    </div>
                )}

                    {tab === 'problems' && (
                    <div className="space-y-6 animate-in fade-in pb-4">
                        <div className="bg-red-50 p-6 md:p-8 rounded-[2rem] border border-red-200 shadow-sm">
                            <h2 className="text-xl md:text-2xl font-black text-red-600 mb-6 flex items-center gap-3"><AlertTriangle size={28}/> Problèmes Commandes À Gérer ({problemOrders.length})</h2>
                            {problemOrders.length === 0 ? (
                                <p className="text-gray-500 font-bold">Aucun problème à gérer.</p>
                            ) : (
                                <div className="space-y-4">
                                    {problemOrders.map(o => (
                                        <div key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-black text-gray-900 text-lg">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${o.source === 'pos' ? 'bg-blue-100 text-blue-700' : o.source === 'telephone' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {o.source === 'pos' ? 'Caisse (POS)' : o.source === 'telephone' ? 'Téléphone' : 'App Client'}
                                                    </span>
                                                    {o.source === 'pos' && o.orderType && (
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${o.orderType === 'sur_place' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'}`}>
                                                            {o.orderType === 'sur_place' ? '🍽️ Sur Place (Plateau)' : '🛍️ À Emporter (Emballage)'}
                                                        </span>
                                                    )}
                                                    <span className="text-sm font-bold text-gray-500">{o.customerName || o.name || o.phone}</span>
                                                </div>
                                                <p className="text-sm text-red-600 font-bold flex items-center gap-1.5 bg-red-100/50 w-fit px-3 py-1 rounded-lg">
                                            🚨 {o.adminMessage || (o.clientUnreachable ? "Client Injoignable" : ((Date.now() - (o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now())) > 12*60*60*1000 ? "Commande Bloquée (M3el9a kter mn 12h)" : "Problème signalé"))}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button onClick={() => handleUpdateStatus(o.id, o.status, {clientUnreachable: false, adminMessage: null})} className="px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all">
                                                    ✅ Résolu (Retour Normal)
                                                </button>
                                                <button onClick={() => setConfirmDialog({
                                                    message: 'Annuler cette commande ?',
                                                    onConfirm: () => handleUpdateStatus(o.id, 'rejected', {reason: o.adminMessage || 'Problème de livraison', driverPaid: true, deliveredAtLocal: Date.now(), clientUnreachable: false, adminMessage: null})
                                                })} className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all">
                                                    ❌ Annuler
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
                               <label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Numéro de Téléphone <span className="text-red-500">*</span></span><input className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" placeholder="06XXXXXXXX ou 07XXXXXXXX" type="tel" value={extOrder.phone} onChange={e=>setExtOrder({...extOrder, phone: e.target.value.replace(/[^\d]/g, '').slice(0, 10)})} /></label>
                           </div>
                           <label className="block">
                               <span className="text-xs font-medium text-gray-700 mb-1.5 block">Frais de Livraison (DH)</span>
                               <div className="flex gap-2">
                                   {[0, 5, 10, 15, 20].map((fee) => (
                                       <button 
                                           key={fee} 
                                           onClick={() => setExtOrder({...extOrder, deliveryFee: fee})}
                                           className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all border ${Number(extOrder.deliveryFee) === fee ? 'bg-blue-500 text-white border-blue-600 shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                       >
                                           {fee} DH
                                       </button>
                                   ))}
                               </div>
                           </label>
                           <label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Agence / Point de Vente <span className="text-red-500">*</span></span><select disabled={role === 'manager'} className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer disabled:opacity-50 shadow-sm" value={extOrder.branchId} onChange={e=>setExtOrder({...extOrder, branchId: e.target.value})}><option value="">Sélectionner une agence...</option>{(settings?.branches || DEFAULT_BRANCHES).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                           
                           <div className="block mt-2">
                              <div className="flex justify-between items-center mb-3"><span className="text-xs font-medium text-gray-700 block">Détails de la Commande <span className="text-red-500">*</span></span><button onClick={()=>setShowExtMenu(!showExtMenu)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border border-gray-200">{showExtMenu ? 'Cacher le Menu' : 'Ajouter un produit'}</button></div>
                              <div className={`transition-all overflow-hidden ${showExtMenu ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0'}`}><div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-wrap gap-2 overflow-y-auto max-h-60 no-scrollbar shadow-sm">{(settings?.menuItems || DEFAULT_MENU_ITEMS).map(item => (<button key={item.id} disabled={item.outOfStock} onClick={() => { if (item.removableIngredients || item.hasVariations || item.choices || (item.extras && item.extras.length > 0)) { setSelectedExtItem(item); setExtItemOptions([]); setExtSelectedVariation(item.hasVariations && item.variations?.length > 0 ? item.variations[0] : null); setExtSelectedChoice(null); setExtSelectedExtras([]); } else { addExtCart({...item, cartItemId: item.id + '_default'}); } }} className={`bg-gray-50 px-3 py-2 rounded-md border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-all flex items-center gap-2 ${item.outOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}><span>{item.img?.startsWith('http') || item.img?.startsWith('data:image') ? '🍔' : item.img}</span> {item.name || ''} {item.hasVariations && <span className="text-[9px] text-blue-500 font-bold ml-1">(Tailles)</span>} <span className="text-gray-900 font-semibold ml-auto">{item.price} DH</span></button>))}</div></div>
                              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 min-h-[100px] shadow-inner">{extCart.length === 0 ? (<p className="text-sm font-medium text-blue-400 flex items-center justify-center h-full min-h-[80px]">Le panier est vide pour le moment.</p>) : (<div className="space-y-3">{extCart.map(item => (<div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow"><div className="flex flex-col"><span className="text-sm font-bold text-gray-900">{(item.name || '').split(' (Sans ')[0] || ''}</span>{(item.name || '').includes(' (Sans ') && (item.name || '').split(' (Sans ')[1].replace(')','').split(', ').map((opt, idx) => <span key={idx} className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-bold mt-1 w-fit uppercase">- {formatSansIngredient(opt)}</span>)}</div><div className="flex items-center gap-4"><span className="text-base font-black text-blue-600">{item.price * item.qty} DH</span><div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200"><button onClick={() => removeExtCart(item)} className="w-7 h-7 bg-white hover:bg-gray-100 rounded-md text-gray-600 shadow-sm flex items-center justify-center font-bold">-</button><span className="text-sm font-black w-5 text-center">{item.qty}</span><button onClick={() => addExtCart(item)} className="w-7 h-7 bg-white hover:bg-gray-100 rounded-md text-gray-600 shadow-sm flex items-center justify-center font-bold">+</button></div></div></div>))}</div>)}</div>
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

                                   {selectedExtItem.choices && (() => {
                                       let choiceList = [];
                                       const choicesStr = String(selectedExtItem.choices).trim();
                                       if (choicesStr.toUpperCase().startsWith('CAT:')) {
                                           const catName = choicesStr.split(':')[1].trim();
                                           const matchedItems = (settings?.menuItems || DEFAULT_MENU_ITEMS).filter(i => i.category === catName && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                                           matchedItems.forEach(i => {
                                               if (i.hasVariations && i.variations?.length > 0) {
                                                   i.variations.forEach(v => choiceList.push({ name: `${i.name} (${v.name})`, img: i.img }));
                                               } else {
                                                   choiceList.push({ name: i.name, img: i.img });
                                               }
                                           });
                                       } else if (choicesStr.toUpperCase().startsWith('PROD:')) {
                                           const prodNames = choicesStr.substring(5).split(',').map(n => n.trim().toLowerCase());
                                           const matchedItems = (settings?.menuItems || DEFAULT_MENU_ITEMS).filter(i => prodNames.includes((i.name || '').trim().toLowerCase()) && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                                           matchedItems.forEach(i => {
                                               if (i.hasVariations && i.variations?.length > 0) {
                                                   i.variations.forEach(v => choiceList.push({ name: `${i.name} (${v.name})`, img: i.img }));
                                               } else {
                                                   choiceList.push({ name: i.name, img: i.img });
                                               }
                                           });
                                       } else {
                                           choiceList = choicesStr.split(',').map(choice => {
                                               const parts = choice.trim().split('|');
                                               return { name: parts[0].trim(), img: parts.length > 1 ? parts[1].trim() : null };
                                           }).filter(c => c.name);
                                       }

                                       return (
                                     <div className="mb-6">
                                       <p className="text-sm font-medium text-gray-600 mb-3">Choix / Parfum <span className="text-red-500">*</span></p>
                                      <div className={`${choiceList.some(c => c.img) ? 'grid grid-cols-2 gap-2' : 'space-y-2'}`}>
                                         {choiceList.map(c => (
                                            <label key={c.name} className={`flex ${c.img ? 'flex-col items-center text-center' : 'items-center justify-between'} p-3 rounded-lg border cursor-pointer transition-all ${extSelectedChoice === c.name ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                                {c.img && (
                                                    <div className="w-12 h-12 mb-2 rounded-md overflow-hidden flex items-center justify-center">
                                                        {c.img.startsWith('http') || c.img.startsWith('data:image') ? <img src={c.img} className="w-full h-full object-contain" alt={c.name} /> : <span className="text-3xl">{c.img}</span>}
                                                    </div>
                                                )}
                                                <div className={`flex items-center gap-3 ${c.img ? 'w-full justify-center' : ''}`}>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${extSelectedChoice === c.name ? 'border-blue-500' : 'border-gray-300'}`}>{extSelectedChoice === c.name && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}</div>
                                                    <span className="font-medium text-sm text-gray-900 leading-tight">{c.name}</span>
                                                 </div>
                                                 <input type="radio" className="hidden" name="extchoice" checked={extSelectedChoice === c.name} onChange={() => setExtSelectedChoice(c.name)} />
                                             </label>
                                           ))}
                                       </div>
                                     </div>
                                       );
                                   })()}
                                   {selectedExtItem.extras?.length > 0 && (
                                       (() => {
                                         const activeGlobalDrinks = settings?.globalDrinks !== undefined ? settings.globalDrinks : PREDEFINED_DRINKS;
                                         const drinkNames = new Set(activeGlobalDrinks.map(d => d.name));
                                         const pureExtras = (selectedExtItem.extras || []).filter(e => !drinkNames.has(e.name));
                                         const pureDrinks = (selectedExtItem.extras || []).filter(e => drinkNames.has(e.name));
                                         
                                         return (
                                             <>
                                               {pureExtras.length > 0 && (
                                                 <div className="mb-6">
                                                   <p className="text-sm font-medium text-gray-600 mb-3">➕ Extras & Suppléments :</p>
                                                   <div className="space-y-2">
                                                     {pureExtras.map(ext => {
                                                       const isAdded = extSelectedExtras.some(e => e.name === ext.name);
                                                       return ( 
                                                           <button key={ext.name} onClick={() => { if (isAdded) setExtSelectedExtras(extSelectedExtras.filter(e => e.name !== ext.name)); else setExtSelectedExtras([...extSelectedExtras, ext]); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm font-medium ${isAdded ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                                                               <span>Avec {ext.name} (+{ext.price} DH)</span>
                                                               <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isAdded ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>{isAdded && <Check size={14} color="white" strokeWidth={4} />}</div>
                                                           </button> 
                                                       );
                                                     })}
                                                   </div>
                                                 </div>
                                               )}
                                               {pureDrinks.length > 0 && (
                                                 <div className="mb-6">
                                                   <p className="text-sm font-medium text-gray-600 mb-3">🥤 Boissons :</p>
                                                   <div className="space-y-2">
                                                     {pureDrinks.map(ext => {
                                                       const isAdded = extSelectedExtras.some(e => e.name === ext.name);
                                                       return ( 
                                                           <button key={ext.name} onClick={() => { if (isAdded) setExtSelectedExtras(extSelectedExtras.filter(e => e.name !== ext.name)); else setExtSelectedExtras([...extSelectedExtras, ext]); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm font-medium ${isAdded ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>
                                                               <span>{ext.name} (+{ext.price} DH)</span>
                                                               <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isAdded ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>{isAdded && <Check size={14} color="white" strokeWidth={4} />}</div>
                                                           </button> 
                                                       );
                                                     })}
                                                   </div>
                                                 </div>
                                               )}
                                             </>
                                         );
                                       })()
                                   )}

                                   {selectedExtItem.removableIngredients && (
                                     <div>
                                       <p className="text-sm font-medium text-gray-600 mb-3">Ingrédients à retirer :</p>
                                       <div className="space-y-2">
                                         {(selectedExtItem.removableIngredients || '').split(',').map(ing => {
                                     const ingredient = ing.trim(); if (!ingredient) return null;
                                     const isRemoved = extItemOptions.includes(ingredient);
                                     return ( <button key={ingredient} onClick={() => { if (isRemoved) setExtItemOptions(extItemOptions.filter(o => o !== ingredient)); else setExtItemOptions([...extItemOptions, ingredient]); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-sm font-medium ${isRemoved ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}><span>{formatSansIngredient(ingredient)}</span><div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 ${isRemoved ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>{isRemoved && <Check size={14} color="white" strokeWidth={4} />}</div></button> );
                                   })}
                                       </div>
                                     </div>
                                   )}
                                 </div>
                                 <button onClick={() => { if (selectedExtItem.hasVariations && !extSelectedVariation) return showNotify("Veuillez choisir une taille !", "error"); if (selectedExtItem.choices && !extSelectedChoice) return showNotify("Veuillez choisir une option (Choix/Parfum) !", "error"); const optionsSuffix = extItemOptions.length > 0 ? '_' + extItemOptions.join('_') : '_default'; const varSuffix = extSelectedVariation ? '_' + extSelectedVariation.name.replace(/\s+/g, '') : ''; const choiceSuffix = extSelectedChoice ? '_' + extSelectedChoice.replace(/\s+/g, '') : ''; const extrasSuffix = extSelectedExtras.length > 0 ? '_' + extSelectedExtras.map(e => e.name.replace(/\s+/g, '')).join('_') : ''; const cartItemId = selectedExtItem.id + varSuffix + choiceSuffix + optionsSuffix + extrasSuffix; let finalPrice = extSelectedVariation ? Number(extSelectedVariation.price || 0) : Number(selectedExtItem.price || 0); finalPrice += extSelectedExtras.reduce((s, e) => s + Number(e.price), 0); const varNamePart = extSelectedVariation ? ` (${extSelectedVariation.name})` : ''; const choiceNamePart = extSelectedChoice ? ` (${extSelectedChoice})` : ''; const avecNamePart = extSelectedExtras.length > 0 ? ` (Avec ${extSelectedExtras.map(e => e.name).join(', ')})` : ''; const sansNamePart = extItemOptions.length > 0 ? ` (Sans ${extItemOptions.join(', ')})` : ''; const finalName = selectedExtItem.name + varNamePart + choiceNamePart + avecNamePart + sansNamePart; const existingItem = extCart.find(c => (c.cartItemId || c.id) === cartItemId); if (existingItem) { setExtCart(extCart.map(c => (c.cartItemId || c.id) === cartItemId ? { ...c, qty: c.qty + 1 } : c)); } else { setExtCart([...extCart, { ...selectedExtItem, qty: 1, cartItemId, name: finalName, price: finalPrice }]); } setSelectedExtItem(null); showNotify("Produit ajouté ! 🍔", "success"); }} className="w-full py-3 rounded-lg font-medium text-sm text-white shadow-sm bg-blue-600 hover:bg-blue-700 mt-4">Valider • {(extSelectedVariation ? Number(extSelectedVariation.price || 0) : Number(selectedExtItem.price || 0)) + extSelectedExtras.reduce((s,e)=>s+Number(e.price),0)} DH</button>
                               </div>
                             </div>
                           )}
                        </div>
                      )}

                      {extOrder.type === 'glovo' && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
                           <h3 className="font-semibold text-gray-900 text-base mb-2 flex items-center gap-2 border-b border-gray-100 pb-3"><Truck size={16} className="text-gray-500"/> Convertir Client Glovo</h3>
                           <div className="grid grid-cols-1 gap-4"><label className="block"><span className="text-xs font-medium text-gray-700 mb-1.5 block">Numéro de Téléphone <span className="text-red-500">*</span></span><input className="w-full bg-white border border-gray-300 p-2.5 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" placeholder="06XXXXXXXX ou 07XXXXXXXX" type="tel" value={extOrder.phone} onChange={e=>setExtOrder({...extOrder, phone: e.target.value.replace(/[^\d]/g, '').slice(0, 10)})} /></label></div>
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
                               <p className="text-4xl font-black text-gray-900">{(clientsList||[]).filter(c => c.isDriver === true && (liveOnlineDrivers||[]).some(od => ((c.uid && od.uid === c.uid) || (od.phone && c.id && od.phone === c.id)) && isDriverOnline(od))).length} <span className="text-lg font-bold text-gray-500">Livreurs actifs</span></p>
                               </div>
                           </div>
                           <button onClick={handleWakeUpDrivers} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
                               <Navigation size={18}/> Wake Up GPS
                           </button>
                       </div>
                       
                       {/* Carte Live Map SaaS */}
                       <div className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white p-2">
                           <AdminMap 
                           onlineDrivers={(liveOnlineDrivers||[]).filter(d => isDriverOnline(d) && d.lat && d.lng && (d.uid || d.phone)).map(d => ({
                                   ...d,
                                   isFreelance: (clientsList||[]).find(c => (c.uid && c.uid === d.uid) || (d.phone && c.phone === d.phone))?.isFreelance
                               }))} 
                               branches={settings?.branches || DEFAULT_BRANCHES} 
                           />
                       </div>
                       
                       {/* 🔥 NOUVEAU : Alerte si RTDB est déconnecté */}
                       {!isRtdbConnected && (
                           <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 mt-4">
                               <AlertTriangle className="text-red-500 shrink-0" size={20} />
                               <div>
                                   <h4 className="text-red-800 font-bold text-sm">Connexion Live Interrompue 📡</h4>
                                   <p className="text-red-700 text-xs mt-1">L'Idara a perdu la connexion avec le serveur Live. Tentative de reconnexion automatique en cours...</p>
                               </div>
                           </div>
                       )}

                       {/* Alert info GPS */}
                   {(liveOnlineDrivers||[]).filter(d => isDriverOnline(d) && (!d.lat || !d.lng)).length > 0 && (
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
                                   {(clientsList||[]).filter(c => c.isDriver === true && (liveOnlineDrivers||[]).some(od => ((c.uid && od.uid === c.uid) || (od.phone && c.id && od.phone === c.id)) && isDriverOnline(od))).length === 0 ? (
                                           <tr>
                                               <td colSpan="5" className="py-16 text-center text-gray-400">
                                                   <Truck size={40} className="mx-auto mb-3 opacity-20"/>
                                                   <p className="font-semibold text-sm">Aucun livreur n'est en ligne pour le moment 😴</p>
                                               </td>
                                           </tr>
                                   ) : (clientsList||[]).filter(c => c.isDriver === true).map(c => {
                                       const onlineData = (liveOnlineDrivers||[]).find(od => ((c.uid && od.uid === c.uid) || (od.phone && c.id && od.phone === c.id)) && isDriverOnline(od)); 
                                           if (!onlineData) return null;
                                           const isOnline = true; 
                                           const isAvailable = onlineData.isAvailable; 
                                           const driverTotalOrders = safeOrders.filter(o => c.uid && o.driverId === c.uid && o.status === 'delivered').length;
                                           const activeCount = actives.filter(o => c.uid && o.driverId === c.uid).length;
                                           
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
                                                               <a href={`tel:${c.phone}`} className="text-[10px] text-blue-500 font-mono underline hover:text-blue-700 w-fit">
                                                                   {c.phone || ''}
                                                               </a>
                                                               {onlineData.appVersion && (
                                                                   <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border w-fit mt-0.5 ${onlineData.appVersion === latestGithubVersion ? 'text-green-600 bg-green-50 border-green-200' : 'text-orange-600 bg-orange-50 border-orange-200'}`}>
                                                                       v{onlineData.appVersion} {onlineData.appVersion !== latestGithubVersion && '(Maj dispo)'}
                                                                   </span>
                                                               )}
                                                               <div className="flex flex-wrap gap-1 mt-1">
                                                                   {c.isAppInstalled ? <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded border border-green-200 font-bold">📲 App Installée</span> : <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200 font-bold">🌐 Navigateur</span>}
                                                                   {c.deviceType === 'ios' ? <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-300 font-bold">🍎 iOS</span> : c.deviceType === 'android' ? <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200 font-bold">🤖 Android</span> : <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 font-bold">💻 PC</span>}
                                                               </div>
                                                               <span className="text-[9px] text-gray-400 mt-1 font-medium">Inscrit le: {c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '--/--/----'}</span>
                                                           </div>
                                                       </div>
                                                   </td>
                                                   <td className="px-6 py-4">
                                                       <div className="flex flex-col gap-1.5 items-start">
                                                           <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${c.isFreelance ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                               {c.isFreelance ? 'Freelance' : 'Officiel'}
                                                           </span>
                                                           {isOnline ? (
                                                               activeCount === 0 ? <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">✅ Disponible (Kitsenna)</span> : <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">🛵 Occupé ({activeCount} cmd{activeCount > 1 ? 's' : ''} en cours)</span>
                                                           ) : <span className="text-[10px] font-semibold text-red-500">❌ Hors Ligne</span>}
                                                           
                                                           {c.otp && (
                                                               <span className="mt-1 bg-yellow-50 text-yellow-800 border border-yellow-200 px-2 py-1 rounded-md text-[11px] font-black shadow-sm">
                                                                   🔑 Code: {c.otp}
                                                               </span>
                                                           )}
                                                           
                                                           {c.otp && !c.otpVerified && (
                                                               <button 
                                                                   onClick={() => {
                                                                       const msg = `Salam ${c.name}, mar7ba bik m3ana! L-code de confirmation dyalek bach tdkhol l'application howa: *${c.otp}*`;
                                                                   openWhatsAppDirect(c.phone.replace(/^0/, '212'), msg);
                                                                   }}
                                                                   className="mt-1 bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-sm"
                                                               >
                                                                   📱 Envoyer Code : {c.otp}
                                                               </button>
                                                           )}
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
                handleFetchArchive={handleFetchArchive}
                handleDownloadAndDeleteArchive={handleDownloadAndDeleteArchive}
                archiveDates={archiveDates}
                setArchiveDates={setArchiveDates}
                    isFetchingHistory={isFetchingHistory}
                    fullHistoryFetched={fullHistoryFetched}
                olderOrders={olderOrders}
                    loadLazyHistory={loadLazyHistory}
                    loadingLazyHistory={loadingLazyHistory}
                    hasMoreHistory={hasMoreHistory}
                    />
                )}

                    {tab === 'analytics' && role === 'admin' && (() => {
                   let deliveredOrders = lazyHistory.filter(o => o.status === 'delivered');
                   
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

                   // NOUVEAU: Répartition par Source
                   const posOrders = deliveredOrders.filter(o => o.source === 'pos');
                   const appOrders = deliveredOrders.filter(o => !o.source || o.source === 'app');
                   const telOrders = deliveredOrders.filter(o => o.source === 'telephone');
                   
                   const caPos = posOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                   const caApp = appOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                   const caTel = telOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                   const totalRevenue = caPos + caApp + caTel;

                   // NOUVEAU: Rapport détaillé complet des produits
                   const productStats = {};
                   deliveredOrders.forEach(o => {
                       (o.items || []).forEach(item => {
                           const baseName = (item.name || '').split(' (Sans ')[0];
                           if (!productStats[baseName]) productStats[baseName] = { qty: 0, revenue: 0, img: item.img };
                           productStats[baseName].qty += item.qty;
                           productStats[baseName].revenue += (item.price * item.qty);
                       });
                   });
                   const sortedProducts = Object.entries(productStats).sort((a,b) => b[1].qty - a[1].qty);

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

                   // NOUVEAU: Top Agences (Performances)
                   const branchCount = {};
                   deliveredOrders.forEach(o => {
                       const bId = o.nearestBranch?.id || 'inconnu';
                       branchCount[bId] = branchCount[bId] || { name: o.nearestBranch?.name || 'Agence Inconnue', revenue: 0, count: 0 };
                       branchCount[bId].count += 1;
                       branchCount[bId].revenue += (Number(o.total) || 0);
                   });
                   const topBranches = Object.values(branchCount).sort((a,b) => b.revenue - a.revenue).slice(0, 5);

               // NOUVEAU: Fonction pour Imprimer ou Exporter en PDF
               const handlePrintAnalytics = () => {
                   const branchName = analyticsBranch === 'all' ? 'Toutes Agences' : (settings?.branches || DEFAULT_BRANCHES).find(b => b.id === analyticsBranch)?.name || 'Inconnu';
                   const periodName = analyticsPeriod === 'all' ? 'Toujours' : analyticsPeriod === 'today' ? "Aujourd'hui" : analyticsPeriod === 'yesterday' ? 'Hier' : analyticsPeriod;

                   const productsHtml = sortedProducts.map(([name, data]) => `
                       <tr style="border-bottom: 1px solid #eee;">
                           <td style="padding: 10px;">${name}</td>
                           <td style="padding: 10px; text-align: center; font-weight: bold;">${data.qty}x</td>
                           <td style="padding: 10px; text-align: right; font-weight: bold; color: #2563eb;">${data.revenue} DH</td>
                       </tr>
                   `).join('');

                   const html = `
                   <html>
                   <head>
                       <title>Rapport Analytique - ${brand?.name || 'Restaurant'}</title>
                       <style>
                           body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                           h1 { text-align: center; color: #111; margin-bottom: 5px; }
                           .header-info { text-align: center; margin-bottom: 30px; font-size: 14px; color: #666; padding-bottom: 15px; border-bottom: 1px dashed #ccc; }
                           .grid { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 15px; }
                           .card { border: 1px solid #e5e7eb; background: #f9fafb; padding: 20px; border-radius: 12px; flex: 1; text-align: center; }
                           .card h3 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; }
                           .card p { margin: 0; font-size: 28px; font-weight: 900; color: #111; }
                           .card small { color: #6b7280; font-weight: bold; font-size: 12px; }
                           table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                           th { background-color: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; color: #4b5563; }
                           .section-title { border-bottom: 2px solid #111; padding-bottom: 8px; margin-top: 40px; margin-bottom: 15px; font-size: 18px; text-transform: uppercase; }
                       </style>
                   </head>
                   <body>
                       <h1>RAPPORT ANALYTIQUE</h1>
                       <div class="header-info">
                           <p><strong>Agence :</strong> ${branchName} &nbsp;|&nbsp; <strong>Période :</strong> ${periodName}</p>
                           <p style="font-size: 12px; margin-top: 5px;">Généré le ${new Date().toLocaleString('fr-FR')}</p>
                       </div>

                       <div class="grid">
                           <div class="card"><h3>Chiffre d'Affaires</h3><p>${totalRevenue} <span style="font-size:16px; color:#666;">DH</span></p></div>
                           <div class="card"><h3>Commandes Livrées</h3><p>${deliveredOrders.length}</p></div>
                           <div class="card"><h3>Panier Moyen</h3><p>${deliveredOrders.length ? Math.round(totalRevenue / deliveredOrders.length) : 0} <span style="font-size:16px; color:#666;">DH</span></p></div>
                       </div>

                       <div class="grid" style="margin-top: 20px;">
                           <div class="card" style="background:#fff;"><h3>Caisse (POS)</h3><p>${caPos} <span style="font-size:14px; color:#666;">DH</span></p><br/><small>${posOrders.length} cmds</small></div>
                           <div class="card" style="background:#fff;"><h3>App (Livraison)</h3><p>${caApp} <span style="font-size:14px; color:#666;">DH</span></p><br/><small>${appOrders.length} cmds</small></div>
                           <div class="card" style="background:#fff;"><h3>Tél (Standard)</h3><p>${caTel} <span style="font-size:14px; color:#666;">DH</span></p><br/><small>${telOrders.length} cmds</small></div>
                       </div>

                       <h2 class="section-title">Détails des Ventes (Produits)</h2>
                       <table>
                           <thead>
                               <tr><th>Produit</th><th style="text-align: center;">Quantité</th><th style="text-align: right;">Chiffre d'Affaires</th></tr>
                           </thead>
                           <tbody>
                               ${productsHtml || '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #999;">Aucun produit vendu dans cette période.</td></tr>'}
                           </tbody>
                       </table>
                   </body>
                   </html>
                   `;
                   
                   // 🔥 ZEDNA HAD L-CODE: Impression Electron ola Web
                   if (typeof window !== 'undefined' && window.require) {
                       const { ipcRenderer } = window.require('electron');
                       ipcRenderer.send('print-ticket', html, brand?.selectedPrinter);
                   } else {
                       const printWindow = window.open('', '', 'width=800,height=900');
                       if (printWindow) {
                           const htmlWithScript = html.replace('</body>', `
                           <script>
                               window.onload = function() { 
                                   setTimeout(function() {
                                       window.print();
                                   }, 500);
                               };
                               window.onafterprint = function() {
                                   window.close();
                               };
                           </script>
                           </body>`);
                           printWindow.document.write(htmlWithScript);
                           printWindow.document.close();
                       }
                   }
               };

                   return (
                       <div className="space-y-6 animate-in fade-in pb-4">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-gray-200 pb-4">
                           <div className="flex items-center gap-3">
                               <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={24} strokeWidth={2}/></div>
                               <div><h2 className="text-xl font-semibold text-gray-900">Analyses & Statistiques</h2><p className="text-xs text-gray-500">Performances globales du restaurant</p></div>
                           </div>
                           <button onClick={handlePrintAnalytics} className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                               <Printer size={18}/> Imprimer / PDF
                           </button>
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

                           {/* NOUVEAU: REPARTITION PAR SOURCE */}
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-6">
                               <div className="bg-white border-2 border-indigo-100 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all">
                                   <div>
                                       <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Store size={14}/> Caisse (Sur Place)</p>
                                       <p className="text-3xl font-black text-gray-900">{caPos} <span className="text-sm text-gray-500">DH</span></p>
                                       <p className="text-xs font-bold text-gray-400 mt-1">{posOrders.length} commandes</p>
                                   </div>
                                   <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform"><Store size={32}/></div>
                               </div>
                               <div className="bg-white border-2 border-green-100 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-green-300 transition-all">
                                   <div>
                                       <p className="text-xs font-black text-green-500 uppercase tracking-widest mb-1 flex items-center gap-2"><ShoppingBag size={14}/> App (Livraison)</p>
                                       <p className="text-3xl font-black text-gray-900">{caApp} <span className="text-sm text-gray-500">DH</span></p>
                                       <p className="text-xs font-bold text-gray-400 mt-1">{appOrders.length} commandes</p>
                                   </div>
                                   <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform"><ShoppingBag size={32}/></div>
                               </div>
                               <div className="bg-white border-2 border-purple-100 p-6 rounded-2xl shadow-sm flex items-center justify-between group hover:border-purple-300 transition-all">
                                   <div>
                                       <p className="text-xs font-black text-purple-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Phone size={14}/> Tél (Standard)</p>
                                       <p className="text-3xl font-black text-gray-900">{caTel} <span className="text-sm text-gray-500">DH</span></p>
                                       <p className="text-xs font-bold text-gray-400 mt-1">{telOrders.length} commandes</p>
                                   </div>
                                   <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform"><Phone size={32}/></div>
                               </div>
                           </div>

                           {/* NOUVEAU: RAPPORT DETAILLÉ DES PRODUITS */}
                           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-6">
                               <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-4"><Utensils size={20} className="text-[#da291c]"/> Rapport Analytique des Ventes (Produits)</h3>
                               <div className="overflow-x-auto max-h-[400px] overflow-y-auto no-scrollbar">
                                   <table className="w-full text-left border-collapse">
                                       <thead className="sticky top-0 bg-white shadow-sm z-10">
                                           <tr className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-500">
                                               <th className="px-4 py-3 font-black rounded-l-xl">Produit</th>
                                               <th className="px-4 py-3 font-black text-center">Quantité Vendue</th>
                                               <th className="px-4 py-3 font-black text-right rounded-r-xl">Chiffre d'Affaires</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-gray-50 text-sm">
                                           {sortedProducts.map(([name, data], i) => (
                                               <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                   <td className="px-4 py-3">
                                                       <div className="flex items-center gap-3">
                                                           <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl overflow-hidden border border-gray-200">
                                                               {typeof data.img === 'string' && (data.img.startsWith('http') || data.img.startsWith('data:image')) ? <img src={data.img} loading="lazy" className="w-full h-full object-cover"/> : data.img}
                                                           </div>
                                                           <span className="font-bold text-gray-800">{name}</span>
                                                       </div>
                                                   </td>
                                                   <td className="px-4 py-3 text-center">
                                                       <span className="font-black text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">{data.qty}x</span>
                                                   </td>
                                                   <td className="px-4 py-3 text-right">
                                                       <span className="font-black text-blue-600">{data.revenue} DH</span>
                                                   </td>
                                               </tr>
                                           ))}
                                           {sortedProducts.length === 0 && (
                                               <tr>
                                                   <td colSpan="3" className="py-8 text-center text-gray-400 font-bold">Aucun produit vendu dans cette période.</td>
                                               </tr>
                                           )}
                                       </tbody>
                                   </table>
                               </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                               <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                   <h3 className="font-semibold text-sm text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><Store size={16} className="text-gray-400"/> Top Agences</h3>
                                   <div className="space-y-1">
                                       {topBranches.map((b, i) => (
                                           <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                               <div className="flex items-center gap-3">
                                                   <span className="font-medium text-gray-400 text-sm w-4">{i+1}.</span>
                                                   <span className="text-sm font-medium text-gray-800 truncate">{b.name}</span>
                                               </div>
                                               <div className="flex flex-col items-end">
                                                   <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md mb-1">{b.count} cmds</span>
                                                   <span className="text-[10px] font-black text-green-600">{b.revenue} DH</span>
                                               </div>
                                           </div>
                                       ))}
                                       {topBranches.length === 0 && <p className="text-sm text-gray-400 py-4">Aucune donnée</p>}
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
                           
                           {/* 🔥 NOUVEAU: ESTIMATION QUOTAS FIREBASE */}
                           <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-6">
                               <h3 className="font-black text-lg text-gray-900 mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
                                   <Database size={20} className="text-[#f5820b]"/> Estimations & Quotas Firebase
                               </h3>
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                   <div className="bg-orange-50 p-5 rounded-xl border border-orange-100 shadow-sm">
                                       <p className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-1">Base de Données</p>
                                       <p className="text-3xl font-black text-orange-900">{safeOrders.length + (clientsList||[]).length} <span className="text-sm font-bold text-orange-700">Docs</span></p>
                                       <p className="text-[10px] font-bold text-orange-700 mt-1">Volume très faible (Plan Gratuit 1 Go)</p>
                                   </div>
                                   <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
                                       <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Lectures / Jour (Est.)</p>
                                       <p className="text-3xl font-black text-blue-900">~{safeOrders.filter(o => o.createdAt?.seconds && getL(new Date(o.createdAt.seconds * 1000)) === today).length * 45}</p>
                                       <p className="text-[10px] font-bold text-blue-700 mt-1">Limite Gratuite: 50 000 / jour</p>
                                   </div>
                                   <div className="bg-green-50 p-5 rounded-xl border border-green-100 shadow-sm">
                                       <p className="text-xs font-bold text-green-800 uppercase tracking-widest mb-1">Coût Estimé Firebase</p>
                                       <p className="text-3xl font-black text-green-900">0.00 <span className="text-sm font-bold text-green-700">$</span></p>
                                       <p className="text-[10px] font-bold text-green-700 mt-1">Plan Spark (Gratuit) suffisant</p>
                                   </div>
                               </div>
                               <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 leading-relaxed">
                                   💡 <strong>Note :</strong> Ces chiffres sont des estimations basées sur l'activité de l'application d'aujourd'hui. L'application est optimisée pour minimiser les requêtes réseau. Vous êtes largement en dessous des limites payantes. <br/><br/>
                                   💰 <strong>Tarification (Plan Blaze) :</strong> Même si vous dépassez les 50 000 lectures par jour, Firebase ne facture que <strong>~0.06$ (soit ~0.60 DH) pour chaque 100 000 lectures supplémentaires</strong>, ce qui reste extrêmement abordable.
                                   <br/>👉 Pour voir votre facture officielle exacte, connectez-vous sur : <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">console.firebase.google.com</a>
                               </div>
                           </div>
                       </div>
                   );
                })()}

                    {tab === 'glovo_report' && role === 'admin' && (() => {
                        const totalCA = glovoData.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                        const totalEspece = glovoData.filter(o => o.paymentMethod === 'espece' || o.paymentMethod === 'cash').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                        const totalPrepaye = glovoData.filter(o => o.paymentMethod !== 'espece' && o.paymentMethod !== 'cash').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
                        
                        const commission = totalCA * 0.28;
                        const tva = commission * 0.20;
                        const totalRetenu = commission + tva + Number(glovoPenalties || 0);
                        const solde = totalPrepaye - totalRetenu;

                        const fetchGlovoReport = async () => {
                            if (!glovoDates.start || !glovoDates.end) return showNotify("Veuillez sélectionner les dates (Du / Au).", "error");
                            setIsFetchingGlovo(true);
                            try {
                                const start = new Date(glovoDates.start); start.setHours(0,0,0,0);
                                const end = new Date(glovoDates.end); end.setHours(23,59,59,999);
                                
                                const q = query(
                                    collection(db, 'artifacts', appId, 'public', 'data', 'orders'),
                                    where('createdAt', '>=', start),
                                    where('createdAt', '<=', end)
                                );
                                const snap = await getDocs(q);
                                let allOrders = snap.docs.map(d => ({id: d.id, ...d.data()}));
                                
                                let filtered = allOrders.filter(o => o.source === 'glovo' && o.status !== 'rejected');
                                
                                if (glovoBranch !== 'ALL') {
                                    filtered = filtered.filter(o => o.nearestBranch?.id === glovoBranch);
                                }
                                setGlovoData(filtered);
                                showNotify(`Données Glovo chargées : ${filtered.length} commandes ✅`, "success");
                            } catch(e) {
                                console.error(e);
                                showNotify("Erreur de chargement", "error");
                            }
                            setIsFetchingGlovo(false);
                        };

                        return (
                            <div className="space-y-6 animate-in fade-in pb-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-gray-200 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-yellow-50 text-yellow-600 rounded-lg"><Calculator size={24} strokeWidth={2}/></div>
                                        <div><h2 className="text-xl font-semibold text-gray-900">Rapport Comptable Glovo</h2><p className="text-xs text-gray-500">Calculez vos factures de la quinzaine</p></div>
                                    </div>
                                    <button onClick={() => {
                                        const menuToExport = settings?.menuItems || DEFAULT_MENU_ITEMS;
                                        const rows = menuToExport.map(item => `"${item.name}","${item.id}"`);
                                        const csv = "data:text/csv;charset=utf-8,\uFEFFNom du Produit (Glovo),ID POS (Mon Bocadillo)\n" + rows.join("\n");
                                        const link = document.createElement("a");
                                        link.href = encodeURI(csv);
                                        link.download = "Menu_Mapping_Glovo.csv";
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        if(showNotify) showNotify("Menu exporté ! Envoyez ce fichier à Glovo ✅", "success");
                                    }} className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <Download size={18}/> Exporter Menu (Mapping)
                                    </button>
                                </div>

                                <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 items-end">
                                    <div className="flex flex-col w-full md:w-auto">
                                        <label className="text-xs font-bold text-gray-600 mb-1">Agence</label>
                                        <select value={glovoBranch} onChange={e=>setGlovoBranch(e.target.value)} className="bg-gray-50 p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm cursor-pointer min-w-[150px]">
                                            <option value="ALL">Toutes Agences</option>
                                            {(settings?.branches || DEFAULT_BRANCHES).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col w-full md:w-auto">
                                        <label className="text-xs font-bold text-gray-600 mb-1">Du (Date de début)</label>
                                        <input type="date" value={glovoDates.start} onChange={e=>setGlovoDates({...glovoDates, start: e.target.value})} className="bg-gray-50 p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm" />
                                    </div>
                                    <div className="flex flex-col w-full md:w-auto">
                                        <label className="text-xs font-bold text-gray-600 mb-1">Au (Date de fin)</label>
                                        <input type="date" value={glovoDates.end} onChange={e=>setGlovoDates({...glovoDates, end: e.target.value})} className="bg-gray-50 p-2.5 rounded-lg text-gray-900 outline-none border border-gray-300 font-medium text-sm" />
                                    </div>
                                    <button onClick={fetchGlovoReport} disabled={isFetchingGlovo} className="w-full md:w-auto bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2.5 rounded-lg font-black text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 h-[42px]">
                                        {isFetchingGlovo ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Search size={18}/>} Calculer
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                    <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-sm relative overflow-hidden">
                                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Total Commandes Glovo</p>
                                        <p className="text-3xl font-black text-gray-900">{glovoData.length} <span className="text-sm font-bold text-gray-500">Cmds</span></p>
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                                            <span className="text-sm font-bold text-gray-600">Chiffre d'Affaires Brut</span>
                                            <span className="text-lg font-black text-blue-600">{totalCA.toFixed(2)} DH</span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border-2 border-green-100 shadow-sm relative overflow-hidden">
                                        <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1 flex items-center gap-2"><DollarSign size={14}/> Total Espèce (Encaissé)</p>
                                        <p className="text-2xl font-black text-gray-900">{totalEspece.toFixed(2)} <span className="text-sm font-bold text-gray-500">DH</span></p>
                                        <p className="text-[10px] font-bold text-gray-400 mt-1">L'argent que le livreur vous a donné</p>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border-2 border-orange-100 shadow-sm relative overflow-hidden">
                                        <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-1">Total Prépayé (En ligne)</p>
                                        <p className="text-2xl font-black text-gray-900">{totalPrepaye.toFixed(2)} <span className="text-sm font-bold text-gray-500">DH</span></p>
                                        <p className="text-[10px] font-bold text-gray-400 mt-1">L'argent chez Glovo</p>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-6">
                                    <h3 className="font-black text-lg text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4"><Calculator size={20} className="text-gray-500"/> Détail des Déductions</h3>
                                    
                                    <div className="space-y-4 max-w-2xl mx-auto">
                                        <div className="flex justify-between items-center bg-red-50/50 p-4 rounded-xl border border-red-100">
                                            <div>
                                                <p className="font-bold text-red-800">Commission Glovo (28%)</p>
                                                <p className="text-[10px] text-red-600">Calculée sur le CA Brut de {totalCA.toFixed(2)} DH</p>
                                            </div>
                                            <span className="font-black text-red-600 text-lg">- {commission.toFixed(2)} DH</span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center bg-red-50/50 p-4 rounded-xl border border-red-100">
                                            <div>
                                                <p className="font-bold text-red-800">TVA sur Commission (20%)</p>
                                                <p className="text-[10px] text-red-600">Calculée sur les {commission.toFixed(2)} DH de commission</p>
                                            </div>
                                            <span className="font-black text-red-600 text-lg">- {tva.toFixed(2)} DH</span>
                                        </div>

                                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <div>
                                                <p className="font-bold text-gray-800">Pénalités (Retards, Annulations)</p>
                                                <p className="text-[10px] text-gray-500">Regardez sur votre facture PDF Glovo</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-gray-600 text-lg">-</span>
                                                <input type="number" min="0" value={glovoPenalties} onChange={e => setGlovoPenalties(e.target.value)} className="w-24 bg-white border border-gray-300 p-2 rounded-lg text-right font-bold outline-none focus:border-blue-500" />
                                                <span className="font-bold text-gray-600">DH</span>
                                            </div>
                                        </div>

                                        <div className={`mt-6 p-6 rounded-2xl border-2 flex justify-between items-center ${solde >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                            <div>
                                                <p className={`font-black text-xl uppercase ${solde >= 0 ? 'text-green-800' : 'text-red-800'}`}>Net à Recevoir (Solde)</p>
                                                <p className={`text-xs font-bold mt-1 ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {solde >= 0 ? 'Ce que Glovo va vous virer' : 'Ce que vous devez à Glovo (Facture à payer)'}
                                                </p>
                                            </div>
                                            <span className={`text-3xl font-black ${solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {solde >= 0 ? '+' : ''}{solde.toFixed(2)} DH
                                            </span>
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

                    {tab === 'maintenance' && role === 'admin' && (
                    <div className="space-y-6 animate-in fade-in pb-4">
                        {/* BOUTON HARD RESET */}
                        <div className="bg-red-50 p-6 md:p-8 rounded-[2rem] border border-red-200 shadow-sm flex flex-col items-center text-center max-w-3xl mx-auto">
                            <AlertTriangle size={48} className="text-red-500 mb-4 animate-pulse" />
                            <h2 className="text-2xl font-black text-red-600 mb-2 uppercase">Hard Reset (Formater)</h2>
                            <p className="text-red-800 font-bold mb-6 text-sm">
                                Had l-option ghadi tmsse7 <strong>GA3 LES COMMANDES</strong> (historique, en cours, etc.) mn la base de données.<br/>
                                ✅ <strong>Les comptes Clients w Livreurs ghadi yb9aw (Maghadich ytms7o).</strong>
                            </p>
                            <button onClick={handleHardResetOrders} disabled={isFetchingHistory} className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-black text-sm uppercase shadow-xl active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50">
                                <Trash2 size={20}/> {isFetchingHistory ? 'Formatage en cours...' : 'Formater les Commandes'}
                            </button>
                        </div>
                        
                        <AdminMaintenance
                            db={db}
                            appId={appId}
                            showNotify={showNotify}
                            safeOrders={safeOrders}
                            clientsList={clientsList}
                        />
                    </div>
                )}
                </Suspense>
            </main>
        </div>

        {/* MODAL DE CONFIRMATION */}
        {confirmDialog && (
            <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDialog(null)}>
                <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                        <h2 className="text-lg font-black text-orange-800 flex items-center gap-2"><AlertTriangle size={20}/> Confirmation</h2>
                        <button onClick={() => setConfirmDialog(null)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                    </div>
                    <div className="p-6 bg-gray-50 text-center space-y-5">
                        <p className="font-bold text-gray-800 text-base whitespace-pre-wrap">{confirmDialog.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-200 rounded-xl hover:bg-gray-300 transition-colors shadow-sm">Non (Annuler)</button>
                            <button onClick={() => {
                                confirmDialog.onConfirm();
                                setConfirmDialog(null);
                            }} className="flex-[2] py-3 font-black text-white bg-green-500 rounded-xl shadow-md active:scale-95 transition-all hover:bg-green-600">Oui, Confirmer</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL ÉCOUTE (SPY MICROPHONE) */}
        {showSpyModal && (
            <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95">
                <div className="bg-[#1e293b] rounded-[2.5rem] w-full max-w-sm flex flex-col overflow-hidden shadow-2xl border border-slate-700">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                        <h2 className="text-lg font-black text-white flex items-center gap-2"><Mic size={20} className="text-red-500 animate-pulse" /> Écoute en Direct</h2>
                        <button onClick={() => { stopSpy(); setShowSpyModal(false); }} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600 text-slate-400"><X size={20}/></button>
                    </div>
                    <div className="p-6 flex flex-col gap-4">
                        <div className="flex bg-slate-800 p-1 rounded-xl">
                            <button onClick={() => setSpyTargetType('pos')} className={`flex-1 py-2.5 rounded-lg font-bold text-xs uppercase transition-all ${spyTargetType === 'pos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Caisse (POS)</button>
                            <button onClick={() => setSpyTargetType('kds')} className={`flex-1 py-2.5 rounded-lg font-bold text-xs uppercase transition-all ${spyTargetType === 'kds' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Cuisine (KDS)</button>
                        </div>
                        <div className="flex flex-col gap-3 mb-2">
                            <select value={spyBranchId} onChange={e => setSpyBranchId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3.5 rounded-xl text-sm font-bold text-white outline-none focus:border-blue-500 shadow-inner">
                                <option value="" disabled>Sélectionner une agence...</option>
                                {(settings?.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <label className="flex items-center justify-between p-3.5 bg-slate-800 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors shadow-inner">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white flex items-center gap-2">🔁 Enregistrement Continu</span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">Garde la dernière heure (60 min) en mémoire</span>
                                </div>
                                <div className={`w-12 h-6 rounded-full relative transition-all border-2 ${isRollingRecordEnabled ? 'bg-blue-600 border-blue-500' : 'bg-slate-600 border-slate-500'}`}>
                                    <input type="checkbox" className="hidden" checked={isRollingRecordEnabled} onChange={e => setIsRollingRecordEnabled(e.target.checked)} />
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${isRollingRecordEnabled ? 'translate-x-6' : 'translate-x-1'}`}></div>
                                </div>
                            </label>
                        </div>
                        <div className="flex flex-col items-center justify-center py-8 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
                            {spyStatus === 'idle' && <MicOff size={48} className="text-slate-600 mb-3" />}
                            {spyStatus === 'calling' && <div className="w-12 h-12 border-4 border-slate-700 border-t-red-500 rounded-full animate-spin mb-3"></div>}
                            {spyStatus === 'connected' && <Mic size={48} className="text-red-500 mb-3 animate-pulse" />}
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">
                                {spyStatus === 'idle' ? 'Prêt à écouter' : spyStatus === 'calling' ? 'Connexion en cours...' : 'En direct'}
                            </p>
                            {spyStatus === 'connected' && <p className="text-[10px] text-green-400 mt-2 font-bold uppercase tracking-widest bg-green-500/10 px-3 py-1 rounded-md border border-green-500/20">Audio en cours de lecture</p>}
                        </div>
                        <audio ref={audioRef} autoPlay className="hidden"></audio>
                        <div className="flex flex-col gap-2 mt-2">
                            {spyStatus === 'idle' ? (<button onClick={startSpy} disabled={!spyBranchId} className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"><Mic size={18}/> Lancer l'écoute</button>) : (<button onClick={stopSpy} className="w-full bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl font-black text-sm uppercase shadow-lg active:scale-95 transition-all border border-slate-600">Arrêter l'écoute</button>)}
                            {spyStatus === 'connected' && (!isRecording ? (<button onClick={startRecording} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 py-3 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-2 mt-2">🔴 Démarrer Enregistrement</button>) : (<button onClick={stopRecording} className="w-full bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] py-3 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-2 animate-pulse mt-2">⏹️ Arrêter et Sauvegarder</button>))}
                            {spyStatus === 'connected' && isRollingRecordEnabled && (
                                <button onClick={downloadLastHour} className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 py-3 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-2 mt-2" title="Sauvegarder la dernière heure">
                                    ⏪ Télécharger la dernière heure
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
}