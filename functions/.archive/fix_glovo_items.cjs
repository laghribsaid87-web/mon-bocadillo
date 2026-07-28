const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { readFileSync } = require('fs');

const serviceAccount = JSON.parse(readFileSync('../service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixGlovoItems() {
    const ordersRef = db.collection('artifacts').doc('mon-bocadillo').collection('public').doc('data').collection('orders');
    const snapshot = await ordersRef.where('source', '==', 'glovo').get();
    
    let updated = 0;
    for (const doc of snapshot.docs) {
        const order = doc.data();
        if (['delivered', 'cancelled', 'rejected'].includes(order.status)) continue;
        
        let changed = false;
        if (!order.items || !Array.isArray(order.items)) continue;

        let newItems = order.items.map(item => {
            let modifierStrings = [];
            
            // Reconstruct the modifier strings from the parsed selectedSans and selectedExtras
            if (item.selectedSans && Array.isArray(item.selectedSans)) {
                item.selectedSans.forEach(sans => {
                    modifierStrings.push(sans);
                });
            }
            if (item.selectedExtras && Array.isArray(item.selectedExtras)) {
                item.selectedExtras.forEach(extra => {
                    let extraName = extra.name;
                    if (!extraName.toLowerCase().includes('extra') && !extraName.toLowerCase().includes('ajout') && !extraName.includes('إكسترا')) {
                        extraName = '+ ' + extraName;
                    }
                    modifierStrings.push(extraName);
                });
            }
            
            // Only update if it doesn't already have (Sans ...)
            if (modifierStrings.length > 0 && !item.name.includes(' (Sans ')) {
                item.name = item.name + ' (Sans ' + modifierStrings.join(', ') + ')';
                changed = true;
            }
            return item;
        });

        if (changed) {
            await doc.ref.update({ items: newItems });
            console.log(`Updated items for order ${doc.id}`);
            updated++;
        }
    }
    console.log(`Finished fixing items in ${updated} orders.`);
}

fixGlovoItems().catch(console.error);
