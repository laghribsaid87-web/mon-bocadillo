const fs = require('fs');

let content = fs.readFileSync('functions/index.js', 'utf-8');

// Fix 1: Oum Rabii storeId
content = content.replace(
    /\"249396\": \{ id: \"oum_rabii\", name: \"Oum Rabii\" \}/g,
    '\"249094\": { id: \"oum_rabii\", name: \"Oum Rabii\" }'
);

// Fix 2: Order Number (pick_up_code) and glovoOrderId
content = content.replace(
    /userId: \"glovo\",\s*orderNumber: glovoOrder\.order_code \|\| glovoOrder\.order_id\.toString\(\)\.slice\(-4\),/g,
    'userId: \"glovo\",\n            glovoOrderId: glovoOrder.order_id,\n            orderNumber: glovoOrder.pick_up_code || glovoOrder.order_code || glovoOrder.order_id.toString(),'
);

// Fix 3: Auto-accept endpoint
content = content.replace(
    /const response = await fetch\(https:\/\/api\.glovoapp\.com\/webhook\/stores\/\$\{glovoStoreId\}\/orders\/\$\{glovoOrder\.order_id\}\/status, \{\s*method: 'PUT',\s*headers: \{\s*'Authorization': GLOVO_API_TOKEN,\s*'Content-Type': 'application\/json'\s*\},\s*body: JSON\.stringify\(\{ status: "ACCEPTED" \}\)\s*\}\);/g,
    'const response = await fetch(https://api.glovoapp.com/webhook/stores//orders//status, {\n                method: \\'PUT\\',\n                headers: { \n                    \\'Authorization\\': GLOVO_API_TOKEN,\n                    \\'Content-Type\\': \\'application/json\\' \n                },\n                body: JSON.stringify({ status: \"ACCEPTED\" })\n            });'
);

// Wait, the original code had a different fetch for auto-accept before I changed it today.
// Let's replace the whole auto accept block.
