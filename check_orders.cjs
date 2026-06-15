const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./functions/serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const appId = "mon-bocadillo-menu";

async function checkRecent() {
    const snap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('Commandes_Brutes_Glovo')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();
        
    console.log("Recent raw orders:");
    snap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id}, Processed: ${d.processed}, Timestamp: ${d.timestamp?.toDate()}`);
        console.log(`Payload preview: ${JSON.stringify(d).substring(0, 150)}...\n`);
    });
    
    const ordersSnap = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('orders')
        .where('source', '==', 'glovo')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
        
    console.log("Recent parsed orders:");
    ordersSnap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id}, Status: ${d.status}, Number: ${d.orderNumber}, Name: ${d.customerName}, Phone: ${d.phone}, Date: ${d.createdAt?.toDate()}`);
    });
}

checkRecent().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
