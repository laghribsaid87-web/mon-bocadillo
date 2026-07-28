const fs = require('fs');
let c = fs.readFileSync('functions/index.js', 'utf8');

// 1. Fix order_code length
c = c.split('glovoOrder.order_code || glovoOrder.order_id.toString().slice(-4)').join('(glovoOrder.order_code && glovoOrder.order_code.length <= 6 ? glovoOrder.order_code : (glovoOrder.order_code || glovoOrder.order_id.toString()).slice(-4))');

// 2. Fix the items mapping block
const targetBlock = `                let selectedSans = [];
                let selectedExtras = [];
                
                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        if (attr.name.toLowerCase().includes('sans')) {
                            selectedSans.push(attr.name.replace(/sans/i, '').trim());
                        } else {
                            selectedExtras.push({ name: attr.name, price: (attr.price || 0) / 100 });
                        }
                    });
                }`;

const replacement = `                let selectedSans = [];
                let selectedExtras = [];
                let modifierStrings = [];
                
                if (p.attributes && Array.isArray(p.attributes)) {
                    p.attributes.forEach(attr => {
                        let attrName = attr.name;
                        if (attrName.toLowerCase().includes('sans')) {
                            let withoutSans = attrName.replace(/sans/i, '').trim();
                            selectedSans.push(withoutSans);
                            modifierStrings.push(withoutSans);
                        } else {
                            selectedExtras.push({ name: attrName, price: (attr.price || 0) / 100 });
                            let extraName = attrName;
                            if (!extraName.toLowerCase().includes('extra') && !extraName.toLowerCase().includes('ajout') && !extraName.includes('إكسترا')) {
                                extraName = '+ ' + extraName;
                            }
                            modifierStrings.push(extraName);
                        }
                    });
                }`;

c = c.split(targetBlock).join(replacement);

// 3. Fix the return blocks to include finalName
// We replace 'name: p.name,' with 'name: (modifierStrings.length > 0 ? p.name + " (Sans " + modifierStrings.join(", ") + ")" : p.name),'
c = c.replace(/name: p\.name,/g, 'name: (modifierStrings.length > 0 ? p.name + " (Sans " + modifierStrings.join(", ") + ")" : p.name),');

fs.writeFileSync('functions/index.js', c);
console.log('Fixed index.js correctly');
