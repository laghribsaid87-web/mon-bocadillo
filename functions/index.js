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
                const driversSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("drivers")
                    .where('isAvailable', '==', true).get();
                
                const tokens = [];
                driversSnap.forEach(doc => { if (doc.data().fcmToken) tokens.push(doc.data().fcmToken); });

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

// 10. Webhook API Glovo (Pour recevoir les commandes en temps réel)
exports.glovoWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const glovoOrder = req.body;
        
        if (!glovoOrder || !glovoOrder.order_id) {
            res.status(400).send('Bad Request');
            return;
        }

        const appId = "mon-bocadillo-menu";

        // 🔥 MAPPING DES AGENCES (Glovo Store ID -> Mon Bocadillo Branch)
        const GLOVO_STORES_MAP = {
            "370282": { id: "laymoune", name: "Laymoune" },
            "249396": { id: "oum_rabii", name: "Oum Rabii" }
        };

        const glovoStoreId = glovoOrder.store_id ? glovoOrder.store_id.toString() : "";
        const assignedBranch = GLOVO_STORES_MAP[glovoStoreId] || { id: "laymoune", name: "Laymoune" };

        const newOrder = {
            userId: "glovo",
            orderNumber: glovoOrder.order_code || glovoOrder.order_id.toString().slice(-4),
            customerName: glovoOrder.customer?.name || "Client Glovo",
            phone: glovoOrder.customer?.phone_number || "GLOVO",
            address: glovoOrder.delivery_address?.label || "Commande Glovo",
            nearestBranch: assignedBranch,
            source: "glovo",
            orderType: "a_emporter",
            // 🔥 Hada howa s-ster li beddelna bach yferrez l-Espèce 3la l-Prépayé
            paymentMethod: glovoOrder.payment_method === 'CASH' ? 'espece' : 'glovo',
            status: "pending", 
            total: glovoOrder.estimated_total_price / 100, 
            subtotal: glovoOrder.estimated_total_price / 100,
            deliveryFee: 0,
            items: (glovoOrder.products || []).map(p => {
                let selectedSans = [];
                let selectedExtras = [];
                
                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        if (attr.name.toLowerCase().includes('sans')) {
                            selectedSans.push(attr.name.replace(/sans/i, '').trim());
                        } else {
                            selectedExtras.push({ name: attr.name, price: (attr.price || 0) / 100 });
                        }
                    });
                }

                return {
                    id: p.id,
                    name: p.name,
                    qty: p.quantity,
                    price: p.price / 100,
                    selectedSans: selectedSans,
                    selectedExtras: selectedExtras
                };
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
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        // Vérifier wach l-commande dyal Glovo w wach l-Statut tbeddel
        if (newData.source !== 'glovo' || newData.status === oldData.status) return null;

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
        const glovoStoreId = storeIdMap[branchId];

        // ⚠️ HAD L-TOKEN GHADI Y3TIH LIK L-ACCOUNT MANAGER DYAL GLOVO
        const GLOVO_API_TOKEN = "VOTRE_TOKEN_API_GLOVO_ICI";

        if (glovoStatus && glovoStoreId) {
            try {
                const response = await fetch(`https://api.glovoapp.com/webhook/stores/${glovoStoreId}/orders/${glovoOrderId}/replace_status`, {
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
