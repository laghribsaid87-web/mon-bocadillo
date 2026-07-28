const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function check() {
    const snap = await db.collection('artifacts').doc('mon-bocadillo-menu').collection('public').doc('data').collection('menuItems').get();
    let found = false;
    snap.forEach(doc => {
        const item = doc.data();
        if (item.name.toLowerCase().includes('cheese')) {
            console.log("ID:", doc.id);
            console.log("Name:", item.name);
            console.log("Groups:", JSON.stringify(item.groups));
            console.log("---");
            found = true;
        }
    });
    if (!found) console.log("No cheese items found");
}
check().catch(console.error).then(() => process.exit(0));
