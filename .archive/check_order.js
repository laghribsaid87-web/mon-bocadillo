import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Read service account key
const serviceAccount = JSON.parse(fs.readFileSync('C:/Users/pc/Desktop/mon-bocadillo/serviceAccountKey.json', 'utf8'));

// Initialize Firebase Admin if not already initialized
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
    
    // We will fetch today's orders and find the one ending in 105 or with orderNumber = 105
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
            console.log("Logs / History:");
            if (data.statusHistory) {
                console.log(data.statusHistory);
            }
            if (data.logs) {
                console.log(data.logs);
            }
        }
    }
    
    if (!found) {
        console.log("Order 105 not found in recent orders.");
    }
}

checkOrder105().catch(console.error);
