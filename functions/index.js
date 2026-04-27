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
                if ((profile.isAdmin || profile.isManager) && profile.fcmToken) {
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

