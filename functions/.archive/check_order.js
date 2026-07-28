const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('C:/Users/pc/Desktop/mon-bocadillo/serviceAccountKey.json', 'utf8'));

if (process.env.FIREBASE_APP_NAME === undefined) {
    initializeApp({
        credential: cert(serviceAccount)
    });
    process.env.FIREBASE_APP_NAME = "mon-bocadillo";
}

const db = getFirestore();
const appId = "mon-bocadillo";

async function checkOrder105() {
    console.log("Searching for order 105...");
    const ordersRef = db.collection("artifacts").doc(appId).collection("public").doc("data").collection("orders");
    
    const snapshot = await ordersRef.orderBy('createdAt', 'desc').limit(200).get();
    
    let found = false;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.orderNumber === '105' || data.orderNumber === 105 || (data.glovoOrderId && data.glovoOrderId.endsWith('105'))) {
            found = true;
            console.log("\nFOUND ORDER:");
            console.log("ID:", doc.id);
            console.log("Source:", data.source);
            console.log("Status:", data.status);
            console.log("Glovo Order ID:", data.glovoOrderId);
            console.log("Nearest Branch:", data.nearestBranch?.name);
            console.log("Logs / History:");
            if (data.statusHistory) {
                console.log(JSON.stringify(data.statusHistory, null, 2));
            }
            if (data.logs) {
                console.log(JSON.stringify(data.logs, null, 2));
            }
        }
    }
    
    if (!found) {
        console.log("Order 105 not found in recent orders.");
    }
}

checkOrder105().catch(console.error);
