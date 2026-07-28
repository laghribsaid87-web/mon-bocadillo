const fs = require('fs');
const file = 'functions/index.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add glovoOrderId to newOrder in glovoWebhookOrderDispatch
content = content.replace(
    'orderNumber: glovoOrder.pick_up_code || glovoOrder.order_code || glovoOrder.order_id.toString(),',
    'glovoOrderId: glovoOrder.order_id,\n            orderNumber: glovoOrder.pick_up_code || glovoOrder.order_code || glovoOrder.order_id.toString(),'
);

// 2. Update auto-accept fetch in glovoWebhookOrderDispatch
content = content.replace(
    /await fetch\(`https:\/\/api\.glovoapp\.com\/webhook\/stores\/\$\{glovoStoreId\}\/orders\/\$\{glovoOrder\.order_id\}\/replace_status`, \{\s*method: 'PUT',\s*headers: \{\s*'Authorization': `Basic \$\{Buffer\.from\(GLOVO_API_TOKEN\)\.toString\('base64'\)\}`,\s*'Content-Type': 'application\/json'\s*\},\s*body: JSON\.stringify\(\{ status: "ACCEPTED" \}\)\s*\}\);/g,
    `await fetch(\`https://api.glovoapp.com/api/v0/integrations/orders/\${glovoOrder.order_id}/accept\`, {
                method: 'PUT',
                headers: { 
                    'Authorization': GLOVO_API_TOKEN,
                    'Glovo-Store-Address-External-Id': glovoStoreId,
                    'Content-Type': 'application/json' 
                }
            });`
);

// 3. Update syncStatusToGlovo
content = content.replace(
    /const glovoOrderId = context\.params\.orderId;/,
    `const glovoOrderId = newData.glovoOrderId;`
);

// update fetch in syncStatusToGlovo
content = content.replace(
    /if \(glovoStatus && glovoStoreId\) \{\s*try \{\s*const response = await fetch\(`https:\/\/api\.glovoapp\.com\/webhook\/stores\/\$\{glovoStoreId\}\/orders\/\$\{glovoOrderId\}\/replace_status`, \{\s*method: 'PUT',\s*headers: \{\s*'Authorization': `Basic \$\{Buffer\.from\(GLOVO_API_TOKEN\)\.toString\('base64'\)\}`,\s*'Content-Type': 'application\/json'\s*\},\s*body: JSON\.stringify\(\{ status: glovoStatus \}\)\s*\}\);\s*\} catch \(error\) \{\s*console\.error\("Erreur de synchronisation avec Glovo:", error\);\s*\}\s*\}/g,
    `if (glovoStatus && glovoStoreId && glovoOrderId) {
            try {
                let endpoint = glovoStatus === "ACCEPTED" ? "accept" : "ready_for_pickup";
                const response = await fetch(\`https://api.glovoapp.com/api/v0/integrations/orders/\${glovoOrderId}/\${endpoint}\`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': GLOVO_API_TOKEN,
                        'Glovo-Store-Address-External-Id': glovoStoreId,
                        'Content-Type': 'application/json' 
                    }
                });
            } catch (error) {
                console.error("Erreur de synchronisation avec Glovo:", error);
            }
        }`
);

fs.writeFileSync(file, content, 'utf8');
console.log('patched');
