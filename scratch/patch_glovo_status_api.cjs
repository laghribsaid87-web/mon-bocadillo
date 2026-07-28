const fs = require('fs');
const file = 'functions/index.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update glovoWebhookOrderDispatch fetch
content = content.replace(
    /const response = await fetch\(`https:\/\/api\.glovoapp\.com\/api\/v0\/integrations\/orders\/\$\{glovoOrder\.order_id\}\/accept`, \{\s*method: 'PUT',\s*headers: \{\s*'Authorization': GLOVO_API_TOKEN,\s*'Glovo-Store-Address-External-Id': glovoStoreId,\s*'Content-Type': 'application\/json'\s*\}\s*\}\);/g,
    `const response = await fetch(\`https://api.glovoapp.com/webhook/stores/\${glovoStoreId}/orders/\${glovoOrder.order_id}/status\`, {
                method: 'PUT',
                headers: { 
                    'Authorization': GLOVO_API_TOKEN,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ status: "ACCEPTED" })
            });`
);

// 2. Update syncStatusToGlovo
content = content.replace(
    /let endpoint = glovoStatus === "ACCEPTED" \? "accept" : "ready_for_pickup";\s*const response = await fetch\(`https:\/\/api\.glovoapp\.com\/api\/v0\/integrations\/orders\/\$\{glovoOrderId\}\/\$\{endpoint\}`, \{\s*method: 'PUT',\s*headers: \{\s*'Authorization': GLOVO_API_TOKEN,\s*'Glovo-Store-Address-External-Id': glovoStoreId,\s*'Content-Type': 'application\/json'\s*\}\s*\}\);/g,
    `const response = await fetch(\`https://api.glovoapp.com/webhook/stores/\${glovoStoreId}/orders/\${glovoOrderId}/status\`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': GLOVO_API_TOKEN,
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ status: glovoStatus })
                });`
);

fs.writeFileSync(file, content, 'utf8');
console.log('patched revert to status API');
