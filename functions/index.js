const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// 1. Bouton "Live Map" (Admin): Réveiller tous les livreurs en ligne
exports.wakeUpDriversGPS = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    const appId = data.appId || "mon-bocadillo-menu";
    const driversSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("drivers")
        .where("isOnline", "==", true).get();
    if (driversSnap.empty) return { success: true, count: 0 };
    const tokens = [];
    driversSnap.forEach(doc => {
        const d = doc.data();
        if (d.fcmToken) tokens.push(d.fcmToken);
    });
    if (tokens.length === 0) return { success: true, count: 0 };
    const payload = { data: { type: 'WAKE_UP_GPS', duration: '300000', timestamp: String(Date.now()) } };
    const options = { priority: "high", timeToLive: 60 * 5 };
    const response = await admin.messaging().sendToDevice(tokens, payload, options);
    console.log(`Notification envoyée avec succès à ${response.successCount} appareils.`);
    return { success: true, count: tokens.length, sent: response.successCount };
});

// 2. Lors d'une nouvelle commande: Réveiller les livreurs disponibles pour MAJ GPS
exports.onNewOrderWakeUpDrivers = functions.firestore
    .document('artifacts/{appId}/public/data/orders/{orderId}')
    .onCreate(async (snap, context) => {
        const appId = context.params.appId;
        const driversSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("drivers")
            .where("isOnline", "==", true).where("isAvailable", "==", true).get();
        const tokens = [];
        driversSnap.forEach(doc => {
            const d = doc.data();
            if (d.fcmToken) tokens.push(d.fcmToken);
        });
        if (tokens.length > 0) {
            const payload = { data: { type: 'WAKE_UP_GPS', duration: '300000', orderId: snap.id, timestamp: String(Date.now()) } };
            const options = { priority: "high", timeToLive: 60 * 5 };
            await admin.messaging().sendToDevice(tokens, payload, options);
        }
        return null;
    });

// 3. Notification à l'administration lors d'une nouvelle commande
exports.sendAdminNotificationOnNewOrder = functions.firestore
    .document('artifacts/{appId}/public/data/orders/{orderId}')
    .onCreate(async (snap, context) => {
        const orderData = snap.data();
        const appId = context.params.appId;
        
        // Optimisation: On pourrait avoir un document "admin_tokens" pour éviter de lire tous les users
        // Pour l'instant, on fait un group query ou on parcourt (Attention si bcp de users)
        const profilesSnap = await db.collectionGroup("profile").get();
        const adminTokens = [];
        
        profilesSnap.forEach(docSnap => {
            // Vérifier que c'est bien le sous-dossier profile de la bonne app
            if (docSnap.ref.path.includes(`artifacts/${appId}/users/`)) {
                const profile = docSnap.data();
                if ((profile.isAdmin || profile.isManager || profile.isKds) && profile.fcmToken) {
                    adminTokens.push(profile.fcmToken);
                }
            }
        });
        
        if (adminTokens.length > 0) {
            const payload = {
                notification: {
                    title: 'Nouvelle Commande! 🍔',
                    body: `Commande #${orderData.orderNumber || snap.id.slice(-4).toUpperCase()} de ${orderData.total} DH.`,
                    clickAction: `https://${appId}.web.app/idara`
                },
                data: {
                    type: 'NEW_ORDER',
                    orderId: snap.id
                }
            };
            await admin.messaging().sendToDevice(adminTokens, payload);
        }
        return null;
    });

// 4. Notification au client quand le statut change
exports.sendClientNotificationOnOrderStatusChange = functions.firestore
    .document('artifacts/{appId}/public/data/orders/{orderId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();
        const appId = context.params.appId;

        if (newData.status !== oldData.status) {
            if (!newData.userId) return null;
            
            const profileSnap = await db.collection("artifacts").doc(appId).collection("users").doc(newData.userId).collection("profile").doc("data").get();
            
            if (profileSnap.exists && profileSnap.data().fcmToken) {
                const token = profileSnap.data().fcmToken;
                let title = '';
                let body = '';
                
                switch(newData.status) {
                    case 'preparing': title = 'En préparation 🍳'; body = 'Votre commande est en cours de préparation!'; break;
                    case 'ready': title = 'Prête! 🥡'; body = 'Votre commande est prête!'; break;
                    case 'out_for_delivery': title = 'En route! 🛵'; body = 'Le livreur est en route avec votre commande!'; break;
                    case 'delivered': title = 'Livrée! ✅'; body = 'Votre commande a été livrée. Bon appétit!'; break;
                    default: return null;
                }

                if (title && body) {
                    const payload = { notification: { title: title, body: body, clickAction: `https://${appId}.web.app/` } };
                    await admin.messaging().sendToDevice(token, payload);
                }
            }
        }
        return null;
    });

