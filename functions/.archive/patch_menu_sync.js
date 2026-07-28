const fs = require('fs');
const path = require('path');

const indexJsPath = path.join(__dirname, 'index.js');

const codeToAppend = `

// [NEW] Added by Antigravity: Synchronize product availability to Glovo instantly
exports.syncMenuRuptureToGlovo = functions.firestore
    .document('artifacts/{appId}/public/data/settings/config')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        const newMenu = newData.menu || [];
        const oldMenu = oldData.menu || [];

        // Find items whose outOfStock status changed
        const changedItems = newMenu.filter(newItem => {
            const oldItem = oldMenu.find(item => item.id === newItem.id);
            return oldItem && oldItem.outOfStock !== newItem.outOfStock;
        });

        if (changedItems.length === 0) return null;

        const GLOVO_STORES = ["370282", "249094"]; // Laymoune and Oum Rabii
        const GLOVO_API_TOKEN = "76a633d6-08e1-423f-813d-008b77df13b5";

        const promises = [];
        for (const item of changedItems) {
            const isAvailable = !item.outOfStock;
            
            for (const storeId of GLOVO_STORES) {
                promises.push(
                    fetch(\`https://api.glovoapp.com/webhook/stores/\${storeId}/products/\${item.id}\`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': \`Basic \${Buffer.from(GLOVO_API_TOKEN).toString('base64')}\`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ available: isAvailable })
                    }).then(async (res) => {
                        if (!res.ok) {
                            const errText = await res.text();
                            console.error(\`Failed to sync product \${item.id} to Glovo store \${storeId}: Status \${res.status} \${errText}\`);
                        } else {
                            console.log(\`Successfully synced product \${item.id} to store \${storeId}. Available: \${isAvailable}\`);
                        }
                    }).catch(err => {
                        console.error(\`Error syncing product \${item.id} to store \${storeId}\`, err);
                    })
                );
            }
        }
        
        await Promise.all(promises);
        return null;
    });
`;

let content = fs.readFileSync(indexJsPath, 'utf8');
if (!content.includes('syncMenuRuptureToGlovo')) {
    fs.appendFileSync(indexJsPath, codeToAppend);
    console.log("Appended syncMenuRuptureToGlovo successfully!");
} else {
    console.log("syncMenuRuptureToGlovo already exists.");
}
