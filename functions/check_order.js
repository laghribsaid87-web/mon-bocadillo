const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const appId = "mon-bocadillo-menu";
const orderId = "101722676632";

async function checkOrder() {
    const doc = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("orders").doc(orderId).get();
    if (doc.exists) {
        console.log("Order Data:", doc.data());
    } else {
        console.log("Order not found in orders collection.");
    }

    // Try to find it in raw glovo
    const rawGlovo = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("Commandes_Brutes_Glovo_OumRabii").where("order_id", "==", parseInt(orderId)).get();
    if (!rawGlovo.empty) {
        console.log("Found in Commandes_Brutes_Glovo_OumRabii:", rawGlovo.docs[0].data());
    }
    
    // Check webhook logs or Commandes_Brutes_Glovo
    const rawGlovo2 = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("Commandes_Brutes_Glovo").where("order_id", "==", parseInt(orderId)).get();
    if (!rawGlovo2.empty) {
        console.log("Found in Commandes_Brutes_Glovo:", rawGlovo2.docs[0].data());
    }
    
    const rawGlovo3 = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("Commandes_Brutes_Glovo").doc(orderId).get();
    if (rawGlovo3.exists) {
        console.log("Found in Commandes_Brutes_Glovo (doc ID):", rawGlovo3.data());
    }
}

checkOrder().then(() => process.exit(0)).catch(console.error);
