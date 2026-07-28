const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { readFileSync } = require('fs');
const sa = JSON.parse(readFileSync('../service-account.json', 'utf8'));

initializeApp({ credential: cert(sa) });
const db = getFirestore();

db.collection('glovo_logs').orderBy('receivedAt', 'desc').limit(2).get().then(snap => {
    if(snap.empty) {
        console.log('EMPTY_LOGS');
        process.exit(0);
    }
    snap.forEach(doc => {
        console.log("PAYLOAD FOUND:");
        console.log(JSON.stringify(doc.data().payload, null, 2));
    });
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
