// ==========================================
// GLOVO API WEBHOOKS (OFFICIAL INTEGRATION)
// ==========================================

exports.pushMenuToGlovo = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    
    const { appId, storeId } = data;
    if (!appId || !storeId) throw new functions.https.HttpsError('invalid-argument', 'Missing appId or storeId');

    try {
        const GLOVO_API_TOKEN = "76a633d6-08e1-423f-813d-008b77df13b5";
        const projectId = process.env.GCLOUD_PROJECT || "mon-bocadillo-menu";
        const menuUrl = `https://us-central1-${projectId}.cloudfunctions.net/glovoMenuDownload?appId=${appId}`;
        
        const response = await fetch(`https://api.glovoapp.com/webhook/stores/${storeId}/menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': GLOVO_API_TOKEN
            },
            body: JSON.stringify({ menuUrl })
        });
        
        const respData = await response.text();
        if (!response.ok) {
            console.error("Glovo Menu Sync Error:", respData);
            throw new Error(`Glovo API Error: ${response.status} - ${respData}`);
        }
        
        return { success: true, message: "Menu synchronisé avec succès." };
    } catch (error) {
        console.error("Failed to sync menu:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.glovoMenuDownload = functions.https.onRequest(async (req, res) => {
    try {
        const appId = req.query.appId || "mon-bocadillo-menu";
        
        const configSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("config").get();
        if (!configSnap.exists) {
            return res.status(404).send("Config not found");
        }
        
        const config = configSnap.data();
        const menuItems = config.menuItems || [];
        
        const GARNITURE_ATTRS = [
            { id: "sans_tomate", name: "Sans Tomate", price: 0, available: true },
            { id: "sans_oignon", name: "Sans Oignon", price: 0, available: true },
            { id: "sans_olive", name: "Sans Olive", price: 0, available: true },
            { id: "sans_laitue", name: "Sans Laitue", price: 0, available: true },
            { id: "sans_carotte", name: "Sans Carotte", price: 0, available: true },
            { id: "sans_pommes_de_terre", name: "Sans Pommes de Terre", price: 0, available: true },
            { id: "sans_mayo", name: "Sans Sauce Mayonnaise Maison", price: 0, available: true },
            { id: "sans_harissa", name: "Sans Harissa", price: 0, available: true }
        ];

        const EXTRA_ATTRS = [
            { id: "ext_frites", name: "\"Extra\" Frites", price: 700, available: true },
            { id: "ext_thon", name: "\"Extra\" Thon", price: 800, available: true },
            { id: "ext_charcuterie", name: "\"Extra\" Charcuterie", price: 400, available: true },
            { id: "ext_fromage", name: "\"Extra\" Fromage", price: 300, available: true },
            { id: "ext_oeuf", name: "\"Extra\" Œuf", price: 300, available: true }
        ];

        const BOISSON_ATTRS = [
            { id: "bs_pepsi", name: "PEPSI", price: 1000, available: true },
            { id: "bs_mirinda_orange", name: "Mirinda Orange", price: 1000, available: true },
            { id: "bs_mirinda_citron", name: "Mirinda Citron", price: 1000, available: true },
            { id: "bs_7up", name: "7UP", price: 1000, available: true },
            { id: "bs_mirinda_pomme", name: "Mirinda Pomme", price: 1000, available: true },
            { id: "bs_fanta", name: "Fanta Orange", price: 1000, available: true },
            { id: "bs_eau", name: "Eaux 50cl", price: 1000, available: true },
            { id: "bs_jus", name: "Jus d'orange", price: 2500, available: true }
        ];

        const ATTRIBUTE_GROUPS = [
            { id: "grp_garniture", name: "Choix de garniture", min: 0, max: 8, attributes: GARNITURE_ATTRS },
            { id: "grp_garniture_1er_bocadillo", name: "Choix de garniture - 1er bocadillo", min: 0, max: 8, attributes: GARNITURE_ATTRS },
            { id: "grp_garniture_2eme_bocadillo", name: "Choix de garniture - 2éme bocadillo", min: 0, max: 8, attributes: GARNITURE_ATTRS },
            { id: "grp_garniture_1er_sandwich", name: "Choix de garniture - 1er sandwich", min: 0, max: 8, attributes: GARNITURE_ATTRS },
            { id: "grp_garniture_2eme_sandwich", name: "Choix de garniture - 2éme sandwich", min: 0, max: 8, attributes: GARNITURE_ATTRS },
            { id: "grp_extra", name: "Souhaitez vous un Extra ?", min: 0, max: 5, attributes: EXTRA_ATTRS },
            { id: "grp_boisson", name: "Souhaitez-vous une boisson ?", min: 0, max: 7, attributes: BOISSON_ATTRS.slice(0, 7) },
            { id: "grp_boisson_choix", name: "Boisson au choix", min: 1, max: 1, attributes: BOISSON_ATTRS.slice(0, 5) }
        ];

        const sectionsMap = {};
        const products = [];
        
        menuItems.forEach((item) => {
            const cat = item.glovoCategory || item.category;
            if (!cat) return;
            if (!sectionsMap[cat]) {
                sectionsMap[cat] = {
                    name: cat,
                    position: Object.keys(sectionsMap).length,
                    products: []
                };
            }
            
            const itemNameLower = (item.glovoName || item.name || "").toLowerCase();
            let attrGroups = [];
            
            if (itemNameLower.includes("formule toi")) {
                attrGroups = ["grp_garniture_1er_bocadillo", "grp_garniture_2eme_bocadillo", "grp_boisson_choix"];
            } else if (itemNameLower.includes("formule gourmande")) {
                attrGroups = ["grp_garniture_1er_sandwich", "grp_garniture_2eme_sandwich", "grp_boisson_choix"];
            } else if (itemNameLower.includes("bocadillo") || itemNameLower.includes("sandwich") || itemNameLower.includes("burger")) {
                attrGroups = ["grp_garniture", "grp_extra", "grp_boisson"];
            }
            
            const glovoProduct = {
                id: item.id.toString(),
                name: item.glovoName || item.name,
                price: Math.round((parseFloat(item.glovoPrice || item.price) || 0) * 100),
                available: !item.outOfStock,
                description: item.glovoDesc || item.desc || item.name,
                image_url: null,
                attributes: attrGroups.map(id => ATTRIBUTE_GROUPS.find(g => g.id === id)).filter(Boolean)
            };
            
            products.push(glovoProduct);
            
            // Glovo schema expects an object with id inside the section's products array
            sectionsMap[cat].products.push({
                id: item.id.toString(),
                price: Math.round((parseFloat(item.glovoPrice || item.price) || 0) * 100),
                available: !item.outOfStock
            });
        });
        
        const glovoMenuPayload = {
            products: products,
            collections: [
                {
                    name: "Menu Mon Bocadillo",
                    position: 0,
                    sections: Object.values(sectionsMap)
                }
            ]
        };
        
        res.json(glovoMenuPayload);
    } catch (error) {
        console.error("Glovo menu download error:", error);
        res.status(500).send("Internal Server Error");
    }
});

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
            orderNumber: glovoOrder.order_code || glovoOrder.order_id.toString().slice(-4),
            customerName: glovoOrder.customer?.name || "Client Glovo",
            phone: glovoOrder.customer?.phone_number || "GLOVO",
            address: glovoOrder.delivery_address?.label || "Commande Glovo",
            nearestBranch: assignedBranch,
            source: "glovo_api",
            orderType: "a_emporter",
            paymentMethod: glovoOrder.payment_method === 'CASH' ? 'espece' : 'glovo',
            status: "pending", 
            total: glovoOrder.estimated_total_price / 100, 
            subtotal: glovoOrder.estimated_total_price / 100,
            deliveryFee: 0,
            glovoStoreId: glovoStoreId,
            glovoOrderId: glovoOrder.order_id,
            orderNote: [glovoOrder.allergy_info, glovoOrder.special_requirements].filter(Boolean).join(" - "),
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
                    purchased_product_id: p.purchased_product_id || p.id,
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

        res.status(200).send("OK");
    } catch (e) {
        console.error("Glovo Dispatch Error", e);
        res.status(500).send("Error");
    }
});

exports.glovoWebhookOrderCancel = functions.https.onRequest(async (req, res) => {
    try {
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
        const appId = "mon-bocadillo-menu";
        if (payload && payload.order_id) {
            await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("orders").doc(payload.order_id.toString()).update({ status: 'cancelled' });
        }
        res.status(200).send("OK");
    } catch (e) { res.status(500).send("Error"); }
});

exports.glovoWebhookCustomerPickup = functions.https.onRequest(async (req, res) => {
    try {
        const payload = Object.keys(req.body).length > 0 ? req.body : req.query;
        const appId = "mon-bocadillo-menu";
        if (payload && payload.order_id) {
            await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("orders").doc(payload.order_id.toString()).update({ status: 'delivered', deliveredAtLocal: Date.now() });
        }
        res.status(200).send("OK");
    } catch (e) { res.status(500).send("Error"); }
});
