const fs = require('fs');
let c = fs.readFileSync('functions/index.js', 'utf8');

const target1 = `        const glovoOrder = payload;
        if (!glovoOrder || !glovoOrder.order_id) {`;
const rep1 = `        const glovoOrder = payload;
        try { await db.collection('glovo_logs').add({ receivedAt: admin.firestore.FieldValue.serverTimestamp(), payload: payload }); } catch(e) {}
        if (!glovoOrder || !glovoOrder.order_id) {`;

c = c.split(target1).join(rep1);

fs.writeFileSync('functions/index.js', c);
console.log('Added loggers');
