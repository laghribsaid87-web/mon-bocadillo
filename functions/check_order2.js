const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'mon-bocadillo-menu' });

const db = admin.firestore();
const appId = "mon-bocadillo-menu";
const orderId = "101722676632";

async function checkOrder() {
    const doc = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("orders").doc(orderId).get();
    if (doc.exists) {
        console.log("Order Data storeId:", doc.data().glovoStoreId, doc.data().nearestBranch);
    } else {
        console.log("Order not found in orders collection.");
    }
}

checkOrder().then(() => process.exit(0)).catch(console.error);