// 5. Créer un compte sécurisé (Manager/Admin) sans déconnecter l'utilisateur actuel
exports.createSecureAccount = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    
    const { email, password, role, branchId, appId } = data;
    if (!email || !password || !role || !appId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
        });

        const profileData = {
            isManager: role === 'manager',
            isAdmin: role === 'admin',
            isKds: role === 'kds',
            isRegistered: true,
            email: email,
            managerBranchId: branchId || null
        };

        await db.collection("artifacts").doc(appId).collection("users").doc(userRecord.uid).collection("profile").doc("data").set(profileData, { merge: true });

        return { success: true, uid: userRecord.uid };
    } catch (error) {
        console.error("Error creating new user:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// 8. Notification au livreur lors d'une nouvelle assignation ou commande prête pour freelance
exports.notifyDriverOnNewOrder = functions.firestore
    .document('artifacts/{appId}/public/data/orders/{orderId}')
    .onWrite(async (change, context) => {
        const appId = context.params.appId;
        const orderData = change.after.exists ? change.after.data() : null;
        const previousData = change.before.exists ? change.before.data() : null;

        if (!orderData) return null;

        // Cas 1: Commande assignée à un livreur spécifique
        const isNewAssignment = orderData.driverId && 
            (!previousData || previousData.driverId !== orderData.driverId);
        
        // Cas 2: Commande prête pour les freelances (pas de driverId encore assigné)
        const isNewFreelance = orderData.isFreelanceDriver && 
            orderData.status === 'ready' && !orderData.driverId && 
            (!previousData || previousData.status !== 'ready');

        try {
            if (isNewAssignment && !orderData.driverAccepted) {
                const driverDoc = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("drivers").doc(orderData.driverId).get();
                if (driverDoc.exists && driverDoc.data().fcmToken) {
                    const token = driverDoc.data().fcmToken;
                    const payload = {
                        notification: { 
                            title: "🚨 Nouvelle Commande !", 
                            body: `Commande #${orderData.orderNumber || '...'} katsennak.`, 
                            sound: "default",
                            android_channel_id: "loud_alarm"
                        },
                        data: { type: "NEW_ORDER", orderId: context.params.orderId }
                    };
                    await admin.messaging().sendToDevice(token, payload, { priority: "high", timeToLive: 60 * 60 * 24 });
                }
            } else if (isNewFreelance) {
                // Fetch config to get branch coordinates
                const configSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("config").get();
                const config = configSnap.exists ? configSnap.data() : {};
                const branches = config.branches || [];
                const branchId = orderData.nearestBranch?.id || "laymoune";
                const branch = branches.find(b => b.id === branchId);

                const driversSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("drivers")
                    .where('isAvailable', '==', true).get();
                
                const tokens = [];
                driversSnap.forEach(doc => { 
                    const driver = doc.data();
                    if (!driver.fcmToken) return;
                    
                    let isWithin2Km = true; // Par défaut on accepte si on n'a pas les coords
                    if (branch && branch.lat && branch.lng && driver.lat && driver.lng) {
                        const R = 6371; // Rayon de la Terre en km
                        const dLat = (driver.lat - branch.lat) * (Math.PI / 180);
                        const dLon = (driver.lng - branch.lng) * (Math.PI / 180);
                        const a = 
                            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(branch.lat * (Math.PI / 180)) * Math.cos(driver.lat * (Math.PI / 180)) * 
                            Math.sin(dLon / 2) * Math.sin(dLon / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        const distance = R * c;
                        
                        if (distance > 2) isWithin2Km = false;
                    }
                    
                    if (isWithin2Km) {
                        tokens.push(driver.fcmToken); 
                    }
                });

                if (tokens.length > 0) {
                    const payload = {
                        notification: { 
                            title: "🚨 Commande Freelance Dispo !", 
                            body: `Commande #${orderData.orderNumber || '...'} wajda! Zreb 9bel mayhezha chi wa7ed.`, 
                            sound: "default",
                            android_channel_id: "loud_alarm"
                        },
                        data: { type: "NEW_FREELANCE_ORDER", orderId: context.params.orderId }
                    };
                    await admin.messaging().sendToDevice(tokens, payload, { priority: "high", timeToLive: 60 * 60 * 24 });
                }
            }
        } catch (error) {
            console.error("Erreur Notification Livreur:", error);
        }
        return null;
    });

// 6. Mettre à jour un compte sécurisé (Email/Mot de passe) depuis l'éditeur
exports.updateSecureAccount = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    
    const { email, password, oldEmail } = data;
    if (!email && !password) {
        throw new functions.https.HttpsError('invalid-argument', 'Nothing to update');
    }

    try {
        const searchEmail = oldEmail || email;
        const userRecord = await admin.auth().getUserByEmail(searchEmail).catch(() => null);
        
        if (!userRecord) {
             throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const updateData = {};
        if (password) updateData.password = password;
        if (email && email !== oldEmail) updateData.email = email;

        await admin.auth().updateUser(userRecord.uid, updateData);

        return { success: true, uid: userRecord.uid };
    } catch (error) {
        console.error("Error updating user:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// 7. Envoyer des notifications Push Marketing aux clients
exports.sendMarketingPush = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    
    const { appId, tokens, title, body } = data;
    
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
        return { success: true, count: 0 };
    }
    if (!title || !body) {
        throw new functions.https.HttpsError('invalid-argument', 'Title and body are required');
    }

    try {
        const payload = {
            notification: {
                title: title,
                body: body,
                clickAction: `https://${appId || 'mon-bocadillo-menu'}.web.app/`
            }
        };
        const options = { priority: "high", timeToLive: 60 * 60 * 24 };
        
        const response = await admin.messaging().sendToDevice(tokens, payload, options);
        console.log(`Marketing Push envoyé avec succès à ${response.successCount} appareils.`);
        
        return { success: true, count: tokens.length, sent: response.successCount };
    } catch (error) {
        console.error("Error sending marketing push:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// 9. 🛡️ SÉCURITÉ CRITIQUE: Vérifier les prix des commandes (Anti-Fraude / Hacker)
exports.verifyOrderSecurity = functions.firestore
    .document('artifacts/{appId}/public/data/orders/{orderId}')
    .onCreate(async (snap, context) => {
        const order = snap.data();
        const appId = context.params.appId;
        
        // On fait confiance aux commandes passées par la Caisse (Admin/Manager)
        if (order.source === 'pos' || order.source === 'telephone' || order.source === 'glovo') return null;
        if (order.status === 'rejected') return null;
        
        const configSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("config").get();
        const config = configSnap.exists ? configSnap.data() : {};
        const menuItems = config.menuItems || [];
        const globalDrinks = config.globalDrinks || [
            { name: "🥤 Pepsi", price: 10 }, { name: "🍊 Mirinda Orange", price: 10 }, { name: "🍋 Mirinda Citron", price: 10 },
            { name: "🍏 Mirinda Pomme", price: 10 }, { name: "🥤 Fanta Orange", price: 10 }, { name: "💧 Eau 50cl", price: 10 }, { name: "🧃 Jus d'orange", price: 25 }
        ];

        let realSubtotal = 0;

        for (const item of order.items || []) {
            const realItem = menuItems.find(m => m.id === item.id);
            if (!realItem) continue;

            let unitPrice = Number(realItem.price || 0);

            if (item.selectedVariation && realItem.variations) {
                const realVar = realItem.variations.find(v => v.name === item.selectedVariation.name);
                if (realVar) unitPrice = Number(realVar.price || 0);
            }

            if (item.selectedExtras && item.selectedExtras.length > 0) {
                item.selectedExtras.forEach(ext => {
                    let realExt = (realItem.extras || []).find(e => e.name === ext.name);
                    if (!realExt) realExt = globalDrinks.find(d => d.name === ext.name);
                    if (realExt) unitPrice += Number(realExt.price || 0);
                });
            }

            if (item.isCombo) {
                unitPrice = Number(realItem.price || 0);
            }

            realSubtotal += (unitPrice * item.qty);
        }

        // 🔥 1. Vérification du Code Promo
        let realDiscount = 0;
        if (order.promoCode) {
            const promo = order.promoCode.toUpperCase();
            if (promo === 'GLOVO1') realDiscount = 15;
            else if (promo === 'BOCA10') realDiscount = Math.floor(realSubtotal * 0.10);
        }

        // 🔥 2. Vérification des Points de Fidélité
        let availablePoints = 0;
        if (Number(order.pointsUsed || 0) > 0) {
            let pEarned = 0;
            let pUsed = 0;
            
            let pastOrdersSnap;
            if (order.userId && order.userId !== 'guest') {
                pastOrdersSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("orders")
                    .where("userId", "==", order.userId).where("status", "==", "delivered").get();
            } else if (order.phone) {
                pastOrdersSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("orders")
                    .where("phone", "==", order.phone).where("status", "==", "delivered").get();
            }
            
            if (pastOrdersSnap && !pastOrdersSnap.empty) {
                pastOrdersSnap.forEach(doc => {
                    const o = doc.data();
                    pEarned += Math.floor((Number(o.subtotal) || 0) / 10);
                    pUsed += Number(o.pointsUsed || 0);
                });
            }
            
            if (order.userId && order.userId !== 'guest') {
                const profileSnap = await db.collection("artifacts").doc(appId).collection("users").doc(order.userId).collection("profile").doc("data").get();
                if (profileSnap.exists) pEarned += Number(profileSnap.data().manualPoints || 0);
            }
            
            availablePoints = Math.max(0, pEarned - pUsed);
        }

        // 3. Calcul du total attendu (Sécurisé)
        const expectedTotal = realSubtotal + Number(order.deliveryFee || 0) - realDiscount - (Number(order.pointsUsed || 0) <= availablePoints ? Number(order.pointsUsed || 0) : 0);

        // 4. Détection des fraudes
        const isSubtotalFraud = Number(order.subtotal || 0) < realSubtotal - 2;
        const isTotalFraud = Number(order.total || 0) < expectedTotal - 2;
        const isDiscountFraud = Number(order.discount || 0) > realDiscount + 1;
        const isPointsFraud = Number(order.pointsUsed || 0) > availablePoints;

        if (isSubtotalFraud || isTotalFraud || isDiscountFraud || isPointsFraud) {
            console.error(`🚨 Fraude détectée sur ${snap.id}. Attendu: ${expectedTotal}, Reçu: ${order.total}`);
            let fraudReason = "PRIX FALSIFIÉ";
            if (isDiscountFraud) fraudReason = "CODE PROMO FALSIFIÉ";
            else if (isPointsFraud) fraudReason = "POINTS DE FIDÉLITÉ FALSIFIÉS";

            return snap.ref.update({
                status: 'rejected',
                adminMessage: `🚨 FRAUDE DÉTECTÉE (${fraudReason}) : Le client a essayé de payer ${order.total} DH au lieu de ${expectedTotal} DH ! Commande bloquée.`,
                clientUnreachable: true,
                isFraud: true
            });
        }
        
        return null;
    });

// 10. Webhook API Glovo (Pour recevoir les commandes en temps réel + MacroDroid)
exports.glovoWebhook = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
        const appId = "mon-bocadillo-menu";

        // === CAS 1: Format MACRODROID (x-www-form-urlencoded ou json avec title/text) ===
        if (payload.text || payload.title) {
            let orderNumber = 'GLOVO';
            const titleMatch = payload.title?.match(/#([A-Z0-9]+)/i);
            if (titleMatch) orderNumber = titleMatch[1];
            else if (payload.text) {
                const textMatch = payload.text.match(/#([A-Z0-9]+)/i);
                if (textMatch) orderNumber = textMatch[1];
            }

            // Fetch menuItems for categorization
            const configSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("config").get();
            const config = configSnap.exists ? configSnap.data() : {};
            const menuItems = (config.menuItems || []).sort((a, b) => (b.name || '').length - (a.name || '').length);

            const parsedItems = [];
            let currentItem = null;
            const fullText = (payload.text || payload.title || '');
            const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

            for (let line of lines) {
                // 1x BOCADILLO THON
                const itemMatch = line.match(/^(\d+)\s*[xX]?\s+(.+)$/i);
                if (itemMatch && !line.toLowerCase().startsWith('sans') && !line.toLowerCase().startsWith('- sans')) {
                    const qty = parseInt(itemMatch[1]);
                    let rawName = itemMatch[2].trim();
                    
                    // Nettoyer les tirets à la fin (ex: "Pizza Salami --")
                    rawName = rawName.replace(/--.*$/, '').replace(/\*\*/g, '').trim();
                    
                    // Ignorer les lignes parasites (0x, mins, produit...)
                    if (qty === 0) continue;
                    if (!rawName || rawName.length < 2) continue;
                    
                    const lowerName = rawName.toLowerCase();
                    const ignoreList = ['mins', 'min', 'produit', 'produits', 'grande', 'moyenne', 'petite', 'tva', 'total', 'sous-total'];
                    if (ignoreList.includes(lowerName)) continue;
                    if (lowerName.includes('produit xxxx') || lowerName.includes('commande test') || lowerName.includes('acceptée')) continue;

                    // Remplacer par le nom exact du menu POS
                    const matchedMenu = menuItems.find(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerName.replace(/[^a-z0-9]/g, '')) 
                                     || menuItems.find(m => m.name.length >= 3 && lowerName.includes(m.name.toLowerCase()));

                    currentItem = {
                        name: matchedMenu ? matchedMenu.name : rawName, // Remplacer par le nom POS
                        qty: qty,
                        price: matchedMenu ? (matchedMenu.price || 0) : 0,
                        category: matchedMenu ? (matchedMenu.category || 'Divers') : 'Divers',
                        station: matchedMenu ? (matchedMenu.station || 'CHAUD') : 'CHAUD',
                        sans: []
                    };
                    parsedItems.push(currentItem);
                    continue;
                }

                if (currentItem) {
                    if (line.toLowerCase().startsWith('- sans') || line.toLowerCase().startsWith('sans')) {
                        const sansOpt = line.replace(/^-?\s*sans\s+/i, '').trim();
                        currentItem.sans.push(sansOpt);
                    }
                }
            }

            const brandSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("brand").get();
            const brand = brandSnap.exists ? brandSnap.data() : {};
            const enableArabicKDS = brand.enableArabicKDS === true;

            const translateToArabic = (text) => {
                let lower = text.toLowerCase();
                const isExtra = lower.includes('extra') || lower.includes('ajout');

                if (isExtra) {
                    if (lower.includes('fromage')) return '🧀 إكسترا فرماج';
                    if (lower.includes('frite')) return '🍟 إكسترا فريت';
                    if (lower.includes('viande')) return '🥩 إكسترا لحم';
                    if (lower.includes('poulet')) return '🍗 إكسترا دجاج';
                    return text;
                }

                if (lower.includes('tomate')) return '🍅 بلا مطيشة';
                if (lower.includes('oignon')) return '🧅 بلا بصلة';
                if (lower.includes('olive')) return '🟢 بلا زيتون';
                if (lower.includes('laitue') || lower.includes('salade')) return '🥗 بلا خس';
                if (lower.includes('carotte')) return '🥕 بلا خيزو';
                if (lower.includes('purée') || lower.includes('pomme') || lower.includes('frite')) return '🥔 بلا بطاطا';
                if (lower.includes('mayonnaise') || lower.includes('mayo')) return '🥣 بلا مايونيز';
                if (lower.includes('harissa') || lower.includes('hrissa')) return '🌶️ بلا هريسة';
                if (lower.includes('ketchup')) return '🍅 بلا كيتشوب';
                if (lower.includes('sauce')) return '🥣 بلا صوص';
                if (lower.includes('fromage')) return '🧀 بلا فرماج';

                return text;
            };

            const finalItems = parsedItems.length > 0 ? parsedItems.map(i => {
                let finalName = i.name;
                if (i.sans.length > 0) {
                    if (enableArabicKDS) {
                        i.sans = i.sans.map(translateToArabic);
                    }
                    finalName += ` (Sans ${i.sans.join(', ')})`;
                }
                return {
                    name: finalName,
                    qty: i.qty,
                    price: 0,
                    category: i.category,
                    station: i.station
                };
            }) : [{ name: 'COMMANDE GLOVO (Texte non reconnu)', qty: 1, price: 0 }];

            // Extract Total Price (Supports MAD, DH, DHS, dhs)
            let total = 0;
            const priceRegex = /([0-9]+[.,]?[0-9]*)\s*(MAD|DH|DHS)/gi;
            let match;
            while ((match = priceRegex.exec(fullText)) !== null) {
                let parsed = parseFloat(match[1].replace(',', '.'));
                if (!isNaN(parsed)) total = parsed;
            }

            // Fallback for Glovo's new format without MAD/DH
            if (total === 0 || isNaN(total)) {
                const fallbackRegex = /(?:total|payer)[^\d]*([0-9]+[.,][0-9]{2})/i;
                const fallbackMatch = fullText.match(fallbackRegex);
                if (fallbackMatch) {
                    let parsed = parseFloat(fallbackMatch[1].replace(',', '.'));
                    if (!isNaN(parsed)) total = parsed;
                }
            }

            // Extract Payment Method (Cash vs Card)
            let paymentMethod = 'card';
            const cashMatch = fullText.match(/(\d+(?:[.,]\d+)?)\s*(cash|espèces?|espece)/i);
            if (cashMatch) {
                const cashValue = parseFloat(cashMatch[1].replace(',', '.'));
                if (!isNaN(cashValue) && cashValue > 0) {
                    paymentMethod = 'cash';
                    if (total === 0 || isNaN(total)) total = cashValue; // Use cash value as total fallback
                }
            } else if (fullText.match(/(cash|espèces?|espece)/i)) {
                paymentMethod = 'cash'; // Fallback if it just says 'espece' without the amount next to it
            }

            const newOrder = {
                source: 'glovo',
                status: 'preparing',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                orderNumber: orderNumber,
                total: total,
                paymentMethod: paymentMethod,
                parsedGlovo: true,
                items: finalItems,
                customerName: 'Client Glovo',
                phone: payload.title || '',
                orderNote: payload.text || '',
                nearestBranch: { id: payload.branchId || 'laymoune' }
            };

            await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('orders').add(newOrder);
            res.status(200).send({ success: true, message: 'MacroDroid Order injected' });
            return;
        }

        // === CAS 2: Format OFFICIEL GLOVO API ===
        const glovoOrder = payload;
        if (!glovoOrder || !glovoOrder.order_id) {
            res.status(400).send('Bad Request');
            return;
        }

        const GLOVO_STORES_MAP = {
            "370282": { id: "laymoune", name: "Laymoune" },
            "249094": { id: "oum_rabii", name: "Oum Rabii" },
            "962002": { id: "laymoune", name: "Glovo Test" }
        };

        const glovoStoreId = glovoOrder.store_id ? glovoOrder.store_id.toString() : "";
        const assignedBranch = GLOVO_STORES_MAP[glovoStoreId] || { id: "laymoune", name: "Laymoune" };

        const newOrder = {
            userId: "glovo",
            glovoOrderId: glovoOrder.order_id,
            orderNumber: glovoOrder.pick_up_code || glovoOrder.order_code || glovoOrder.order_id.toString(),
            customerName: glovoOrder.customer?.name || "Client Glovo",
            phone: glovoOrder.customer?.phone_number || "GLOVO",
            address: glovoOrder.delivery_address?.label || "Commande Glovo",
            nearestBranch: assignedBranch,
            source: "glovo",
            orderType: "a_emporter",
            paymentMethod: glovoOrder.payment_method === 'CASH' ? 'espece' : 'glovo',
            status: "preparing",
            needsAutomatorExtraction: true,
            total: glovoOrder.estimated_total_price / 100, 
            subtotal: glovoOrder.estimated_total_price / 100,
            deliveryFee: 0,
            glovoStoreId: glovoStoreId,
            items: (glovoOrder.products || []).flatMap(p => {
                let selectedSans = [];
                let selectedExtras = [];
                let standaloneItems = [];
                
                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        let lowerName = attr.name.toLowerCase();
                        
                        const translateGlovoOption = (text) => {
                            let lower = text.toLowerCase();
                            if (lower.includes('tomate')) return 'مطيشة 🍅';
                            if (lower.includes('oignon')) return 'بصل 🧅';
                            if (lower.includes('olive')) return 'زيتون 🫒';
                            if (lower.includes('laitue') || lower.includes('salade')) return 'خس 🥬';
                            if (lower.includes('carotte')) return 'خيزو 🥕';
                            if (lower.includes('purée') || lower.includes('pomme') || lower.includes('frite')) return 'فريت 🍟';
                            if (lower.includes('mayonnaise') || lower.includes('mayo')) return 'مايونيز 🥚';
                            if (lower.includes('harissa') || lower.includes('hrissa')) return 'هريسة 🌶️';
                            if (lower.includes('ketchup')) return 'كيتشوب 🍅';
                            if (lower.includes('sauce')) return 'صوص 🥣';
                            if (lower.includes('fromage')) return 'الجبن 🧀';
                            if (lower.includes('viande') || lower.includes('hachée')) return 'اللحم المفروم 🥩';
                            if (lower.includes('poulet')) return 'الدجاج 🍗';
                            if (lower.includes('oeuf') || lower.includes('œuf')) return 'البيض 🍳';
                            if (lower.includes('thon')) return 'الطون 🐟';
                            if (lower.includes('charcuterie')) return '🥓 الكاشير';
                            if (lower.includes('saucisse')) return '🌭 الصوصيص';
                            return text;
                        };

                        if (lowerName.includes('sans')) {
                            const rawSans = attr.name.replace(/sans/i, '').trim();
                            selectedSans.push(translateGlovoOption(rawSans));
                        } else {
                            let rawExtra = attr.name.replace(/extra/i, '').replace(/ajout/i, '').trim();
                            if (!rawExtra) rawExtra = attr.name.trim();
                            
                            if (
                                lowerName.includes('pepsi') || 
                                lowerName.includes('mirinda') || lowerName.includes('meranda') || lowerName.includes('meranda') || 
                                lowerName.includes('coca') || 
                                lowerName.includes('7up') || 
                                lowerName.includes('hawai') || 
                                lowerName.includes('poms') || 
                                lowerName.includes('boisson') ||
                                lowerName.includes('eau') ||
                                lowerName.includes('sprite') ||
                                lowerName.includes('schweppes') ||
                                lowerName.includes('fanta') ||
                                lowerName.includes('ice tea')
                            ) {
                                standaloneItems.push({
                                    id: 'glovo_drink_' + Math.random().toString(36).substr(2, 9),
                                    name: translateGlovoOption(rawExtra),
                                    qty: p.quantity || 1,
                                    price: (attr.price || 0) / 100,
                                    selectedSans: [],
                                    selectedExtras: []
                                });
                            } else {
                                selectedExtras.push({ name: translateGlovoOption(rawExtra), price: (attr.price || 0) / 100 });
                            }
                        }
                    });
                }

                let mainItem = {
                    id: p.id,
                    name: p.name,
                    qty: p.quantity,
                    price: p.price / 100,
                    selectedSans: selectedSans,
                    selectedExtras: selectedExtras
                };

                return [mainItem, ...standaloneItems];
            }),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("artifacts").doc(appId)
                .collection("public").doc("data")
                .collection("orders").doc(glovoOrder.order_id.toString())
                .set(newOrder);

        res.status(200).send('OK');
    } catch (error) {
        console.error("Erreur Webhook Glovo:", error);
        res.status(500).send('Internal Server Error');
    }
});

// 11. Informer Glovo mli l-restaurant y-accepter awla y-wjed l-commande
exports.syncStatusToGlovo = functions.firestore
    .document('artifacts/{appId}/public/data/orders/{orderId}')
    .onWrite(async (change, context) => {
        const newData = change.after.exists ? change.after.data() : null;
        const oldData = change.before.exists ? change.before.data() : null;

        // Vérifier wach l-commande dyal Glovo w wach l-Statut tbeddel
        if (!newData || newData.source !== 'glovo') return null;
        if (oldData && newData.status === oldData.status) return null;

        const glovoOrderId = context.params.orderId;
        let glovoStatus = "";

        // 1 = Mli la Caisse t-accepter -> "ACCEPTED"
        if (newData.status === 'preparing') glovoStatus = "ACCEPTED";
        // 2 = Mli l-Cuisine t-wjed -> "READY_FOR_PICKUP"
        else if (newData.status === 'ready') glovoStatus = "READY_FOR_PICKUP";
        else return null;

        // N3rfo l-Store ID dyal l-Agence li daret l-Action
        const storeIdMap = {
            "laymoune": "370282",
            "oum_rabii": "249396"
        };
        const branchId = newData.nearestBranch?.id || "laymoune";
        const glovoStoreId = newData.glovoStoreId || storeIdMap[branchId];

        // ⚠️ HAD L-TOKEN GHADI Y3TIH LIK L-ACCOUNT MANAGER DYAL GLOVO
        const GLOVO_API_TOKEN = "76a633d6-08e1-423f-813d-008b77df13b5";

        if (glovoStatus && glovoStoreId) {
            try {
                const response = await fetch(`https://api.glovoapp.com/webhook/stores/${glovoStoreId}/orders/${glovoOrderId}/status`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `Basic ${Buffer.from(GLOVO_API_TOKEN).toString('base64')}`,
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ status: glovoStatus })
                });
            } catch (error) {
                console.error("Erreur de synchronisation avec Glovo:", error);
            }
        }
        return null;
    });

// 12. Extraction des données d'un reçu/facture via l'IA (OCR - Gemini / Vision)
exports.scanReceiptWithAI = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    
    const { imageBase64, mimeType } = data;
    if (!imageBase64) {
        throw new functions.https.HttpsError('invalid-argument', 'Image is required');
    }

    try {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        
        // ⚠️ HNA 7ET L-API KEY DYALEK DIRECTEMENT (L-cle khass ybda b AIzaSy...)
        const apiKey = process.env.GEMINI_API_KEY || ""; 
        
        if (!apiKey || apiKey === "VOTRE_API_KEY_GEMINI_ICI") {
            return { success: false, error: "Khassk t-modifier l-fichier functions/index.js w t7et l-API key dyalek s7i7a." };
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        // Mss7o l-header dyal base64 image (data:image/jpeg;base64,...)
        const base64Data = imageBase64.split(',')[1] || imageBase64;

        const prompt = `Tu es un assistant comptable pour un restaurant au Maroc.
Analyse cette facture ou ce bon d'achat et extrais les produits.
Renvoie UNIQUEMENT un objet JSON valide avec cette structure stricte (pas de markdown, pas de texte autour) :
{
  "fournisseur": "Nom du fournisseur, supermarché ou magasin (ou Inconnu)",
  "items": [
    { "name": "Nom produit", "qty": nombre, "price": prix unitaire, "total": total pour le produit }
  ],
  "total": total général de la facture
}`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" } }
        ]);

        const responseText = result.response.text();
        
        // Nn9iw r-reponse mn markdown (```json ... ```)
        let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Format JSON non trouvé dans la réponse de l'IA");
        
        const parsedData = JSON.parse(jsonMatch[0]);
        
        return { success: true, ...parsedData };

    } catch (error) {
        console.error("Erreur OCR AI:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// 13. Process orders sent by GoDroid Automator APK
async function handleGoDroidOrder(snap, context, branchId) {
        const rawData = snap.data();
        const appId = context.params.appId;
        
        if (!rawData || !rawData.raw_text) {
            console.log("No valid raw_text found in the document");
            return null;
        }

        try {
            const rawTextString = typeof rawData.raw_text === 'object' ? rawData.raw_text.stringValue : String(rawData.raw_text);
            const parsed = JSON.parse(rawTextString);
            
            const configSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("config").get();
            const config = configSnap.exists ? configSnap.data() : {};
            const menuItems = (config.menuItems || []).sort((a, b) => (b.name || '').length - (a.name || '').length);
            
            let validOptionsMap = [];
            const addOption = (opt) => {
                if (opt && opt.trim().length > 2) {
                    validOptionsMap.push({ original: opt.trim(), lower: opt.trim().toLowerCase() });
                }
            };
            
            (config.globalIngredients || []).forEach(addOption);
            (config.globalChoices || []).forEach(addOption);
            (config.globalExtras || []).forEach(e => addOption(e.name));
            (config.globalDrinks || []).forEach(d => addOption(d.name));
            
            menuItems.forEach(item => {
                if (item.removableIngredients) item.removableIngredients.split(',').forEach(addOption);
                if (item.choices) item.choices.split(',').forEach(addOption);
                if (item.variations) item.variations.forEach(v => addOption(v.name));
                if (item.extras) item.extras.forEach(e => addOption(e.name));
            });

            const formatPOSNote = (note) => {
                const originalNote = note.trim();
                const lowerNote = originalNote.toLowerCase();
                
                if (lowerNote.startsWith('**')) return originalNote; // Keep custom notes
                if (lowerNote.startsWith('note:') || lowerNote.startsWith('remarque:')) return `** ${originalNote} **`; // Explicit client notes
                
                let prefix = "";
                let contentToMatch = lowerNote;
                const qtyMatch = lowerNote.match(/^([0-9]+\s*x\s+)(.*)/i);
                let isQty = false;
                
                if (qtyMatch) {
                    prefix = originalNote.substring(0, qtyMatch[1].length);
                    contentToMatch = qtyMatch[2].trim();
                    isQty = true;
                }

                for (let optObj of validOptionsMap) {
                    if (contentToMatch.includes(optObj.lower) || optObj.lower.includes(contentToMatch)) {
                        return isQty ? prefix + optObj.original : optObj.original;
                    }
                }
                
                if (isQty) return originalNote; // Keep Glovo options
                return `** NOTE: ${originalNote} **`; // Keep custom client notes
            };
            
            const parsedItems = [];
            let currentItemIndex = -1;
            let cleanNotes = [];
            let pendingNotes = [];

            // Split merged notes (e.g., '1x "Extra" Frites Sansfromage' -> ['1x "Extra" Frites', 'Sansfromage'])
            const expandedItems = (parsed.items || []).flatMap(itemLine => {
                return itemLine.split(/(?<=[a-wy-zA-WY-Zéèàê]\s*)(?=\b(?:Sans|Extra|Ajout|sans|extra|ajout))/).map(s => s.trim()).filter(s => s);
            });

            for (let itemLine of expandedItems) {
                let text = itemLine.replace(/\s*--\s*$/, '').trim();
                let lower = text.toLowerCase();
                
                if (!text || /^[0-9.,]+$/.test(text)) continue;
                
                // CLEANUP: If the line starts with a quantity but ends with garbage like "Sous-total", "TVA (incl.)", remove the garbage.
                const startsWithQty = /^\d+\s*[xX]\s+/.test(text);
                if (startsWithQty) {
                    text = text.replace(/(?:\s+sous-total|\s+sous-|\s+tva\s*\(incl\.\)|\s+tva|\s+total|\s+le\s+coursier\s+doit\s+payer).*$/i, '').trim();
                    lower = text.toLowerCase();
                } else {
                    // --- ROBUST GLOVO UI FILTERING ---
                    if (lower === 'aucune commande acceptée' || lower === 'aucun' || lower === 'aucune') continue;
                    if (lower.startsWith('#')) continue;
                    if (lower.includes('fermé') || lower.includes('horaires') || lower.includes('imprimer')) continue;
                    if (lower.includes('modifier') || lower.includes('nouvelle') || lower.includes('test restaurant')) continue;
                    if (lower.includes('produit xxxx') || lower.includes('xxxx-') || lower.includes('1 produit')) continue;
                    if (lower.includes('commande test') || lower.includes('accepter la commande')) continue;
                    if (lower.includes('sous-total') || lower.includes('tva') || lower === 'total' || lower.includes('à venir')) continue;
                    if (lower.includes('carte de crédit') || lower === 'cash' || lower === 'espece' || lower === 'glovo') continue;
                    if (lower.includes('test est proche') || lower.includes('prêt pour la livraison')) continue;
                    if (lower.includes('commandes groupées') || lower.includes('collectées ensemble')) continue;
                    if (lower.includes('min ') || lower.endsWith('min') || lower.includes('mins')) continue;
                    // ----------------------------------
                }
                // ----------------------------------

                const itemMatch = text.match(/^(\d+)\s*[xX]\s+(.+)$/i);
                const isNoteModifier = lower.includes('sans') || lower.includes('extra') || lower.includes('ajout');
                const isKnownOption = itemMatch && validOptionsMap.some(opt => lower.includes(opt.lower));
                
                if (itemMatch && !lower.startsWith('0 x ') && !isNoteModifier && !(isKnownOption && currentItemIndex !== -1)) {
                    const qty = parseInt(itemMatch[1]);
                    let rawName = itemMatch[2].trim();
                    const lowerName = rawName.toLowerCase();
                    const ignoreList = ['mins', 'min', 'produit', 'produits', 'grande', 'moyenne', 'petite', 'tva', 'total', 'sous-total'];
                    
                    if (ignoreList.includes(lowerName)) continue;

                    const normalizeStr = (str) => {
                        return str.toLowerCase()
                                  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                  .replace(/œ/g, "oe")
                                  .replace(/æ/g, "ae");
                    };
                    const normLower = normalizeStr(lowerName);

                    const matchedMenu = menuItems.find(m => normalizeStr(m.name).replace(/[^a-z0-9]/g, '') === normLower.replace(/[^a-z0-9]/g, '')) 
                                     || menuItems.find(m => m.name.length >= 3 && normLower.includes(normalizeStr(m.name)) && (m.name.length >= normLower.length * 0.5))
                                     || menuItems.find(m => normLower.length >= 8 && normalizeStr(m.name).includes(normLower));

                    if (matchedMenu) {
                        parsedItems.push({
                            name: matchedMenu.name,
                            qty: qty,
                            price: matchedMenu.price || 0,
                            category: matchedMenu.category || 'Divers',
                            station: matchedMenu.station || 'CHAUD',
                            sans: []
                        });
                        currentItemIndex = parsedItems.length - 1;
                    } else {
                        parsedItems.push({
                            name: rawName,
                            qty: qty,
                            price: 0,
                            category: 'Divers',
                            station: 'CHAUD',
                            sans: []
                        });
                        currentItemIndex = parsedItems.length - 1;
                    }

                    // Pour pending notes into the newly created item
                    if (pendingNotes.length > 0) {
                        parsedItems[currentItemIndex].sans.push(...pendingNotes);
                        pendingNotes = [];
                    }
                } else {
                    let theNoteToPush = text;
                    if (lower.startsWith('acceptée')) {
                        let noteIndex = text.indexOf('**');
                        if (noteIndex !== -1) {
                            theNoteToPush = text.substring(noteIndex).trim().replace(/\s+x\s+[a-zA-Z0-9_éèàê\s-]+$/i, '').trim();
                        } else {
                            theNoteToPush = "";
                        }
                    }

                    let formattedNote = formatPOSNote(theNoteToPush);
                    console.log(`[DEBUG] Note analysis: raw="${theNoteToPush}", formatted="${formattedNote}"`);
                    if (formattedNote) {
                        const isCustomNote = formattedNote.startsWith('**');
                        
                        if (currentItemIndex !== -1 && !isCustomNote) {
                            let existingIdx = -1;
                            let baseNoteToFind = formattedNote;
                            let newQty = 1;
                            const qtyMatch = formattedNote.match(/^([0-9]+)\s*[xX]\s*(.*)/i);
                            if (qtyMatch) {
                                newQty = parseInt(qtyMatch[1]);
                                baseNoteToFind = qtyMatch[2].trim();
                            }
                            
                            for (let i = 0; i < parsedItems[currentItemIndex].sans.length; i++) {
                                const existNote = parsedItems[currentItemIndex].sans[i];
                                const exMatch = existNote.match(/^([0-9]+)\s*[xX]\s*(.*)/i);
                                let exQty = 1;
                                let exBase = existNote;
                                if (exMatch) {
                                    exQty = parseInt(exMatch[1]);
                                    exBase = exMatch[2].trim();
                                }
                                if (exBase.toLowerCase() === baseNoteToFind.toLowerCase()) {
                                    existingIdx = i;
                                    newQty += exQty;
                                    break;
                                }
                            }
                            
                            if (existingIdx !== -1) {
                                parsedItems[currentItemIndex].sans[existingIdx] = `${newQty}x ${baseNoteToFind}`;
                            } else {
                                parsedItems[currentItemIndex].sans.push(formattedNote);
                            }
                        } else {
                            // Either no current item yet, OR it's a global custom note (bypasses items)
                            if (!cleanNotes.includes(formattedNote)) {
                                cleanNotes.push(formattedNote);
                            }
                        }
                    }
                }
            }
            console.log(`[DEBUG] parsedItems BEFORE processing KDS notes: ${JSON.stringify(parsedItems)}`);

            const brandSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("brand").get();
            const brand = brandSnap.exists ? brandSnap.data() : {};
            const enableArabicKDS = brand.enableArabicKDS === true;

            const translateToArabic = (text) => {
                if (text.trim().startsWith('**')) return text; // Bypass translation for custom notes!
                let lower = text.toLowerCase();
                const isExtra = lower.includes('extra') || lower.includes('ajout');
                
                let qtySuffix = "";
                let qtyMatch = text.match(/^([0-9]+)\s*[xX]\s*/i);
                if (qtyMatch) {
                    qtySuffix = " X" + qtyMatch[1]; // e.g. " X1"
                }
                
                let cleanText = text.replace(/^([0-9]+)\s*[xX]\s*/i, '');

                if (isExtra) {
                    if (lower.includes('fromage')) return '🧀 إكسترا فرماج' + qtySuffix;
                    if (lower.includes('frite')) return '🍟 إكسترا فريت' + qtySuffix;
                    if (lower.includes('viande') || lower.includes('hachée')) return '🥩 إكسترا لحم مفروم' + qtySuffix;
                    if (lower.includes('poulet')) return '🍗 إكسترا دجاج' + qtySuffix;
                    if (lower.includes('oeuf') || lower.includes('œuf')) return '🍳 إكسترا بيض' + qtySuffix;
                    if (lower.includes('thon')) return '🐟 إكسترا طون' + qtySuffix;
                    if (lower.includes('charcuterie')) return '🥓 إكسترا كاشير' + qtySuffix;
                    if (lower.includes('saucisse')) return '🌭 إكسترا صوصيص' + qtySuffix;
                    
                    // Fallback for other extras
                    return 'إكسترا ' + cleanText + qtySuffix;
                }

                if (lower.includes('tomate')) return '🍅 بلا مطيشة';
                if (lower.includes('oignon')) return '🧅 بلا بصلة';
                if (lower.includes('olive')) return '🟢 بلا زيتون';
                if (lower.includes('laitue') || lower.includes('salade')) return '🥗 بلا خس';
                if (lower.includes('carotte')) return '🥕 بلا خيزو';
                if (lower.includes('purée') || lower.includes('pomme') || lower.includes('frite')) return '🥔 بلا بطاطا';
                if (lower.includes('mayonnaise') || lower.includes('mayo')) return '🥣 بلا مايونيز';
                if (lower.includes('harissa') || lower.includes('hrissa')) return '🌶️ بلا هريسة';
                if (lower.includes('ketchup')) return '🍅 بلا كيتشوب';
                if (lower.includes('sauce')) return '🥣 بلا صوص';
                if (lower.includes('fromage')) return '🧀 بلا فرماج';

                return cleanText;
            };

            // Finally, format item names with their attached notes/options so the KDS renders them
            // The POS KitchenDashboard uses item.name.split(' (Sans ') to extract options
            console.log(`enableArabicKDS flag is: ${enableArabicKDS}`);
            for (let item of parsedItems) {
                if (item.sans && item.sans.length > 0) {
                    console.log(`Item before translation: ${JSON.stringify(item.sans)}`);
                    if (enableArabicKDS) {
                        item.sans = item.sans.map(translateToArabic);
                    }
                    console.log(`Item after translation: ${JSON.stringify(item.sans)}`);
                    item.name = item.name + ' (Sans ' + item.sans.join(', ') + ')';
                }
            }

            const finalNotes = cleanNotes.join("\n");
            
            const total = parsed.total || 0;
            const paymentMethod = parsed.paymentMethod && parsed.paymentMethod.toUpperCase() === 'CASH' ? 'espece' : 'glovo';
            
            const orderNumber = parsed.orderId.replace('#', '') || 'GLOVO';

            let phone = 'GLOVO';
            let customerName = 'Client Glovo';
            
            const rawPhoneText = (rawData.phone_text && rawData.phone_text.stringValue) ? rawData.phone_text.stringValue : (rawData.phone_text || '');
            if (rawPhoneText) {
                let phoneLines = String(rawPhoneText).split('\n').map(l => l.trim()).filter(l => l.length > 0);
                let phoneIndex = phoneLines.findIndex(l => l.replace(/[\s\-]/g, '').match(/^(\+?\d{9,15})$/));
                
                if (phoneIndex !== -1) {
                    phone = phoneLines[phoneIndex].replace(/[\s\-]/g, '').match(/(\+?\d{9,15})/)[1];
                    if (phoneIndex > 0) {
                        customerName = phoneLines[phoneIndex - 1];
                    }
                } else {
                    const cleanText = String(rawPhoneText).replace(/[\s\-]/g, '');
                    let phoneMatch = cleanText.match(/(\+?\d{9,15})/);
                    if (phoneMatch) {
                        phone = phoneMatch[1].trim();
                    }
                }
            }
            
            let cleanPhone = phone;
            if (cleanPhone && cleanPhone !== "Inconnu" && cleanPhone !== "GLOVO") {
                cleanPhone = cleanPhone.replace(/\s/g, '').replace(/^\+212/, '0');
            }

            // Check for duplicates (same orderNumber today)
            // If duplicate found, check if we need to update the phone number
            if (orderNumber !== 'GLOVO' && orderNumber !== '00') {
                const existingQuery = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('orders')
                    .where('source', '==', 'glovo')
                    .where('orderNumber', '==', orderNumber)
                    .get();

                const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
                let existingDocRef = null;
                existingQuery.forEach(doc => {
                    const data = doc.data();
                    if (data.createdAt && data.createdAt.toDate().getTime() > twelveHoursAgo) {
                        existingDocRef = doc.ref;
                    }
                });

                if (existingDocRef) {
                    if (cleanPhone && cleanPhone !== "GLOVO") {
                        if (!config.glovoConfig?.disableAutomatorOrderCreation) {
                            console.log(`Order ${orderNumber} already exists. Updating phone number to ${cleanPhone}`);
                            await existingDocRef.update({
                                phone: cleanPhone,
                                customerName: customerName
                            });
                            await snap.ref.update({ processed: true, note: 'duplicate_phone_updated' });
                        } else {
                            console.log(`Order ${orderNumber} already exists. Automator order creation is disabled, so NOT updating phone on order.`);
                            await snap.ref.update({ processed: true, note: 'duplicate_ignored_disabled' });
                        }
                    } else {
                        console.log(`Order ${orderNumber} already exists today. Ignoring duplicate scrape.`);
                        await snap.ref.update({ processed: true, duplicate: true });
                    }
                    
                    // MUST SAVE CLIENT HERE TOO!
                    if (cleanPhone && cleanPhone !== "Inconnu" && cleanPhone !== "GLOVO") {
                        const clientRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('clients').doc(cleanPhone);
                        await clientRef.set({
                            phone: cleanPhone,
                            name: customerName,
                            source: "glovo",
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            blocked: false,
                            isDriver: false
                        }, { merge: true });
                    }
                    
                    return null;
                }
            }

            const newOrder = {
                source: 'glovo',
                status: 'preparing',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                orderNumber: parsed.orderId.replace('#', '') || 'GLOVO',
                total: total,
                paymentMethod: paymentMethod,
                parsedGlovo: true,
                items: parsedItems.length > 0 ? parsedItems : [{ name: 'COMMANDE GLOVO (Extraction)', qty: 1, price: 0 }],
                customerName: customerName,
                phone: cleanPhone || 'GLOVO',
                orderNote: finalNotes || '',
                nearestBranch: { id: branchId }
            };

            if (!config.glovoConfig?.disableAutomatorOrderCreation) {
                await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('orders').add(newOrder);
            } else {
                console.log(`Automator order creation is disabled for order ${orderNumber}. Skipping creation.`);
            }
            
            // Save Client Document so they appear in IDARA
            if (cleanPhone && cleanPhone !== "Inconnu" && cleanPhone !== "GLOVO") {
                const clientRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('clients').doc(cleanPhone);
                await clientRef.set({
                    phone: cleanPhone,
                    name: customerName,
                    source: "glovo",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    blocked: false,
                    isDriver: false
                }, { merge: true });
            }
            
            // Mark the raw doc as processed
            await snap.ref.update({ processed: true });
            
            return null;
        } catch (error) {
            console.error("Error processing GoDroid JSON:", error);
            return null;
        }
}

exports.processGoDroidAutomatorOrders = functions.firestore
    .document('artifacts/{appId}/public/data/Commandes_Brutes_Glovo/{docId}')
    .onCreate((snap, context) => handleGoDroidOrder(snap, context, 'laymoune'));

exports.processGoDroidAutomatorOrders_OumRabii = functions.firestore
    .document('artifacts/{appId}/public/data/Commandes_Brutes_Glovo_OumRabii/{docId}')
    .onCreate((snap, context) => handleGoDroidOrder(snap, context, 'oum_rabii'));

exports.processGoDroidAutomatorOrders_Zoubire = functions.firestore
    .document('artifacts/{appId}/public/data/Commandes_Brutes_Glovo_Zoubire/{docId}')
    .onCreate((snap, context) => handleGoDroidOrder(snap, context, 'zoubire'));

// ==========================================
// GLOVO API WEBHOOKS (OFFICIAL INTEGRATION)
// ==========================================

exports.glovoWebhookOrderDispatch = functions.https.onRequest(async (req, res) => {
    try {
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
        console.log("Glovo Order Dispatch Received:", JSON.stringify(payload));
        
        const appId = "mon-bocadillo-menu";
        const glovoOrder = payload;
        if (!glovoOrder || !glovoOrder.order_id) {
            res.status(400).send('Bad Request');
            return;
        }

        const GLOVO_STORES_MAP = {
            "370282": { id: "laymoune", name: "Laymoune" },
            "249094": { id: "oum_rabii", name: "Oum Rabii" }
        };

        const glovoStoreId = glovoOrder.store_id ? glovoOrder.store_id.toString() : "";
        const assignedBranch = GLOVO_STORES_MAP[glovoStoreId] || { id: "laymoune", name: "Laymoune" };

        const newOrder = {
            userId: "glovo",
            glovoOrderId: glovoOrder.order_id,
            orderNumber: glovoOrder.pick_up_code || glovoOrder.order_code || glovoOrder.order_id.toString(),
            customerName: glovoOrder.customer?.name || "Client Glovo",
            phone: glovoOrder.customer?.phone_number || "GLOVO",
            address: glovoOrder.delivery_address?.label || "Commande Glovo",
            nearestBranch: assignedBranch,
            source: "glovo",
            orderType: "a_emporter",
            paymentMethod: glovoOrder.payment_method === 'CASH' ? 'espece' : 'glovo',
            status: "preparing",
            needsAutomatorExtraction: true,
            total: glovoOrder.estimated_total_price / 100, 
            subtotal: glovoOrder.estimated_total_price / 100,
            deliveryFee: 0,
            items: (glovoOrder.products || []).flatMap(p => {
                let selectedSans = [];
                let selectedExtras = [];
                let standaloneItems = [];
                
                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        let lowerName = attr.name.toLowerCase();
                        
                        const translateGlovoOption = (text) => {
                            let lower = text.toLowerCase();
                            if (lower.includes('tomate')) return 'مطيشة 🍅';
                            if (lower.includes('oignon')) return 'بصل 🧅';
                            if (lower.includes('olive')) return 'زيتون 🫒';
                            if (lower.includes('laitue') || lower.includes('salade')) return 'خس 🥬';
                            if (lower.includes('carotte')) return 'خيزو 🥕';
                            if (lower.includes('purée') || lower.includes('pomme') || lower.includes('frite')) return 'فريت 🍟';
                            if (lower.includes('mayonnaise') || lower.includes('mayo')) return 'مايونيز 🥚';
                            if (lower.includes('harissa') || lower.includes('hrissa')) return 'هريسة 🌶️';
                            if (lower.includes('ketchup')) return 'كيتشوب 🍅';
                            if (lower.includes('sauce')) return 'صوص 🥣';
                            if (lower.includes('fromage')) return 'الجبن 🧀';
                            if (lower.includes('viande') || lower.includes('hachée')) return 'اللحم المفروم 🥩';
                            if (lower.includes('poulet')) return 'الدجاج 🍗';
                            if (lower.includes('oeuf') || lower.includes('œuf')) return 'البيض 🍳';
                            if (lower.includes('thon')) return 'الطون 🐟';
                            if (lower.includes('charcuterie')) return '🥓 الكاشير';
                            if (lower.includes('saucisse')) return '🌭 الصوصيص';
                            return text;
                        };

                        if (lowerName.includes('sans')) {
                            const rawSans = attr.name.replace(/sans/i, '').trim();
                            selectedSans.push(translateGlovoOption(rawSans));
                        } else {
                            let rawExtra = attr.name.replace(/extra/i, '').replace(/ajout/i, '').trim();
                            if (!rawExtra) rawExtra = attr.name.trim();
                            
                            if (
                                lowerName.includes('pepsi') || 
                                lowerName.includes('mirinda') || lowerName.includes('meranda') || lowerName.includes('meranda') || 
                                lowerName.includes('coca') || 
                                lowerName.includes('7up') || 
                                lowerName.includes('hawai') || 
                                lowerName.includes('poms') || 
                                lowerName.includes('boisson') ||
                                lowerName.includes('eau') ||
                                lowerName.includes('sprite') ||
                                lowerName.includes('schweppes') ||
                                lowerName.includes('fanta') ||
                                lowerName.includes('ice tea')
                            ) {
                                standaloneItems.push({
                                    id: 'glovo_drink_' + Math.random().toString(36).substr(2, 9),
                                    name: translateGlovoOption(rawExtra),
                                    qty: p.quantity || 1,
                                    price: (attr.price || 0) / 100,
                                    selectedSans: [],
                                    selectedExtras: []
                                });
                            } else {
                                selectedExtras.push({ name: translateGlovoOption(rawExtra), price: (attr.price || 0) / 100 });
                            }
                        }
                    });
                }

                let mainItem = {
                    id: p.id,
                    name: p.name,
                    qty: p.quantity,
                    price: p.price / 100,
                    selectedSans: selectedSans,
                    selectedExtras: selectedExtras
                };

                return [mainItem, ...standaloneItems];
            }),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("artifacts").doc(appId)
                .collection("public").doc("data")
                .collection("orders").doc(glovoOrder.order_id.toString())
                .set(newOrder);

        res.status(200).send("OK");
    } catch (e) {
        console.error("Glovo Dispatch Error", e);
        res.status(500).send("Error");
    }
});

exports.glovoWebhookOrderCancel = functions.https.onRequest(async (req, res) => {
    try {
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
        console.log("Glovo Order Cancel Received:", JSON.stringify(payload));
        const appId = "mon-bocadillo-menu";
        
        if (payload && payload.order_id) {
            await db.collection("artifacts").doc(appId)
                .collection("public").doc("data")
                .collection("orders").doc(payload.order_id.toString())
                .update({ status: 'cancelled' });
        }
        res.status(200).send("OK");
    } catch (e) {
        console.error("Glovo Cancel Error", e);
        res.status(500).send("Error");
    }
});

exports.glovoWebhookCustomerPickup = functions.https.onRequest(async (req, res) => {
    try {
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
        console.log("Glovo Customer Pickup Received:", JSON.stringify(payload));
        const appId = "mon-bocadillo-menu";
        
        if (payload && payload.order_id) {
            await db.collection("artifacts").doc(appId)
                .collection("public").doc("data")
                .collection("orders").doc(payload.order_id.toString())
                .update({ status: 'delivered', deliveredAtLocal: Date.now() });
        }
        res.status(200).send("OK");
    } catch (e) {
        console.error("Glovo Pickup Error", e);
        res.status(500).send("Error");
    }
});
