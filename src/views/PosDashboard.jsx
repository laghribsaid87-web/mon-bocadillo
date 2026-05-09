import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Coffee, Banknote, ArrowLeft, ShoppingBasket, ShoppingBag, Unlock, History, ClipboardList, X, Printer, Power, BellRing, CheckCircle, MapPin, ChefHat, Clock, Monitor, AlertTriangle, Delete } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateOrderNumber, printTicket, formatSansIngredient, buildMessage, openWhatsAppDirect } from '../utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { PREDEFINED_DRINKS, DEFAULT_BRAND } from '../config/constants';

export default function PosDashboard({ settings, brand, db, appId, showNotify, managerBranchId, isAdmin, orders = [], updateStatus, handleReassignOrder, onQuit, setTab, saveSettings, hasAccess }) {
    const [cart, setCart] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');

    const [orderType, setOrderType] = useState('sur_place'); // 'sur_place' wla 'a_emporter'
    const [editCartItem, setEditCartItem] = useState(null); // Jdid: Modal modifier l-quantité
    const [selectedItemForOptions, setSelectedItemForOptions] = useState(null); // Jdid: Modal dyal les options
    const [selectedChoiceForOptions, setSelectedChoiceForOptions] = useState(null);
    const [heldCarts, setHeldCarts] = useState([]); // Jdid: Commandes en attente
    const [showHeldCarts, setShowHeldCarts] = useState(false);
    const [showReadyPosModal, setShowReadyPosModal] = useState(false); // Jdid: Modal Commandes Prêtes
    const [showConfirmToutDonner, setShowConfirmToutDonner] = useState(false); // Jdid: Modal Custom Confirmation
    const [confirmDialog, setConfirmDialog] = useState(null);

    const [showStandardModal, setShowStandardModal] = useState(false);
    const [showTelNumpad, setShowTelNumpad] = useState(false);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [showOnlineOrdersModal, setShowOnlineOrdersModal] = useState(false);
    const [telInfo, setTelInfo] = useState({ phone: '', deliveryFee: 0 });
    
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showXZModal, setShowXZModal] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState(managerBranchId || '');
    const prevPendingCount = useRef(0);

    // 🔥 States & Refs pour le glissement (Drag & Drop)
    const dragCatRef = useRef(null);
    const dropCatRef = useRef(null);
    const dragItemRef = useRef(null);
    const dropItemRef = useRef(null);
    
    const defaultHeaderButtons = ['commandes_web', 'problemes', 'suivi', 'pretes', 'tv', 'standard', 'kds', 'quitter'];
    
    // 🔥 Ordre des boutons (Drag & Drop Flex)
    const [headerBtnsOrder, setHeaderBtnsOrder] = useState(settings?.headerBtnsOrder || []);
    const dragBtnRef = useRef(null);
    const dropBtnRef = useRef(null);

    useEffect(() => {
        if (settings?.headerBtnsOrder) {
            setHeaderBtnsOrder(settings.headerBtnsOrder);
        }
    }, [settings?.headerBtnsOrder]);

    const handleResetPositions = () => {
        setHeaderBtnsOrder([]);
        if (saveSettings) saveSettings({ ...settings, headerBtnsOrder: [] });
    };

    const currentBranch = (settings?.branches || []).find(b => b.id === activeBranchId);

    const allowedButtons = defaultHeaderButtons.filter(btnId => {
        if (currentBranch && currentBranch.posButtons) {
            return currentBranch.posButtons.includes(btnId);
        }
        if (!hasAccess || isAdmin) return true;
        if (btnId === 'quitter') return true;
        if (btnId === 'tv') return hasAccess('tv');
        if (btnId === 'kds') return hasAccess('kds');
        if (btnId === 'standard') return hasAccess('standard');
        if (btnId === 'problemes') return hasAccess('problems');
        if (btnId === 'commandes_web') return hasAccess('active');
        if (btnId === 'suivi') return hasAccess('active') || hasAccess('history');
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
            if (managerBranchId && o.nearestBranch?.id !== managerBranchId) return false;
            return o.clientUnreachable || (o.adminMessage && o.adminMessage.includes('PANNE'));
        });
    }, [orders, managerBranchId]);

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
        // Zoom global de l'interface (Ajusté pour être un peu plus grand)
        document.documentElement.style.fontSize = '13px';
    }, []);

    // Init Active Branch
    useEffect(() => {
        if (!activeBranchId && settings?.branches?.length > 0) setActiveBranchId(managerBranchId || settings.branches[0].id);
    }, [settings, managerBranchId, activeBranchId]);

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
        if (o.source === 'pos') return false;
        if (managerBranchId && o.nearestBranch?.id !== managerBranchId) return false;
        return ['pending', 'preparing', 'ready', 'out_for_delivery'].includes(o.status);
    });
    const pendingOnline = onlineOrders.filter(o => o.status === 'pending');
    const readyPosOrders = (orders || []).filter(o => o.source === 'pos' && o.nearestBranch?.id === activeBranchId && o.status === 'ready');

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

    // 🔥 Hssab dyal Z w Rapports
    const todayStr = new Date().toISOString().split('T')[0];
    const completedOrdersToday = (orders || []).filter(o => {
        if (o.nearestBranch?.id !== activeBranchId) return false;
        
        // POS: tout sauf annulé. Livraison: Seulement les commandes livrées.
        if (o.source === 'pos') {
            if (o.status === 'rejected') return false; 
        } else {
            if (o.status !== 'delivered') return false; 
        }
        
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

    const caPos = completedOrdersToday.filter(o => o.source === 'pos').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const caApp = completedOrdersToday.filter(o => !o.source || o.source === 'app' || o.source === 'glovo').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const caTel = completedOrdersToday.filter(o => o.source === 'telephone').reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const dailyCA = caPos + caApp + caTel;
    
    let dailyItemsMap = {};
    completedOrdersToday.forEach(o => {
        (o.items || []).forEach(i => { const baseName = (i.name || '').split(' (Sans ')[0]; dailyItemsMap[baseName] = (dailyItemsMap[baseName] || 0) + i.qty; });
    });
    const dailyItemsList = Object.entries(dailyItemsMap).sort((a,b) => b[1] - a[1]);

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

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
                ? parts[1].replace(")", "").split(", ").map(s => `\n   - Sans ${formatSansIngredient(s)}`).join("") 
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
            offlineCreatedAt: Date.now()
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

    const handleProductClick = (item) => {
        if (item.removableIngredients || item.choices || (item.extras && item.extras.length > 0)) {
             const ingredients = item.removableIngredients ? String(item.removableIngredients).split(',').map(i => i.trim()).filter(Boolean) : [];
             const choices = item.choices ? String(item.choices).split(',').map(i => i.trim()).filter(Boolean) : [];
             if (ingredients.length > 0 || choices.length > 0 || (item.extras && item.extras.length > 0)) {
                 setSelectedItemForOptions({ ...item, ingredients, choices, selectedSans: [], selectedExtras: [] });
                 setSelectedChoiceForOptions(null);
                 return;
             }
        }
        addToCart(item);
    };

    const confirmOptionsAndAdd = () => {
        if (!selectedItemForOptions) return;
        if (selectedItemForOptions.choices?.length > 0 && !selectedChoiceForOptions) {
            return showNotify("Veuillez choisir une option (ex: Coca, Sprite...) !", "error");
        }
        let note = "";
        let extraPrice = 0;
        if (selectedChoiceForOptions) note += ` (${selectedChoiceForOptions})`;
        if (selectedItemForOptions.selectedExtras?.length > 0) {
            note += ` (Avec ${selectedItemForOptions.selectedExtras.map(e => e.name).join(', ')})`;
            extraPrice = selectedItemForOptions.selectedExtras.reduce((s, e) => s + Number(e.price), 0);
        }
        if (selectedItemForOptions.selectedSans.length > 0) {
            note += ` (Sans ${selectedItemForOptions.selectedSans.join(', ')})`;
        }
        const itemToAdd = { ...selectedItemForOptions, price: Number(selectedItemForOptions.price) + extraPrice };
        addToCart(itemToAdd, note);
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

    // 🔥 Print Custom pour Pos (1 Ticket Client + 1 Ticket Cuisine)
    const printTicketsPos = (order, brandInfo) => {
        
        const itemsHtml = order.items.map(item => `
            <div style="display:flex; justify-content:space-between; margin-bottom: 5px; font-weight: bold; font-size: 14px;">
                <span>${item.qty}x ${item.name.split(' (Sans')[0]}</span>
                <span>${item.price * item.qty} DH</span>
            </div>
            ${item.name.includes(' (Sans') ? `<div style="font-size:12px; color:#da291c; margin-top:-3px; margin-bottom:5px; font-weight: bold;">- ${item.name.split(' (Sans ')[1].replace(')', '').split(', ').map(opt => formatSansIngredient(opt)).join('<br>- ')}</div>` : ''}
        `).join('');

        const kitchenItemsHtml = order.items.map(item => `
            <div style="margin-bottom: 8px; font-size: 20px; font-weight: 900;">
                ${item.qty}x ${item.name.split(' (Sans')[0]}
            </div>
            ${item.name.includes(' (Sans') ? `<div style="font-size:16px; margin-top:-5px; margin-bottom:8px; font-weight: 900; text-transform: uppercase;">*** ${item.name.split(' (Sans ')[1].replace(')', '').split(', ').map(opt => formatSansIngredient(opt)).join(' ***<br>*** ')} ***</div>` : ''}
        `).join('');

        const dateStr = new Date().toLocaleString('fr-FR');
        const orderTypeStr = order.orderType === 'a_emporter' ? 'À EMPORTER' : 'SUR PLACE';

        const html = `
        <html>
        <head><title>Tickets</title></head>
        <body style="font-family: monospace; padding: 10px; color: #000; width: 300px; margin: 0 auto;">
            
            <!-- TICKET CLIENT -->
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

            <!-- COUPURE (Nouveau ticket) -->
            <div style="page-break-after: always; height: 30px;"></div>

            <!-- TICKET CUISINE -->
            <div style="text-align: center; padding-top: 10px;">
                <h2 style="margin: 0; font-size: 28px; font-weight: 900;">BON CUISINE</h2>
                <p style="margin: 5px 0; font-size: 12px; font-weight: bold;">${dateStr}</p>
                <h1 style="margin: 10px 0; font-size: 45px; font-weight: 900;">#${order.orderNumber}</h1>
                <h2 style="margin: 5px 0; padding: 5px; border: 3px solid #000; font-size: 22px;">${orderTypeStr}</h2>
                <div style="margin-top: 20px; text-align: left; border-top: 2px solid #000; padding-top: 10px;">
                    ${kitchenItemsHtml}
                </div>
            </div>

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
        </body>
        </html>
        `;

        // 🔥 ZEDNA HAD L-CODE: Impression Electron ola Web
        if (typeof window !== 'undefined' && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('print-ticket', html);
        } else {
            const printWindow = window.open('', '', 'width=400,height=800');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(html);
                printWindow.document.close();
            }
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
                status: 'preparing', // 🚀 POS orders kaymchiw l-Cuisine (KDS)
                deliveredAtLocal: Date.now(),
                source: 'pos',
                orderType: orderType,
                paymentMethod: 'espece',
                nearestBranch: branch,
                customerName: orderType === 'a_emporter' ? 'Client Emporter' : 'Client Sur Place',
                offlineCreatedAt: Date.now()
            };

            if (isNetOnline) {
                try {
                    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), {
                        ...newOrder,
                        createdAt: serverTimestamp()
                    });
                    showNotify("Commande daret b-naja7! ✅", "success");
                } catch (error) {
                    console.log("Erreur réseau/Firestore, sauvegarde locale...", error);
                    saveOfflineOrder(newOrder);
                }
            } else {
                saveOfflineOrder(newOrder);
            }
            
            // Impression automatique dyal t-ticket w feth l-caisse
            printTicketsPos(newOrder, brand); 

            setCart([]); // Nkhwiw l-panier l-client jdid
        } catch (error) {
            showNotify("W9e3 mochkil f tsjal dyal l-commande", "error");
        }
    };

    // 🔥 Impression des Rapports X / Z
    const printReport = (type) => {
        const branch = (settings?.branches || []).find(b => b.id === activeBranchId);
        const itemsHtml = dailyItemsList.map(([name, qty]) => `<div style="display:flex; justify-content:space-between;"><span>${qty}x ${name}</span><span></span></div>`).join('');
        
        const html = `<html><head><title>Rapport ${type}</title></head>
        <body style="font-family:monospace; padding:10px; font-size:14px; color:#000; text-align:center;">
            ${brand?.ticketLogoUrl ? `<img src="${brand.ticketLogoUrl}" style="max-width: 150px; max-height: 80px; object-fit: contain; margin-bottom: 10px;" /><br/>` : ''}
            <h2 style="margin:0;">RAPPORT ${type}</h2>
            <p style="margin:5px 0;">${branch?.name?.toUpperCase() || brand?.name?.toUpperCase() || 'CAISSE'}<br>Date: ${new Date().toLocaleDateString('fr-FR')}</p>
            <hr style="border-top:1px dashed #000; margin:10px 0;"/><div style="display:flex; justify-content:space-between;"><span>Total Tickets:</span><span>${completedOrdersToday.length}</span></div><hr style="border-top:1px dashed #000; margin:10px 0;"/>
            <p style="text-align:left; font-weight:bold; margin:5px 0;">Répartition C.A :</p>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Sur Place (Caisse):</span><span>${caPos} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Livraison (App):</span><span>${caApp} DH</span></div>
            <div style="display:flex; justify-content:space-between; font-size:12px;"><span>Standard (Tél):</span><span>${caTel} DH</span></div>
            <hr style="border-top:1px dashed #000; margin:10px 0;"/>
            <p style="text-align:left; font-weight:bold; margin:5px 0;">Détails des ventes :</p>${itemsHtml || '<p style="text-align:left;">Aucun article</p>'}
            <hr style="border-top:1px dashed #000; margin:10px 0;"/><div style="display:flex; justify-content:space-between; font-weight:bold; font-size:18px; margin-top:10px;"><span>C.A TOTAL:</span><span>${dailyCA} DH</span></div>
            <p style="margin-top:20px; font-size:12px;">${type === 'Z' ? '*** CLOTURE Z ***' : '*** BILAN PROVISOIRE X ***'}</p>
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
        </body></html>`;

        // 🔥 ZEDNA HAD L-CODE: Impression Electron ola Web
        if (typeof window !== 'undefined' && window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('print-ticket', html);
        } else {
            const printWindow = window.open('', '', 'width=400,height=800');
            if (printWindow) {
                printWindow.document.open();
                printWindow.document.write(html);
                printWindow.document.close();
            }
        }

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
        const baseClass = `relative flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold transition-all text-sm sm:text-base shadow-sm ml-2 ${cursorClass}`;

        switch(btnId) {
            case 'commandes_web':
                return (
                    <button key={btnId} {...dragProps} onClick={() => {
                        if (pendingOnline.length > 0) setShowPendingModal(true);
                        else { if (setTab) setTab('active'); else window.location.href = '/idara'; }
                    }} className={`${baseClass} ${pendingOnline.length > 0 ? 'bg-red-500 text-white animate-pulse border border-red-600' : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
                        <BellRing size={18} className={pendingOnline.length > 0 ? 'animate-bounce' : ''}/>
                        <span className="hidden sm:inline">Commandes Web</span>
                        {pendingOnline.length > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{pendingOnline.length}</span>}
                    </button>
                );
            case 'problemes':
                if (problemOrders.length === 0) return null;
                return (
                    <button key={btnId} {...dragProps} onClick={() => setShowProblemModal(true)} className={`${baseClass} bg-red-500 text-white border border-red-600 animate-pulse`}>
                        <AlertTriangle size={18} /> <span className="hidden sm:inline">Problèmes</span>
                        <span className="absolute -top-2 -right-2 bg-yellow-400 text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{problemOrders.length}</span>
                    </button>
                );
            case 'suivi':
                return (
                    <button key={btnId} {...dragProps} onClick={() => setShowOnlineOrdersModal(true)} className={`${baseClass} ${onlineOrders.length > 0 ? 'bg-purple-500 text-white hover:bg-purple-600 border-purple-600' : 'bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100'}`}>
                        <ShoppingBag size={18} /> <span className="hidden sm:inline">Suivi Web/Tél</span>
                        {onlineOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-yellow-400 text-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{onlineOrders.length}</span>}
                    </button>
                );
            case 'pretes':
                return (
                    <button key={btnId} {...dragProps} onClick={() => setShowReadyPosModal(true)} className={`${baseClass} ${readyPosOrders.length > 0 ? 'bg-green-500 text-white animate-pulse border border-green-600' : 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'}`}>
                        <CheckCircle size={18} /> <span className="hidden sm:inline">Prêtes (Servir)</span>
                        {readyPosOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black shadow-md">{readyPosOrders.length}</span>}
                    </button>
                );
            case 'tv':
                return (
                    <button key={btnId} {...dragProps} onClick={() => {
                        const route = '/tv';
                        window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank');
                    }} className={`${baseClass} bg-blue-600 hover:bg-blue-700 text-white border border-blue-700`}>
                        <Monitor size={18} /> <span className="hidden sm:inline">Écran TV</span>
                    </button>
                );
            case 'standard':
                return (
                    <button key={btnId} {...dragProps} onClick={() => setShowStandardModal(true)} className={`${baseClass} bg-orange-500 hover:bg-orange-600 text-white border border-orange-600`}>
                        📞 <span className="hidden sm:inline">Standard Tél</span>
                    </button>
                );
            case 'kds':
                return (
                    <button key={btnId} {...dragProps} onClick={() => {
                        const route = '/kds';
                        window.open(navigator.userAgent.toLowerCase().includes('electron') ? window.location.href.split('#')[0] + '#' + route : route, '_blank');
                    }} className={`${baseClass} bg-neutral-900 hover:bg-black text-white border border-neutral-800`}>
                        <ChefHat size={18} className="text-orange-500" /> <span className="hidden sm:inline">Cuisine (KDS)</span>
                    </button>
                );
            case 'quitter':
                return (
                    <button key={btnId} {...dragProps} onClick={() => setTab ? setTab('active') : (onQuit ? onQuit() : window.location.href = '/idara')} className={`${baseClass} bg-white border border-gray-200 hover:bg-gray-50 text-gray-700`}>
                        <ArrowLeft size={18}/> <span className="hidden sm:inline">Quitter</span>
                    </button>
                );
            default:
                return null;
        }
    };

    return (
        <div 
            className="flex flex-col h-full w-full md:flex-row overflow-hidden relative font-sans" 
            style={{ fontFamily: brand?.fontFamily || "'Plus Jakarta Sans', sans-serif", backgroundColor: brand?.posBgColor || brand?.bgColor || '#f8fafc', color: brand?.posTextColor || brand?.textColor || '#0f172a' }}
        >
            
            {/* MAIN CONTENT (LEFT) */}
            <div className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
                <header className="p-3 sm:p-4 shadow-sm font-black text-xl sm:text-2xl flex items-center gap-2 z-10" style={{ backgroundColor: brand?.posHeaderColor || brand?.headerColor || '#ffffff', color: brand?.posColor || brand?.color || '#4f46e5' }}>
                    <ShoppingCart size={28}/> <span className="truncate pr-20 sm:pr-0">{brand?.texts?.posAppTitle || brand?.name || 'Caisse POS'}</span>
                    
                    {/* BUTTONS IN HEADER */}
                    {displayedButtons.map((btnId, idx) => renderHeaderButton(btnId, idx))}

                    {/* BOUTON RESET POSITIONS (Si l'ordre a été modifié) */}
                    {isAdmin && headerBtnsOrder.length > 0 && (
                        <button onClick={handleResetPositions} className="ml-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-500 rounded-xl text-xs font-bold transition-all shadow-sm">
                            ↺ Réinitialiser
                        </button>
                    )}

                <div className="ml-auto mr-28 sm:mr-0 flex items-center gap-2">
                    {!isNetOnline ? (
                        <div className="flex items-center gap-1.5 bg-red-100 text-red-600 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm border border-red-200">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                            </span>
                            Hors Ligne ({offlineQueue.length})
                        </div>
                    ) : offlineQueue.length > 0 ? (
                        <button onClick={() => syncOfflineOrdersRef.current && syncOfflineOrdersRef.current()} className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm border border-yellow-300 hover:bg-yellow-200 transition-colors">
                            <History size={14} /> Sync ({offlineQueue.length})
                        </button>
                    ) : null}
                </div>
                </header>
                
                <div className="border-b border-gray-100 p-3 sm:p-4 overflow-x-auto no-scrollbar shrink-0" style={{ backgroundColor: brand?.posHeaderColor || brand?.headerColor || '#ffffff' }}>
                    <div className="flex gap-2">
                        {categories.map((cat, idx) => (
                            <button 
                                key={cat} 
                                draggable={isAdmin}
                                onDragStart={() => dragCatRef.current = idx}
                                onDragEnter={() => dropCatRef.current = idx}
                                onDragEnd={handleCatDragEnd}
                                onDragOver={e => e.preventDefault()}
                                onClick={() => setSelectedCategory(cat)} 
                                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full sm:rounded-2xl font-bold sm:font-black transition-all whitespace-nowrap text-sm sm:text-base ${displayCategory === cat ? 'text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'} ${isAdmin ? 'cursor-move' : ''}`} 
                                style={displayCategory === cat ? { backgroundColor: brand?.posColor || brand?.color || '#4f46e5' } : {}}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

            <main className="flex-1 p-4 sm:p-8 overflow-y-auto w-full">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 pb-6">
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
                                handleProductClick(item);
                            }} 
                            className={`relative bg-white rounded-[2rem] p-4 flex flex-col items-center justify-between gap-4 shadow-sm border border-gray-100 overflow-hidden transition-colors min-h-[220px] sm:min-h-[260px] ${item.outOfStock ? 'opacity-60 grayscale cursor-not-allowed border-red-200' : 'cursor-pointer hover:bg-gray-50'} ${isAdmin ? 'cursor-move' : ''}`}
                        >
                            <div className="w-full h-32 sm:h-40 flex items-center justify-center bg-gray-50/50 rounded-2xl overflow-hidden relative">
                                {item.outOfStock && (
                                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-20">
                                        <span className="bg-red-500 text-white font-black text-xs sm:text-sm px-3 py-1.5 rounded-full shadow-lg transform -rotate-12 border-2 border-white">RUPTURE</span>
                                    </div>
                                )}
                                {typeof item.img === 'string' && (item.img.startsWith('http') || item.img.startsWith('data:image')) ? (
                                    <img src={item.img} loading="lazy" className="w-full h-full object-contain mix-blend-multiply drop-shadow-sm" alt={item.name}/>
                                ) : (
                                    <span className="text-6xl sm:text-7xl">{item.img}</span>
                                )}
                            </div>
                            <div className="w-full text-left space-y-1 px-1">
                                <h3 className="font-black text-gray-800 text-base sm:text-lg leading-tight line-clamp-2">{item.name}</h3>
                                <p className="font-black text-xl sm:text-2xl tracking-tighter" style={{ color: item.outOfStock ? '#9ca3af' : (brand?.posColor || brand?.color || '#f59e0b') }}>
                                    {item.price} <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest">DH</span>
                                </p>
                            </div>
                        </div>
                        ))}
                    </div>
                </main>
            </div>

            {/* CART SIDEBAR (RIGHT) */}
            <aside className="hidden md:flex w-[420px] bg-white/80 backdrop-blur-2xl shadow-[-10px_0_40px_rgba(0,0,0,0.03)] flex-col h-full z-20 border-l border-white/60 shrink-0">
                <div className="p-6 sm:p-8 flex justify-between items-center border-b border-gray-100/50 sticky top-0 z-10">
                    <div className="font-black text-2xl flex items-center gap-3 text-gray-900 tracking-tight">
                        <ShoppingBag size={28} style={{ color: brand?.posColor || brand?.color || '#f59e0b' }}/> 
                        {brand?.texts?.posTabOrder || 'Commande'}
                    </div>
                    <div className="flex items-center gap-2">
                        {heldCarts.length > 0 && (
                            <button onClick={() => setShowHeldCarts(true)} className="p-2.5 bg-orange-50/80 text-orange-500 rounded-full hover:bg-orange-100 transition-colors relative" title="Commandes en attente">
                                <Clock size={20}/>
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-black shadow-sm">{heldCarts.length}</span>
                            </button>
                        )}
                    {cart.length > 0 && (!hasAccess || hasAccess('pos_delete')) && <button onClick={clearCart} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={20}/></button>}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 no-scrollbar">
                    <AnimatePresence>
                        {cart.length === 0 ? (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col items-center justify-center text-gray-300 h-full mt-20 gap-4">
                                <ShoppingBag size={80} strokeWidth={1} className="opacity-20"/>
                                <p className="font-medium text-lg tracking-wide uppercase">Panier vide</p>
                            </motion.div>
                        ) : (
                            cart.map((item, idx) => (
                                <motion.div key={`${item.id}-${idx}`} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }} onClick={() => setEditCartItem(item)} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-5 cursor-pointer hover:shadow-md transition-all">
                                    <div className="flex flex-col items-center bg-gray-50 rounded-2xl p-1.5 border border-gray-100/80" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => updateCartItemQty(item, 1)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-black font-bold text-xl transition-colors">+</button>
                                        <span className="font-black text-sm my-1">{item.qty}</span>
                                        <button onClick={() => updateCartItemQty(item, -1)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-black font-bold text-xl transition-colors">-</button>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-gray-900 text-lg leading-tight">{item.name.split(' (Sans')[0]}</h4>
                                        {item.name.includes(' (Sans') && (
                                            <div className="text-[11px] text-red-400 mt-1 font-bold tracking-wide uppercase">
                                                {item.name.split(' (Sans ')[1].replace(')', '').split(', ').map((opt, oIdx) => <div key={oIdx}>- {formatSansIngredient(opt)}</div>)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="font-black text-xl tracking-tighter" style={{ color: brand?.posColor || brand?.color || '#f59e0b' }}>
                                        {item.price * item.qty}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-6 sm:p-8 bg-white/90 backdrop-blur-xl border-t border-gray-100/50 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] shrink-0">
                    <div className="flex gap-2 mb-6 p-1.5 bg-gray-100 rounded-2xl border border-gray-200">
                        <button onClick={() => setOrderType('sur_place')} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${orderType === 'sur_place' ? 'bg-blue-500 shadow-md text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}>🍽️ Sur Place (Plateaux)</button>
                        <button onClick={() => setOrderType('a_emporter')} className={`flex-1 py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${orderType === 'a_emporter' ? 'bg-pink-500 shadow-md text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}>🛍️ À Emporter (Emballage)</button>
                    </div>

                    <div className="flex justify-between items-end mb-6">
                        <span className="text-gray-400 font-bold uppercase tracking-widest text-xs">{brand?.texts?.posTotal || 'Total à payer'}</span>
                        <span className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tighter leading-none">{total} <span className="text-xl sm:text-2xl tracking-normal" style={{ color: brand?.posColor || brand?.color || '#f59e0b' }}>DH</span></span>
                    </div>

                    <div className="flex gap-3 mb-6">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => {
                            if (cart.length === 0) return;
                            setHeldCarts(prev => [...prev, { id: Date.now(), time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), cart: [...cart], orderType, total }]);
                            setCart([]);
                            showNotify("Commande mise en attente 🕒", "info");
                        }} disabled={cart.length === 0} className="w-16 h-16 bg-orange-50 text-orange-500 border border-orange-100 rounded-2xl font-black disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-sm hover:bg-orange-100">
                            <Clock size={20}/>
                        </motion.button>
                        <motion.button whileHover={cart.length > 0 ? { scale: 1.02 } : {}} whileTap={cart.length > 0 ? { scale: 0.98 } : {}} onClick={handleEncaissement} disabled={cart.length === 0} className="flex-1 rounded-2xl font-black text-xl text-white disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-3 shadow-[0_15px_40px_rgba(0,0,0,0.15)] transition-colors hover:opacity-90" style={{ backgroundColor: brand?.posColor || brand?.color || '#000' }}>
                            <Banknote size={24}/> {brand?.texts?.posBtnPay || 'ENCAISSER'}
                        </motion.button>
                    </div>

                <div className="flex gap-3">
                    {(!hasAccess || hasAccess('pos_drawer')) && (
                        <button onClick={() => showNotify("Tiroir ouvert 🔓", "success")} className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-[10px] transition-colors"><Unlock size={18} className="text-green-500"/><span>Tiroir</span></button>
                    )}
                    {(!hasAccess || hasAccess('pos_history')) && (
                        <button onClick={() => setShowHistoryModal(true)} className="flex-1 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-[10px] transition-colors"><History size={18}/><span>Historique</span></button>
                    )}
                    {(!hasAccess || hasAccess('pos_reports')) && (
                        <button onClick={() => setShowXZModal(true)} className="flex-1 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 rounded-xl flex flex-col items-center justify-center gap-1.5 font-bold text-[10px] transition-colors"><ClipboardList size={18}/><span>Rapports</span></button>
                    )}
                    </div>
                </div>
            </aside>

            {/* MODAL EDIT CART ITEM (Qte / Supprimer) */}
            {editCartItem && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditCartItem(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-black text-gray-900">{editCartItem.name.split(' (Sans')[0]}</h2>
                            <button onClick={() => setEditCartItem(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                        </div>
                        <div className="p-6 flex flex-col items-center gap-6 bg-gray-50">
                            <div className="flex items-center gap-6 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
                                <button onClick={() => updateCartItemQty(editCartItem, -1)} className="w-14 h-14 bg-gray-50 rounded-xl shadow-sm flex items-center justify-center text-3xl font-black text-gray-600 hover:text-blue-600 border border-gray-100">-</button>
                                <span className="text-3xl font-black w-10 text-center">{editCartItem.qty}</span>
                                <button onClick={() => updateCartItemQty(editCartItem, 1)} className="w-14 h-14 bg-gray-50 rounded-xl shadow-sm flex items-center justify-center text-3xl font-black text-gray-600 hover:text-blue-600 border border-gray-100">+</button>
                            </div>
                            {(!hasAccess || hasAccess('pos_delete')) && (
                                <button onClick={() => { deleteFromCart(editCartItem.id, editCartItem.name); setEditCartItem(null); }} className="w-full py-4 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-black rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"><Trash2 size={20}/> Supprimer du panier</button>
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
                        </div>
                        
                        {selectedItemForOptions.choices?.length > 0 && (
                            <div className="p-5 bg-gray-50 border-b border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Choix (Obligatoire) <span className="text-red-500">*</span></p>
                                <div className="space-y-2">
                                    {selectedItemForOptions.choices.map(c => (
                                        <label key={c} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedChoiceForOptions === c ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                                            <input 
                                                type="radio" 
                                                name="pos_choice"
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={selectedChoiceForOptions === c}
                                                onChange={() => setSelectedChoiceForOptions(c)}
                                            />
                                            <span className={`text-sm font-black uppercase ${selectedChoiceForOptions === c ? 'text-blue-700' : 'text-gray-700'}`}>{c}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedItemForOptions.extras?.length > 0 && (
                            (() => {
                                const drinkNames = new Set(PREDEFINED_DRINKS.map(d => d.name));
                                const pureExtras = (selectedItemForOptions.extras || []).filter(e => !drinkNames.has(e.name));
                                const pureDrinks = (selectedItemForOptions.extras || []).filter(e => drinkNames.has(e.name));
                                
                                return (
                                    <>
                                        {pureExtras.length > 0 && (
                                            <div className="p-5 bg-gray-50 border-b border-gray-200">
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
                                            <div className="p-5 bg-gray-50 border-b border-gray-200">
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

                        {selectedItemForOptions.ingredients?.length > 0 && (
                            <div className="p-5 bg-gray-50 space-y-3 max-h-[40dvh] overflow-y-auto">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Options Sans (Khtar chno t7eyed)</p>
                                {selectedItemForOptions.ingredients.map(opt => {
                                    const isSelected = selectedItemForOptions.selectedSans.includes(opt);
                                    return (
                                        <label key={opt} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-red-500 bg-red-50 shadow-sm' : 'border-gray-200 bg-white hover:border-red-300'}`}>
                                            <span className={`text-sm font-black uppercase ${isSelected ? 'text-red-700' : 'text-gray-700'}`}>{formatSansIngredient(opt)}</span>
                                            <input type="checkbox" className="w-6 h-6 rounded-md border-gray-300 accent-red-600 focus:ring-red-500 cursor-pointer" checked={isSelected} onChange={() => toggleOption(opt)} />
                                        </label>
                                    )
                                })}
                            </div>
                        )}
                        
                        <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
                            <button onClick={() => setSelectedItemForOptions(null)} className="flex-1 py-4 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
                            <button onClick={confirmOptionsAndAdd} className="flex-[2] py-4 font-black text-white rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2" style={{backgroundColor: brand?.posColor || brand?.color || '#4f46e5'}}><CheckCircle size={20}/> Valider l'ajout</button>
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
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md text-white ${held.orderType === 'sur_place' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                                                    {held.orderType === 'sur_place' ? '🍽️ SUR PLACE (PLATEAUX)' : '🛍️ À EMPORTER (EMBALLAGE)'}
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
                                        <span className="font-black text-red-600 text-lg">{o.total} DH</span>
                                    </div>
                                    <p className="text-sm text-red-600 font-bold bg-red-100/50 w-fit px-3 py-1 rounded-lg">
                                        🚨 {o.adminMessage || (o.clientUnreachable ? "Client Injoignable" : "Problème signalé")}
                                    </p>
                                    {o.phone && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <a href={`tel:${o.phone}`} className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-gray-200">
                                                📞 Appeler {o.phone}
                                            </a>
                                            <a href={/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? `whatsapp://send?phone=${o.phone.replace(/^0/, '212')}&text=${encodeURIComponent(`Salam, bkhoussous l-commande dyalak #${o.orderNumber || o.id.slice(-4).toUpperCase()}...`)}` : `https://web.whatsapp.com/send?phone=${o.phone.replace(/^0/, '212')}&text=${encodeURIComponent(`Salam, bkhoussous l-commande dyalak #${o.orderNumber || o.id.slice(-4).toUpperCase()}...`)}`} target={/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "_self" : "WhatsAppWebTab"} className="flex-1 sm:flex-none bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-green-200">
                                                💬 WhatsApp
                                            </a>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-2">
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
                                            <p className={`text-[10px] font-black uppercase mt-1 px-2 py-1 rounded-md w-fit text-white ${o.orderType === 'sur_place' ? 'bg-blue-500' : 'bg-pink-500'}`}>
                                                {o.orderType === 'sur_place' ? '🍽️ SUR PLACE (PLATEAUX)' : '🛍️ À EMPORTER (EMBALLAGE)'}
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
            <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowConfirmToutDonner(false)}>
                <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-orange-50">
                        <h2 className="text-lg font-black text-orange-800 flex items-center gap-2"><AlertTriangle size={20}/> Confirmation</h2>
                        <button onClick={() => setShowConfirmToutDonner(false)} className="p-2 bg-white rounded-full hover:bg-gray-100"><X size={20}/></button>
                    </div>
                    <div className="p-6 bg-gray-50 text-center space-y-5">
                        <p className="font-bold text-gray-800 text-base">Wach mt2ked bghiti t3ti ga3 had l-commandes ({readyPosOrders.length}) f de9a we7da ?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirmToutDonner(false)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-200 rounded-xl hover:bg-gray-300 transition-colors shadow-sm">Non (Annuler)</button>
                            <button onClick={() => {
                                readyPosOrders.forEach(o => updateStatus(o.id, 'delivered', { deliveredAtLocal: Date.now() }));
                                showNotify("Ga3 l-commandes t3taw l-klyan ! ✅", "success");
                                setShowReadyPosModal(false);
                                setShowConfirmToutDonner(false);
                            }} className="flex-[2] py-3 font-black text-white bg-green-500 rounded-xl shadow-md active:scale-95 transition-all hover:bg-green-600">Oui, Tout donner</button>
                        </div>
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
                                <h3 className="text-3xl font-black text-purple-600">{dailyCA} MAD</h3>
                                <p className="text-xs text-gray-400 mt-1 font-medium mb-3">{completedOrdersToday.length} commandes au total</p>
                                
                                <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold">Sur Place</span>
                                        <span className="text-sm font-black text-indigo-600">{caPos} DH</span>
                                    </div>
                                    <div className="flex flex-col items-center border-l border-r border-gray-100">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold">App</span>
                                        <span className="text-sm font-black text-green-600">{caApp} DH</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold">Téléphone</span>
                                        <span className="text-sm font-black text-orange-600">{caTel} DH</span>
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
                                            updateStatus(o.id, 'preparing');
                                            printTicket(o, brand);
                                            showNotify("Commande acceptée w mchat l'KDS! ✅", "success");
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
                                        updateStatus(o.id, 'preparing');
                                        printTicket(o, brand);
                                    });
                                    showNotify("Ga3 l-commandes t'acceptaw! ✅", "success");
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
                            <label className="block text-left">
                                <span className="text-xs font-bold text-gray-700 mb-1.5 block">Numéro de Téléphone Client <span className="text-red-500">*</span></span>
                                <input
                                    type="tel"
                                    readOnly
                                    onClick={() => setShowTelNumpad(true)}
                                    placeholder="06XXXXXXXX ou 07XXXXXXXX"
                                    className="w-full bg-white border border-gray-300 p-3 rounded-xl text-lg tracking-widest text-center font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all shadow-sm cursor-pointer"
                                    value={telInfo.phone}
                                    onChange={(e) => setTelInfo({ ...telInfo, phone: e.target.value.replace(/[^\d]/g, "").slice(0, 10) })}
                                />
                            </label>

                            {/* Numpad Tactile */}
                            {showTelNumpad && (
                            <div className="grid grid-cols-3 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={() => setTelInfo(prev => ({ ...prev, phone: (prev.phone + num).slice(0, 10) }))}
                                        className="py-3 bg-white border border-gray-200 rounded-xl font-black text-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm text-gray-800"
                                    >
                                        {num}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setTelInfo(prev => ({ ...prev, phone: prev.phone.slice(0, -1) }))}
                                    className="py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl font-black text-xl hover:bg-red-100 active:scale-95 transition-all flex items-center justify-center shadow-sm"
                                >
                                    <Delete size={24} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTelInfo(prev => ({ ...prev, phone: (prev.phone + '0').slice(0, 10) }))}
                                    className="py-3 bg-white border border-gray-200 rounded-xl font-black text-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm text-gray-800"
                                >
                                    0
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTelInfo(prev => ({ ...prev, phone: '' }))}
                                    className="py-3 bg-gray-200 border border-gray-300 text-gray-700 rounded-xl font-black text-sm uppercase hover:bg-gray-300 active:scale-95 transition-all shadow-sm"
                                >
                                    Effacer
                                </button>
                            </div>
                            )}
                            
                            <label className="block text-left">
                                <span className="text-xs font-bold text-gray-700 mb-1.5 block">Frais de Livraison (DH)</span>
                                <div className="flex gap-2">
                                    {[0, 5, 10, 15, 20].map(fee => (
                                        <button
                                            key={fee}
                                            onClick={() => setTelInfo({ ...telInfo, deliveryFee: fee })}
                                            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all border ${Number(telInfo.deliveryFee) === fee ? "bg-orange-500 text-white border-orange-600 shadow-md" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                        >
                                            {fee}
                                        </button>
                                    ))}
                                </div>
                            </label>

                            <div className="mt-4 flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <span className="text-sm font-bold text-gray-600 uppercase tracking-widest">Total de la commande</span>
                                <span className="text-2xl font-black text-gray-900">
                                    {total + Number(telInfo.deliveryFee || 0)} <span className="text-sm">DH</span>
                                </span>
                            </div>

                            <button
                                onClick={handleSendWhatsappFromPOS}
                                className="w-full mt-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                Créer & Envoyer WhatsApp
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
                            <h2 className="text-lg font-black text-purple-800 flex items-center gap-2">
                                <ShoppingBag size={20}/> Commandes Web & Téléphone ({onlineOrders.length})
                            </h2>
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
                                        {o.status === 'pending' && (
                                            <button onClick={() => {
                                                updateStatus(o.id, 'preparing');
                                                printTicket(o, brand);
                                                showNotify("Commande acceptée w mchat l'KDS! ✅", "success");
                                            }} className="mt-2 w-full bg-green-500 text-white py-3 rounded-xl font-black text-sm hover:bg-green-600 transition-colors shadow-md flex items-center justify-center gap-2">
                                                <CheckCircle size={18}/> Accepter & Imprimer
                                            </button>
                                        )}
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