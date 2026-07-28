const fs = require('fs');
const filePath = 'C:/Users/pc/Desktop/mon-bocadillo/functions/index.js';
let code = fs.readFileSync(filePath, 'utf8');

// Fix 1: syncStatusToGlovo
code = code.replace(
    /const glovoOrderId = context\.params\.orderId;\s*const appId = context\.params\.appId;/g,
    `const glovoOrderId = newData.glovoOrderId;\n        if (!glovoOrderId) return null;\n        const appId = context.params.appId;`
);

// Fix 2: glovoWebhookOrderDispatch Auto-Accept
const autoAcceptCode = `
        await db.collection("artifacts").doc(appId)
                .collection("public").doc("data")
                .collection("orders").doc(glovoOrder.order_id.toString())
                .set(newOrder);

        // Auto-Accept Order via Glovo API
        try {
            const configSnap = await db.collection("artifacts").doc(appId).collection("public").doc("data").collection("settings").doc("config").get();
            const config = configSnap.exists ? configSnap.data() : {};
            const GLOVO_API_TOKEN = config.glovoConfig?.apiToken || "76a633d6-08e1-423f-813d-008b77df13b5";
            
            await fetch(\`https://api.glovoapp.com/webhook/stores/\${glovoStoreId}/orders/\${glovoOrder.order_id}/replace_status\`, {
                method: 'PUT',
                headers: { 
                    'Authorization': \`Basic \${Buffer.from(GLOVO_API_TOKEN).toString('base64')}\`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ status: "ACCEPTED" })
            });
            console.log(\`Order \${glovoOrder.order_id} Auto-Accepted.\`);
        } catch(err) {
            console.error("Failed to auto-accept order:", err);
        }

        res.status(200).send("OK");
`;

code = code.replace(
    /await db\.collection\("artifacts"\)\.doc\(appId\)\s*\.collection\("public"\)\.doc\("data"\)\s*\.collection\("orders"\)\.doc\(glovoOrder\.order_id\.toString\(\)\)\s*\.set\(newOrder\);\s*res\.status\(200\)\.send\("OK"\);/g,
    autoAcceptCode.trim()
);

fs.writeFileSync(filePath, code);
console.log('Patch applied successfully.');
