const fs = require('fs');

let c = fs.readFileSync('functions/index.js', 'utf8');

const target1 = `        const newOrder = {
            userId: "glovo",
            orderNumber: glovoOrder.order_code || glovoOrder.order_id.toString().slice(-4),`;

const rep1 = `        let rawCode = glovoOrder.order_code || glovoOrder.pick_up_code || glovoOrder.pickup_code || glovoOrder.delivery_code || "";
        // Explore attributes if still not found
        if (!rawCode && glovoOrder.products && Array.isArray(glovoOrder.products)) {
            for (let p of glovoOrder.products) {
                if (p.attributes && Array.isArray(p.attributes)) {
                    for (let a of p.attributes) {
                        if (a.name && (a.name.toLowerCase().includes('code') || a.name.toLowerCase().includes('order'))) {
                            // Potentially hidden here? Unlikely but safe.
                        }
                    }
                }
            }
        }
        let strCode = String(rawCode).trim();
        let finalOrderNum = (strCode && strCode !== "undefined" && strCode.length <= 8) ? strCode : glovoOrder.order_id.toString().slice(-4);

        const newOrder = {
            userId: "glovo",
            orderNumber: finalOrderNum,`;

const target2 = `                return {
                    id: p.id,
                    name: p.name,
                    qty: p.quantity,
                    price: p.price / 100,
                    selectedSans: selectedSans,
                    selectedExtras: selectedExtras
                };`;

const rep2 = `                let modifierStrings = [];
                selectedSans.forEach(sans => modifierStrings.push(sans));
                selectedExtras.forEach(extra => {
                    let extraName = extra.name;
                    if (!extraName.toLowerCase().includes('extra') && !extraName.toLowerCase().includes('ajout') && !extraName.includes('إضافة')) {
                        extraName = '+ ' + extraName;
                    }
                    modifierStrings.push(extraName);
                });

                let finalName = p.name;
                if (modifierStrings.length > 0) {
                    finalName = finalName + ' (Sans ' + modifierStrings.join(', ') + ')';
                }

                return {
                    id: p.id,
                    name: finalName,
                    qty: p.quantity,
                    price: p.price / 100,
                    selectedSans: selectedSans,
                    selectedExtras: selectedExtras
                };`;

c = c.split(target1).join(rep1);
c = c.split(target2).join(rep2);

fs.writeFileSync('functions/index.js', c);
console.log('Applied robust fixes to index.js');
