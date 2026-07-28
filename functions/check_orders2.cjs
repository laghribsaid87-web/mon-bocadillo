const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection('artifacts').doc('mon-bocadillo-menu').collection('public').doc('data').collection('orders').orderBy('createdAt', 'desc').limit(5).get();
    snap.forEach(doc => {
        const item = doc.data();
        console.log("Order ID:", doc.id);
        console.log("orderNumber:", item.orderNumber);
        console.log("source:", item.source);
        console.log("parsedGlovo:", item.parsedGlovo);
        console.log("createdAt:", item.createdAt?.toDate());
        console.log("---");
    });
}
check().catch(console.error).then(() => process.exit(0));
