import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Coffee, Banknote, ArrowLeft, ShoppingBasket, ShoppingBag, Unlock, History, ClipboardList, X, Printer, Power, BellRing, CheckCircle, MapPin, ChefHat, Clock, Monitor, AlertTriangle, Delete, Bluetooth, Settings, MessageCircle, Truck, Phone, FileText, Bike, RefreshCw } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc, updateDoc, arrayUnion, onSnapshot, query, where } from 'firebase/firestore';
import { generateOrderNumber, printTicket, formatSansIngredient, buildMessage, openWhatsAppDirect } from '../utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { PREDEFINED_DRINKS, DEFAULT_BRAND } from '../config/constants';
import AchatInventaire from './AchatInventaire';
import { io } from 'socket.io-client';

let localSocket = null;

export default function PosDashboard({ settings, brand, db, appId, showNotify, managerBranchId, adminSelectedBranch, isAdmin, orders = [], updateStatus, handleReassignOrder, onQuit, setTab, saveSettings, hasAccess, clientsList = [], onlineDrivers = [] }) {
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');

    const [orderType, setOrderType] = useState(settings?.hidePosSurPlace ? 'a_emporter' : 'sur_place'); // 'sur_place' wla 'a_emporter'
    const [editCartItem, setEditCartItem] = useState(null); // Jdid: Modal modifier l-quantité
    const [selectedItemForOptions, setSelectedItemForOptions] = useState(null); // Jdid: Modal dyal les options
    const [selectedChoiceForOptions, setSelectedChoiceForOptions] = useState(null);
    const [selectedVariationForOptions, setSelectedVariationForOptions] = useState(null);
    const [comboSelectionsForOptions, setComboSelectionsForOptions] = useState({});
    const [showPosSans, setShowPosSans] = useState(false);
    const [showPosExtras, setShowPosExtras] = useState(false);
    const [heldCarts, setHeldCarts] = useState([]); // Jdid: Commandes en attente
    const [showHeldCarts, setShowHeldCarts] = useState(false);
    const [showUnpaidModal, setShowUnpaidModal] = useState(false);
    const [showReadyPosModal, setShowReadyPosModal] = useState(false); // Jdid: Modal Commandes Prêtes
    const [showGlovoModal, setShowGlovoModal] = useState(false); // Modal Commandes Glovo
    const [showConfirmToutDonner, setShowConfirmToutDonner] = useState(false); // Jdid: Modal Custom Confirmation
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [printCuisine, setPrintCuisine] = useState(true);
    const [printAddition, setPrintAddition] = useState(true);

    const [showStandardModal, setShowStandardModal] = useState(false);
    const [showTelNumpad, setShowTelNumpad] = useState(false);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [showOnlineOrdersModal, setShowOnlineOrdersModal] = useState(false);
    const [telInfo, setTelInfo] = useState({ phone: '', deliveryFee: 0 });
    const [defaultPosDriver, setDefaultPosDriver] = useState(() => localStorage.getItem('pos_default_driver') || '');
    
    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showXZModal, setShowXZModal] = useState(false);
    const [showAchatsModal, setShowAchatsModal] = useState(false);
    const [achatsToday, setAchatsToday] = useState([]);
    const [glovoCancellationsToday, setGlovoCancellationsToday] = useState(0);
    const [isVerifyingGlovo, setIsVerifyingGlovo] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState(isAdmin ? (adminSelectedBranch && adminSelectedBranch !== 'ALL' ? adminSelectedBranch : 'ALL') : (managerBranchId || ''));
    const prevPendingCount = useRef(0);
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
        const int = setInterval(() => setCurrentTime(Date.now()), 10000);
        return () => clearInterval(int);
    }, []);

    useEffect(() => {
        if (!localSocket) {
            localSocket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });
        }
        return () => {
            if (localSocket) {
                localSocket.disconnect();
                localSocket = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!activeBranchId || activeBranchId === 'ALL') return;
        const todayStr = new Date().toISOString().split('T')[0];
        const qAchats = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'achats'),
            where('branchId', '==', activeBranchId)
        );
        const unsub = onSnapshot(qAchats, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const todayList = list.filter(a => {
                const dateStr = a.date || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toISOString().split('T')[0] : null);
                return dateStr === todayStr;
            });
            setAchatsToday(todayList);
        });
        return () => unsub();
    }, [activeBranchId, db, appId]);

    const totalAchats = useMemo(() => achatsToday.reduce((sum, a) => sum + (Number(a.total) || 0), 0), [achatsToday]);

    useEffect(() => {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'glovo_cancellations_count');
        const unsub = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Utiliser updatedAt si envoyé, sinon utiliser l'heure de modification native de Firestore
                const timeToUse = data.updatedAt || docSnap.updateTime; 
                
                let isToday = false;
                if (timeToUse) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const d = timeToUse.toDate ? timeToUse.toDate() : new Date(timeToUse);
                    if (d.toISOString().split('T')[0] === todayStr) {
                        isToday = true;
                    }
                }
                
                if (isToday) setGlovoCancellationsToday(Number(data.count) || 0);
                else setGlovoCancellationsToday(0);
            } else {
                setGlovoCancellationsToday(0);
            }
        });
        return () => unsub();
    }, [db, appId]);

    const triggerGlovoVerification = async (isAuto = false) => {
        if (isVerifyingGlovo) return;
        setIsVerifyingGlovo(true);
        try {
            const triggerId = Date.now().toString() + Math.floor(Math.random() * 1000);
            await setDoc(doc(db, "artifacts", appId, "public", "data", "settings", "glovo_trigger"), {
                action: "VERIFY_CANCELLATIONS",
                isHandled: false,
                triggerId: triggerId,
                timestamp: Date.now()
            });
            if (!isAuto) {
                showNotify("Vérification rapide lancée sur la tablette Glovo !", "success");
            } else {
                console.log("Vérification automatique Glovo lancée (chaque 2h).");
            }
            setTimeout(() => {
                setIsVerifyingGlovo(false);
            }, 2000);
        } catch (error) {
            console.error("Error triggering glovo:", error);
            if (!isAuto) showNotify("Erreur de lancement de vérification", "error");
            setIsVerifyingGlovo(false);
        }
    };

    // 🔥 NOUVEAU: Déclenchement automatique chaque 3 heures à partir de 14h
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const hours = now.getHours();
            
            // Plage horaire de travail: de 14h00 à 23h30
            const isWithinTimeWindow = (hours >= 14 && hours < 23) || (hours === 23 && now.getMinutes() <= 30);
            
            if (isWithinTimeWindow) {
                const lastAutoStr = localStorage.getItem('last_glovo_auto_verify');
                const lastAuto = lastAutoStr ? parseInt(lastAutoStr, 10) : 0;
                const timeSinceLast = now.getTime() - lastAuto;
                
                // 3 heures = 3 * 60 * 60 * 1000 = 10800000 ms
                if (timeSinceLast >= 10800000) {
                    triggerGlovoVerification(true);
                    localStorage.setItem('last_glovo_auto_verify', now.getTime().toString());
                }
            }
        }, 60000); // Vérification chaque minute
        
        return () => clearInterval(interval);
    }, []);

    // 📱 States & Refs pour le glissement (Drag & Drop)
    const dragCatRef = useRef(null);
    const dropCatRef = useRef(null);
    const dragItemRef = useRef(null);
    const dropItemRef = useRef(null);
    
    const defaultHeaderButtons = ['commandes_web', 'non_payes', 'problemes', 'suivi', 'pretes', 'glovo_ready', 'glovo_verify', 'tv', 'standard', 'kds'];
    
    // 🔥 Ordre des boutons (Drag & Drop Flex)
    const [headerBtnsOrder, setHeaderBtnsOrder] = useState(settings?.headerBtnsOrder || []);
    const dragBtnRef = useRef(null);
    const dropBtnRef = useRef(null);

    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);

    // 🔥 Jdid: State pour l'imprimante Bluetooth
    const [btCharacteristic, setBtCharacteristic] = useState(null);
    const [isBtConnecting, setIsBtConnecting] = useState(false);

    // 🔥 NOUVEAU: Mode Édition visuel avancé (Drag & Size)
    const defaultPosUI = {
        fontSize: 13,
        cartWidth: 420,
        cardWidth: 160,
        cardHeight: 200,
        imgHeight: 96,
        catWidth: 120,
        catHeight: 48,
        actionBtnWidth: 140,
        actionBtnHeight: 48
    };

    const [posUI, setPosUI] = useState(() => {
        try { const saved = localStorage.getItem('posUI'); if (saved) return { ...defaultPosUI, ...JSON.parse(saved) }; } catch(e) {}
        return defaultPosUI;
    });
    const [showUISettings, setShowUISettings] = useState(false);

    // 🔥 NOUVEAU: Filtrer uniquement les livreurs qui existent vraiment dans la liste des comptes
    const validOnlineDrivers = useMemo(() => {
        return (onlineDrivers || []).filter(d => {
            return (clientsList || []).some(c => c.isDriver === true && ((c.uid && c.uid === d.uid) || (d.phone && c.id === d.phone) || (c.id === d.id) || (c.id === d.uid)));
        });
    }, [onlineDrivers, clientsList]);

    // 🔥 NOUVEAU: Calculer les commandes actives du livreur local
    const defaultDriverActiveOrders = useMemo(() => {
        if (!defaultPosDriver) return 0;
        return (orders || []).filter(o => o.driverId === defaultPosDriver && !['delivered', 'rejected'].includes(o.status)).length;
    }, [orders, defaultPosDriver]);

    // 🔥 NOUVEAU: Trouver les livreurs libres d'autres agences si notre livreur est surchargé
    const idleOtherDrivers = useMemo(() => {
        const hasPendingOrReady = (orders || []).some(o => 
            (o.status === 'pending' || o.status === 'ready') && 
            o.source !== 'pos' && 
            (activeBranchId === 'ALL' || o.nearestBranch?.id === activeBranchId)
        );

        if (defaultPosDriver && defaultDriverActiveOrders >= 2 && hasPendingOrReady) {
            return validOnlineDrivers.filter(d => {
                if (d.uid === defaultPosDriver) return false;
                if (!d.isOnline) return false;
                const dOrders = (orders || []).filter(o => o.driverId === d.uid && !['delivered', 'rejected'].includes(o.status)).length;
                return dOrders === 0;
            });
        }
        return [];
    }, [defaultPosDriver, defaultDriverActiveOrders, orders, validOnlineDrivers, activeBranchId]);

    // 🔥 NOUVEAU: Auto-release des livreurs en aide quand il n'y a plus de commandes
    const activeHelpers = useMemo(() => validOnlineDrivers.filter(d => d.isHelping === activeBranchId), [validOnlineDrivers, activeBranchId]);

    useEffect(() => {
        if (!activeBranchId || activeBranchId === 'ALL' || activeHelpers.length === 0) return;

        const branchNeedsHelp = (orders || []).some(o => 
            ['pending', 'preparing', 'ready'].includes(o.status) && 
            o.source !== 'pos' &&
            o.nearestBranch?.id === activeBranchId
        );

        activeHelpers.forEach(h => {
            const helperOrders = (orders || []).filter(o => o.driverId === h.uid && !['delivered', 'rejected'].includes(o.status));
            
            if (!branchNeedsHelp && helperOrders.length === 0) {
                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', h.uid), {
                    isHelping: null,
                    returnMessage: "L'agence a terminé ses commandes. Garder ton agence et retourne à ton poste."
                });
                showNotify(`Livreur dyal aide (${h.name}) rah ghadi yrja3 poste dyalo`, "info");
            }
        });
    }, [orders, activeHelpers, activeBranchId, db, appId, showNotify]);

    // 🔥 NOUVEAU: Fonction bach njbdo l-livreur li m-fixi f had la caisse
    const getDriverAssignmentData = () => {
        if (!defaultPosDriver) return {};
        const dInfo = (clientsList||[]).find(c => c.uid === defaultPosDriver || c.id === defaultPosDriver);
        if (!dInfo) return {};
        return {
            driverId: dInfo.uid || dInfo.id,
            driverName: dInfo.name || 'Inconnu',
            isFreelanceDriver: dInfo.isFreelance || false,
            driverAccepted: false,
            assignedAtLocal: Date.now(),
            notifiedDriver: false,
            isManualAssignment: true // 🔥 INDICATEUR D'ASSIGNATION MANUELLE
        };
    };

    useEffect(() => {
        if (settings?.hidePosSurPlace && orderType === 'sur_place') setOrderType('a_emporter');
        if (settings?.hidePosAEmporter && orderType === 'a_emporter') setOrderType('sur_place');
    }, [settings?.hidePosSurPlace, settings?.hidePosAEmporter]);

    // 🔥 NOUVEAU: Mni kaykhwa l-panier (commande dazt ola tms7at), nrejj3o l-mode par défaut
    useEffect(() => {
        if (cart.length === 0) {
            setOrderType(settings?.hidePosSurPlace ? 'a_emporter' : 'sur_place');
        }
    }, [cart.length, settings?.hidePosSurPlace]);

    useEffect(() => {
        if (isAdmin && adminSelectedBranch) {
            setActiveBranchId(adminSelectedBranch);
        }
    }, [adminSelectedBranch, isAdmin]);

    // 🔥 Webrtc Spy Listener (Microphone Silencieux)
    useEffect(() => {
        if (!activeBranchId || activeBranchId === 'ALL') return;
        const targetId = `pos_${activeBranchId}`;
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
    }, [activeBranchId, db, appId]);

    // 🔥 NOUVEAU: Auto-reconnexion au démarrage (Web Bluetooth getDevices)
    useEffect(() => {
        const tryAutoConnectBT = async () => {
            if (localStorage.getItem('use_bt_printer') === 'true' && navigator.bluetooth && navigator.bluetooth.getDevices) {
                try {
                    setIsBtConnecting(true);
                    const devices = await navigator.bluetooth.getDevices();
                    if (devices.length > 0) {
                        // Prendre le premier appareil Bluetooth préalablement autorisé
                        const device = devices[0];
                        const server = await device.gatt.connect();
                        
                        const services = await server.getPrimaryServices();
                        let targetCharacteristic = null;
                        for (const service of services) {
                            try {
                                const characteristics = await service.getCharacteristics();
                                targetCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
                                if (targetCharacteristic) break;
                            } catch(e) {}
                        }
                        
                        if (targetCharacteristic) {
                            setBtCharacteristic(targetCharacteristic);
                            showNotify("Imprimante BT Auto-Connectée ✅", "success");
                        }
                    }
                } catch (err) {
                    console.log("Erreur auto-connect BT:", err);
                } finally {
                    setIsBtConnecting(false);
                }
            }
        };
        tryAutoConnectBT();
    }, []);

    // 🔥 Enregistrer le statut de la caisse (En ligne, Version) pour l'Idara
    useEffect(() => {
        if (!activeBranchId) return;
        const savePosStatus = async () => {
            try {
                const isDesktop = typeof window !== 'undefined' && window.require;
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pos_status', activeBranchId), {
                    branchId: activeBranchId,
                    isOnline: true,
                    updatedAt: serverTimestamp(),
                    deviceType: isDesktop ? "Logiciel Caisse (Windows)" : "Navigateur Web",
                    defaultDriverId: defaultPosDriver || null
                }, {merge: true});
            } catch(e) {}
        };
        savePosStatus();
        const interval = setInterval(savePosStatus, 60000); // Toutes les minutes
        return () => clearInterval(interval);
    }, [activeBranchId, db, appId, defaultPosDriver]);

    // 🔥 NOUVEAU: Écouter l'événement pour installer la PWA (POS / KDS / IDARA sur Tablette)
    useEffect(() => {
        if (window.deferredPWAInstall) {
            setDeferredPrompt(window.deferredPWAInstall);
            setShowInstallBtn(true);
        }
        const handler = (e) => {
            e.preventDefault();
            window.deferredPWAInstall = e;
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallApp = async () => {
        if (!deferredPrompt) return;
        
        const url = window.location.href.toLowerCase();
        if (url.includes('kds')) {
            localStorage.setItem('pwa_mode', 'kds');
        } else if (url.includes('tv')) {
            localStorage.setItem('pwa_mode', 'tv');
        } else if (url.includes('pos')) {
            localStorage.setItem('pwa_mode', 'pos');
        } else {
            localStorage.setItem('pwa_mode', 'admin');
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            window.deferredPWAInstall = null;
            setShowInstallBtn(false);
        }
        setDeferredPrompt(null);
    };

    useEffect(() => {
        if (brand?.logoUrl) {
            const addOrUpdateIcon = (relType) => { let link = document.querySelector(`link[rel='${relType}']`); if (!link) { link = document.createElement('link'); link.rel = relType; document.head.appendChild(link); } link.href = brand.logoUrl; };
            ['apple-touch-icon', 'apple-touch-icon-precomposed', 'icon', 'shortcut icon'].forEach(addOrUpdateIcon);
        }
    }, [brand?.logoUrl]);

    useEffect(() => {
        if (settings?.headerBtnsOrder) {
            setHeaderBtnsOrder(settings.headerBtnsOrder);
        }
    }, [settings?.headerBtnsOrder]);

    const handleResetPositions = () => {
        setHeaderBtnsOrder([]);
        if (saveSettings) saveSettings({ ...settings, headerBtnsOrder: [] });
    };

    const handleGlobalOptionsClick = () => {
        if (cart.length === 0) {
            showNotify("Veuillez d'abord ajouter un produit au panier.", "warning");
            return;
        }
        const lastItem = cart[cart.length - 1];
        setCart(prev => {
            const newCart = [...prev];
            const last = { ...newCart[newCart.length - 1] };
            if (last.qty > 1) {
                last.qty -= 1;
                newCart[newCart.length - 1] = last;
            } else {
                newCart.pop();
            }
            return newCart;
        });
        const originalItem = (settings?.menuItems || []).find(i => i.id === lastItem.id) || lastItem;
        handleProductClick(originalItem, true);
    };

    const currentBranch = (settings?.branches || []).find(b => b.id === activeBranchId);

    const allowedButtons = defaultHeaderButtons.filter(btnId => {
        if (currentBranch && currentBranch.posButtons) {
            // 🔥 Toujours afficher le bouton "Non Payés" même s'il n'est pas dans la configuration (Éditeur Visuel)
            if (btnId === 'non_payes') return true;
            return currentBranch.posButtons.includes(btnId);
        }
        if (!hasAccess || isAdmin) return true;
        if (btnId === 'tv') return hasAccess('tv');
        if (btnId === 'kds') return hasAccess('kds');
        if (btnId === 'standard') return hasAccess('standard');
        if (btnId === 'problemes') return hasAccess('problems');
        if (btnId === 'commandes_web') return hasAccess('active');
        if (btnId === 'suivi') return hasAccess('active') || hasAccess('history');
        if (btnId === 'non_payes') return true; 
        return true; 
    });

    const displayedButtons = [...allowedButtons].sort((a, b) => {
        let indexA = headerBtnsOrder.indexOf(a);
        let indexB = headerBtnsOrder.indexOf(b);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        return indexA - indexB;
    });

    const handleBtnDragEnd = () => {
        if (dragBtnRef.current === null || dropBtnRef.current === null || dragBtnRef.current === dropBtnRef.current) return;
        let arr = [...displayedButtons];
        let item = arr[dragBtnRef.current];
        arr.splice(dragBtnRef.current, 1);
        arr.splice(dropBtnRef.current, 0, item);
        setHeaderBtnsOrder(arr);
        if (saveSettings) saveSettings({...settings, headerBtnsOrder: arr});
        dragBtnRef.current = null; dropBtnRef.current = null;
    };

    // 🔥 Problem Orders (Commandes avec problème)
    const [showProblemModal, setShowProblemModal] = useState(false);
    const prevProblemCount = useRef(0);
    const problemOrders = useMemo(() => {
        return (orders || []).filter(o => {
            if (activeBranchId !== 'ALL' && o.nearestBranch?.id !== activeBranchId) return false;
            if (o.source === 'glovo') return false;
            
            const isUnreachable = o.clientUnreachable;
            const hasAdminMsg = !!o.adminMessage;
            const driverIgnoringTime = o.isManualAssignment ? 300000 : 45000; // 5min ola 45s
            const driverIgnoring = o.driverId && !o.driverAccepted && o.assignedAtLocal && (currentTime - o.assignedAtLocal > driverIgnoringTime);
            const noDriverAssigned = !o.driverId && ['preparing', 'ready'].includes(o.status) && o.source !== 'pos' && o.assignedAtLocal && (currentTime - o.assignedAtLocal > 5 * 60000); // 5 d9ay9
            
            return isUnreachable || hasAdminMsg || driverIgnoring || noDriverAssigned;
        });
    }, [orders, activeBranchId, currentTime]);

    useEffect(() => {
        if (problemOrders.length > prevProblemCount.current) {
            setShowProblemModal(true);
            try {
                const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                audio.play().catch(e => console.log('Audio autoplay blocked', e));
            } catch (e) {}
        } else if (problemOrders.length === 0) {
            setShowProblemModal(false);
        }
        prevProblemCount.current = problemOrders.length;
    }, [problemOrders.length]);

    // 🔥 Offline Mode States (Mode Hors Ligne)
    const [isNetOnline, setIsNetOnline] = useState(navigator.onLine);
    const [offlineQueue, setOfflineQueue] = useState([]);
    const syncOfflineOrdersRef = useRef(null);

    useEffect(() => {
        syncOfflineOrdersRef.current = async () => {
            const stored = localStorage.getItem('posOfflineQueue');
            if (!stored) return;
            let queue = [];
            try { queue = JSON.parse(stored); } catch(e){ return; }
            if (queue.length === 0) return;

            showNotify(`Connexion rj3at! Kansifto ${queue.length} commandes... 🚀`, 'info');
            
            const remainingQueue = [];
            for (const order of queue) {
                try {
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), {
                        ...order,
                        createdAt: order.offlineCreatedAt ? new Date(order.offlineCreatedAt) : serverTimestamp()
                    });
                } catch (e) {
                    console.error("Échec de synchronisation:", e);
                    remainingQueue.push(order);
                }
            }
            
            setOfflineQueue(remainingQueue);
            localStorage.setItem('posOfflineQueue', JSON.stringify(remainingQueue));
            
            if (remainingQueue.length === 0) {
                showNotify("Ga3 l-commandes offline tsifto b-naja7! ✅", "success");
            }
        };
    }, [db, appId, showNotify]);

    useEffect(() => {
        const stored = localStorage.getItem('posOfflineQueue');
        if (stored) { try { setOfflineQueue(JSON.parse(stored)); } catch(e){} }
        
        const handleOnline = () => { setIsNetOnline(true); if (syncOfflineOrdersRef.current) syncOfflineOrdersRef.current(); };
        const handleOffline = () => setIsNetOnline(false);
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        localStorage.setItem('posUI', JSON.stringify(posUI));
        document.documentElement.style.fontSize = `${posUI.fontSize}px`;
    }, [posUI]);

    // 🔥 Fonction pour connecter l'imprimante Bluetooth
    const handleBluetoothConnect = async () => {
        if (!navigator.bluetooth) {
            showNotify("Bluetooth bloqué : Utilisez Chrome et vérifiez que vous êtes bien sur HTTPS ou Localhost.", "error");
            return;
        }
        try {
            setIsBtConnecting(true);
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb', 
                    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                    '0000fee7-0000-1000-8000-00805f9b34fb',
                    '0000ff00-0000-1000-8000-00805f9b34fb'
                ]
            });
            
            device.addEventListener('gattserverdisconnected', () => {
                setBtCharacteristic(null);
            });
            
            const server = await device.gatt.connect();
            
            const services = await server.getPrimaryServices();
            let targetCharacteristic = null;
            for (const service of services) {
                try {
                    const characteristics = await service.getCharacteristics();
                    targetCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
                    if (targetCharacteristic) break;
                } catch(e) {}
            }
            
            if (targetCharacteristic) {
                setBtCharacteristic(targetCharacteristic);
                localStorage.setItem('use_bt_printer', 'true'); // 🔥 Sauvegarder le fait qu'on utilise le BT
                showNotify("Imprimante Bluetooth Connectée ✅", "success");
            } else {
                showNotify("Aucun port d'écriture (Write) n'a été trouvé sur cette imprimante", "error");
            }
        } catch (error) {
            console.error("Erreur BT:", error);
            showNotify(error.message || "Erreur de connexion Bluetooth ou annulée", "error");
        } finally {
            setIsBtConnecting(false);
        }
    };

    // 🔥 Fonction pour envoyer des données au Bluetooth par paquets (Chunks)
    const sendBluetoothData = async (text) => {
        if (!btCharacteristic) return;
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const chunkSize = 256; // 256 octets par paquet pour éviter les erreurs de taille MTU
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            await btCharacteristic.writeValue(chunk);
        }
    };

    // Init Active Branch
    useEffect(() => {
        if (!activeBranchId && settings?.branches?.length > 0) setActiveBranchId(isAdmin ? 'ALL' : (managerBranchId || settings.branches[0].id));
    }, [settings, managerBranchId, activeBranchId, isAdmin]);

    // Njibou l-menu w les catégories
    const menuItems = settings?.menuItems || [];
    const rawCategories = [...new Set(menuItems.map(item => item.category).filter(Boolean))];
    const posCategoriesOrder = settings?.posCategoriesOrder || [];
    
    const categories = [...rawCategories].sort((a, b) => {
        let indexA = posCategoriesOrder.indexOf(a);
        let indexB = posCategoriesOrder.indexOf(b);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        return indexA - indexB;
    });

    const displayCategory = selectedCategory || (categories.length > 0 ? categories[0] : '');

    // Filtrer l-menu
    const filteredMenu = useMemo(() => {
        if (!displayCategory) return menuItems;
        return menuItems.filter(item => item.category === displayCategory);
    }, [menuItems, displayCategory]);

    const handleCatDragEnd = () => {
        if (dragCatRef.current === null || dropCatRef.current === null || dragCatRef.current === dropCatRef.current) return;
        let arr = [...categories];
        let item = arr[dragCatRef.current];
        arr.splice(dragCatRef.current, 1);
        arr.splice(dropCatRef.current, 0, item);
        if (saveSettings) saveSettings({...settings, posCategoriesOrder: arr});
        dragCatRef.current = null; dropCatRef.current = null;
    };

    const handleItemDragEnd = () => {
        if (dragItemRef.current === null || dropItemRef.current === null || dragItemRef.current === dropItemRef.current) return;
        const draggedItem = filteredMenu[dragItemRef.current];
        const droppedItem = filteredMenu[dropItemRef.current];
        
        let newMenuItems = [...menuItems];
        const globalDragIdx = newMenuItems.findIndex(i => i.id === draggedItem.id);
        const globalDropIdx = newMenuItems.findIndex(i => i.id === droppedItem.id);
        
        if (globalDragIdx > -1 && globalDropIdx > -1) {
            newMenuItems.splice(globalDragIdx, 1);
            newMenuItems.splice(globalDropIdx, 0, draggedItem);
            if (saveSettings) saveSettings({...settings, menuItems: newMenuItems});
        }
        dragItemRef.current = null; dropItemRef.current = null;
    };

    // 🔥 Les Commandes li Jayin mn l-App Client
    const onlineOrders = (orders || []).filter(o => {
        if (o.source === 'pos' || o.source === 'glovo') return false;
        if (activeBranchId !== 'ALL' && o.nearestBranch?.id !== activeBranchId) return false;
        return ['pending', 'preparing', 'ready', 'out_for_delivery'].includes(o.status);
    });

    const readyGlovoOrders = (orders || []).filter(o => o.source === 'glovo' && (activeBranchId === 'ALL' || o.nearestBranch?.id === activeBranchId) && o.status === 'ready');
    const pendingOnline = onlineOrders.filter(o => o.status === 'pending');
    const readyPosOrders = (orders || []).filter(o => o.source === 'pos' && (activeBranchId === 'ALL' || o.nearestBranch?.id === activeBranchId) && o.status === 'ready');

    // 🔥 Sonnette (En boucle) mli katzad commande web jdida f l-Caisse
    useEffect(() => {
        let audioInterval;
        if (pendingOnline.length > 0) {
            const playSound = () => {
                try {
                    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
                    audio.play().catch(e => console.log('Audio autoplay blocked', e));
                } catch (e) {}
            };
            playSound(); // Au moment de l'apparition
            audioInterval = setInterval(playSound, 3000); // Répéter chaque 3 secondes tant que la commande est là
        }
        return () => {
            if (audioInterval) clearInterval(audioInterval);
        };
    }, [pendingOnline.length]);

    // 🔥 Trigger pending modal w n7eloh auto ila tzad chi commande
    useEffect(() => {
        if (pendingOnline.length > prevPendingCount.current) {
            setShowPendingModal(true);
        } else if (pendingOnline.length === 0) {
            setShowPendingModal(false);
        }
        prevPendingCount.current = pendingOnline.length;
    }, [pendingOnline.length]);

    const unpaidOrders = useMemo(() => {
        return (orders || []).filter(o => {
            if (activeBranchId !== 'ALL' && o.nearestBranch?.id !== activeBranchId) return false;
            return o.paymentStatus === 'en_attente' && o.source === 'pos' && o.status !== 'rejected';
        });
    }, [orders, activeBranchId]);

    // 🔥 Hssab dyal Z w Rapports
    const { completedOrdersToday, caPos, caApp, caTel, caGlovoEspece, caGlovoEnLigne, dailyCA, dailyItemsList } = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        const completed = (orders || []).filter(o => {
            if (activeBranchId !== 'ALL' && o.nearestBranch?.id !== activeBranchId) return false;
            
            if (o.source === 'pos') {
                if (o.status === 'rejected' || o.paymentStatus === 'en_attente') return false; 
            } else {
                if (o.status !== 'delivered') return false; 
            }
            
            try {
                let d = new Date();
                if (o.createdAt?.seconds) d = new Date(o.createdAt.seconds * 1000);
                else if (typeof o.createdAt === 'string' || typeof o.createdAt === 'number') d = new Date(o.createdAt);
                
                if (isNaN(d.getTime())) return false;
                return d.toISOString().split('T')[0] === todayStr;
            } catch (err) { return false; }
        });

        let cPos = 0, cApp = 0, cTel = 0, cGlovoEspece = 0, cGlovoEnLigne = 0;
        let itemsMap = {};

        completed.forEach(o => {
            const t = Number(o.total) || 0;
            if (o.source === 'pos') cPos += t;
            else if (o.source === 'telephone') cTel += t;
            else if (o.source === 'glovo') {
                if (o.paymentMethod?.toLowerCase() === 'espece' || o.paymentMethod?.toLowerCase() === 'cash') cGlovoEspece += t;
                else cGlovoEnLigne += t;
            }
            else cApp += t;

            (o.items || []).forEach(i => { 
                const baseName = (i.name || '').split(' (Sans ')[0]; 
                const sourcePrefix = o.source === 'glovo' ? 'Vente GLOVO : ' : 'Vente CAISSE : ';
                const finalName = sourcePrefix + baseName;
                itemsMap[finalName] = (itemsMap[finalName] || 0) + i.qty; 
            });
        });

        return {
            completedOrdersToday: completed, caPos: cPos, caApp: cApp, caTel: cTel, caGlovoEspece: cGlovoEspece, caGlovoEnLigne: cGlovoEnLigne,
            dailyCA: cPos + cApp + cTel + cGlovoEspece + cGlovoEnLigne,
            dailyItemsList: Object.entries(itemsMap).sort((a, b) => b[1] - a[1])
        };
    }, [orders, activeBranchId]);

    const total = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.qty), 0), [cart]);

    const addToCart = (item, note = "") => {
        const finalName = note ? item.name + note : item.name;
        
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id && i.name === finalName);
            if (existing) return prev.map(i => i.id === item.id && i.name === finalName ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { ...item, name: finalName, qty: 1 }];
        });
    };

    const handleSendWhatsappFromPOS = async () => {
        if (!telInfo.phone || cart.length === 0) {
            return showNotify("Numéro de Téléphone et Commande sont obligatoires!", "error");
        }
        if (activeBranchId === 'ALL') return showNotify("Khtar agence!", "error");

        let phoneNum = telInfo.phone.replace(/[^\d]/g, "").slice(0, 10);
        if (!/^(06|07)\d{8}$/.test(phoneNum)) {
            return showNotify("Numéro invalide (doit commencer par 06 ou 07)", "error");
        }

        let waPhone = phoneNum.startsWith("0") ? "212" + phoneNum.substring(1) : phoneNum;
        let deliveryCost = Number(telInfo.deliveryFee) || 0;
        let totalToPay = total + deliveryCost; 
        let orderNum = generateOrderNumber();

        let itemsText = cart.map(item => {
            let parts = (item.name || "").split(" (Sans ");
            let name = parts[0];
            let sans = parts.length > 1 
                ? parts[1].replace(")", "").split(", ").map(s => `\n   - ${formatSansIngredient(s)}`).join("") 
                : "";
            return `${item.qty}x ${name}${sans}`;
        }).join("\n");

        const appUrl = window.location.origin + window.location.pathname; 
        const etaMins = 30;
        const msgTemplate = brand?.messages?.standardOrder || DEFAULT_BRAND.messages.standardOrder; 
        const msgBody = buildMessage(msgTemplate, { 
            brandName: (brand?.name || '').toUpperCase(), 
            items: itemsText, 
            subtotal: total, 
            deliveryFee: deliveryCost, 
            total: totalToPay, 
            appUrl: appUrl, 
            eta: etaMins 
        });

        const branch = (settings?.branches || []).find(b => b.id === activeBranchId) || null;

        const newOrder = {
            userId: phoneNum,
            orderNumber: orderNum,
            customerName: "Client Tél (Caisse)",
            phone: phoneNum,
            address: "Commande par Téléphone",
            nearestBranch: branch,
            items: cart,
            total: totalToPay,
            deliveryFee: deliveryCost,
            subtotal: total,
            status: "pending",
            source: "telephone",
            etaMinutes: etaMins,
            offlineCreatedAt: Date.now(),
            ...getDriverAssignmentData()
        };

        try {
            if (isNetOnline) {
                try {
                    await addDoc(collection(db, "artifacts", appId, "public", "data", "orders"), {
                        ...newOrder,
                        createdAt: serverTimestamp()
                    });
                    showNotify("Commande ajoutée w WhatsApp t7el! ✅", "success");
                    openWhatsAppDirect(waPhone, msgBody);
                } catch (error) {
                    console.log("Erreur réseau/Firestore, sauvegarde locale...", error);
                    saveOfflineOrder(newOrder);
                    openWhatsAppDirect(waPhone, msgBody);
                }
            } else {
                saveOfflineOrder(newOrder);
                openWhatsAppDirect(waPhone, msgBody);
            }

            setShowStandardModal(false);
            setTelInfo({ phone: '', deliveryFee: 0 });
            setShowTelNumpad(false);
            setCart([]); 

        } catch (error) {
            console.error(error);
            showNotify("W9e3 mochkil f tsjal dyal l-commande", "error");
        }
    };

    const handleEditCartItemOptions = (cartItem) => {
        const originalItem = menuItems.find(i => i.id === cartItem.id);
        if (!originalItem) {
            showNotify("Produit introuvable dans le menu actuel", "error");
            return;
        }

        const ingredients = originalItem.removableIngredients ? String(originalItem.removableIngredients).split(',').map(i => i.trim()).filter(Boolean) : [];
        let choicesList = [];
        if (originalItem.choices) {
            const choicesStr = String(originalItem.choices).trim();
            if (choicesStr.toUpperCase().startsWith('CAT:')) {
                const catName = choicesStr.split(':')[1].trim();
                const matchedItems = menuItems.filter(i => i.category === catName && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                matchedItems.forEach(i => {
                    if (i.hasVariations && i.variations?.length > 0) {
                        i.variations.forEach(v => choicesList.push(`${i.name} (${v.name})` + (i.img ? ` | ${i.img}` : '')));
                    } else {
                        choicesList.push(i.name + (i.img ? ` | ${i.img}` : ''));
                    }
                });
            } else if (choicesStr.toUpperCase().startsWith('PROD:')) {
                const prodNames = choicesStr.substring(5).split(',').map(n => n.trim().toLowerCase());
                const matchedItems = menuItems.filter(i => prodNames.includes((i.name || '').trim().toLowerCase()) && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                matchedItems.forEach(i => {
                    if (i.hasVariations && i.variations?.length > 0) {
                        i.variations.forEach(v => choicesList.push(`${i.name} (${v.name})` + (i.img ? ` | ${i.img}` : '')));
                    } else {
                        choicesList.push(i.name + (i.img ? ` | ${i.img}` : ''));
                    }
                });
            } else {
                choicesList = choicesStr.split(',').map(i => i.trim()).filter(Boolean);
            }
        }

        let guessedVariation = cartItem.selectedVariation;
        if (!guessedVariation && originalItem.hasVariations && originalItem.variations?.length > 0) {
            guessedVariation = originalItem.variations.find(v => cartItem.name.includes(`(${v.name})`)) || originalItem.variations[0];
        }

        let guessedChoice = cartItem.selectedChoice;
        if (!guessedChoice && choicesList.length > 0) {
            guessedChoice = choicesList.find(c => {
                const choiceName = c.split('|')[0].trim();
                return cartItem.name.includes(`(${choiceName})`);
            }) || null;
            if (guessedChoice) {
                guessedChoice = guessedChoice.split('|')[0].trim();
            }
        }

        let guessedSans = cartItem.selectedSans;
        if (!guessedSans) {
            const sansMatch = cartItem.name.match(/\(Sans ([^)]+)\)/);
            if (sansMatch) {
                guessedSans = sansMatch[1].split(',').map(s => s.trim());
            } else {
                guessedSans = [];
            }
        }

        let guessedExtras = cartItem.selectedExtras;
        if (!guessedExtras) {
            const avecMatch = cartItem.name.match(/\(Avec ([^)]+)\)/);
            if (avecMatch) {
                guessedExtras = avecMatch[1].split(',').map(s => ({ name: s.trim(), price: 0 }));
            } else {
                guessedExtras = [];
            }
        }

        setSelectedItemForOptions({
            ...originalItem,
            ingredients,
            choices: choicesList,
            selectedSans: guessedSans,
            selectedExtras: guessedExtras,
            isEditingCartItemName: cartItem.name,
            editingCartItemQty: cartItem.qty
        });

        setSelectedVariationForOptions(guessedVariation);
        setSelectedChoiceForOptions(guessedChoice);
        setShowPosSans(ingredients.length > 0);
        setShowPosExtras(originalItem.extras && originalItem.extras.length > 0);
        setEditCartItem(null);
    };

    const togglePosComboRemovable = (itemIndex, ing) => {
        setComboSelectionsForOptions(prev => {
            const current = prev[itemIndex]?.removables || [];
            const newRemovables = current.includes(ing) ? current.filter(x => x !== ing) : [...current, ing];
            return { ...prev, [itemIndex]: { ...prev[itemIndex], removables: newRemovables } };
        });
    };

    const handleProductClick = (item, forceOptions = false) => {
        // Les choix w les tailles homa obligatoires, khassna dima n7ello l-modal fihom
        const needsOptions = (item.hasVariations && item.variations?.length > 0) || (item.choices && item.choices.length > 0) || item.isCombo;

        if (forceOptions || needsOptions) {
            const ingredients = item.removableIngredients ? String(item.removableIngredients).split(',').map(i => i.trim()).filter(Boolean) : [];
            let choicesList = [];
            if (item.choices) {
                const choicesStr = String(item.choices).trim();
                if (choicesStr.toUpperCase().startsWith('CAT:')) {
                    const catName = choicesStr.split(':')[1].trim();
                    const matchedItems = menuItems.filter(i => i.category === catName && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                    matchedItems.forEach(i => {
                        if (i.hasVariations && i.variations?.length > 0) {
                            i.variations.forEach(v => choicesList.push(`${i.name} (${v.name})` + (i.img ? ` | ${i.img}` : '')));
                        } else {
                            choicesList.push(i.name + (i.img ? ` | ${i.img}` : ''));
                        }
                    });
                } else if (choicesStr.toUpperCase().startsWith('PROD:')) {
                    const prodNames = choicesStr.substring(5).split(',').map(n => n.trim().toLowerCase());
                    const matchedItems = menuItems.filter(i => prodNames.includes((i.name || '').trim().toLowerCase()) && !i.outOfStock && !(settings?.disabledItems || []).includes(i.id));
                    matchedItems.forEach(i => {
                        if (i.hasVariations && i.variations?.length > 0) {
                            i.variations.forEach(v => choicesList.push(`${i.name} (${v.name})` + (i.img ? ` | ${i.img}` : '')));
                        } else {
                            choicesList.push(i.name + (i.img ? ` | ${i.img}` : ''));
                        }
                    });
                } else {
                    choicesList = choicesStr.split(',').map(i => i.trim()).filter(Boolean);
                }
            }
            
            setSelectedItemForOptions({ ...item, ingredients, choices: choicesList, selectedSans: [], selectedExtras: [] });
            setSelectedChoiceForOptions(null);
            setSelectedVariationForOptions(item.hasVariations && item.variations?.length > 0 ? item.variations[0] : null);
            setComboSelectionsForOptions({});
            setShowPosSans(false);
            setShowPosExtras(false);
            setShowPosSans(ingredients.length > 0);
            setShowPosExtras(item.extras && item.extras.length > 0);
        } else {
            addToCart(item);
        }
    };

    const confirmOptionsAndAdd = () => {
        if (!selectedItemForOptions) return;
        
        if (selectedItemForOptions.isCombo) {
            const missingDrink = selectedItemForOptions.comboItems?.findIndex((c, i) => c.type === 'drink' && !comboSelectionsForOptions[i]?.selectedOption);
            if (missingDrink !== -1) return showNotify(`Veuillez choisir une option pour: ${selectedItemForOptions.comboItems[missingDrink].name}`, "error");
            let comboChoices = selectedItemForOptions.comboItems?.map((c, i) => ({
                name: c.name,
                removables: comboSelectionsForOptions[i]?.removables || [],
                selectedOption: comboSelectionsForOptions[i]?.selectedOption || null
            }));
            const cartItemId = selectedItemForOptions.id + '_combo_' + Date.now();
            setCart(prev => {
                let newCart = prev;
                if (selectedItemForOptions.isEditingCartItemName) {
                    newCart = prev.filter(i => !(i.id === selectedItemForOptions.id && (i.cartItemId === selectedItemForOptions.cartItemId || i.name === selectedItemForOptions.isEditingCartItemName)));
                }
                return [...newCart, { ...selectedItemForOptions, qty: 1, cartItemId, comboChoices }];
            });
            setSelectedItemForOptions(null);
            return;
        }

        if (selectedItemForOptions.hasVariations && !selectedVariationForOptions) {
            return showNotify("Veuillez choisir une taille !", "error");
        }
        if (selectedItemForOptions.choices?.length > 0 && !selectedChoiceForOptions) {
            return showNotify("Veuillez choisir une option (ex: Coca, Sprite...) !", "error");
        }
        let note = "";
        let finalPrice = selectedVariationForOptions ? Number(selectedVariationForOptions.price || 0) : Number(selectedItemForOptions.price || 0);
        if (selectedVariationForOptions) note += ` (${selectedVariationForOptions.name})`;
        if (selectedChoiceForOptions) note += ` (${selectedChoiceForOptions})`;
        if (selectedItemForOptions.selectedExtras?.length > 0) {
            note += ` (Avec ${selectedItemForOptions.selectedExtras.map(e => e.name).join(', ')})`;
            finalPrice += selectedItemForOptions.selectedExtras.reduce((s, e) => s + Number(e.price), 0);
        }
        if (selectedItemForOptions.selectedSans.length > 0) {
            note += ` (Sans ${selectedItemForOptions.selectedSans.join(', ')})`;
        }
        const itemToAdd = { 
            ...selectedItemForOptions, 
            price: finalPrice,
            selectedVariation: selectedVariationForOptions,
            selectedChoice: selectedChoiceForOptions,
            selectedSans: selectedItemForOptions.selectedSans,
            selectedExtras: selectedItemForOptions.selectedExtras
        };
        
        if (selectedItemForOptions.isEditingCartItemName) {
            const finalName = note ? selectedItemForOptions.name + note : selectedItemForOptions.name;
            setCart(prev => {
                const oldItem = prev.find(i => i.id === selectedItemForOptions.id && i.name === selectedItemForOptions.isEditingCartItemName);
                if (!oldItem) return prev;
                
                const isNameChanged = finalName !== oldItem.name;
                
                // Si l'utilisateur modifie un produit avec une quantité > 1, on le sépare du groupe
                if (isNameChanged && oldItem.qty > 1) {
                    let newCart = prev.map(i => {
                        if (i.id === oldItem.id && i.name === oldItem.name) return { ...i, qty: i.qty - 1 };
                        return i;
                    });
                    
                    const existingNew = newCart.find(i => i.id === itemToAdd.id && i.name === finalName);
                    if (existingNew) return newCart.map(i => i.id === itemToAdd.id && i.name === finalName ? { ...i, qty: i.qty + 1 } : i);
                    return [...newCart, { ...itemToAdd, name: finalName, qty: 1 }];
                } else {
                    let filtered = prev.filter(i => !(i.id === selectedItemForOptions.id && i.name === selectedItemForOptions.isEditingCartItemName));
                    const existing = filtered.find(i => i.id === selectedItemForOptions.id && i.name === finalName);
                    if (existing) {
                        return filtered.map(i => i.id === selectedItemForOptions.id && i.name === finalName ? { ...i, qty: i.qty + oldItem.qty } : i);
                    } else {
                        return [...filtered, { ...itemToAdd, name: finalName, qty: oldItem.qty }];
                    }
                }
            });
        } else {
            addToCart(itemToAdd, note);
        }
        setSelectedItemForOptions(null);
    };

    const toggleOption = (opt) => {
        setSelectedItemForOptions(prev => {
            if (!prev) return prev;
            const alreadySelected = prev.selectedSans.includes(opt);
            const newSelected = alreadySelected 
                ? prev.selectedSans.filter(o => o !== opt)
                : [...prev.selectedSans, opt];
            return { ...prev, selectedSans: newSelected };
        });
    };

    const toggleExtra = (ext) => {
        setSelectedItemForOptions(prev => {
            if (!prev) return prev;
            const alreadySelected = prev.selectedExtras.some(e => e.name === ext.name);
            const newSelected = alreadySelected 
                ? prev.selectedExtras.filter(o => o.name !== ext.name)
                : [...prev.selectedExtras, ext];
            return { ...prev, selectedExtras: newSelected };
        });
    };

    const deleteFromCart = (itemId, itemName) => {
        setCart(prev => prev.filter(i => !(i.id === itemId && i.name === itemName)));
    };

    const updateCartItemQty = (item, delta) => {
        setCart(prev => {
            return prev.map(i => {
                if (i.id === item.id && i.name === item.name) {
                    const newQty = i.qty + delta;
                    if (newQty > 0) {
                        setEditCartItem({...i, qty: newQty}); 
                        return { ...i, qty: newQty };
                    }
                    return i; 
                }
                return i;
            });
        });
    };

    const clearCart = () => {
        if (cart.length > 0) {
            setConfirmDialog({
                message: "Wach m2ked bghiti tsme7 f had l-commande?",
                onConfirm: () => setCart([])
            });
        }
    };

    const printTicketsPos = async (order, brandInfo, isPaid = true, printClientOnly = false) => {
        const doPrintAddition = printAddition && isPaid;
        const doPrintCuisine = printCuisine && !printClientOnly;
        
        if (!doPrintAddition && !doPrintCuisine) {
            if (isPaid) openDrawer();
            return; 
        }
        
        // 🔥 Si une imprimante Bluetooth est connectée, on imprime directement via BT et on coupe !
        if (btCharacteristic) {
            try {
                const dateStr = new Date().toLocaleString('fr-FR');
                const orderTypeStr = order.orderType === 'a_emporter' ? 'A EMPORTER' : 'SUR PLACE';
                
                let text = "\x1B\x40"; // Initialize printer
                
                if (doPrintAddition) {
                    text += "\x1B\x61\x01"; // Center align
                    text += `${brandInfo?.name?.toUpperCase() || 'RESTAURANT'}\n`;
                    text += `--------------------------------\n`;
                    text += `TICKET CLIENT\n`;
                    text += `${dateStr}\n`;
                    text += `COMMANDE #${order.orderNumber}\n`;
                    text += `*** ${orderTypeStr} ***\n`;
                    text += `--------------------------------\n`;
                    text += "\x1B\x61\x00"; // Left align
                    
                    order.items.forEach(item => {
                        text += `${item.qty}x ${item.name.split(' (Sans')[0]}    ${item.price * item.qty} DH\n`;
                        if (item.name.includes(' (Sans')) {
                            const sansList = item.name.split(' (Sans ')[1].replace(')', '').split(', ');
                            sansList.forEach(opt => { text += `  - ${formatSansIngredient(opt)}\n`; });
                        }
                        if (item.isCombo && item.comboChoices) {
                            item.comboChoices.forEach(c => {
                                text += `  🔹 ${c.name}\n`;
                                if (c.removables?.length > 0) text += `    - Sans ${c.removables.join(', ')}\n`;
                                if (c.selectedOption) text += `    - ${c.selectedOption}\n`;
                            });
                        }
                    });
                    
                    text += `--------------------------------\n`;
                    text += `TOTAL: ${order.total} DH\n\n`;
                    text += "\x1B\x61\x01"; // Center align
                    text += `Merci de votre visite !\n\n\n\n`;
                    text += "\x1D\x56\x00"; // Cut
                }

                if (doPrintCuisine) {
                    text += "\x1B\x61\x01"; // Center align
                    text += `BON CUISINE\n`;
                    text += `${dateStr}\n`;
                    text += `COMMANDE #${order.orderNumber}\n`;
                    text += `*** ${orderTypeStr} ***\n`;
                    text += `--------------------------------\n`;
                    text += "\x1B\x61\x00"; // Left align
                    
                    order.items.forEach(item => {
                        text += `${item.qty}x ${item.name.split(' (Sans')[0]}\n`;
                        if (item.name.includes(' (Sans')) {
                            const sansList = item.name.split(' (Sans ')[1].replace(')', '').split(', ');
                            sansList.forEach(opt => { text += `  *** ${formatSansIngredient(opt)} ***\n`; });
                        }
                        if (item.isCombo && item.comboChoices) {
                            item.comboChoices.forEach(c => {
                                text += `  🔹 ${c.name}\n`;
                                if (c.removables?.length > 0) text += `    *** ${c.removables.map(r => formatSansIngredient(r)).join(' ***\n    *** ')} ***\n`;
                                if (c.selectedOption) text += `    *** ${c.selectedOption.toUpperCase()} ***\n`;
                            });
                        }
                    });
                    text += `\n\n\n\n`;
                    text += "\x1D\x56\x00"; // Cut
                }
                
                // Code pour ouvrir le tiroir
                text += "\x1B\x70\x00\x19\xFA";
                if (isPaid) text += "\x1B\x70\x00\x19\xFA";

                await sendBluetoothData(text);
                return; // Sortir de la fonction pour ne pas ouvrir la fenêtre Web normale
            } catch (err) {
                console.error("Erreur lors de l'impression Bluetooth:", err);
                showNotify("Erreur d'impression Bluetooth, passage en mode web...", "warning");
            }
        }
        
        const itemsHtml = order.items.map(item => `
            <div style="display:flex; justify-content:space-between; margin-bottom: 5px; font-weight: bold; font-size: 14px;">
                <span>${item.qty}x ${item.name.split(' (Sans')[0]}</span>
                <span>${item.price * item.qty} DH</span>
            </div>
            ${item.name.includes(' (Sans') ? `<div style="font-size:12px; color:#da291c; margin-top:-3px; margin-bottom:5px; font-weight: bold;">- ${item.name.split(' (Sans ')[1].replace(')', '').split(', ').map(opt => formatSansIngredient(opt)).join('<br>- ')}</div>` : ''}
            ${item.isCombo && item.comboChoices ? item.comboChoices.map(c => `
                <div style="font-size:12px; color:#555; margin-left:10px; font-weight: bold;">
                    🔹 ${c.name}
                    ${c.removables?.length ? `<span style="color:#da291c;">(${c.removables.map(r => formatSansIngredient(r)).join(', ')})</span>` : ''}
                    ${c.selectedOption ? `<span style="color:#2563eb;">(${c.selectedOption})</span>` : ''}
                </div>
            `).join('') : ''}
        `).join('');

        const kitchenItemsHtml = order.items.map(item => `
            <div style="margin-bottom: 8px; font-size: 20px; font-weight: 900;">
                ${item.qty}x ${item.name.split(' (Sans')[0]}
            </div>
            ${item.name.includes(' (Sans') ? `<div style="font-size:16px; margin-top:-5px; margin-bottom:8px; font-weight: 900;">*** ${item.name.split(' (Sans ')[1].replace(')', '').split(', ').map(opt => formatSansIngredient(opt)).join(' ***<br>*** ')} ***</div>` : ''}
            ${item.isCombo && item.comboChoices ? item.comboChoices.map(c => `
                <div style="font-size:16px; margin-top:5px; font-weight: bold; padding-left: 15px; border-left: 2px solid #000;">
                    🔹 ${c.name}
                    ${c.removables?.length ? `<br><span style="color:#000;">*** ${c.removables.map(r => formatSansIngredient(r)).join(' ***<br>*** ')} ***</span>` : ''}
                    ${c.selectedOption ? `<br><span style="color:#000;">*** ${c.selectedOption} ***</span>` : ''}
                </div>
            `).join('') : ''}
        `).join('');

        const dateStr = new Date().toLocaleString('fr-FR');
        const orderTypeStr = order.orderType === 'a_emporter' ? 'À EMPORTER' : 'SUR PLACE';

        const clientHtmlStr = `
        <html>
        <head><title>Ticket Client</title></head>
        <body style="font-family: monospace; padding: 10px; color: #000; width: 300px; margin: 0 auto;">
            <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 20px;">
                ${brandInfo?.ticketLogoUrl ? `<img src="${brandInfo.ticketLogoUrl}" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: 10px;" /><br/>` : ''}
                <h2 style="margin: 0; font-size: 24px; font-weight: 900;">${brandInfo?.name?.toUpperCase() || 'RESTAURANT'}</h2>
                ${brandInfo?.ticketHeader ? `<p style="margin: 5px 0; font-size: 14px;">${brandInfo.ticketHeader}</p>` : ''}
                ${brandInfo?.ticketPhone ? `<p style="margin: 5px 0; font-size: 14px;">Tél: ${brandInfo.ticketPhone}</p>` : ''}
                ${brandInfo?.ticketWebsite ? `<p style="margin: 5px 0; font-size: 14px;">${brandInfo.ticketWebsite}</p>` : ''}
                
                <p style="margin: 15px 0 5px 0; font-weight: bold; border-top: 1px dashed #000; padding-top: 10px;">TICKET CLIENT</p>
                <p style="margin: 5px 0; font-size: 12px;">${dateStr}</p>
                <h1 style="margin: 10px 0; font-size: 32px;">#${order.orderNumber}</h1>
                <h2 style="margin: 5px 0; padding: 5px; border: 2px solid #000;">${orderTypeStr}</h2>
                <div style="margin-top: 15px; text-align: left;">
                    ${itemsHtml}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 900; margin-top: 15px; border-top: 1px solid #000; padding-top: 10px;">
                    <span>TOTAL:</span>
                    <span>${order.total} DH</span>
                </div>
                <p style="font-size: 14px; margin-top: 15px; font-weight: bold;">${brandInfo?.ticketFooter || 'Merci de votre visite !'}</p>
            </div>
        </body>
        </html>
        `;

        const cuisineHtmlStr = `
        <html>
        <head><title>Ticket Cuisine</title></head>
        <body style="font-family: monospace; padding: 10px; color: #000; width: 300px; margin: 0 auto;">
            <div style="text-align: center; padding-top: 10px;">
                <h2 style="margin: 0; font-size: 28px; font-weight: 900;">BON CUISINE</h2>
                <p style="margin: 5px 0; font-size: 12px; font-weight: bold;">${dateStr}</p>
                <h1 style="margin: 10px 0; font-size: 45px; font-weight: 900;">#${order.orderNumber}</h1>
                <h2 style="margin: 5px 0; padding: 5px; border: 3px solid #000; font-size: 22px;">${orderTypeStr}</h2>
                <div style="margin-top: 20px; text-align: left; border-top: 2px solid #000; padding-top: 10px;">
                    ${kitchenItemsHtml}
                </div>
            </div>
        </body>
        </html>
        `;

        // 🔥 ZEDNA HAD L-CODE: Impression Electron ola Web
        if (typeof window !== 'undefined' && window.require) {
            const { ipcRenderer } = window.require('electron');
            if (doPrintAddition) ipcRenderer.send('print-ticket', clientHtmlStr, brand?.selectedPrinter);
            if (doPrintCuisine) {
                setTimeout(() => { ipcRenderer.send('print-ticket', cuisineHtmlStr, brand?.selectedPrinter); }, 1000);
            }
            if (isPaid && !doPrintAddition) openDrawer();
        } else {
            const printHtml = (htmlContent) => {
                const printWindow = window.open('', '', 'width=400,height=800');
                if (printWindow) {
                    printWindow.document.open();
                    const htmlWithScript = htmlContent.replace('</body>', `
                    <script>
                        window.onload = function() { setTimeout(function() { window.print(); }, 500); };
                        window.onafterprint = function() { window.close(); };
                    </script>
                    </body>`);
                    printWindow.document.write(htmlWithScript);
                    printWindow.document.close();
                }
            };
            if (doPrintAddition) printHtml(clientHtmlStr);
            if (doPrintCuisine) setTimeout(() => { printHtml(cuisineHtmlStr); }, doPrintAddition ? 1500 : 0);
            if (isPaid && !doPrintAddition) openDrawer();
        }
    };

    const saveOfflineOrder = (order) => {
        setOfflineQueue(prev => {
            const current = [...prev, order];
            localStorage.setItem('posOfflineQueue', JSON.stringify(current));
            return current;
        });
        showNotify("Hors ligne : Commande mkhabya (Ghatssifet mli trje3 connexion) 💾", "info");
    };

    const handleEncaissement = async (isPaid = true) => {
        if (cart.length === 0) return showNotify("L-panier khawi!", "error");
        if (activeBranchId === 'ALL') return showNotify("Khtar agence mnin ghat-encaisser l-commande!", "error");

        try {
            const orderNum = generateOrderNumber();
            const branch = (settings?.branches || []).find(b => b.id === activeBranchId) || null;

            const newOrder = {
                orderNumber: orderNum,
                items: cart,
                total: total,
                subtotal: total,
                deliveryFee: 0,
                status: 'preparing', // 🚀 POS orders kaymchiw l-Cuisine (KDS)
                paymentStatus: isPaid ? 'paye' : 'en_attente',
                deliveredAtLocal: Date.now(),
                source: 'pos',
                orderType: orderType,
                paymentMethod: 'espece',
                nearestBranch: branch,
                customerName: orderType === 'a_emporter' ? 'Client Emporter' : 'Client Sur Place',
                offlineCreatedAt: Date.now(),
                ...getDriverAssignmentData()
            };

            // 🚀 1. IMPRESSION ET RESET INSTANTANÉS (0 SECONDE D'ATTENTE)
            const orderToPrint = { ...newOrder, id: orderNum };
            printTicketsPos(orderToPrint, brand, isPaid); 
            setCart([]); // Nkhwiw l-panier f l-blassa
            setOrderType(settings?.hidePosSurPlace ? 'a_emporter' : 'sur_place'); 

            // 🚀 2. SAUVEGARDE FIREBASE EN ARRIÈRE-PLAN (Sans bloquer la caisse)
            const sanitizedOrder = JSON.parse(JSON.stringify(newOrder));
            if (isNetOnline) {
                addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), {
                    ...sanitizedOrder,
                    createdAt: serverTimestamp()
                }).catch((error) => {
                    console.error("Firebase AddDoc Error:", error);
                    saveOfflineOrder(sanitizedOrder);
                });
            } else {
                saveOfflineOrder(sanitizedOrder);
            }

            // 🚀 3. EMIT VERS KDS LOCAL (WIFI HORS LIGNE)
            if (localSocket) {
                localSocket.emit('new_local_order', sanitizedOrder);
            }
        } catch (error) {
            showNotify("W9e3 mochkil f tsjal dyal l-commande", "error");
        }
    };
    
    const handlePayUnpaidTicket = (order) => {
        try {
            // 🚀 UI INSTANTANÉE
            if (unpaidOrders.length === 1) setShowUnpaidModal(false);
            showNotify("Ticket payé w t'imprima ! ✅", "success");
            
            const orderToPrint = { ...order, paymentMethod: 'espece', paymentStatus: 'paye' };
            printTicketsPos(orderToPrint, brand, true, true);

            // 🚀 FIREBASE EN ARRIÈRE-PLAN
            updateStatus(order.id, order.status, { paymentStatus: 'paye', paymentMethod: 'espece' }).catch(()=>{});
        } catch (error) {
            showNotify("Erreur lors du paiement", "error");
        }
    };

    // 🔥 Fonction pour ouvrir le tiroir (Bluetooth, Electron, ou Manuel)
    const openDrawer = async () => {
        if (btCharacteristic) {
            try {
                // Code ESC/POS pour ouvrir le tiroir-caisse connecté au port RJ11 de l'imprimante
                const escPosDrawer = "\x1B\x70\x00\x19\xFA";
                await sendBluetoothData(escPosDrawer);
                showNotify("Tiroir ouvert b-Bluetooth 🔓", "success");
            } catch (e) {
                showNotify("Erreur d'ouverture du tiroir BT", "error");
            }
        } else if (typeof window !== 'undefined' && window.require) {
            // 🔥 Mode EXE (Electron) : Nsifto un ticket khawi bach y-déclencher le tiroir f Windows
            try {
                const { ipcRenderer } = window.require('electron');
                const emptyHtml = `<html><head><title>Tiroir</title></head><body style="margin:0;padding:0;font-size:1px;color:white;">.</body></html>`;
                ipcRenderer.send('print-ticket', emptyHtml, brand?.selectedPrinter);
                showNotify("Signal envoyé l-Tiroir (EXE) 🔓", "success");
            } catch (e) {
                showNotify("Erreur Electron pour le tiroir", "error");
            }
        } else {
            showNotify("Tiroir ouvert (Simulation Web) 🔓", "success");
        }
    };

    // 🔥 Impression des Rapports X / Z
    const printReport = (type) => {
        if (activeBranchId === 'ALL') {
            showNotify("Veuillez sélectionner une agence spécifique pour imprimer le rapport.", "error");
            return;
        }
        const branch = (settings?.branches || []).find(b => b.id === activeBranchId);
        const itemsHtml = dailyItemsList.map(([name, qty]) => `<div style="display:flex; justify-content:space-between;"><span>${qty}x ${name}</span><span></span></div>`).join('');
        
        const repartitionHtml = `\n
            <p style="text-align:left; font-weight:bold; margin:5px 0;">Répartition C.A :</p>
            ${isAdmin ? `<div style="display:flex; justify-content:space-between; font-size:12px;"><span>Sur Place (Caisse):</span><span>${caPos} DH</span></div>` : ''}
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#16a34a;"><span>Glovo (Espèce):</span><span>${caGlovoEspece} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Glovo (En Ligne):</span><span>${caGlovoEnLigne} DH</span></div>
            ${isAdmin ? `<div style="display:flex; justify-content:space-between; font-size:12px;"><span>Web App:</span><span>${caApp} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Standard (Tél):</span><span>${caTel} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Achats (Dépenses):</span><span>-${totalAchats} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold;"><span>Net (Espèce Caisse + Glovo - Achats):</span><span>${(caPos + caGlovoEspece) - totalAchats} DH</span></div>` : ''}
            <hr style="border-top:1px dashed #000; margin:10px 0;"/>\n`;
        
        const html = `<html><head><title>Rapport ${type}</title></head>
        <body style="font-family:monospace; padding:10px; font-size:14px; color:#000; text-align:center;">
            ${brand?.ticketLogoUrl ? `<img src="${brand.ticketLogoUrl}" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: 10px;" /><br/>` : ''}
            <h2 style="margin:0;">RAPPORT ${type}</h2>
            <p style="margin:5px 0;">${branch?.name?.toUpperCase() || brand?.name?.toUpperCase() || 'CAISSE'}<br>Date: ${new Date().toLocaleString('fr-FR')}</p>
            <hr style="border-top:1px dashed #000; margin:10px 0;"/><div style="display:flex; justify-content:space-between;"><span>Total Tickets:</span><span>${completedOrdersToday.length}</span></div><hr style="border-top:1px dashed #000; margin:10px 0;"/>
            ${repartitionHtml}<p style="text-align:left; font-weight:bold; margin:5px 0;">Détails des ventes :</p>${itemsHtml || '<p style="text-align:left;">Aucun article</p>'}
            <hr style="border-top:1px dashed #000; margin:10px 0;"/><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:18px; margin-top:10px;"><span>C.A TOTAL:</span><span>${isAdmin ? dailyCA + ' DH' : '*** DH'}</span></div>
            <p style="margin-top:20px; font-size:12px;">${type === 'Z' ? '*** CLOTURE Z ***' : '*** BILAN PROVISOIRE X ***'}</p>
        </body></html>`;

        // 🔥 ZEDNA HAD L-CODE: Impression Electron ola Web
        if (typeof window !== 'undefined' && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('print-ticket', html, brand?.selectedPrinter);
        } else {
            const printWindow = window.open('', '', 'width=400,height=800');
            if (printWindow) {
                printWindow.document.open();
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

        // Ouvrir le tiroir caisse automatiquement
        openDrawer();

        if (type === 'Z') { showNotify("Journée clôturée avec succès ✅", "success"); setShowXZModal(false); }
    };

    const renderHeaderButton = (btnId, idx) => {
        const dragProps = isAdmin ? {
            draggable: true,
            onDragStart: () => dragBtnRef.current = idx,
            onDragEnter: () => dropBtnRef.current = idx,
            onDragEnd: handleBtnDragEnd,
            onDragOver: e => e.preventDefault(),
        } : {};
        const cursorClass = isAdmin ? 'cursor-move' : '';
            const baseClass = `relative flex items-center justify-center gap-2 px-3 rounded-2xl font-bold transition-all duration-300 text-xs sm:text-sm shadow-sm hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 shrink-0 border border-transparent ${cursorClass}`;

        switch(btnId) {
            case 'commandes_web':
                const webBg = brand?.btnPosWebColor || ''; const webTxt = brand?.btnPosWebTxtColor || '';
                    const webStyle = webBg ? { backgroundColor: webBg, color: webTxt || '#ffffff', borderColor: webBg, width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` } : { width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` };
                return (
                    <button key={btnId} {...dragProps} style={webStyle} onClick={() => {
                        if (pendingOnline.length > 0) setShowPendingModal(true);
                        else { if (setTab) setTab('active'); else window.location.href = '/idara'; }
                    }} className={`${baseClass} ${pendingOnline.length > 0 ? 'bg-red-500 text-white animate-pulse border border-red-600' : (webBg ? '' : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100')}`}>
                        <BellRing size={18} className={pendingOnline.length > 0 ? 'animate-bounce' : ''}/>
                        <span className="hidden sm:inline">{brand?.texts?.btnCommandesWeb || 'Commandes Web'}</span>
                        {pendingOnline.length > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{pendingOnline.length}</span>}
                    </button>
                );
            case 'non_payes':
                return (
                    <button key={btnId} {...dragProps} onClick={() => setShowUnpaidModal(true)} className={`${baseClass} ${unpaidOrders.length > 0 ? 'bg-red-600 text-white hover:bg-red-700 border-red-700 animate-pulse' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'}`} style={{ width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` }}>
                        <Banknote size={18} /> <span className="hidden sm:inline">Ticket Non Payé</span>
                        {unpaidOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md animate-bounce">{unpaidOrders.length}</span>}
                    </button>
                );
            case 'problemes':
                if (problemOrders.length === 0) return null;
                const probBg = brand?.btnPosProbColor || ''; const probTxt = brand?.btnPosProbTxtColor || '';
                    const probStyle = probBg ? { backgroundColor: probBg, color: probTxt || '#ffffff', borderColor: probBg, width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` } : { width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` };
                return (
                    <button key={btnId} {...dragProps} style={probStyle} onClick={() => setShowProblemModal(true)} className={`${baseClass} ${probBg ? '' : 'bg-red-500 text-white border border-red-600'} animate-pulse`}>
                        <AlertTriangle size={18} /> <span className="hidden sm:inline">{brand?.texts?.btnProblemes || 'Problèmes'}</span>
                        <span className="absolute -top-2 -right-2 bg-yellow-400 text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{problemOrders.length}</span>
                    </button>
                );
            case 'suivi':
const suiviBg = brand?.btnPosSuiviColor || ''; const suiviTxt = brand?.btnPosSuiviTxtColor || '';
                    const suiviStyle = suiviBg ? { backgroundColor: suiviBg, color: suiviTxt || '#ffffff', borderColor: suiviBg, width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` } : { width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` };
                return (
                    <button key={btnId} {...dragProps} style={suiviStyle} onClick={() => setShowOnlineOrdersModal(true)} className={`${baseClass} ${onlineOrders.length > 0 ? 'bg-purple-500 text-white hover:bg-purple-600 border-purple-600' : (suiviBg ? '' : 'bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100')}`}>
                        <ShoppingBag size={18} /> <span className="hidden sm:inline">{brand?.texts?.btnSuivi || 'Suivi Web/Tél'}</span>
                        {onlineOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{onlineOrders.length}</span>}
                    </button>
                );
            case 'pretes':
                const preteBg = brand?.btnPosPreteColor || ''; const preteTxt = brand?.btnPosPreteTxtColor || '';
                    const preteStyle = preteBg ? { backgroundColor: preteBg, color: preteTxt || '#ffffff', borderColor: preteBg, width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` } : { width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` };
                return (
                    <button key={btnId} {...dragProps} style={preteStyle} onClick={() => setShowReadyPosModal(true)} className={`${baseClass} ${readyPosOrders.length > 0 ? 'bg-green-500 text-white animate-pulse border border-green-600' : (preteBg ? '' : 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100')}`}>
                        <CheckCircle size={18} /> <span className="hidden sm:inline">{brand?.texts?.btnPretes || 'Prêtes (Servir)'}</span>
                        {readyPosOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{readyPosOrders.length}</span>}
                    </button>
                );
            case 'glovo_ready':
                return (
                    <button key={btnId} {...dragProps} onClick={() => setShowGlovoModal(true)} className={`${baseClass} ${readyGlovoOrders.length > 0 ? 'text-black animate-pulse shadow-lg font-black' : 'bg-yellow-50 border border-yellow-200 text-yellow-700 hover:bg-yellow-100'}`} style={{ width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px`, backgroundColor: readyGlovoOrders.length > 0 ? brand.color || '#FFC244' : undefined, borderColor: readyGlovoOrders.length > 0 ? brand.color || '#FFC244' : undefined }}>
                        <Bike size={20} /> <span className="hidden sm:inline">Prêtes (Glovo)</span>
                        {readyGlovoOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-black text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{readyGlovoOrders.length}</span>}
                    </button>
                );
            case 'glovo_verify':
                return (
                    <button key={btnId} {...dragProps} onClick={triggerGlovoVerification} disabled={isVerifyingGlovo} className={`${baseClass} relative ${glovoCancellationsToday > 0 ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'} disabled:opacity-50 disabled:cursor-not-allowed`} style={{ width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` }}>
                        {isVerifyingGlovo ? <RefreshCw size={18} className="animate-spin" /> : <Bike size={18} />} <span className="hidden sm:inline text-center leading-tight">{isVerifyingGlovo ? "Vérification..." : "Vérifier Annulées (Glovo)"}</span>
                        {glovoCancellationsToday > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{glovoCancellationsToday}</span>
                        )}
                    </button>
                );
            case 'tv':
                const tvBg = brand?.btnPosTvColor || ''; const tvTxt = brand?.btnPosTvTxtColor || '';
                    const tvStyle = tvBg ? { backgroundColor: tvBg, color: tvTxt || '#ffffff', borderColor: tvBg, width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` } : { width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` };
                return (
                    <button key={btnId} {...dragProps} style={tvStyle} onClick={() => {
                    const route = activeBranchId !== 'ALL' ? `/tv?branch=${activeBranchId}` : '/tv';
                        window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank');
                    }} className={`${baseClass} ${tvBg ? '' : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-700'}`}>
                        <Monitor size={18} /> <span className="hidden sm:inline">{brand?.texts?.btnTv || 'Écran TV'}</span>
                    </button>
                );
            case 'standard':
                const stdBg = brand?.btnPosStdColor || ''; const stdTxt = brand?.btnPosStdTxtColor || '';
                    const stdStyle = stdBg ? { backgroundColor: stdBg, color: stdTxt || '#ffffff', borderColor: stdBg, width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` } : { width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` };
                return (
                    <button key={btnId} {...dragProps} style={stdStyle} onClick={() => setShowStandardModal(true)} className={`${baseClass} ${stdBg ? '' : 'bg-orange-500 hover:bg-orange-600 text-white border border-orange-600'}`}>
                        📞 <span className="hidden sm:inline">{brand?.texts?.btnStandard || 'Standard Tél'}</span>
                    </button>
                );
            case 'kds':
                const kdsBg = brand?.btnPosKdsColor || ''; const kdsTxt = brand?.btnPosKdsTxtColor || '';
                    const kdsStyle = kdsBg ? { backgroundColor: kdsBg, color: kdsTxt || '#ffffff', borderColor: kdsBg, width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` } : { width: `${posUI.actionBtnWidth}px`, height: `${posUI.actionBtnHeight}px` };
                return (
                    <button key={btnId} {...dragProps} style={kdsStyle} onClick={() => {
                    const route = activeBranchId !== 'ALL' ? `/kds?branch=${activeBranchId}` : '/kds';
                        window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank');
                    }} className={`${baseClass} ${kdsBg ? '' : 'bg-neutral-900 hover:bg-black text-white border border-neutral-800'}`}>
                        <ChefHat size={18} className="text-orange-500" /> <span className="hidden sm:inline">{brand?.texts?.btnKds || 'Cuisine (KDS)'}</span>
                    </button>
                );
            default:
                return null;
        }
    };

    const theme = brand?.posTheme || 'light';
    const isDark = theme === 'dark';
    const isNavy = theme === 'navy';

    // Variables de Thème
    const mainBg = isDark ? 'bg-neutral-900' : isNavy ? 'bg-slate-50' : 'bg-[#f4f7f6]';
    const mainTextColor = isDark ? '#ffffff' : isNavy ? '#0f172a' : (brand?.posTextColor || brand?.textColor || '#1e293b');
    const headerClasses = isDark ? 'bg-neutral-800/95 border-neutral-700 text-white shadow-md' : isNavy ? 'bg-[#0f172a]/95 border-slate-800 text-white shadow-md' : 'bg-white/80 backdrop-blur-xl border-gray-100/80 text-gray-900 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]';
    const logoBg = isDark ? 'bg-gradient-to-br from-neutral-700 to-neutral-600' : isNavy ? 'bg-gradient-to-br from-blue-600 to-blue-500' : 'bg-gradient-to-br from-gray-900 to-gray-700';
    const catBgActive = brand?.posColor || brand?.color || (isDark ? '#e5e5e5' : isNavy ? '#0f172a' : '#0f172a');
    const catTextActive = isDark && !brand?.posColor ? '#000000' : '#ffffff';
    const catClassesInactive = isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white border-neutral-700' : isNavy ? 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 border-slate-200' : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-gray-100 hover:border-gray-200';
    const cardBg = isDark ? 'bg-neutral-800 border-neutral-700 hover:border-neutral-500 text-white shadow-lg' : isNavy ? 'bg-white border-slate-200 shadow-sm text-slate-900' : 'bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] border-transparent hover:border-gray-200 text-gray-800';
    const cardImgBg = isDark ? 'bg-neutral-700/50' : isNavy ? 'bg-slate-100/50' : 'bg-gray-50/50';
    const titleColor = isDark ? 'text-white' : 'text-gray-800';
    const priceColor = isDark && !brand?.posColor ? '#ffffff' : (brand?.posColor || brand?.color || '#0f172a');
    const cartSidebarClasses = isDark ? 'bg-neutral-900 border-neutral-800' : isNavy ? 'bg-white border-slate-200' : 'bg-white shadow-[-20px_0_40px_-20px_rgba(0,0,0,0.08)] border-gray-100';
    const cartHeaderClasses = isDark ? 'bg-neutral-900/90 border-neutral-800 text-white' : isNavy ? 'bg-white/90 border-slate-100 text-slate-900' : 'bg-white/90 border-gray-100/80 text-gray-900';
    const cartItemBg = isDark ? 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-white shadow-none' : isNavy ? 'bg-white border-slate-100 hover:shadow-md' : 'bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border-gray-100/80 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)]';
    const cartQtyBg = isDark ? 'bg-neutral-700 text-white' : isNavy ? 'bg-slate-50 text-slate-900 border-slate-200' : 'bg-[#f4f7f6] text-gray-800 border-gray-200/50';
    const cartTotalBg = isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-100';
    const iconColor = isDark || isNavy ? 'text-white' : 'text-gray-900';

    return (
        <div 
            className={`flex flex-col h-[100dvh] md:h-full w-full md:flex-row overflow-hidden relative font-sans ${mainBg}`} 
            style={{ fontFamily: brand?.fontFamily || "'Inter', 'Plus Jakarta Sans', sans-serif", color: mainTextColor }}
        >

            {/* MAIN CONTENT (LEFT) */}
            <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
                <header className={`px-4 sm:px-6 py-3 flex items-center justify-between z-10 shrink-0 w-full gap-2 sm:gap-4 border-b ${headerClasses}`}>
                    
                    {/* LEFT: LOGO */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${logoBg}`}>
                            <ShoppingBasket size={22} className="font-black"/> 
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="font-black text-lg sm:text-xl truncate max-w-[120px] sm:max-w-[200px] leading-tight tracking-tight">
                                {brand?.texts?.posAppTitle || brand?.name || 'Mon Bocadillo'}
                            </span>
                            {activeBranchId && activeBranchId !== 'ALL' && !isAdmin && (
                            <span className={`text-[10px] md:text-xs font-bold uppercase tracking-widest leading-tight ${isDark ? 'text-neutral-400' : 'text-gray-400'}`}>
                                Caisse {(settings?.branches || []).find(b => b.id === activeBranchId)?.name || ''}
                            </span>
                            )}
                            {isAdmin && (
                                <select
                                    value={activeBranchId}
                                    onChange={(e) => setActiveBranchId(e.target.value)}
                                    className={`mt-1 border px-1 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold outline-none cursor-pointer w-fit ${isDark ? 'bg-neutral-800 border-neutral-600 text-white' : isNavy ? 'bg-[#0f172a] border-slate-700 text-white' : 'bg-gray-100 border-gray-200 text-gray-700'}`}
                                >
                                    <option value="ALL">Toutes les agences</option>
                                    {(settings?.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            )}
                        </div>
                    </div>
                    
                    {/* MIDDLE: BUTTONS (SCROLLABLE SINGLE LINE) */}
                    <div className="flex-1 flex flex-wrap items-center justify-center gap-1.5 py-1">
                        {displayedButtons.map((btnId, idx) => renderHeaderButton(btnId, idx))}
                    </div>

                    {/* RIGHT: CONFIG & WINDOW CONTROLS */}
                    <div className="flex items-center gap-2 shrink-0 border-l border-gray-200/50 pl-2 sm:pl-4">
                        {showInstallBtn && (
                            <button onClick={handleInstallApp} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-black uppercase rounded-xl shadow-md animate-bounce active:scale-95 transition-all">
                                📲 Installer
                            </button>
                        )}
                        {!isNetOnline ? (
                            <div className="flex items-center gap-1.5 bg-red-100 text-red-600 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm border border-red-200">
                                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
                                <span className="hidden sm:inline">Hors Ligne</span> ({offlineQueue.length})
                            </div>
                        ) : offlineQueue.length > 0 ? (
                            <button onClick={() => syncOfflineOrdersRef.current && syncOfflineOrdersRef.current()} className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm border border-yellow-300 hover:bg-yellow-200 transition-colors">
                                <History size={14} /> Sync ({offlineQueue.length})
                            </button>
                        ) : null}

                        <button onClick={() => setShowUISettings(true)} className="p-2 sm:px-3 sm:py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors shadow-md flex items-center gap-1.5 text-[10px] sm:text-xs font-bold" title="Configuration">
                            <Settings size={16}/> <span className="hidden sm:inline">Config</span>
                        </button>
                        
                        {/* Electron Window Controls - Plus compacts et pros */}
                        <div className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                            <button onClick={() => {
                                if (window.require) {
                                    const { ipcRenderer } = window.require('electron');
                                    ipcRenderer.send('minimize-window');
                                }
                            }} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white hover:shadow-sm rounded-lg transition-all" title="Réduire">
                                <Minus size={16} strokeWidth={3} />
                            </button>
                            <button onClick={() => {
                                if (window.require) {
                                    const { ipcRenderer } = window.require('electron');
                                    ipcRenderer.send('close-window');
                                } else {
                                    window.close();
                                }
                            }} className="p-1.5 text-gray-500 hover:text-white hover:bg-red-500 hover:shadow-sm rounded-lg transition-all" title="Fermer">
                                <X size={16} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </header>
                
                <div className="pt-5 pb-3 px-4 sm:px-6 overflow-x-auto no-scrollbar shrink-0 w-full bg-transparent">
                    <div className="flex gap-3 w-max items-center">
                        {categories.map((cat, idx) => (
                            <button 
                                key={cat} 
                                draggable={isAdmin}
                                onDragStart={() => dragCatRef.current = idx}
                                onDragEnter={() => dropCatRef.current = idx}
                                onDragEnd={handleCatDragEnd}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => setSelectedCategory(cat)} 
                                className={`px-5 sm:px-7 rounded-full font-bold transition-all duration-300 whitespace-nowrap text-sm sm:text-[15px] flex items-center justify-center border-2 ${displayCategory === cat ? 'shadow-[0_8px_16px_-6px_rgba(0,0,0,0.3)] scale-105 border-transparent' : catClassesInactive} ${isAdmin ? 'cursor-move' : ''}`} 
                                style={displayCategory === cat ? { minWidth: `${posUI.catWidth}px`, height: `${posUI.catHeight}px`, backgroundColor: catBgActive, color: catTextActive } : { minWidth: `${posUI.catWidth}px`, height: `${posUI.catHeight}px` }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

            <main className="flex-1 p-3 sm:p-4 md:p-8 overflow-y-auto w-full">
                {idleOtherDrivers.length > 0 && (
                    <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-6 rounded-r-xl shadow-sm flex items-start gap-3 animate-in fade-in">
                        <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={24} />
                        <div className="flex-1">
                            <h4 className="text-orange-800 font-black text-sm uppercase tracking-wide">🚨 Livreur Surchargé !</h4>
                            <p className="text-orange-700 text-xs font-bold mt-1">
                                Votre livreur a déjà plusieurs commandes en cours. Voici des livreurs d'autres agences qui sont libres :
                            </p>
                            <div className="flex flex-col gap-2 mt-3">
                                {idleOtherDrivers.map(d => (
                                    <div key={d.uid} className="flex items-center justify-between bg-white border border-orange-200 px-3 py-2 rounded-lg shadow-sm">
                                        <a href={`tel:${d.phone}`} className="flex items-center gap-2 hover:opacity-70 transition-opacity" title="Appeler ce livreur">
                                            <Phone size={14} className="text-orange-500" />
                                            <span className="text-xs font-black text-orange-900 underline">{d.name} ({d.phone})</span>
                                        </a>
                                        <button 
                                            onClick={() => {
                                                updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'drivers', d.uid), {
                                                    helpRequest: {
                                                        branchId: activeBranchId,
                                                        branchName: (settings?.branches || []).find(b => b.id === activeBranchId)?.name || 'Caisse',
                                                        timestamp: Date.now()
                                                    }
                                                });
                                                showNotify(`Demande d'aide envoyée à ${d.name} !`, "success");
                                            }}
                                            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-colors shadow-sm"
                                        >
                                            Demander Aide
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeHelpers.length > 0 && (
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-xl shadow-sm flex items-start gap-3 animate-in fade-in">
                        <CheckCircle className="text-blue-600 shrink-0 mt-0.5" size={24} />
                        <div className="flex-1">
                            <h4 className="text-blue-800 font-black text-sm uppercase tracking-wide">🤝 Livreurs en Aide</h4>
                            <p className="text-blue-700 text-xs font-bold mt-1">Vous pouvez maintenant leur assigner des commandes :</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {activeHelpers.map(h => (
                                    <span key={h.uid} className="bg-blue-200 text-blue-900 px-3 py-1.5 rounded-md text-xs font-bold shadow-sm">
                                        🛵 {h.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${posUI.cardWidth}px, 1fr))`, gap: '18px', paddingBottom: '32px' }}>
                        {filteredMenu.map((item, idx) => (
                        <div 
                            key={item.id} 
                            draggable={isAdmin}
                            onDragStart={() => dragItemRef.current = idx}
                            onDragEnter={() => dropItemRef.current = idx}
                            onDragEnd={handleItemDragEnd}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => {
                                if (item.outOfStock) {
                                    showNotify("Rupture de stock validé man kds li daro repture", "error");
                                    return;
                                }
                                handleProductClick(item, false);
                            }} 
                            className={`group relative rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-between gap-3 sm:gap-4 border overflow-hidden transition-all duration-300 ${cardBg} ${item.outOfStock ? 'opacity-60 grayscale cursor-not-allowed border-red-200' : 'cursor-pointer hover:-translate-y-1'} ${isAdmin ? 'cursor-move' : ''}`}
                            style={{ minHeight: `${posUI.cardHeight}px` }}
                        >
                            <div className={`w-full flex items-center justify-center rounded-2xl overflow-hidden relative transition-transform duration-300 group-hover:scale-105 ${cardImgBg}`} style={{ height: `${posUI.imgHeight}px` }}>
                                {item.outOfStock && (
                                    <div className={`absolute inset-0 flex items-center justify-center z-20 ${isDark ? 'bg-black/70' : 'bg-white/70 backdrop-blur-sm'}`}>
                                        <span className={`font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-lg transform -rotate-12 border-2 tracking-widest ${isDark ? 'bg-red-600 text-white border-red-500' : 'bg-red-500 text-white border-white'}`}>RUPTURE</span>
                                    </div>
                                )}
                                {typeof item.img === 'string' && (item.img.startsWith('http') || item.img.startsWith('data:image')) ? (
                                    <img src={item.img} loading="lazy" className={`w-full h-full object-contain drop-shadow-sm ${isDark ? '' : 'mix-blend-multiply'}`} alt={item.name}/>
                                ) : (
                                    <span className="text-6xl sm:text-7xl">{item.img}</span>
                                )}
                            </div>
                            <div className="w-full text-left space-y-1 px-1">
                                <h3 className={`font-bold text-sm sm:text-base leading-tight line-clamp-2 tracking-tight ${titleColor}`}>{item.name}</h3>
                                <p className="font-black text-lg sm:text-xl tracking-tighter" style={{ color: item.outOfStock ? '#9ca3af' : priceColor }}>
                                    {item.price} <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-400'}`}>DH</span>
                                </p>
                            </div>
                        </div>
                        ))}
                    </div>
                </main>
            </div>

            {/* BOUTON FLOTTANT MOBILE POUR OUVRIR LE PANIER */}
            {!isMobileCartOpen && (
                <button
                    onClick={() => setIsMobileCartOpen(true)}
                    className="md:hidden fixed bottom-6 right-6 z-40 text-white p-4 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] flex items-center gap-3 font-black text-lg active:scale-95 transition-transform border-2 border-white"
                    style={{ backgroundColor: brand?.posColor || brand?.color || '#4f46e5' }}
                >
                    <div className="relative">
                        <ShoppingBag size={28} />
                        {cart.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white shadow-sm">
                                {cart.reduce((s,i)=>s+i.qty,0)}
                            </span>
                        )}
                    </div>
                    {cart.length > 0 && <span>{total} DH</span>}
                </button>
            )}

            {/* CART SIDEBAR (RIGHT) */}
            <aside className={`${isMobileCartOpen ? 'fixed inset-0 z-[100] flex w-full' : 'hidden md:flex'} flex-col h-full md:z-20 shrink-0 relative ${cartSidebarClasses}`} style={{ width: isMobileCartOpen ? '100%' : `${posUI.cartWidth}px` }}>
                <div className={`p-5 sm:p-7 md:p-8 flex justify-between items-center border-b sticky top-0 z-10 backdrop-blur-xl ${cartHeaderClasses}`}>
                    <div className="font-black text-xl sm:text-2xl flex items-center gap-3 tracking-tight">
                        <ShoppingBag size={26} className={iconColor} /> 
                        <span className="hidden xl:inline tracking-tighter">Commande</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {(!settings?.hidePosSurPlace || !settings?.hidePosAEmporter) && (
                            <button
                                onClick={() => setOrderType(prev => prev === 'sur_place' ? 'a_emporter' : 'sur_place')}
                                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 ${orderType === 'a_emporter' ? 'bg-pink-500 text-white border-pink-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                {orderType === 'a_emporter' ? '🛍️ À EMPORTER' : '🍽️ SUR PLACE'}
                            </button>
                        )}
                        {/* Bouton fermer sur Mobile */}
                        <button onClick={() => setIsMobileCartOpen(false)} className="md:hidden p-2.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors mr-1">
                            <X size={20}/>
                        </button>
                        {heldCarts.length > 0 && (
                            <button onClick={() => setShowHeldCarts(true)} className="p-2.5 bg-orange-50/80 text-orange-500 rounded-full hover:bg-orange-100 transition-colors relative" title="Commandes en attente">
                                <Clock size={20}/>
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black shadow-sm">{heldCarts.length}</span>
                            </button>
                        )}
                    {cart.length > 0 && (!hasAccess || hasAccess('pos_delete')) && <button onClick={clearCart} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={20}/></button>}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 no-scrollbar" style={{ zoom: cart.length > 6 ? Math.max(0.7, 1 - (cart.length - 6) * 0.05) : 1 }}>
                    <AnimatePresence>
                        {cart.length === 0 ? (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col items-center justify-center h-full mt-20 gap-4" style={{ color: isDark ? '#525252' : '#d1d5db' }}>
                                <ShoppingBag size={64} strokeWidth={1} className="opacity-20"/>
                                <p className="font-bold text-sm tracking-widest uppercase opacity-60">Panier vide</p>
                            </motion.div>
                        ) : (
                            cart.map((item, idx) => (
                                <motion.div key={`${item.id}-${idx}`} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }} onClick={() => setEditCartItem(item)} className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all duration-300 group ${cartItemBg}`}>
                                    <div className={`flex items-center justify-center rounded-xl px-3 py-2 shrink-0 border transition-colors ${cartQtyBg}`}>
                                        <span className={`font-black text-sm tracking-tight ${titleColor}`}>{item.qty}x</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold text-sm leading-tight truncate tracking-tight ${titleColor}`}>{item.name.split(' (Sans')[0]}</h4>
                                        {item.name.includes(' (Sans') && (
                                            <div className="flex flex-col gap-1 mt-1">
                                                {item.name.split(' (Sans ')[1].replace(')', '').split(', ').map((opt, oIdx) => (
                                                    <span key={oIdx} className="text-[10px] text-red-500 font-bold tracking-wide">- {formatSansIngredient(opt)}</span>
                                                ))}
                                            </div>
                                        )}
                                        {item.isCombo && item.comboChoices && item.comboChoices.map((c, cIdx) => (
                                            <div key={cIdx} className="text-[10px] text-gray-500 font-bold mt-1.5 pl-2.5 border-l-[3px] border-orange-400/60">
                                                🔹 {c.name}
                                                {c.removables?.length > 0 && <span className="text-red-500 ml-1">({c.removables.map(r => formatSansIngredient(r)).join(', ')})</span>}
                                                {c.selectedOption && <span className="text-blue-600 ml-1">({c.selectedOption})</span>}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="font-black text-base tracking-tighter shrink-0" style={{ color: brand?.posColor || brand?.color || '#0f172a' }}>
                                        {item.price * item.qty}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                {/* CONTROLES DU BAS (Plus compact pour petits ecrans) */}
                <div className={`p-5 sm:p-6 backdrop-blur-xl border-t shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.05)] shrink-0 z-20 overflow-y-auto max-h-[50dvh] ${cartTotalBg}`}>
                    <div className="flex justify-between items-end mb-4">
                        <span className={`font-bold uppercase tracking-widest text-xs ${isDark ? 'text-neutral-400' : 'text-gray-400'}`}>{brand?.texts?.posTotal || 'Total à payer'}</span>
                        <span className={`text-4xl sm:text-5xl font-black tracking-tighter leading-none ${titleColor}`}>{total} <span className={`text-xl sm:text-2xl tracking-tight font-bold ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>DH</span></span>
                    </div>

                    <div className="flex gap-3 mb-4">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => {
                            if (cart.length === 0) return;
                            setHeldCarts(prev => [...prev, { id: Date.now(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), cart: [...cart], orderType, total }]);
                            setCart([]);
                            showNotify("Commande mise en attente 🕒", "info");
                        }} disabled={cart.length === 0} className={`w-16 h-16 rounded-2xl font-black disabled:opacity-40 flex flex-col items-center justify-center gap-1 shadow-sm shrink-0 transition-colors ${cartQtyBg} border`} style={{ borderColor: isDark ? '#404040' : '#e5e7eb' }}>
                            <Clock size={22}/>
                        </motion.button>
                        
                        <div className="flex-1 flex gap-3">
                            <motion.button whileHover={cart.length > 0 ? { scale: 1.02 } : {}} whileTap={cart.length > 0 ? { scale: 0.98 } : {}} onClick={() => handleEncaissement(true)} disabled={cart.length === 0} className="flex-1 rounded-2xl font-black text-xl md:text-2xl text-white disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(34,197,94,0.5)] transition-all hover:opacity-90 bg-gradient-to-r from-green-500 to-green-600 py-4">
                                <Banknote size={26}/> PAYER
                            </motion.button>
                            <motion.button whileHover={cart.length > 0 ? { scale: 1.02 } : {}} whileTap={cart.length > 0 ? { scale: 0.98 } : {}} onClick={() => handleEncaissement(false)} disabled={cart.length === 0} className="flex-[0.8] rounded-2xl font-black text-lg md:text-xl text-white disabled:opacity-30 disabled:shadow-none flex items-center justify-center gap-2 shadow-[0_8px_20px_-8px_rgba(249,115,22,0.5)] transition-all hover:opacity-90 bg-gradient-to-r from-orange-400 to-orange-500 py-4">
                                NON PAYÉ
                            </motion.button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {!settings?.hidePosTiroir && (!hasAccess || hasAccess('pos_drawer')) && (
                            <button onClick={openDrawer} className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg flex flex-col items-center justify-center gap-1 font-bold text-[9px] transition-colors"><Unlock size={16} className="text-green-500"/><span>Tiroir</span></button>
                        )}
                        {!settings?.hidePosHistory && (!hasAccess || hasAccess('pos_history')) && (
                            <button onClick={() => setShowHistoryModal(true)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 rounded-lg flex flex-col items-center justify-center gap-1 font-bold text-[9px] transition-colors"><History size={16}/><span>Historique</span></button>
                        )}
                        {!settings?.hidePosReports && (!hasAccess || hasAccess('pos_reports')) && (
                            <button onClick={() => setShowXZModal(true)} className="flex-1 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 rounded-lg flex flex-col items-center justify-center gap-1 font-bold text-[9px] transition-colors"><ClipboardList size={16}/><span>Rapports</span></button>
                        )}
                        {(!hasAccess || hasAccess('achat_inventaire')) && (
                            <button onClick={() => setShowAchatsModal(true)} className="flex-1 py-2 bg-green-50 hover:bg-green-100 border border-green-100 text-green-700 rounded-lg flex flex-col items-center justify-center gap-1 font-bold text-[9px] transition-colors"><FileText size={16}/><span>Achats</span></button>
                        )}
                    </div>
                    {!settings?.hidePosBluetooth && (
                        <div className="flex gap-2 mt-2">
                            <button onClick={handleBluetoothConnect} disabled={isBtConnecting} className={`flex-1 py-2 border rounded-lg flex items-center justify-center gap-1.5 font-bold text-[9px] transition-colors ${btCharacteristic ? 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700' : (isBtConnecting ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700')}`}>
                                <Bluetooth size={14} className={`${btCharacteristic ? "text-green-500" : "text-blue-500"} ${isBtConnecting ? "animate-pulse" : ""}`}/>
                                <span>{isBtConnecting ? "Connexion en cours..." : (btCharacteristic ? "Imprimante BT Connectée" : "Connecter Imprimante BT")}</span>
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* MODAL EDIT CART ITEM (Qte / Supprimer) */}
            {editCartItem && (
                <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setEditCartItem(null)}>
                    <div className="bg-white rounded-[2rem] w-full max-w-sm flex flex-col overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h2 className="text-xl font-black text-gray-900 tracking-tight">{editCartItem.name.split(' (Sans')[0]}</h2>
                            <button onClick={() => setEditCartItem(null)} className="p-2.5 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6 flex flex-col items-center gap-5 bg-[#f8fafc]">
                            <div className="flex items-center gap-6 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                                <button onClick={() => updateCartItemQty(editCartItem, -1)} className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-3xl font-black text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors">-</button>
                                <span className="text-4xl font-black w-12 text-center text-gray-900 tracking-tighter">{editCartItem.qty}</span>
                                <button onClick={() => updateCartItemQty(editCartItem, 1)} className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-3xl font-black text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors">+</button>
                            </div>
                            {(() => {
                                const originalItem = menuItems.find(i => i.id === editCartItem.id);
                                const showBtn = originalItem && (
                                    originalItem.removableIngredients || 
                                    (originalItem.extras && originalItem.extras.length > 0) ||
                                    originalItem.hasVariations ||
                                    originalItem.choices
                                );
                                if (!showBtn) return null;
                                return (
                                    <button onClick={() => handleEditCartItemOptions(editCartItem)} className="w-full py-4 mt-2 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50/50 text-blue-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm">
                                        ⚙️ Modifier Options / Sans
                                    </button>
                                );
                            })()}
                            {(!hasAccess || hasAccess('pos_delete')) && (
                                <button onClick={() => { deleteFromCart(editCartItem.id, editCartItem.name); setEditCartItem(null); }} className="w-full py-4 mt-1 bg-red-50/50 border border-red-200 hover:bg-red-50 hover:border-red-300 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"><Trash2 size={20}/> Supprimer du panier</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedItemForOptions && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedItemForOptions(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100">
                            <h2 className="text-xl font-black text-gray-900 mb-1">{selectedItemForOptions.name}</h2>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Options du produit</p>

                            {/* 🔥 BOUTONS TOGGLES POUR SANS ET EXTRAS (POUR NE PAS DÉRANGER LE CAISSIER) */}
                            {((selectedItemForOptions.ingredients?.length > 0) || (selectedItemForOptions.extras?.length > 0)) && (
                                <div className="flex gap-2 mt-4">
                                    {selectedItemForOptions.ingredients?.length > 0 && (
                                        <button onClick={() => setShowPosSans(!showPosSans)} className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shadow-sm ${showPosSans ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}>
                                            Sans Ingrédients
                                        </button>
                                    )}
                                    {selectedItemForOptions.extras?.length > 0 && (
                                        <button onClick={() => setShowPosExtras(!showPosExtras)} className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shadow-sm ${showPosExtras ? 'bg-green-500 text-white border-green-600' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                                            Extras & Boissons
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto max-h-[60vh] bg-gray-50">

                        {selectedItemForOptions.isCombo && (
                            <div className="p-5 border-b border-gray-200 space-y-4">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Personnalisez votre Menu</p>
                                {selectedItemForOptions.comboItems?.map((cItem, idx) => (
                                    <div key={idx} className="p-4 border-2 border-gray-100 rounded-2xl bg-gray-50 shadow-sm">
                                        <h4 className="font-black text-gray-900 mb-3 text-sm flex items-center gap-2">🔹 {cItem.name}</h4>
                                        {cItem.type === 'sandwich' && (
                                            <div>
                                                <p className="text-[10px] text-gray-500 mb-2 font-bold uppercase">Ingrédients à retirer :</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Tomate', 'Oignon', 'Olive', 'Laitue', 'Carotte'].map(ing => {
                                                        const isRemoved = comboSelectionsForOptions[idx]?.removables?.includes(ing);
                                                        return (
                                                            <button key={ing} onClick={() => togglePosComboRemovable(idx, ing)} className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all ${isRemoved ? 'bg-red-50 text-red-600 border-red-300' : 'bg-white text-gray-600 border-gray-200 hover:border-red-200'}`}>
                                                                Sans {ing}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {cItem.type === 'drink' && (
                                            <div className="grid grid-cols-1 gap-2">
                                                {cItem.options?.map(opt => (
                                                    <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${comboSelectionsForOptions[idx]?.selectedOption === opt ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                                        <input type="radio" className="w-5 h-5 accent-blue-600" checked={comboSelectionsForOptions[idx]?.selectedOption === opt} onChange={() => setComboSelectionsForOptions(prev => ({...prev, [idx]: {...prev[idx], selectedOption: opt}}))} />
                                                        <span className="text-sm font-bold text-gray-800">{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedItemForOptions.hasVariations && selectedItemForOptions.variations?.length > 0 && (
                            <div className="p-5 border-b border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Taille / Variante <span className="text-red-500">*</span></p>
                                <div className="space-y-2">
                                    {selectedItemForOptions.variations.map((v, idx) => (
                                        <label key={idx} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedVariationForOptions?.name === v.name ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedVariationForOptions?.name === v.name ? 'border-blue-500' : 'border-gray-300'}`}>{selectedVariationForOptions?.name === v.name && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>}</div>
                                                <span className={`text-sm font-black uppercase leading-tight ${selectedVariationForOptions?.name === v.name ? 'text-blue-700' : 'text-gray-700'}`}>{v.name}</span>
                                            </div>
                                            <span className="font-black text-blue-600">{v.price} DH</span>
                                            <input type="radio" className="hidden" name="pos_variation" checked={selectedVariationForOptions?.name === v.name} onChange={() => setSelectedVariationForOptions(v)} />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedItemForOptions.choices?.length > 0 && (
                            <div className="p-5 border-b border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Choix (Obligatoire) <span className="text-red-500">*</span></p>
                                <div className={`${selectedItemForOptions.choices.some(c => c.includes('|')) ? 'grid grid-cols-2 gap-3' : 'space-y-2'}`}>
                                    {selectedItemForOptions.choices.map(c => {
                                        const parts = c.trim().split('|');
                                        const choiceName = parts[0].trim();
                                        const img = parts.length > 1 ? parts[1].trim() : null;
                                        return (
                                        <label key={choiceName} className={`flex ${img ? 'flex-col items-center text-center' : 'items-center gap-3'} p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedChoiceForOptions === choiceName ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                            {img && (
                                                <div className="w-16 h-16 mb-2 rounded-lg overflow-hidden flex items-center justify-center bg-transparent">
                                                    {img.startsWith('http') || img.startsWith('data:image') ? <img src={img} className="w-full h-full object-contain" alt={choiceName} /> : <span className="text-4xl">{img}</span>}
                                                </div>
                                            )}
                                            <div className={`flex items-center gap-3 ${img ? 'w-full justify-center' : ''}`}>
                                            <input 
                                                type="radio" 
                                                name="pos_choice"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0"
                                                checked={selectedChoiceForOptions === choiceName}
                                                onChange={() => setSelectedChoiceForOptions(choiceName)}
                                            />
                                            <span className={`text-sm font-black uppercase leading-tight ${selectedChoiceForOptions === choiceName ? 'text-blue-700' : 'text-gray-700'}`}>{choiceName}</span>
                                            </div>
                                        </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {showPosExtras && selectedItemForOptions.extras?.length > 0 && (
                            (() => {
                                const drinkNames = new Set(PREDEFINED_DRINKS.map(d => d.name));
                                const pureExtras = (selectedItemForOptions.extras || []).filter(e => !drinkNames.has(e.name));
                                const pureDrinks = (selectedItemForOptions.extras || []).filter(e => drinkNames.has(e.name));
                                
                                return (
                                    <>
                                        {pureExtras.length > 0 && (
                                            <div className="p-5 border-b border-gray-200">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">➕ Extras & Suppléments</p>
                                                <div className="space-y-2">
                                                    {pureExtras.map(ext => {
                                                        const isSelected = selectedItemForOptions.selectedExtras.some(e => e.name === ext.name);
                                                        return (
                                                            <label key={ext.name} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 bg-white hover:border-green-300'}`}>
                                                                <span className={`text-sm font-black uppercase ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>Avec {ext.name} <span className="text-green-600 ml-1">(+{ext.price} DH)</span></span>
                                                                <input type="checkbox" className="w-6 h-6 rounded-md border-gray-300 accent-green-600 focus:ring-green-500 cursor-pointer" checked={isSelected} onChange={() => toggleExtra(ext)} />
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {pureDrinks.length > 0 && (
                                            <div className="p-5 border-b border-gray-200">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">🥤 Boissons</p>
                                                <div className="space-y-2">
                                                    {pureDrinks.map(ext => {
                                                        const isSelected = selectedItemForOptions.selectedExtras.some(e => e.name === ext.name);
                                                        return (
                                                            <label key={ext.name} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                                                <span className={`text-sm font-black uppercase ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>{ext.name} <span className="text-blue-600 ml-1">(+{ext.price} DH)</span></span>
                                                                <input type="checkbox" className="w-6 h-6 rounded-md border-gray-300 accent-blue-600 focus:ring-blue-500 cursor-pointer" checked={isSelected} onChange={() => toggleExtra(ext)} />
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )
                            })()
                        )}

                        {showPosSans && selectedItemForOptions.ingredients?.length > 0 && (
                            <div className="p-5 space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Options Sans (Khtar chno t7eyed)</p>
                                {selectedItemForOptions.ingredients.map(opt => {
                                    const isSelected = selectedItemForOptions.selectedSans.includes(opt);
                                    return (
                                        <label key={opt} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-red-500 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:border-red-300'}`}>
                                            <span className={`text-sm font-black ${isSelected ? 'text-red-700' : 'text-gray-700'}`}>{formatSansIngredient(opt)}</span>
                                            <input type="checkbox" className="w-6 h-6 rounded-md border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer" checked={isSelected} onChange={() => toggleOption(opt)} />
                                        </label>
                                    )
                                })}
                            </div>
                        )}
                        </div>
                        
                        <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
                            <button onClick={() => setSelectedItemForOptions(null)} className="flex-1 py-4 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
                            <button onClick={confirmOptionsAndAdd} className="flex-[2] py-4 font-black text-white rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2" style={{backgroundColor: brand?.posColor || brand?.color || '#4f46e5'}}><CheckCircle size={20}/> {selectedItemForOptions.isEditingCartItemName ? "Valider la modification" : "Valider l'ajout"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REGLAGES D'AFFICHAGE SIMPLIFIÉ */}
            {showUISettings && (
                <div className="fixed inset-0 z-[5000] bg-black/40 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowUISettings(false)}>
                    <div className="bg-white rounded-[2rem] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2 tracking-tight"><Settings size={22}/> Configuration Caisse</h2>
                            <button onClick={() => setShowUISettings(false)} className="p-2.5 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600 transition-colors"><X size={20}/></button>
                        </div>
                        <div className="p-6 bg-[#f8fafc] space-y-6 overflow-y-auto flex-1 no-scrollbar">
                            
                            {/* 🔥 NOUVEAU: Khtiyar L-Livreur Manuel */}
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-sm mb-4">
                                <label className="flex justify-between text-xs font-black text-blue-800 mb-2">Livreur de cette Caisse (Manuel)</label>
                                <select
                                    className="w-full bg-white border border-blue-300 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                                    value={defaultPosDriver}
                                    onChange={(e) => {
                                        setDefaultPosDriver(e.target.value);
                                        localStorage.setItem('pos_default_driver', e.target.value);
                                        showNotify(e.target.value ? "Mode Manuel Activé 🛵" : "Mode Auto Activé 🤖", "success");
                                    }}
                                >
                                    <option value="">🤖 Automatique (Idara / Robot)</option>
                                    {(clientsList||[]).filter(c => c.isDriver).map(d => (
                                        <option key={d.id} value={d.uid || d.id}>🛵 {d.name || d.phone}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-blue-700 mt-2 font-bold leading-tight">Si sélectionné, toute commande Web acceptée ici sera envoyée DIRECTEMENT à ce livreur.</p>
                            </div>

                            <div className="flex gap-3 p-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <button onClick={() => setPrintCuisine(!printCuisine)} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border ${printCuisine ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-[0_2px_10px_-3px_rgba(249,115,22,0.2)]' : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-50'}`}>
                                    <ChefHat size={18}/> Cuisine {printCuisine ? 'ON' : 'OFF'}
                                </button>
                                <button onClick={() => setPrintAddition(!printAddition)} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border ${printAddition ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-[0_2px_10px_-3px_rgba(59,130,246,0.2)]' : 'bg-transparent text-gray-400 border-transparent hover:bg-gray-50'}`}>
                                    <Printer size={18}/> Ticket {printAddition ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Largeur Panier</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.cartWidth}px</span></label>
                                    <input type="range" min="150" max="800" step="5" value={posUI.cartWidth} onChange={e => setPosUI({...posUI, cartWidth: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Largeur Boutons</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.actionBtnWidth}px</span></label>
                                    <input type="range" min="80" max="250" step="5" value={posUI.actionBtnWidth} onChange={e => setPosUI({...posUI, actionBtnWidth: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Hauteur Boutons</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.actionBtnHeight}px</span></label>
                                    <input type="range" min="30" max="80" step="2" value={posUI.actionBtnHeight} onChange={e => setPosUI({...posUI, actionBtnHeight: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Largeur Produits</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.cardWidth}px</span></label>
                                    <input type="range" min="100" max="400" step="5" value={posUI.cardWidth} onChange={e => setPosUI({...posUI, cardWidth: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Hauteur Produits</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.cardHeight}px</span></label>
                                    <input type="range" min="100" max="500" step="5" value={posUI.cardHeight} onChange={e => setPosUI({...posUI, cardHeight: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest"><span>Taille Texte</span><span className="text-gray-900 bg-gray-100 px-1.5 rounded">{posUI.fontSize}px</span></label>
                                    <input type="range" min="10" max="24" step="1" value={posUI.fontSize} onChange={e => setPosUI({...posUI, fontSize: Number(e.target.value)})} className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={() => setPosUI(defaultPosUI)} className="flex-1 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-sm">Réinitialiser par défaut</button>
                                {isAdmin && headerBtnsOrder.length > 0 && (
                                    <button onClick={handleResetPositions} className="flex-1 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-sm">↺ Réinitialiser l'ordre des boutons</button>
                                )}
                            </div>
                                
                                {isAdmin && (
                                    <div className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mt-4">
                                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Activer / Désactiver les boutons (Admin)</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <label className="flex items-center justify-between p-3.5 bg-[#f8fafc] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                                <span className="text-xs font-bold text-gray-700">Bouton "Sur Place"</span>
                                                <input type="checkbox" checked={!settings?.hidePosSurPlace} onChange={(e) => saveSettings({...settings, hidePosSurPlace: !e.target.checked})} className="w-5 h-5 accent-gray-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between p-3.5 bg-[#f8fafc] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                                <span className="text-xs font-bold text-gray-700">Bouton "À Emporter"</span>
                                                <input type="checkbox" checked={!settings?.hidePosAEmporter} onChange={(e) => saveSettings({...settings, hidePosAEmporter: !e.target.checked})} className="w-5 h-5 accent-gray-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between p-3.5 bg-[#f8fafc] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                                <span className="text-xs font-bold text-gray-700">Connecter Imprimante BT</span>
                                                <input type="checkbox" checked={!settings?.hidePosBluetooth} onChange={(e) => saveSettings({...settings, hidePosBluetooth: !e.target.checked})} className="w-5 h-5 accent-gray-900 cursor-pointer" />
                                            </label>
                                            <label className="flex items-center justify-between p-3.5 bg-[#f8fafc] rounded-xl cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                                                <span className="text-xs font-bold text-gray-700">Tiroir / Historique / Rapports</span>
                                                <input type="checkbox" checked={!settings?.hidePosTiroir} onChange={(e) => saveSettings({...settings, hidePosTiroir: !e.target.checked, hidePosHistory: !e.target.checked, hidePosReports: !e.target.checked})} className="w-5 h-5 accent-gray-900 cursor-pointer" />
                                            </label>
                                        </div>
                                    </div>
                                )}
                        </div>
                        <div className="p-6 bg-white border-t border-gray-100 shrink-0">
                            <button onClick={() => setShowUISettings(false)} className="w-full py-4 bg-gray-900 hover:bg-black text-white font-black rounded-xl text-sm transition-all shadow-[0_8px_16px_-6px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 uppercase tracking-widest">Valider et Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TICKETS NON PAYÉS */}
            {showUnpaidModal && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUnpaidModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
                            <h2 className="text-lg font-black text-red-800 flex items-center gap-2"><Banknote size={20}/> Tickets Non Payés</h2>
                            <button onClick={() => setShowUnpaidModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                            {unpaidOrders.length === 0 ? (
                                <div className="text-center text-gray-400 py-6 font-bold">Aucun ticket en attente de paiement.</div>
                            ) : (
                                unpaidOrders.map(o => (
                                    <div key={o.id} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-black text-gray-900 text-xl">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                                <p className="text-[10px] font-bold text-gray-500 mt-0.5">{o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toLocaleTimeString() : ''}</p>
                                            </div>
                                            <span className="font-black text-red-600 text-xl">{o.total} DH</span>
                                        </div>
                                        <div className="text-xs font-bold text-gray-600 bg-gray-50 p-2 rounded-xl border border-gray-100 mt-1">
                                            {(o.items||[]).map((i, idx) => (
                                                <div key={idx}>{i.qty}x {(i.name || '').split(' (Sans')[0]}</div>
                                            ))}
                                            </div>
                                        <button onClick={() => handlePayUnpaidTicket(o)} className="mt-2 w-full bg-green-500 text-white py-3 rounded-xl font-black text-sm hover:bg-green-600 transition-colors shadow-md flex items-center justify-center gap-2">
                                            <Banknote size={18}/> Payer le tichet
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL COMMANDES EN ATTENTE */}
            {showHeldCarts && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHeldCarts(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><Clock size={20} className="text-orange-500"/> En attente</h2>
                            <button onClick={() => setShowHeldCarts(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                            {heldCarts.length === 0 ? (
                                <div className="text-center text-gray-400 py-6 font-bold">Aucune commande en attente.</div>
                            ) : (
                                heldCarts.map(held => (
                                    <div key={held.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-gray-800 text-sm">Panier {held.time}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-xs text-gray-500 font-bold">{held.cart.reduce((s,i)=>s+i.qty,0)} articles</p>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md text-white`} style={{ backgroundColor: held.orderType === 'sur_place' ? (brand?.btnPosSurPlaceColor || '#3b82f6') : (brand?.btnPosAEmporterColor || '#ec4899') }}>
                                                    {held.orderType === 'sur_place' ? (brand?.texts?.posBtnSurPlace || '🍽️ SUR PLACE (PLATEAUX)') : (brand?.texts?.posBtnAEmporter || '🛍️ À EMPORTER (EMBALLAGE)')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-blue-600">{held.total} DH</span>
                                            <button onClick={() => { 
                                                if (cart.length > 0) {
                                                    setConfirmDialog({
                                                        message: "Le panier actuel n'est pas vide. L'écraser ?",
                                                        onConfirm: () => {
                                                            setCart(held.cart); setOrderType(held.orderType); setHeldCarts(prev => prev.filter(c => c.id !== held.id)); setShowHeldCarts(false);
                                                        }
                                                    });
                                                } else {
                                                    setCart(held.cart); 
                                                    setOrderType(held.orderType); 
                                                    setHeldCarts(prev => prev.filter(c => c.id !== held.id)); 
                                                    setShowHeldCarts(false);
                                                }
                                            }} className="bg-orange-100 text-orange-700 px-3 py-2 rounded-lg font-black text-xs hover:bg-orange-200 transition-colors shadow-sm">Reprendre</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PROBLÈMES DE LIVRAISON */}
            {showProblemModal && problemOrders.length > 0 && (
                <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowProblemModal(false)}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl flex flex-col overflow-hidden shadow-[0_0_80px_rgba(220,38,38,0.4)] border-4 border-red-500 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
                            <h2 className="text-xl font-black text-red-800 flex items-center gap-2 animate-pulse">
                                <AlertTriangle size={24} className="animate-bounce text-red-600"/> PROBLÈMES COMMANDES ({problemOrders.length})
                            </h2>
                            <button onClick={() => setShowProblemModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                            {problemOrders.map(o => (
                                <div key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-red-200 flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-gray-900 text-lg">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                            <span className="text-sm font-bold text-gray-500">{o.customerName || o.name || o.phone}</span>
                                        </div>
                                        <span className="font-black text-red-600 text-lg">{o.total || '???'} DH</span>
                                    </div>
                                    <p className="text-sm text-red-600 font-bold bg-red-100/50 w-fit px-3 py-1 rounded-lg">
                                        🚨 {o.adminMessage ? o.adminMessage : 
                                           o.clientUnreachable ? "Client Injoignable" : 
                                           (o.driverId && !o.driverAccepted) ? (o.isManualAssignment ? "Livreur n'a pas accepté la commande" : "Livreur n'a pas accepté (> 45s)") : 
                                           "Aucun livreur disponible !"}
                                    </p>
                                    {o.phone && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <a href={`tel:${o.phone}`} className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-gray-200">
                                                📞 Appeler {o.phone}
                                            </a>
                                            <button onClick={() => openWhatsAppDirect(o.phone, `Salam, bkhoussous l-commande dyalak #${o.orderNumber || o.id.slice(-4).toUpperCase()}...`)} className="flex-1 sm:flex-none bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-green-200">
                                                💬 WhatsApp
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {((o.driverId && !o.driverAccepted) || (!o.driverId && ['preparing', 'ready'].includes(o.status))) && (
                                            <button onClick={() => {
                                                handleReassignOrder(o, null, true, true);
                                                showNotify("Recherche d'un autre livreur lancée", "info");
                                            }} className="w-full px-5 py-3 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all border border-orange-200">
                                                🔄 Chercher un autre livreur (Robot)
                                            </button>
                                        )}
                                        <button onClick={() => {
                                            updateStatus(o.id, o.status, {clientUnreachable: false, adminMessage: null});
                                            showNotify("Commande marquée comme résolue ✅", "success");
                                        }} className="flex-1 px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all">
                                            ✅ Résolu (Retour Normal)
                                        </button>
                                        <button onClick={() => {
                                            setConfirmDialog({
                                                message: "Annuler définitivement cette commande ?",
                                                onConfirm: () => {
                                                    updateStatus(o.id, 'rejected', {reason: o.adminMessage || 'Problème de livraison', driverPaid: true, deliveredAtLocal: Date.now(), clientUnreachable: false, adminMessage: null});
                                                    showNotify("Commande annulée ❌", "info");
                                                }
                                            });
                                        }} className="flex-1 px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-sm active:scale-95 transition-all">
                                            ❌ Annuler
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL COMMANDES PRÊTES (À SERVIR) */}
            {showReadyPosModal && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowReadyPosModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-green-50">
                            <h2 className="text-lg font-black text-green-800 flex items-center gap-2"><CheckCircle size={20}/> Commandes Prêtes (TV)</h2>
                            <div className="flex items-center gap-2">
                                {readyPosOrders.length > 1 && (
                                <button onClick={() => setShowConfirmToutDonner(true)} className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all">
                                        Tout donner
                                    </button>
                                )}
                                <button onClick={() => setShowReadyPosModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                            {readyPosOrders.length === 0 ? (
                                <div className="text-center text-gray-400 py-6 font-bold">Aucune commande prête à servir.</div>
                            ) : (
                                readyPosOrders.map(o => (
                                    <div key={o.id} className="bg-white p-4 rounded-2xl border border-green-200 shadow-sm flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-gray-900 text-2xl">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                            <p className={`text-[10px] font-black uppercase mt-1 px-2 py-1 rounded-md w-fit text-white`} style={{ backgroundColor: o.orderType === 'sur_place' ? (brand?.btnPosSurPlaceColor || '#3b82f6') : (brand?.btnPosAEmporterColor || '#ec4899') }}>
                                                {o.orderType === 'sur_place' ? (brand?.texts?.posBtnSurPlace || '🍽️ SUR PLACE (PLATEAUX)') : (brand?.texts?.posBtnAEmporter || '🛍️ À EMPORTER (EMBALLAGE)')}
                                            </p>
                                        </div>
                                        <button onClick={() => { updateStatus(o.id, 'delivered', { deliveredAtLocal: Date.now() }); showNotify("Remis au client ! ✅", "success"); if (readyPosOrders.length === 1) setShowReadyPosModal(false); }} className="bg-green-500 text-white px-5 py-3 rounded-xl font-black text-sm hover:bg-green-600 transition-colors shadow-md">Remis au client</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

        {/* MODAL CUSTOM CONFIRMATION TOUT DONNER */}
        {showConfirmToutDonner && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32}/></div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">Tout donner ?</h3>
                        <p className="text-gray-500 font-bold mb-6 text-sm">Wach m2ked bghiti t3ti ga3 l-commandes ({readyPosOrders.length}) l-malihom ?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirmToutDonner(false)} className="flex-1 py-3 font-black text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
                            <button onClick={() => {
                                readyPosOrders.forEach(o => {
                                    updateStatus(o.id, 'delivered', { deliveredAtLocal: Date.now() });
                                });
                                showNotify("Ga3 l-commandes t3taw! ✅", "success");
                                setShowReadyPosModal(false);
                                setShowConfirmToutDonner(false);
                            }} className="flex-[2] py-3 font-black text-white bg-green-500 rounded-xl shadow-md active:scale-95 transition-all hover:bg-green-600">Oui, Tout donner</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL COMMANDES PRÊTES GLOVO */}
            {showGlovoModal && (
                <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowGlovoModal(false)}>
                    <div className="bg-gray-50 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black flex items-center gap-2" style={{color: brand.color || '#FFC244'}}>
                                <Bike size={24} />
                                Prêtes (Glovo)
                            </h2>
                            <button onClick={() => setShowGlovoModal(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 text-gray-700"><X size={20}/></button>
                        </div>
                        
                        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto no-scrollbar pr-2 pb-2">
                            {readyGlovoOrders.length === 0 ? (
                                <div className="text-center text-gray-400 py-6 font-bold flex flex-col items-center gap-4">
                                    <span>Aucune commande Glovo prête.</span>
                                </div>
                            ) : (
                                readyGlovoOrders.map(o => (
                                    <div key={o.id} className="bg-white p-4 rounded-2xl border-2 border-[#FFC244]/30 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-xl text-yellow-600 uppercase">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</span>
                                                    {(o.paymentMethod?.toLowerCase() === 'espece' || o.paymentMethod?.toLowerCase() === 'cash') ? (
                                                        <span className="text-[10px] text-green-700 bg-green-100 px-2 py-1 rounded-md border border-green-300 font-black animate-pulse">ESPECE 💵 À ENCAISSER: {o.total || '???'} DH</span>
                                                    ) : (
                                                        <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-1 rounded-md border border-blue-300 font-black">EN LIGNE 💳 (DÉJÀ PAYÉ)</span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold text-gray-500 mt-1">{o.items?.length || 0} article(s)</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-lg text-gray-900">{o.total || '???'} DH</span>
                                            </div>
                                        </div>
                                        {(o.paymentMethod?.toLowerCase() === 'espece' || o.paymentMethod?.toLowerCase() === 'cash') ? (
                                            <div className="bg-green-100 border-2 border-green-400 text-green-800 p-3 rounded-lg text-center font-black animate-pulse shadow-sm flex flex-col">
                                                <span className="text-xs uppercase opacity-80 mb-1">TOTAL À PAYER (CE QUE LE LIVREUR DOIT DONNER)</span>
                                                <span className="text-2xl">{o.total || '???'} DH</span>
                                            </div>
                                        ) : (
                                            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-2 rounded-lg text-center font-bold shadow-sm">
                                                <span className="text-xs uppercase opacity-80">Commande En Ligne (Déjà Payée)</span>
                                            </div>
                                        )}
                                        {o.pickupCode && (
                                            <div className="bg-purple-100 border-2 border-purple-400 text-purple-800 p-3 rounded-lg text-center font-black shadow-sm flex flex-col mt-1">
                                                <span className="text-xs uppercase opacity-80 mb-1">CODE DE RETRAIT (PIN)</span>
                                                <span className="text-4xl tracking-widest uppercase">{o.pickupCode}</span>
                                            </div>
                                        )}
                                        <button onClick={() => { 
                                            updateStatus(o.id, 'delivered', { deliveredAtLocal: Date.now() }); 
                                            printTicket(o, brand);
                                            showNotify("Remis au Livreur Glovo !", "success"); 
                                            if (readyGlovoOrders.length === 1) setShowGlovoModal(false); 
                                        }} className="bg-[#FFC244] hover:bg-yellow-500 text-black px-5 py-3 rounded-xl font-black text-sm transition-colors shadow-md flex items-center justify-center gap-2"><CheckCircle size={18}/> Remis au Livreur</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL HISTORIQUE */}
            {showHistoryModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowHistoryModal(false)}>
                    <div className="bg-white rounded-3xl w-full max-w-md max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="bg-blue-600 text-white p-4 flex justify-between items-center"><h2 className="text-lg sm:text-xl font-bold flex items-center gap-2"><History size={20}/> Historique (Aujourd'hui)</h2><button onClick={() => setShowHistoryModal(false)} className="hover:bg-blue-700 p-1 rounded-full"><X size={24}/></button></div>
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
                            {completedOrdersToday.filter(o => o.source === 'pos').length === 0 ? ( <p className="text-center text-gray-500 py-10 font-medium">Aucun ticket aujourd'hui.</p> ) : (
                                completedOrdersToday.filter(o => o.source === 'pos').sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).map(sale => (
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
                                <p className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Recette Globale du jour</p>
                                <h3 className="text-3xl font-black text-purple-600">{isAdmin ? `${dailyCA} MAD` : '*** MAD'}</h3>
                                <p className="text-xs text-gray-400 mt-1 font-medium mb-3">{completedOrdersToday.length} commandes au total</p>
                                
                                <div className="grid grid-cols-5 gap-1 border-t border-gray-100 pt-3">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Sur Place</span>
                                        <span className="text-xs font-black text-indigo-600">{isAdmin ? `${caPos} DH` : '***'}</span>
                                    </div>
                                    <div className="flex flex-col items-center border-l border-gray-100">
                                        <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Glovo<br/>Espèce</span>
                                        <span className="text-xs font-black text-green-600">{caGlovoEspece} DH</span>
                                    </div>
                                    <div className="flex flex-col items-center border-l border-gray-100">
                                        <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Glovo<br/>En Ligne</span>
                                        <span className="text-xs font-black text-green-600">{caGlovoEnLigne} DH</span>
                                    </div>
                                    <div className="flex flex-col items-center border-l border-gray-100">
                                        <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Web App</span>
                                        <span className="text-xs font-black text-blue-600">{isAdmin ? `${caApp} DH` : '***'}</span>
                                    </div>
                                    <div className="flex flex-col items-center border-l border-gray-100">
                                        <span className="text-[8px] text-gray-400 uppercase font-bold text-center">Téléphone</span>
                                        <span className="text-xs font-black text-orange-600">{isAdmin ? `${caTel} DH` : '***'}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 border-t border-gray-100 mt-2 pt-2">
                                    <div className="flex flex-col items-center bg-red-50 p-2 rounded-xl">
                                        <span className="text-[10px] text-red-500 uppercase font-bold">Achats (Dépenses)</span>
                                        <span className="text-sm font-black text-red-600">{isAdmin ? `-${totalAchats} DH` : '***'}</span>
                                    </div>
                                    <div className="flex flex-col items-center bg-green-50 p-2 rounded-xl">
                                        <span className="text-[10px] text-green-600 uppercase font-bold text-center leading-tight">Net (Espèce + Glovo Esp - Achats)</span>
                                        <span className="text-sm font-black text-green-700">{isAdmin ? `${(caPos + caGlovoEspece) - totalAchats} DH` : '***'}</span>
                                    </div>
                                </div>
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

            {/* MODAL ACHATS DEPUIS LA CAISSE */}
            {showAchatsModal && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex flex-col animate-in fade-in">
                    <div className="bg-white p-4 flex justify-between items-center border-b border-gray-100 shadow-sm z-[201]">
                        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2"><FileText size={24} className="text-blue-500"/> Achats & Dépenses (Caisse)</h2>
                        <button onClick={() => setShowAchatsModal(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-50 relative z-[200]">
                        <AchatInventaire db={db} appId={appId} profile={{ id: 'pos', managerBranchId: activeBranchId }} brand={brand} showNotify={showNotify} />
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMATION GLOBALE */}
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
            
            {/* MODAL NOUVELLE COMMANDE WEB */}
            {showPendingModal && pendingOnline.length > 0 && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setShowPendingModal(false)}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg flex flex-col overflow-hidden shadow-[0_0_80px_rgba(220,38,38,0.4)] border-4 border-red-500 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
                            <h2 className="text-lg font-black text-red-800 flex items-center gap-2 animate-pulse">
                                <BellRing size={24} className="animate-bounce"/> Nouvelles Commandes Web ({pendingOnline.length})
                            </h2>
                            <div className="flex gap-2">
                                <button onClick={() => {
                                    if (setTab) setTab('active');
                                    else window.location.href = '/idara';
                                }} className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                                    Ouvrir Idara
                                </button>
                                <button onClick={() => setShowPendingModal(false)} className="p-1.5 bg-white rounded-full hover:bg-gray-100 text-gray-500">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[60dvh] bg-gray-50 space-y-3">
                            {pendingOnline.map(o => (
                                <div key={o.id} className="bg-white p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-black text-gray-900 text-xl">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                            <p className="text-xs font-bold text-gray-500">{o.customerName || o.name || o.phone}</p>
                                        </div>
                                        <span className="font-black text-red-600 text-lg">{o.total} DH</span>
                                    </div>
                                    <div className="text-sm font-bold text-gray-700 bg-gray-50 p-2 rounded-xl">
                                        {(o.items||[]).map((i, idx) => (
                                            <div key={idx}>{i.qty}x {(i.name || '').split(' (Sans')[0]}</div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={() => {
                                            updateStatus(o.id, 'preparing', getDriverAssignmentData());
                                            printTicket(o, brand);
                                            showNotify(defaultPosDriver ? "Commande acceptée w mchat l-livreur! 🛵" : "Commande acceptée w mchat l'KDS! ✅", "success");
                                        }} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-black text-sm hover:bg-green-600 transition-colors shadow-md flex items-center justify-center gap-2">
                                            <CheckCircle size={18}/> Accepter & Imprimer
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {pendingOnline.length > 1 && (
                            <div className="p-4 bg-white border-t border-gray-100">
                                <button onClick={() => {
                                    pendingOnline.forEach(o => {
                                        updateStatus(o.id, 'preparing', getDriverAssignmentData());
                                        printTicket(o, brand);
                                    });
                                    showNotify(defaultPosDriver ? "Ga3 l-commandes mchaw l-livreur! 🛵" : "Ga3 l-commandes t'acceptaw! ✅", "success");
                                }} className="w-full bg-red-600 text-white py-4 rounded-xl font-black text-sm hover:bg-red-700 transition-colors shadow-md uppercase flex items-center justify-center gap-2">
                                    <CheckCircle size={20}/> Tout Accepter & Imprimer
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL STANDARD TÉL */}
            {showStandardModal && (
                <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowStandardModal(false); setShowTelNumpad(false); }}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                            <h2 className="text-lg font-black text-orange-800 flex items-center gap-2">
                                📞 Commande Téléphone
                            </h2>
                            <button onClick={() => { setShowStandardModal(false); setShowTelNumpad(false); }} className="p-2 bg-white rounded-full hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 bg-gray-50 flex flex-col gap-4">

                        {/* Input Number - SHARED */}
                        <label className="block text-left">
                            <span className="text-xs font-bold text-gray-700 mb-1.5 block">
                                Numéro de Téléphone Client <span className="text-red-500">*</span>
                            </span>
                            <input
                                type="tel"
                                readOnly
                                onClick={() => setShowTelNumpad(true)}
                                placeholder="06XXXXXXXX ou 07XXXXXXXX"
                                className="w-full bg-white border border-gray-300 p-4 rounded-2xl text-3xl tracking-widest text-center font-bold text-gray-900 outline-none focus:ring-4 focus:border-blue-500 focus:ring-blue-500/20 transition-all shadow-sm cursor-pointer"
                                value={telInfo.phone}
                                onChange={(e) => setTelInfo({ ...telInfo, phone: e.target.value.replace(/[^\d]/g, "").slice(0, 10) })}
                            />
                        </label>

                        {/* Numpad Tactile - SHARED (Style iPhone) */}
                        {showTelNumpad && (
                            <div className="grid grid-cols-3 gap-y-4 gap-x-8 w-fit mx-auto my-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setTelInfo(prev => ({ ...prev, phone: (prev.phone + num).slice(0, 10) }))}
                                        className="w-20 h-20 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-full font-light text-4xl text-gray-800 flex items-center justify-center transition-all shadow-md border border-gray-100"
                                    >
                                        {num}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setTelInfo(prev => ({ ...prev, phone: prev.phone.slice(0, -1) }))}
                                    className="w-20 h-20 bg-red-50 hover:bg-red-100 text-red-500 rounded-full font-light text-3xl flex items-center justify-center transition-all shadow-sm border border-red-100"
                                >
                                    <Delete size={32} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTelInfo(prev => ({ ...prev, phone: (prev.phone + '0').slice(0, 10) }))}
                                    className="w-20 h-20 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-full font-light text-4xl text-gray-800 flex items-center justify-center transition-all shadow-md border border-gray-100"
                                >
                                    0
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTelInfo(prev => ({ ...prev, phone: '' }))}
                                    className="w-20 h-20 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-bold text-xs uppercase flex items-center justify-center transition-all shadow-sm"
                                >
                                    Effacer
                                </button>
                            </div>
                        )}

                        <label className="block text-left mt-2">
                            <span className="text-xs font-bold text-gray-700 mb-1.5 block">Frais de Livraison (DH)</span>
                            <div className="flex gap-2">
                                {[0, 5, 10, 15, 20].map(fee => (
                                    <button
                                        key={fee}
                                        onClick={() => setTelInfo({ ...telInfo, deliveryFee: fee })}
                                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${Number(telInfo.deliveryFee) === fee ? "bg-orange-500 text-white border-orange-600 shadow-md scale-105" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                    >
                                        {fee}
                                    </button>
                                ))}
                            </div>
                        </label>

                        <div className="mt-4 flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <span className="text-sm font-bold text-gray-600 uppercase tracking-widest">Total commande</span>
                            <span className="text-2xl font-black text-gray-900">
                                {total + Number(telInfo.deliveryFee || 0)} <span className="text-sm">DH</span>
                            </span>
                        </div>

                        <button
                            onClick={handleSendWhatsappFromPOS}
                            className="w-full mt-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            Créer Commande Tél & WhatsApp
                        </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SUIVI WEB / TEL */}
            {showOnlineOrdersModal && (
                <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowOnlineOrdersModal(false)}>
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-purple-50">
                            <div>
                                <h2 className="text-lg font-black text-purple-800 flex items-center gap-2">
                                    <ShoppingBag size={20}/> Commandes Web & Téléphone ({onlineOrders.length})
                                </h2>
                                <p className="text-xs font-bold text-purple-600 mt-1 flex items-center gap-1">
                                    <Truck size={14}/> {validOnlineDrivers.filter(d => d.isOnline).length} livreur(s) en ligne ({validOnlineDrivers.filter(d => d.isOnline && d.isAvailable).length} dispo)
                                </p>
                            </div>
                            <button onClick={() => setShowOnlineOrdersModal(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto bg-gray-50 space-y-3">
                            {onlineOrders.length === 0 ? (
                                <div className="text-center text-gray-400 py-6 font-bold">Aucune commande web ou téléphone en cours.</div>
                            ) : (
                                onlineOrders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(o => (
                                    <div key={o.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-black text-gray-900 text-lg">#{o.orderNumber || o.id.slice(-4).toUpperCase()}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${o.source === 'telephone' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {o.source === 'telephone' ? '📞 Téléphone' : '📱 App Web'}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-500">{o.customerName || o.name || o.phone}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5">
                                                <span className="font-black text-purple-600 text-lg">{o.total} DH</span>
                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md text-white ${o.status === 'pending' ? 'bg-red-500 animate-pulse' : o.status === 'preparing' ? 'bg-orange-500' : o.status === 'ready' ? 'bg-green-500' : 'bg-blue-500'}`}>
                                                    {o.status === 'pending' ? 'En attente' : o.status === 'preparing' ? 'En Cuisine' : o.status === 'ready' ? 'Prête (Attente Livreur)' : 'En Route'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            {(o.items||[]).map((i, idx) => (
                                                <div key={idx}>{i.qty}x {(i.name || '').split(' (Sans')[0]}</div>
                                            ))}
                                            {o.orderNote && <div className="mt-2 pt-2 border-t border-gray-200 text-[10px] text-red-500">📝 Note: {o.orderNote}</div>}
                                        </div>
                                        
                                        {/* GESTION CAISSIER: LIVRAISON & STATUTS */}
                                        <div className="mt-1 flex flex-col gap-2 border-t border-gray-100 pt-3">
                                            {/* Affichage du Livreur */}
                                            <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                                                <div className="flex items-center gap-2">
                                                    <Truck size={16} className={o.driverId ? "text-green-500" : "text-gray-400"} />
                                                    <span className="text-xs font-bold text-gray-700">
                                                        Livreur: {o.driverId ? (o.driverName || 'Assigné') : 'Non assigné'}
                                                        {o.driverId && !o.driverAccepted && <span className="text-[10px] text-orange-500 ml-1">(En attente...)</span>}
                                                    </span>
                                                </div>
                                                
                                                {/* Dropdown d'assignation manuelle */}
                                                {o.status !== 'pending' && o.status !== 'delivered' && (
                                                    <select
                                                        className="bg-white border border-gray-300 text-xs font-bold text-gray-700 py-1.5 px-2 rounded-md outline-none max-w-[140px] truncate"
                                                        value={o.driverId || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === 'ROBOT') {
                                                                handleReassignOrder(o, null, true, true);
                                                                showNotify("Recherche automatique lancée", "info");
                                                            } else if (val) {
                                                                // 🔥 Correction: val khas ydoz f l-paramètre l-khamess (manualTargetDriverId)
                                                                handleReassignOrder(o, null, false, false, val);
                                                            }
                                                        }}
                                                    >
                                                        <option value="" disabled>Assigner...</option>
                                                        <option value="ROBOT">🤖 Auto (Robot)</option>
                                                        {(validOnlineDrivers || []).filter(d => d.isOnline).map(d => (
                                                            <option key={d.uid} value={d.uid}>
                                                                🛵 {d.name || d.phone} {d.isAvailable ? '✅' : '⏳'}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>

                                            {/* Boutons d'actions selon le statut */}
                                            <div className="flex gap-2">
                                                {o.status === 'pending' && (
                                                    <button onClick={() => {
                                                        updateStatus(o.id, 'preparing', getDriverAssignmentData());
                                                        printTicket(o, brand);
                                                        showNotify("Commande acceptée w mchat l'KDS! ✅", "success");
                                                    }} className="flex-1 bg-green-500 text-white py-2.5 rounded-xl font-black text-xs hover:bg-green-600 transition-colors shadow-sm flex items-center justify-center gap-2">
                                                        <CheckCircle size={16}/> Accepter & Imprimer
                                                    </button>
                                                )}
                                                
                                                {o.status === 'preparing' && (
                                                    <button onClick={() => {
                                                        updateStatus(o.id, 'ready');
                                                        showNotify("Commande marquée prête! ✅", "success");
                                                    }} className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-black text-xs hover:bg-orange-600 transition-colors shadow-sm flex items-center justify-center gap-2">
                                                        <ChefHat size={16}/> 
                                                        {o.source === 'glovo' && (o.paymentMethod?.toLowerCase() === 'espece' || o.paymentMethod?.toLowerCase() === 'cash') ? 'Prête (💶 À ENCAISSER CASH)' : 'Marquer Prête'}
                                                    </button>
                                                )}

                                                <button onClick={() => {
                                                    setConfirmDialog({
                                                        message: "Annuler cette commande ?",
                                                        onConfirm: () => updateStatus(o.id, 'rejected', {reason: 'Annulée par la caisse', driverPaid: false})
                                                    });
                                                }} className="px-3 bg-red-100 text-red-600 rounded-xl font-black hover:bg-red-200 transition-colors flex items-center justify-center">
                                                    <X size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
