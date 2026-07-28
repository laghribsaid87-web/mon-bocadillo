import re

with open('functions/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update orderNumber logic in CAS 2
old_order_num = 'orderNumber: glovoOrder.order_code || glovoOrder.order_id.toString().slice(-4),'
new_order_num = 'orderNumber: glovoOrder.order_code || glovoOrder.order_id.toString(),'

# 2. Add notes to order and items in CAS 2
old_items = '''            items: (glovoOrder.products || []).map(p => {
                let selectedSans = [];
                let selectedExtras = [];
                
                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        if (attr.name.toLowerCase().includes('sans')) {
                            selectedSans.push(attr.name.replace(/sans/i, '').trim());
                        } else {
                            selectedExtras.push({ name: attr.name, price: (attr.price || 0) / 100 });
                        }
                    });
                }
                
                return {
                    id: p.id,
                    name: p.name,
                    qty: p.quantity,
                    price: (p.price || 0) / 100,
                    selectedSans: selectedSans,
                    selectedExtras: selectedExtras
                };
            })'''

new_items = '''            note: glovoOrder.special_instructions || glovoOrder.observations || "",
            items: (glovoOrder.products || []).map(p => {
                let selectedSans = [];
                let selectedExtras = [];
                
                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        if (attr.name.toLowerCase().includes('sans')) {
                            selectedSans.push(attr.name.replace(/sans/i, '').trim());
                        } else {
                            selectedExtras.push({ name: attr.name, price: (attr.price || 0) / 100 });
                        }
                    });
                }
                
                return {
                    id: p.id,
                    name: p.name,
                    qty: p.quantity,
                    price: (p.price || 0) / 100,
                    selectedSans: selectedSans,
                    selectedExtras: selectedExtras,
                    note: p.special_instructions || p.instructions || p.observations || ""
                };
            })'''

content = content.replace(old_order_num, new_order_num)
if old_items in content:
    content = content.replace(old_items, new_items)
else:
    print("Failed to replace items array in index.js")

with open('functions/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("functions/index.js patched!")
