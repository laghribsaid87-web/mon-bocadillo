const fs = require('fs');

let content = fs.readFileSync('functions/index.js', 'utf-8');

// Fix 1: Oum Rabii Store ID
content = content.replace(
    /"249396": \{ id: "oum_rabii", name: "Oum Rabii" \}/g,
    '"249094": { id: "oum_rabii", name: "Oum Rabii" }'
);

// Fix 2: newOrder mapping (orderNumber, glovoOrderId)
content = content.replace(
    /orderNumber: glovoOrder\.order_code \|\| glovoOrder\.order_id\.toString\(\)\.slice\(-4\),/g,
    'glovoOrderId: glovoOrder.order_id,\n            orderNumber: glovoOrder.pick_up_code || glovoOrder.order_code || glovoOrder.order_id.toString(),'
);
content = content.replace(
    /orderNumber: glovoOrder\.order_code \|\| glovoOrder\.order_id\.toString\(\)\.slice\(-4\),/g,
    'glovoOrderId: glovoOrder.order_id,\n            orderNumber: glovoOrder.pick_up_code || glovoOrder.order_code || glovoOrder.order_id.toString(),'
);

// Fix 3: auto-accept logic in glovoWebhookOrderDispatch
const oldAutoAccept = /\/\/ Auto-Accept Order via Glovo API[\s\S]*?console\.log\(Order \$\{glovoOrder\.order_id\} Auto-Accepted API response: \$\{resp\.status\} \$\{respText\}\);\n        \} catch\(err\) \{\n            console\.error\("Failed to auto-accept order:", err\);\n        \}/;

const newAutoAccept = // Auto-Accept Order via Glovo API
        try {
            const configSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("config").get();
            const config = configSnap.exists ? configSnap.data() : {};
            const GLOVO_API_TOKEN = config.glovoConfig?.apiToken || "76a633d6-08e1-423f-813d-008b77df13b5";
            
            const response = await fetch(\https://api.glovoapp.com/webhook/stores/\/orders/\/status\, {
                method: 'PUT',
                headers: { 
                    'Authorization': GLOVO_API_TOKEN,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ status: "ACCEPTED" })
            });
            const respText = await response.text();
            console.log(\Order \ Auto-Accepted API response: \ - \\);
        } catch(err) {
            console.error("Failed to auto-accept order:", err);
        };

content = content.replace(oldAutoAccept, newAutoAccept);

// Apply identical auto accept for Oum Rabii
content = content.replace(oldAutoAccept, newAutoAccept);

// Fix 4: syncStatusToGlovo webhook
const oldSync = /const response = await fetch\(https:\/\/api\.glovoapp\.com\/api\/v0\/integrations\/\$\{glovoStoreId\}\/orders\/\$\{glovoOrderId\}\/status, \{\s*method: 'PUT',\s*headers: \{\s*'Authorization': Basic \$\{Buffer\.from\(GLOVO_API_TOKEN \+ ":"\)\.toString\('base64'\)\},\s*'Content-Type': 'application\/json'\s*\},\s*body: JSON\.stringify\(\{ status: glovoStatus \}\)\s*\}\);/g;

const newSync = const response = await fetch(\https://api.glovoapp.com/webhook/stores/\/orders/\/status\, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': GLOVO_API_TOKEN,
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ status: glovoStatus })
                });;

content = content.replace(oldSync, newSync);

// Fix 5: Translation helper
const translationHelper = 
                        const translateGlovoOption = (text) => {
                            let lower = text.toLowerCase();
                            if (lower.includes('tomate')) return '?? ?????';
                            if (lower.includes('oignon')) return '?? ???';
                            if (lower.includes('olive')) return '?? ?????';
                            if (lower.includes('laitue') || lower.includes('salade')) return '?? ??';
                            if (lower.includes('carotte')) return '?? ????';
                            if (lower.includes('purée') || lower.includes('pomme') || lower.includes('frite')) return '?? ????';
                            if (lower.includes('mayonnaise') || lower.includes('mayo')) return '?? ???????';
                            if (lower.includes('harissa') || lower.includes('hrissa')) return '??? ?????';
                            if (lower.includes('ketchup')) return '?? ??????';
                            if (lower.includes('sauce')) return '?? ???';
                            if (lower.includes('fromage')) return '?? ?????';
                            if (lower.includes('viande') || lower.includes('hachée')) return '?? ????? ???????';
                            if (lower.includes('poulet')) return '?? ??????';
                            if (lower.includes('oeuf') || lower.includes('œuf')) return '?? ?????';
                            if (lower.includes('thon')) return '?? ?????';
                            if (lower.includes('charcuterie')) return '?? ???????';
                            if (lower.includes('saucisse')) return '?? ???????';
                            return text;
                        };
;

const oldParsing = /if \(p\.attributes && Array\.isArray\(p\.attributes\)\) \{\s*p\.attributes\.forEach\(attr => \{\s*if \(attr\.name\.toLowerCase\(\)\.includes\('sans'\)\) \{\s*selectedSans\.push\(attr\.name\.replace\(\/sans\/i, ''\)\.trim\(\)\);\s*\} else \{\s*selectedExtras\.push\(\{ name: attr\.name, price: \(attr\.price \|\| 0\) \/ 100 \}\);\s*\}\s*\}\);\s*\}/g;

const newParsing = if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        let lowerName = attr.name.toLowerCase();
                        
                        if (lowerName.includes('sans')) {
                            const rawSans = attr.name.replace(/sans/i, '').trim();
                            selectedSans.push(translateGlovoOption(rawSans));
                        } else {
                            let rawExtra = attr.name.replace(/extra/i, '').replace(/ajout/i, '').trim();
                            if (!rawExtra) rawExtra = attr.name.trim();
                            selectedExtras.push({ name: translateGlovoOption(rawExtra), price: (attr.price || 0) / 100 });
                        }
                    });
                };

content = content.replace(oldParsing, newParsing);

fs.writeFileSync('functions/index.js', content, 'utf-8');
console.log("All fixes applied successfully.");
