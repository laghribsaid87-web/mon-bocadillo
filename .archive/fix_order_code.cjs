const fs = require('fs');
let c = fs.readFileSync('functions/index.js', 'utf8');

const target = `        const glovoStoreId = glovoOrder.store_id ? glovoOrder.store_id.toString() : "";
        const assignedBranch = GLOVO_STORES_MAP[glovoStoreId] || { id: "laymoune", name: "Laymoune" };

        const newOrder = {
            userId: "glovo",
            orderNumber: (glovoOrder.order_code && glovoOrder.order_code.length <= 6 ? glovoOrder.order_code : (glovoOrder.order_code || glovoOrder.order_id.toString()).slice(-4)),
            customerName: glovoOrder.customer?.name || "Client Glovo",`;

const replacer = `        const glovoStoreId = glovoOrder.store_id ? glovoOrder.store_id.toString() : "";
        const assignedBranch = GLOVO_STORES_MAP[glovoStoreId] || { id: "laymoune", name: "Laymoune" };

        let rawCode = glovoOrder.order_code || glovoOrder.pick_up_code || glovoOrder.pickup_code || "";
        let strCode = String(rawCode).trim();
        let finalOrderNum = (strCode && strCode !== "undefined" && strCode.length <= 8) ? strCode : glovoOrder.order_id.toString().slice(-4);

        const newOrder = {
            userId: "glovo",
            orderNumber: finalOrderNum,
            customerName: glovoOrder.customer?.name || "Client Glovo",`;

c = c.split(target).join(replacer);
fs.writeFileSync('functions/index.js', c);
console.log('Fixed order codes');
