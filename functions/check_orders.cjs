const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const snapshot = await db.collection('artifacts').doc('mon-bocadillo-menu').collection('public').doc('data').collection('orders')
    .orderBy('createdAt', 'desc').limit(2).get();
  
  snapshot.forEach(doc => {
    console.log('ID:', doc.id);
    const data = doc.data();
    console.log('source:', data.source);
    console.log('status:', data.status);
    console.log('glovoStoreId:', data.glovoStoreId);
    console.log('orderNumber:', data.orderNumber);
    console.log('glovoOrderId:', data.glovoOrderId);
    console.log('paymentMethod:', data.paymentMethod);
    console.log('needsAutomatorExtraction:', data.needsAutomatorExtraction);
    console.log('----------------');
  });
}
check().catch(console.error);
