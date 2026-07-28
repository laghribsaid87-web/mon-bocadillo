# -*- coding: utf-8 -*-
import re

with open('functions/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1
content = content.replace(
    '"249396": { id: "oum_rabii", name: "Oum Rabii" }',
    '"249094": { id: "oum_rabii", name: "Oum Rabii" }'
)

# Fix 2
content = content.replace(
    'orderNumber: glovoOrder.order_code || glovoOrder.order_id.toString().slice(-4),',
    'glovoOrderId: glovoOrder.order_id,\n            orderNumber: glovoOrder.pick_up_code || glovoOrder.order_code || glovoOrder.order_id.toString(),'
)

# Fix 3
old_auto_accept = re.search(r'// Auto-Accept Order via Glovo API.*?console\.error\("Failed to auto-accept order:", err\);\n        \}', content, re.DOTALL)
if old_auto_accept:
    new_auto_accept = '''// Auto-Accept Order via Glovo API
        try {
            const configSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("config").get();
            const config = configSnap.exists ? configSnap.data() : {};
            const GLOVO_API_TOKEN = config.glovoConfig?.apiToken || "76a633d6-08e1-423f-813d-008b77df13b5";
            
            const response = await fetch(https://api.glovoapp.com/webhook/stores//orders//status, {
                method: 'PUT',
                headers: { 
                    'Authorization': GLOVO_API_TOKEN,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ status: "ACCEPTED" })
            });
            const respText = await response.text();
            console.log(Order  Auto-Accepted API response:  - );
        } catch(err) {
            console.error("Failed to auto-accept order:", err);
        }'''
    content = content.replace(old_auto_accept.group(0), new_auto_accept)

# Fix 4
old_sync = re.search(r'const response = await fetch\(https://api\.glovoapp\.com/api/v0/integrations/\$\{glovoStoreId\}/orders/\$\{glovoOrderId\}/status, \{.*?body: JSON\.stringify\(\{ status: glovoStatus \}\)\n                \}\);', content, re.DOTALL)
if old_sync:
    new_sync = '''const response = await fetch(https://api.glovoapp.com/webhook/stores//orders//status, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': GLOVO_API_TOKEN,
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ status: glovoStatus })
                });'''
    content = content.replace(old_sync.group(0), new_sync)

# Fix 5
translation_helper = '''
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
'''

old_parsing = '''                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        if (attr.name.toLowerCase().includes('sans')) {
                            selectedSans.push(attr.name.replace(/sans/i, '').trim());
                        } else {
                            selectedExtras.push({ name: attr.name, price: (attr.price || 0) / 100 });
                        }
                    });
                }'''

new_parsing = '''                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        let lowerName = attr.name.toLowerCase();
                        ''' + translation_helper + '''
                        if (lowerName.includes('sans')) {
                            const rawSans = attr.name.replace(/sans/i, '').trim();
                            selectedSans.push(translateGlovoOption(rawSans));
                        } else {
                            let rawExtra = attr.name.replace(/extra/i, '').replace(/ajout/i, '').trim();
                            if (!rawExtra) rawExtra = attr.name.trim();
                            selectedExtras.push({ name: translateGlovoOption(rawExtra), price: (attr.price || 0) / 100 });
                        }
                    });
                }'''

content = content.replace(old_parsing, new_parsing)

with open('functions/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("All fixes applied successfully.")
