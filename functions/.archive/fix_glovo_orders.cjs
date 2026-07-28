const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { readFileSync } = require('fs');

const serviceAccount = JSON.parse(readFileSync('../service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixGlovoOrders() {
    const ordersRef = db.collection('artifacts').doc('mon-bocadillo').collection('public').doc('data').collection('orders');
    const snapshot = await ordersRef.where('source', '==', 'glovo').get();
    
    let updated = 0;
    for (const doc of snapshot.docs) {
        const order = doc.data();
        // Check if orderNumber is long and if the order is still pending/preparing/ready (not delivered/cancelled)
        if (order.orderNumber && order.orderNumber.length > 6 && !['delivered', 'cancelled'].includes(order.status)) {
            const shortNum = order.orderNumber.slice(-4);
            await doc.ref.update({ orderNumber: shortNum });
            console.log(`Updated order ${doc.id}: ${order.orderNumber} -> ${shortNum}`);
            updated++;
        }
    }
    console.log(`Finished fixing ${updated} orders.`);
}

fixGlovoOrders().catch(console.error);
