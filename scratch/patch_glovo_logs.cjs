const fs = require('fs');
const file = 'functions/index.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update glovoWebhookOrderDispatch fetch to log response
content = content.replace(
    /await fetch\(`https:\/\/api\.glovoapp\.com\/api\/v0\/integrations\/orders\/\$\{glovoOrder\.order_id\}\/accept`, \{\s*method: 'PUT',\s*headers: \{\s*'Authorization': GLOVO_API_TOKEN,\s*'Glovo-Store-Address-External-Id': glovoStoreId,\s*'Content-Type': 'application\/json'\s*\}\s*\}\);\s*console\.log\(`Order \$\{glovoOrder\.order_id\} Auto-Accepted.`\);/g,
    `const response = await fetch(\`https://api.glovoapp.com/api/v0/integrations/orders/\${glovoOrder.order_id}/accept\`, {
                method: 'PUT',
                headers: { 
                    'Authorization': GLOVO_API_TOKEN,
                    'Glovo-Store-Address-External-Id': glovoStoreId,
                    'Content-Type': 'application/json' 
                }
            });
            const respText = await response.text();
            console.log(\`Order \${glovoOrder.order_id} Auto-Accepted API response: \${response.status} - \${respText}\`);`
);

// 2. Update syncStatusToGlovo to log response
content = content.replace(
    /const response = await fetch\(`https:\/\/api\.glovoapp\.com\/api\/v0\/integrations\/orders\/\$\{glovoOrderId\}\/\$\{endpoint\}`, \{\s*method: 'PUT',\s*headers: \{\s*'Authorization': GLOVO_API_TOKEN,\s*'Glovo-Store-Address-External-Id': glovoStoreId,\s*'Content-Type': 'application\/json'\s*\}\s*\}\);/g,
    `const response = await fetch(\`https://api.glovoapp.com/api/v0/integrations/orders/\${glovoOrderId}/\${endpoint}\`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': GLOVO_API_TOKEN,
                        'Glovo-Store-Address-External-Id': glovoStoreId,
                        'Content-Type': 'application/json' 
                    }
                });
                const respText = await response.text();
                console.log(\`SyncStatus to Glovo API response: \${response.status} - \${respText}\`);`
);

fs.writeFileSync(file, content, 'utf8');
console.log('patched logs');
