const fs = require('fs');
let c = fs.readFileSync('functions/index.js', 'utf8');

const regex = /let selectedSans = \[\];\s*let selectedExtras = \[\];\s*if \(p\.attributes && Array\.isArray\(p\.attributes\)\) \{\s*p\.attributes\.forEach\(attr => \{\s*if \(attr\.name\.toLowerCase\(\)\.includes\('sans'\)\) \{\s*selectedSans\.push\(attr\.name\.replace\(\/sans\/i, ''\)\.trim\(\)\);\s*\} else \{\s*selectedExtras\.push\(\{ name: attr\.name, price: \(attr\.price \|\| 0\) \/ 100 \}\);\s*\}\s*\}\);\s*\}/g;

const replacement = `let selectedSans = [];
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

c = c.replace(regex, replacement);

fs.writeFileSync('functions/index.js', c);
console.log('Fixed index.js correctly');
