const fs = require('fs');

let c = fs.readFileSync('functions/index.js', 'utf8');

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
                }

                let finalName = p.name;
                if (modifierStrings.length > 0) {
                    finalName = p.name + ' (Sans ' + modifierStrings.join(', ') + ')';
                }`;

// 1. First two occurrences
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

c = c.replace(targetBlock, replacement);
c = c.replace(targetBlock, replacement);

// 2. Fix the return statements for the first two occurrences
c = c.replace(/name: p\.name,\s*qty:/g, 'name: typeof finalName !== "undefined" ? finalName : p.name,\n                    qty:');

// 3. Fix the third occurrence which was messed up
const badBlock = /let selectedSans = \[\];[\s\S]*?if \(selectedSans\.length > 0\) \{[\s\S]*?\}/g;
c = c.replace(badBlock, replacement);

fs.writeFileSync('functions/index.js', c);
console.log('Fixed index.js completely');
