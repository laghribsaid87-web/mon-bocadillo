const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccountKeyPath = './serviceAccountKey.json';
if (!fs.existsSync(serviceAccountKeyPath)) {
    console.error('Service account key not found at', serviceAccountKeyPath);
    process.exit(1);
}

const serviceAccount = require(serviceAccountKeyPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const appId = "mon-bocadillo-menu";

async function recoverClients() {
    console.log('Fetching Glovo orders...');
    const snapshot = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('orders')
        .where('source', '==', 'glovo')
        .get();

    console.log(`Found ${snapshot.size} Glovo orders. Processing...`);

    let recoveredCount = 0;
    
    for (const doc of snapshot.docs) {
        const orderData = doc.data();
        let phone = 'GLOVO';
        let customerName = 'Client Glovo';
        
        let hasRawText = false;
        let rawPhoneText = '';

        if (orderData.phone_text && typeof orderData.phone_text === 'object' && orderData.phone_text.stringValue) {
            rawPhoneText = orderData.phone_text.stringValue;
        } else if (orderData.phone_text && typeof orderData.phone_text === 'string') {
            rawPhoneText = orderData.phone_text;
        } else if (orderData.raw_text && typeof orderData.raw_text === 'string') {
            // Check if phone is in raw_text or phone field directly
            rawPhoneText = orderData.phone || '';
        } else {
             rawPhoneText = orderData.phone || '';
        }

        if (rawPhoneText && rawPhoneText.length > 10) {
             let phoneLines = String(rawPhoneText).split('\n').map(l => l.trim()).filter(l => l.length > 0);
             let phoneIndex = phoneLines.findIndex(l => l.replace(/[\s\-]/g, '').match(/^(\+?\d{9,15})$/));
             
             if (phoneIndex !== -1) {
                 phone = phoneLines[phoneIndex].replace(/[\s\-]/g, '').match(/(\+?\d{9,15})/)[1];
                 if (phoneIndex > 0) {
                     customerName = phoneLines[phoneIndex - 1];
                 }
             } else {
                 const cleanText = String(rawPhoneText).replace(/[\s\-]/g, '');
                 let phoneMatch = cleanText.match(/(\+?\d{9,15})/);
                 if (phoneMatch) {
                     phone = phoneMatch[1].trim();
                 }
             }
        } else if (orderData.phone && orderData.phone !== 'GLOVO' && orderData.phone !== 'Inconnu') {
             phone = orderData.phone;
             customerName = orderData.customerName || 'Client Glovo';
        }

        let cleanPhone = phone;
        if (cleanPhone && cleanPhone !== "Inconnu" && cleanPhone !== "GLOVO") {
            cleanPhone = cleanPhone.replace(/\s/g, '').replace(/^\+212/, '0');
            
            const clientRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('clients').doc(cleanPhone);
            await clientRef.set({
                phone: cleanPhone,
                name: customerName,
                source: "glovo",
                createdAt: orderData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                blocked: false,
                isDriver: false
            }, { merge: true });
            
            console.log(`Recovered client: ${customerName} - ${cleanPhone}`);
            recoveredCount++;
        }
    }
    console.log(`Successfully recovered ${recoveredCount} clients!`);
}

recoverClients().then(() => {
    console.log("Done.");
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
